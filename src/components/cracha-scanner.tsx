"use client";

import { useRef, useState } from "react";
import { reduzirFoto } from "@/lib/foto";

export type CamposCracha = {
  nome: string;
  empresa: string;
  cargo: string;
  whatsapp: string;
  cnpj: string;
  inscricao: string;
};

type Estado = { tipo: "parado" } | { tipo: "lendo" } | { tipo: "ok"; n: number } | { tipo: "erro"; msg: string };

/** Tira a foto do crachá, manda para leitura e devolve os campos para preencher o formulário. */
export function CrachaScanner({ onLido }: { onLido: (c: CamposCracha) => number }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const entrada = useRef<HTMLInputElement>(null);

  async function ler(arquivo: File) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setEstado({ tipo: "erro", msg: "Sem internet para ler o crachá. Preencha à mão: o lead será salvo e enviado depois." });
      return;
    }
    setEstado({ tipo: "lendo" });
    try {
      const foto = await reduzirFoto(arquivo);
      const r = await fetch("/api/crachas/ler", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: foto,
      });
      const j = (await r.json().catch(() => null)) as { erro?: string; campos?: CamposCracha } | null;
      if (!r.ok || !j?.campos) {
        setEstado({ tipo: "erro", msg: j?.erro ?? "Não consegui ler o crachá. Preencha à mão." });
        return;
      }
      const n = onLido(j.campos);
      setEstado(
        n > 0
          ? { tipo: "ok", n }
          : { tipo: "erro", msg: "O crachá foi lido, mas não trouxe dados novos para preencher." },
      );
    } catch {
      setEstado({ tipo: "erro", msg: "Sem conexão para ler o crachá. Preencha à mão." });
    } finally {
      if (entrada.current) entrada.current.value = ""; // permite fotografar de novo
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-brand-50 p-3">
      <label className={`btn btn-primary w-full cursor-pointer ${estado.tipo === "lendo" ? "opacity-60" : ""}`}>
        {estado.tipo === "lendo" ? "Lendo crachá…" : "📷 Ler crachá com a câmera"}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={estado.tipo === "lendo"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void ler(f);
          }}
        />
      </label>
      {estado.tipo === "ok" && (
        <p role="status" className="text-center text-sm font-semibold text-emerald-800">
          {estado.n} {estado.n === 1 ? "campo preenchido" : "campos preenchidos"}. Confira os destacados antes de salvar.
        </p>
      )}
      {estado.tipo === "erro" && (
        <p role="alert" className="text-center text-sm font-semibold text-red-700">
          {estado.msg}
        </p>
      )}
      {estado.tipo === "parado" && (
        <p className="text-center text-sm text-slate-600">Enquadre o crachá de frente, com boa luz.</p>
      )}
    </div>
  );
}
