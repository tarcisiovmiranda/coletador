"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarLead, criarLead } from "@/app/coletor/actions";
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

export async function enviarAudioDoLead(id: string, blob: Blob): Promise<string | null> {
  try {
    const r = await fetch(`/api/leads/${id}/audio`, {
      method: "POST",
      headers: { "Content-Type": (blob.type || "audio/webm").split(";")[0] },
      body: blob,
    });
    if (r.ok) return null;
    return ((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? "Falha no envio do áudio.";
  } catch {
    return "Sem conexão para enviar o áudio.";
  }
}

export function LeadForm({ leadId, inicial }: { leadId?: string; inicial?: Valores }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const editando = Boolean(leadId);
  const v = inicial ?? VAZIO;

  function enviar(formData: FormData) {
    setErro(null);
    start(async () => {
      const r = leadId ? await atualizarLead(leadId, formData) : await criarLead(formData);
      if (!r.ok) return setErro(r.erro);
      // o lead já está salvo; falha no áudio não perde o cadastro
      let aviso = "";
      if (audio) {
        const e = await enviarAudioDoLead(r.id, audio);
        if (e) aviso = `?audio=${encodeURIComponent(e)}`;
      }
      router.push(`/coletor/leads/${r.id}${aviso}`);
      router.refresh();
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
      <Campo label="WhatsApp" name="whatsapp" def={v.whatsapp} type="tel" inputMode="tel" ph="(11) 99999-9999" />
      <Campo label="CNPJ" name="cnpj" def={v.cnpj} inputMode="numeric" ph="00.000.000/0000-00" />
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
        className="field"
      />
    </label>
  );
}
