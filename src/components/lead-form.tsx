"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarLead } from "@/app/coletor/actions";
import { VAZIO, type Valores } from "@/lib/lead-valores";
import {
  CAMPOS_COMPLETOS,
  ORDEM_TELA,
  PAISES,
  SEXOS,
  UFS,
  validarLead,
  type ErroCampo,
} from "@/lib/leads";
import { guardar, remover } from "@/lib/outbox";
import { sincronizar } from "@/lib/sync";
import { maskCep, maskCnpj, maskCpf, maskDdi, maskWhats } from "@/lib/masks";
import { interpretarCodigo } from "@/lib/codigo-cracha";
import { CrachaScanner } from "./cracha-scanner";
import { LeitorCodigo } from "./leitor-codigo";
import { AudioRecorder } from "./audio-recorder";

export function LeadForm({
  leadId,
  inicial,
  userId,
}: {
  leadId?: string;
  inicial?: Valores;
  userId?: string; // dono dos leads novos (fila offline)
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erros, setErros] = useState<string[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [completoAberto, setCompletoAberto] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const editando = Boolean(leadId);
  const formRef = useRef<HTMLFormElement>(null);
  const v = inicial ?? VAZIO;

  // no desktop sobra espaço: a seção de dados completos já abre; no celular fica recolhida
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCompletoAberto(true);
  }, []);

  /**
   * Preenche campos vindos de uma leitura (foto do crachá, código de barras ou CEP) e destaca para conferência.
   * Não sobrescreve o que o coletador digitou; campos que vieram de uma leitura anterior podem ser
   * trocados (ler outro crachá substitui os dados do primeiro).
   */
  function preencher(c: Partial<Record<string, string>>): number {
    const form = formRef.current;
    if (!form) return 0;
    const mascara: Record<string, (v: string) => string> = { whatsapp: maskWhats, cnpj: maskCnpj, cpf: maskCpf, cep: maskCep };
    let n = 0;
    for (const [nome, valor] of Object.entries(c)) {
      const el = form.elements.namedItem(nome);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !valor) continue;
      if (el.value.trim() && el.dataset.lido !== "1") continue;
      const novo = mascara[nome] ? mascara[nome](valor) : valor;
      if (el.value === novo) continue;
      el.value = novo;
      if (el.value !== novo) continue; // <select> sem essa opção
      el.dataset.lido = "1";
      delete el.dataset.invalido;
      n++;
    }
    return n;
  }

  /** CEP completo → busca o endereço (ViaCEP). Só ajuda: falhou ou sem internet, o coletador digita. */
  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return setCepMsg(null);
    const pais = (formRef.current?.elements.namedItem("pais") as HTMLInputElement | null)?.value ?? "Brasil";
    if (pais.trim().toLowerCase() !== "brasil") return;
    setCepMsg("Buscando endereço…");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) });
      const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!r.ok || j.erro) return setCepMsg("CEP não encontrado. Preencha o endereço à mão.");
      const n = preencher({ endereco: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" });
      setCepMsg(n > 0 ? "Endereço preenchido pelo CEP. Confira os campos destacados." : null);
    } catch {
      setCepMsg(null); // sem internet: segue manual
    }
  }

  function marcarInvalidos(lista: ErroCampo[]) {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLElement>("[data-invalido]").forEach((e) => delete e.dataset.invalido);
    for (const e of lista) {
      const el = form.elements.namedItem(e.campo);
      if (el instanceof HTMLElement) el.dataset.invalido = "1";
    }
    // o primeiro campo com problema, na ordem da tela
    const primeiro = [...form.elements].find((e) => e instanceof HTMLElement && e.dataset.invalido === "1") as HTMLElement | undefined;
    if (primeiro) {
      // a seção recolhida precisa estar aberta para o campo poder receber o foco
      setTimeout(() => {
        primeiro.focus({ preventScroll: true });
        primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
    }
  }

  function enviar(formData: FormData) {
    setErros([]);
    start(async () => {
      if (leadId) {
        const r = await atualizarLead(leadId, formData);
        if (!r.ok) return setErros([r.erro]);
        router.push(`/coletor/leads/${r.id}`);
        router.refresh();
        return;
      }

      // Lead novo: valida aqui (funciona sem rede), grava no aparelho PRIMEIRO e só então tenta enviar.
      // Assim nada se perde se a rede cair, o app fechar ou o celular reiniciar.
      const campos = Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
      const ok = validarLead(campos);
      if (!ok.ok) return mostrarErros(ok.erros);
      if (!userId) return setErros(["Sessão inválida. Recarregue a página."]);

      const clientId = crypto.randomUUID();
      try {
        await guardar({
          clientId,
          colaboradorId: userId,
          campos,
          audio,
          audioMime: audio ? (audio.type || "audio/webm").split(";")[0] : null,
          tentativas: 0,
          criadoEm: Date.now(),
        });
      } catch {
        return setErros(["Não foi possível salvar no aparelho. Verifique o armazenamento do navegador."]);
      }

      const rodada = await sincronizar(userId, clientId);
      const r = rodada.resultados[clientId];
      if (r?.status === "enviado") {
        const aviso = r.avisoAudio ? `?audio=${encodeURIComponent(r.avisoAudio)}` : "";
        router.push(`/coletor/leads/${r.serverId}${aviso}`);
        router.refresh();
      } else if (r?.status === "erro") {
        await remover(clientId); // recusado pelo servidor: corrija o formulário
        setErros([r.erro]);
      } else {
        router.push("/coletor"); // sem rede/sessão: fica na fila e sobe sozinho
      }
    });
  }

  /** Lista o que falta, abre a seção "Dados completos" se preciso e leva ao primeiro campo com problema. */
  function mostrarErros(entrada: ErroCampo[]) {
    const lista = [...entrada].sort((a, b) => ORDEM_TELA.indexOf(a.campo) - ORDEM_TELA.indexOf(b.campo));
    setErros(lista.map((e) => e.mensagem));
    if (lista.some((e) => (CAMPOS_COMPLETOS as readonly string[]).includes(e.campo))) {
      setCompletoAberto(true);
      // abre já, no DOM: campo dentro de <details> fechado não recebe foco
      const det = formRef.current?.querySelector("details");
      if (det) det.open = true;
    }
    marcarInvalidos(lista);
  }

  return (
    <form
      ref={formRef}
      noValidate // a validação é nossa: o navegador não consegue focar campo dentro de seção recolhida
      onInput={(e) => {
        if (e.target instanceof HTMLElement) {
          delete e.target.dataset.lido; // editou: não precisa mais conferir
          delete e.target.dataset.invalido;
        }
      }}
      onSubmit={(e) => {
        e.preventDefault(); // sem <form action>: o React não limpa os campos quando há erro
        const fd = new FormData(e.currentTarget);
        if (editando) {
          const r = validarLead(Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === "string")));
          if (!r.ok) return mostrarErros(r.erros);
        }
        enviar(fd);
      }}
      className="space-y-4"
    >
      {!editando && (
        <CrachaScanner onLido={preencher} extra={<LeitorCodigo onLido={(texto) => preencher(interpretarCodigo(texto))} />} />
      )}

      <section aria-label="Dados do visitante" className="grid gap-3 lg:grid-cols-2">
        <Campo
          label="Nome completo"
          obrigatorio
          name="nome"
          def={v.nome}
          autoFocus={!editando}
          onBlur={(e) => {
            // sugere o nome da credencial a partir do nome (o coletador confere)
            const cred = formRef.current?.elements.namedItem("nomeCredencial");
            if (cred instanceof HTMLInputElement && !cred.value.trim() && e.currentTarget.value.trim()) {
              cred.value = e.currentTarget.value.trim().slice(0, 60);
              cred.dataset.lido = "1";
            }
          }}
        />
        <Campo label="Nome da empresa" obrigatorio name="empresa" def={v.empresa} />
        <Campo label="Cargo" obrigatorio name="cargo" def={v.cargo} />
        <Telefone label="Telefone celular" obrigatorio nomeNum="whatsapp" nomeDdi="whatsappDdi" defNum={v.whatsapp} defDdi={v.whatsappDdi} />
        <Campo label="E-mail" obrigatorio name="email" def={v.email} type="email" inputMode="email" ph="nome@empresa.com.br" max={120} />
        <Campo label="CNPJ" name="cnpj" def={v.cnpj} inputMode="numeric" ph="00.000.000/0000-00" mask={maskCnpj} max={18} />
        <Campo label="Nº de inscrição" name="inscricao" def={v.inscricao} />
      </section>

      <details
        open={completoAberto}
        onToggle={(e) => setCompletoAberto(e.currentTarget.open)}
        className="rounded-2xl border border-slate-200 bg-white"
      >
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-base font-bold text-slate-800">
          <span>Dados completos (credenciamento)</span>
          <span className="text-xs font-semibold text-slate-500">tem campos obrigatórios *</span>
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-4 lg:grid-cols-2">
          <Campo label="CPF" obrigatorio name="cpf" def={v.cpf} inputMode="numeric" ph="000.000.000-00" mask={maskCpf} max={14} />
          <Campo label="Nome na credencial" obrigatorio name="nomeCredencial" def={v.nomeCredencial} ph="Como será impresso no crachá" max={60} />
          <Selecao label="Sexo" obrigatorio name="sexo" def={v.sexo} opcoes={[...SEXOS]} />
          <Campo label="Data de nascimento" obrigatorio name="dataNascimento" def={v.dataNascimento} type="date" />
          <div>
            <Campo
              label="CEP"
              obrigatorio
              name="cep"
              def={v.cep}
              inputMode="numeric"
              ph="00000-000"
              max={20}
              mask={(x) => {
                const pais = (formRef.current?.elements.namedItem("pais") as HTMLInputElement | null)?.value ?? "Brasil";
                return pais.trim().toLowerCase() === "brasil" ? maskCep(x) : x;
              }}
              aoMudar={buscarCep}
            />
            {cepMsg && <p className="mt-1 text-xs font-medium text-slate-500">{cepMsg}</p>}
          </div>
          <Campo label="Endereço" obrigatorio name="endereco" def={v.endereco} max={200} />
          <Campo label="Número" obrigatorio name="numero" def={v.numero} max={20} />
          <Campo label="Complemento" name="complemento" def={v.complemento} max={100} />
          <Campo label="Bairro" obrigatorio name="bairro" def={v.bairro} max={100} />
          <Campo label="País" obrigatorio name="pais" def={v.pais} max={60} lista="lista-paises" />
          <datalist id="lista-paises">
            {PAISES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <Selecao label="UF" obrigatorio name="uf" def={v.uf} opcoes={[...UFS]} />
          <Campo label="Cidade" obrigatorio name="cidade" def={v.cidade} max={100} />
          <Telefone label="Telefone fixo" nomeNum="telefoneFixo" nomeDdi="telefoneFixoDdi" defNum={v.telefoneFixo} defDdi={v.telefoneFixoDdi} />
        </div>
      </details>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Observações</span>
        <textarea
          name="observacoes"
          defaultValue={v.observacoes}
          rows={4}
          maxLength={2000}
          className="field !min-h-28 py-3"
        />
      </label>

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">
          {editando ? "Novo áudio (substitui o atual)" : "Áudio"}
        </span>
        <AudioRecorder onChange={setAudio} />
      </div>

      {erros.length > 0 && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
          <p className="font-bold">{erros.length === 1 ? "Corrija este campo:" : `Corrija estes ${erros.length} campos:`}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-medium">
            {erros.slice(0, 20).map((m) => (
              <li key={m}>{m}</li>
            ))}
            {erros.length > 20 && <li>…e mais {erros.length - 20}.</li>}
          </ul>
        </div>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Salvando…" : editando ? "Salvar alterações" : "Salvar lead"}
      </button>
    </form>
  );
}

const Rotulo = ({ texto, obrigatorio }: { texto: string; obrigatorio?: boolean }) => (
  <span className="mb-1 block text-sm font-semibold text-slate-700">
    {texto}
    {obrigatorio && <span className="text-red-600"> *</span>}
  </span>
);

function Campo(p: {
  label: string;
  name: string;
  def: string;
  obrigatorio?: boolean;
  type?: string;
  inputMode?: "tel" | "numeric" | "email";
  ph?: string;
  autoFocus?: boolean;
  mask?: (v: string) => string;
  max?: number;
  lista?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  aoMudar?: (valor: string) => void;
}) {
  return (
    <label className="block">
      <Rotulo texto={p.label} obrigatorio={p.obrigatorio} />
      <input
        name={p.name}
        defaultValue={p.def}
        type={p.type ?? "text"}
        inputMode={p.inputMode}
        placeholder={p.ph}
        autoFocus={p.autoFocus}
        autoComplete="off"
        autoCapitalize={p.type === "email" ? "none" : undefined}
        spellCheck={p.type === "email" ? false : undefined}
        maxLength={p.max}
        list={p.lista}
        onBlur={p.onBlur}
        onInput={(e) => {
          if (p.mask) e.currentTarget.value = p.mask(e.currentTarget.value);
          p.aoMudar?.(e.currentTarget.value);
        }}
        className="field"
      />
    </label>
  );
}

function Selecao(p: { label: string; name: string; def: string; obrigatorio?: boolean; opcoes: string[] }) {
  return (
    <label className="block">
      <Rotulo texto={p.label} obrigatorio={p.obrigatorio} />
      <select name={p.name} defaultValue={p.def} className="field">
        <option value="">Selecione</option>
        {p.opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** DDI + número. Com DDI 55 o número ganha a máscara brasileira; em outros países fica livre. */
function Telefone(p: {
  label: string;
  nomeNum: string;
  nomeDdi: string;
  defNum: string;
  defDdi: string;
  obrigatorio?: boolean;
}) {
  const numero = useRef<HTMLInputElement>(null);
  const aplicarMascara = (ddi: string) => {
    const el = numero.current;
    if (!el) return;
    el.value = ddi === "55" ? maskWhats(el.value) : el.value.replace(/[^\d\s()+-]/g, "").slice(0, 20);
  };
  return (
    <div>
      <Rotulo texto={p.label} obrigatorio={p.obrigatorio} />
      <div className="flex gap-2">
        <div className="relative w-24 shrink-0">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">+</span>
          <input
            name={p.nomeDdi}
            defaultValue={p.defDdi}
            inputMode="numeric"
            aria-label={`DDI do ${p.label.toLowerCase()}`}
            placeholder="55"
            autoComplete="off"
            maxLength={3}
            onInput={(e) => {
              e.currentTarget.value = maskDdi(e.currentTarget.value);
              aplicarMascara(e.currentTarget.value);
            }}
            className="field !pl-7"
          />
        </div>
        <input
          ref={numero}
          name={p.nomeNum}
          defaultValue={p.defNum}
          type="tel"
          inputMode="tel"
          aria-label={p.label}
          placeholder="(11) 99999-9999"
          autoComplete="off"
          maxLength={20}
          onInput={(e) => {
            const ddi = (e.currentTarget.form?.elements.namedItem(p.nomeDdi) as HTMLInputElement | null)?.value || "55";
            e.currentTarget.value = ddi === "55" ? maskWhats(e.currentTarget.value) : e.currentTarget.value.replace(/[^\d\s()+-]/g, "");
          }}
          className="field min-w-0 flex-1"
        />
      </div>
    </div>
  );
}
