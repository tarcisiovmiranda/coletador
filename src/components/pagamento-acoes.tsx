"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarPagamento, resolverPagamento, type PagarResult } from "@/app/admin/pagamentos/actions";

/** Ações sobre um pagamento de comissão que ainda não terminou. */
export function PagamentoAcoes({ id, status, nome, valor }: { id: string; status: "PROCESSANDO" | "VERIFICAR"; nome: string; valor: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const rodar = (fn: () => Promise<PagarResult>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? r.mensagem : r.erro);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => rodar(() => atualizarPagamento(id))}
          className="btn btn-ghost !min-h-11 !px-4 !text-base"
        >
          Atualizar status
        </button>
        {status === "VERIFICAR" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`Você conferiu no painel do Asaas que o Pix de ${valor} para ${nome} SAIU? Isso marca como pago.`)) {
                  rodar(() => resolverPagamento(id, "pago"));
                }
              }}
              className="btn btn-primary !min-h-11 !px-4 !text-base"
            >
              Confirmar que foi pago
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    `Você conferiu no painel do Asaas que o Pix de ${valor} para ${nome} NÃO saiu? Os contratos voltam a ficar disponíveis para pagar de novo.`,
                  )
                ) {
                  rodar(() => resolverPagamento(id, "liberar"));
                }
              }}
              className="btn btn-danger !min-h-11 !px-4 !text-base"
            >
              Não saiu: liberar
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-sm font-medium text-slate-700">{msg}</p>}
    </div>
  );
}
