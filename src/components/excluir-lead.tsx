"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirLead } from "@/app/coletor/actions";

export function ExcluirLead({ leadId, nome }: { leadId: string; nome: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Excluir o lead “${nome}”? O áudio também será apagado. Isso não pode ser desfeito.`)) return;
          setErro(null);
          start(async () => {
            const r = await excluirLead(leadId);
            if (!r.ok) return setErro(r.erro);
            router.push("/admin/leads");
            router.refresh();
          });
        }}
        className="btn btn-danger w-full"
      >
        {pending ? "Excluindo…" : "Excluir lead"}
      </button>
      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
