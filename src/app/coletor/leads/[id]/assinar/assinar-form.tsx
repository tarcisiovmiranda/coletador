"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Blocos } from "@/components/contrato-blocos";
import { FERRAMENTAS, parseContrato, preencher } from "@/lib/contrato-render";
import { maskCnpj, maskCpf } from "@/lib/masks";

type Props = {
  leadId: string;
  modelo: { corpo: string; titulo: string; versao: number };
  dadosLead: Record<string, string>;
  limiteAuto: number | null;
  documentoInicial: string;
  nomeInicial: string;
  linkWhatsApp: string | null;
};

const MEDICO = "contratado (+ R$ 200,00 por mês)";

export function AssinarForm(p: Props) {
  const [mensalidade, setMensalidade] = useState("700,00");
  const [plano, setPlano] = useState("");
  const [vencimento, setVencimento] = useState("10");
  const [medico, setMedico] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([...FERRAMENTAS]);
  const [limiteManual, setLimiteManual] = useState("");
  const [leuTudo, setLeuTudo] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [nome, setNome] = useState(p.nomeInicial);
  const [doc, setDoc] = useState(
    p.documentoInicial.length === 14 ? maskCnpj(p.documentoInicial) : maskCpf(p.documentoInicial),
  );
  const [temTraco, setTemTraco] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const leitura = useRef<HTMLDivElement>(null);
  const desenhando = useRef(false);
  const pontos = useRef(0);

  // pré-visualização; o texto final (e o que vale) é montado no servidor ao assinar
  const blocos = useMemo(() => {
    const limite = p.limiteAuto !== null ? p.limiteAuto.toLocaleString("pt-BR") : limiteManual.trim();
    const { texto } = preencher(
      p.modelo.corpo,
      {
        ...p.dadosLead,
        mensalidade: mensalidade.trim() || "—",
        plano: plano.trim() || "(plano a informar)",
        vencimento,
        medico_trabalho: medico ? MEDICO : "não contratado",
        limite_vidas: limite || "(a informar)",
      },
      { todas: FERRAMENTAS, marcadas },
    );
    return parseContrato(texto);
  }, [p.modelo.corpo, p.dadosLead, p.limiteAuto, mensalidade, plano, vencimento, medico, limiteManual, marcadas]);

  // contrato curto que não rola: já conta como lido
  useEffect(() => {
    const el = leitura.current;
    if (el && el.scrollHeight <= el.clientHeight + 24) setLeuTudo(true);
  }, [blocos]);

  function aoRolar() {
    const el = leitura.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLeuTudo(true);
  }

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }
  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhando.current = true;
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    pontos.current += 1;
    if (pontos.current >= 15) setTemTraco(true);
  }
  function terminar() {
    desenhando.current = false;
  }
  function limpar() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    pontos.current = 0;
    setTemTraco(false);
  }

  const alternar = (f: string) =>
    setMarcadas((m) => (m.includes(f) ? m.filter((x) => x !== f) : [...m, f]));

  const camposOk =
    plano.trim().length >= 2 &&
    marcadas.length > 0 &&
    (p.limiteAuto !== null || Number(limiteManual) >= 1) &&
    nome.trim().length >= 3 &&
    doc.replace(/\D/g, "").length >= 11;
  const podeAssinar = camposOk && leuTudo && aceite && temTraco && !enviando;

  async function assinar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/leads/${p.leadId}/assinatura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensalidade,
          plano,
          vencimento: Number(vencimento),
          medicoTrabalho: medico,
          ferramentas: FERRAMENTAS.filter((f) => marcadas.includes(f)),
          limiteVidas: p.limiteAuto === null ? Number(limiteManual) : undefined,
          signatarioNome: nome,
          signatarioDocumento: doc,
          assinaturaPng: canvas.current!.toDataURL("image/png"),
          aceite: true,
          versaoModelo: p.modelo.versao,
          limiteExibido: p.limiteAuto ?? undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; erro?: string };
      if (!r.ok || !j.id) {
        setErro(j.erro ?? "Não foi possível assinar. Tente de novo.");
        return;
      }
      setFeito(j.id);
    } catch {
      setErro("Sem conexão. Verifique a internet e toque em Assinar de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    const msg = encodeURIComponent("Olá! Segue o contrato assinado da Conformidade PJ (PDF em anexo).");
    return (
      <div className="card space-y-3 lg:max-w-xl">
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-lg font-bold text-emerald-800">
          Contrato assinado.
        </p>
        <a href={`/api/assinaturas/${feito}/pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
          Ver / baixar PDF
        </a>
        {p.linkWhatsApp && (
          <a href={`${p.linkWhatsApp}?text=${msg}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
            Abrir WhatsApp do cliente (anexe o PDF)
          </a>
        )}
        <Link href={`/coletor/leads/${p.leadId}`} className="btn btn-ghost w-full">
          Voltar ao lead
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:max-w-3xl">
      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-slate-900">1. Dados do contrato</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Mensalidade (R$)</span>
          <input name="mensalidade" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} inputMode="decimal" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Plano</span>
          <input name="plano" value={plano} onChange={(e) => setPlano(e.target.value)} className="field" autoComplete="off" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Dia do vencimento</span>
          <select name="vencimento" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="field">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="medico" checked={medico} onChange={(e) => setMedico(e.target.checked)} className="h-6 w-6" />
          <span className="font-medium text-slate-800">Contratar médico do trabalho (+ R$ 200,00 por mês)</span>
        </label>
        {p.limiteAuto !== null ? (
          <p className="text-slate-700">
            Limite de vidas pelo dia da assinatura: <strong>{p.limiteAuto.toLocaleString("pt-BR")}</strong>
          </p>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Limite de vidas (fora dos dias da feira)</span>
            <input name="limiteVidas" value={limiteManual} onChange={(e) => setLimiteManual(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="field" />
          </label>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-slate-700">Ferramentas (Anexo I)</legend>
          {FERRAMENTAS.map((f) => (
            <label key={f} className="flex items-center gap-3">
              <input type="checkbox" checked={marcadas.includes(f)} onChange={() => alternar(f)} className="h-5 w-5" />
              <span className="text-slate-800">{f}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold text-slate-900">2. Leitura do contrato</h2>
        <p className="text-sm text-slate-600">Peça ao cliente para ler e rolar até o fim para liberar a assinatura.</p>
        <div ref={leitura} onScroll={aoRolar} data-testid="leitura" className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 p-3">
          <h1 className="text-xl font-bold text-slate-900">{p.modelo.titulo}</h1>
          <Blocos blocos={blocos} />
        </div>
        {!leuTudo && <p className="text-sm font-semibold text-amber-700">Role até o fim para liberar a assinatura.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-slate-900">3. Assinatura do cliente</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Nome completo de quem assina</span>
          <input name="signatarioNome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">CPF ou CNPJ</span>
          <input
            name="signatarioDocumento"
            value={doc}
            inputMode="numeric"
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 14);
              setDoc(d.length > 11 ? maskCnpj(d) : maskCpf(d));
            }}
            className="field"
          />
        </label>
        <div>
          <canvas
            ref={canvas}
            width={600}
            height={200}
            data-testid="assinatura"
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            className="h-40 w-full rounded-xl border-2 border-dashed border-slate-400 bg-white"
            style={{ touchAction: "none" }}
          />
          <button type="button" onClick={limpar} className="btn btn-ghost mt-2 w-full">Limpar assinatura</button>
        </div>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="aceite" checked={aceite} disabled={!leuTudo} onChange={(e) => setAceite(e.target.checked)} className="h-6 w-6" />
          <span className="font-medium text-slate-800">Li e concordo com o contrato</span>
        </label>
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">{erro}</p>}
        <button type="button" onClick={assinar} disabled={!podeAssinar} className="btn btn-primary w-full">
          {enviando ? "Assinando…" : "Assinar"}
        </button>
      </section>
    </div>
  );
}
