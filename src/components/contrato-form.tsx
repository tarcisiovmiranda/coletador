"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarContrato } from "@/app/coletor/contratos/actions";
import { PAGAMENTOS } from "@/lib/contratos";
import { calcComissao, fmtCents, fmtPercent, maskBRL, parseBRL } from "@/lib/dinheiro";

export function ContratoForm({
  leadId,
  percentualBps,
  inicial,
}: {
  leadId: string;
  percentualBps: number;
  inicial?: { plano: string; valor: string; pagamento: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [valor, setValor] = useState(inicial?.valor ?? "");

  const cents = parseBRL(valor) ?? 0;
  const comissao = calcComissao(cents, percentualBps);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErro(null);
        start(async () => {
          const r = await salvarContrato(leadId, fd);
          if (!r.ok) return setErro(r.erro);
          router.push(`/coletor/leads/${leadId}`);
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Plano *</span>
        <input name="plano" defaultValue={inicial?.plano} required maxLength={120} autoComplete="off" className="field" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Valor do contrato *</span>
        <input
          name="valor"
          value={valor}
          onChange={(e) => setValor(maskBRL(e.target.value))}
          inputMode="numeric"
          placeholder="R$ 0,00"
          required
          autoComplete="off"
          className="field"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Forma de pagamento *</span>
        <select name="pagamento" defaultValue={inicial?.pagamento ?? ""} required className="field">
          <option value="" disabled>
            Selecione…
          </option>
          {PAGAMENTOS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>

      <div className="rounded-2xl bg-brand-50 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-slate-600">
          Comissão estimada ({fmtPercent(percentualBps / 100)})
        </p>
        <p className="text-2xl font-extrabold text-brand-700">{fmtCents(comissao)}</p>
        {percentualBps === 0 && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            O percentual ainda não foi definido pelo admin.
          </p>
        )}
      </div>

      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {erro}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Salvando…" : inicial ? "Salvar alterações" : "Registrar contrato"}
      </button>
    </form>
  );
}
