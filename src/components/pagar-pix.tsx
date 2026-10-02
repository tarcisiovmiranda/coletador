"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pagarComissao } from "@/app/admin/pagamentos/actions";

/** Botão "Pagar via Pix": mostra tudo o que será feito e só envia depois da confirmação. */
export function PagarPix({
  colaboradorId,
  nome,
  valor,
  tipo,
  chave,
  teste,
}: {
  colaboradorId: string;
  nome: string;
  valor: string;
  tipo: string;
  chave: string;
  teste: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ok = confirm(
            `Pagar ${valor} por Pix para ${nome}?\n\nChave (${tipo}): ${chave}\n\n` +
              (teste
                ? "AMBIENTE DE TESTE: nenhum dinheiro real será movido."
                : "ATENÇÃO: é DINHEIRO REAL e não pode ser desfeito."),
          );
          if (!ok) return;
          setMsg(null);
          start(async () => {
            const r = await pagarComissao(colaboradorId);
            setMsg(r.ok ? { ok: true, texto: r.mensagem } : { ok: false, texto: r.erro });
            router.refresh();
          });
        }}
        className="btn btn-primary w-full lg:w-auto lg:px-6"
      >
        {pending ? "Enviando Pix…" : `Pagar ${valor} via Pix`}
      </button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {msg.texto}
        </p>
      )}
    </div>
  );
}
