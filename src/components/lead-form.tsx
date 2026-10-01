"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarLead } from "@/app/coletor/actions";
import { leadSchema } from "@/lib/leads";
import { guardar, remover } from "@/lib/outbox";
import { sincronizar } from "@/lib/sync";
import { fmtCnpj, fmtWhats } from "@/lib/leads";
import { maskCnpj, maskWhats } from "@/lib/masks";
import { AudioRecorder } from "./audio-recorder";

type Valores = {
  nome: string;
  cargo: string;
  empresa: string;
  inscricao: string;
  whatsapp: string;
  cnpj: string;
  observacoes: string;
};

const VAZIO: Valores = {
  nome: "",
  cargo: "",
  empresa: "",
  inscricao: "",
  whatsapp: "",
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
      onSubmit={(e) => {
        e.preventDefault(); // sem <form action>: o React não limpa os campos quando há erro
        enviar(new FormData(e.currentTarget));
      }}
      className="space-y-3"
    >
      <Campo label="Nome *" name="nome" def={v.nome} required autoFocus={!editando} />
      <Campo label="Empresa" name="empresa" def={v.empresa} />
      <Campo label="Cargo" name="cargo" def={v.cargo} />
      <Campo label="WhatsApp" name="whatsapp" def={fmtWhats(v.whatsapp)} type="tel" inputMode="tel" ph="(11) 99999-9999" mask={maskWhats} max={15} />
      <Campo label="CNPJ" name="cnpj" def={fmtCnpj(v.cnpj)} inputMode="numeric" ph="00.000.000/0000-00" mask={maskCnpj} max={18} />
      <Campo label="Nº de inscrição" name="inscricao" def={v.inscricao} />
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
  inputMode?: "tel" | "numeric";
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
        maxLength={p.max}
        onInput={p.mask ? (e) => (e.currentTarget.value = p.mask!(e.currentTarget.value)) : undefined}
        className="field"
      />
    </label>
  );
}
