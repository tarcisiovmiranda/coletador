"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarLead } from "@/app/coletor/actions";
import { leadSchema } from "@/lib/leads";
import { guardar, remover } from "@/lib/outbox";
import { sincronizar } from "@/lib/sync";
import { fmtCnpj, fmtWhats } from "@/lib/leads";
import { maskCnpj, maskWhats } from "@/lib/masks";
import { interpretarCodigo } from "@/lib/codigo-cracha";
import { CrachaScanner } from "./cracha-scanner";
import { LeitorCodigo } from "./leitor-codigo";
import { AudioRecorder } from "./audio-recorder";

type Valores = {
  nome: string;
  cargo: string;
  empresa: string;
  inscricao: string;
  whatsapp: string;
  email: string;
  cnpj: string;
  observacoes: string;
};

const VAZIO: Valores = {
  nome: "",
  cargo: "",
  empresa: "",
  inscricao: "",
  whatsapp: "",
  email: "",
  cnpj: "",
  observacoes: "",
};

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
  const [erro, setErro] = useState<string | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const editando = Boolean(leadId);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Preenche campos vindos de uma leitura (foto do crachá ou código de barras) e destaca para conferência.
   * Não sobrescreve o que o coletador digitou; campos que vieram de uma leitura anterior podem ser
   * trocados (ler outro crachá substitui os dados do primeiro).
   */
  function preencher(c: Partial<Record<string, string>>): number {
    const form = formRef.current;
    if (!form) return 0;
    const mascara: Record<string, (v: string) => string> = { whatsapp: maskWhats, cnpj: maskCnpj };
    let n = 0;
    for (const [nome, valor] of Object.entries(c)) {
      const el = form.elements.namedItem(nome);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !valor) continue;
      if (el.value.trim() && el.dataset.lido !== "1") continue;
      const novo = mascara[nome] ? mascara[nome](valor) : valor;
      if (el.value === novo) continue;
      el.value = novo;
      el.dataset.lido = "1";
      n++;
    }
    return n;
  }
  const v = inicial ?? VAZIO;

  function enviar(formData: FormData) {
    setErro(null);
    start(async () => {
      if (leadId) {
        const r = await atualizarLead(leadId, formData);
        if (!r.ok) return setErro(r.erro);
        router.push(`/coletor/leads/${r.id}`);
        router.refresh();
        return;
      }

      // Lead novo: valida aqui (funciona sem rede), grava no aparelho PRIMEIRO e só então tenta enviar.
      // Assim nada se perde se a rede cair, o app fechar ou o celular reiniciar.
      const campos = Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
      const ok = leadSchema.safeParse(campos);
      if (!ok.success) return setErro(ok.error.issues[0].message);
      if (!userId) return setErro("Sessão inválida. Recarregue a página.");

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
        return setErro("Não foi possível salvar no aparelho. Verifique o armazenamento do navegador.");
      }

      const rodada = await sincronizar(userId, clientId);
      const r = rodada.resultados[clientId];
      if (r?.status === "enviado") {
        const aviso = r.avisoAudio ? `?audio=${encodeURIComponent(r.avisoAudio)}` : "";
        router.push(`/coletor/leads/${r.serverId}${aviso}`);
        router.refresh();
      } else if (r?.status === "erro") {
        await remover(clientId); // recusado pelo servidor: corrija o formulário
        setErro(r.erro);
      } else {
        router.push("/coletor"); // sem rede/sessão: fica na fila e sobe sozinho
      }
    });
  }

  return (
    <form
      ref={formRef}
      onInput={(e) => {
        if (e.target instanceof HTMLElement) delete e.target.dataset.lido; // editou: não precisa mais conferir
      }}
      onSubmit={(e) => {
        e.preventDefault(); // sem <form action>: o React não limpa os campos quando há erro
        enviar(new FormData(e.currentTarget));
      }}
      className="space-y-3"
    >
      {!editando && (
        <CrachaScanner onLido={preencher} extra={<LeitorCodigo onLido={(texto) => preencher(interpretarCodigo(texto))} />} />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
      <Campo label="Nome *" name="nome" def={v.nome} required autoFocus={!editando} />
      <Campo label="Empresa" name="empresa" def={v.empresa} />
      <Campo label="Cargo" name="cargo" def={v.cargo} />
      <Campo label="WhatsApp" name="whatsapp" def={fmtWhats(v.whatsapp)} type="tel" inputMode="tel" ph="(11) 99999-9999" mask={maskWhats} max={15} />
      <Campo label="E-mail" name="email" def={v.email} type="email" inputMode="email" ph="nome@empresa.com.br" max={120} />
      <Campo label="CNPJ" name="cnpj" def={fmtCnpj(v.cnpj)} inputMode="numeric" ph="00.000.000/0000-00" mask={maskCnpj} max={18} />
      <Campo label="Nº de inscrição" name="inscricao" def={v.inscricao} />
      </div>
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

      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {erro}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Salvando…" : editando ? "Salvar alterações" : "Salvar lead"}
      </button>
    </form>
  );
}

function Campo(p: {
  label: string;
  name: string;
  def: string;
  required?: boolean;
  type?: string;
  inputMode?: "tel" | "numeric" | "email";
  ph?: string;
  autoFocus?: boolean;
  mask?: (v: string) => string;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{p.label}</span>
      <input
        name={p.name}
        defaultValue={p.def}
        required={p.required}
        type={p.type ?? "text"}
        inputMode={p.inputMode}
        placeholder={p.ph}
        autoFocus={p.autoFocus}
        autoComplete="off"
        autoCapitalize={p.type === "email" ? "none" : undefined}
        spellCheck={p.type === "email" ? false : undefined}
        maxLength={p.max}
        onInput={p.mask ? (e) => (e.currentTarget.value = p.mask!(e.currentTarget.value)) : undefined}
        className="field"
      />
    </label>
  );
}
