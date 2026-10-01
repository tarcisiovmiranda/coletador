import Link from "next/link";
import type { Contrato } from "@prisma/client";
import { cancelarContrato } from "@/app/coletor/contratos/actions";
import { STATUS_CONTRATO } from "@/lib/contratos";
import { fmtCents, fmtPercent, toCents } from "@/lib/dinheiro";
import { fmtData } from "@/lib/leads";

/** Bloco do contrato dentro da tela do lead (coletador e admin). */
export function ContratoCard({ leadId, contrato }: { leadId: string; contrato: Contrato | null }) {
  if (!contrato) {
    return (
      <Link href={`/coletor/leads/${leadId}/contrato`} className="btn btn-primary w-full">
        Registrar contrato
      </Link>
    );
  }
  const st = STATUS_CONTRATO[contrato.status];
  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Contrato</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${st.cor}`}>{st.label}</span>
      </div>
      <p className="text-lg text-slate-900">
        {contrato.plano} · <span className="font-bold">{fmtCents(toCents(contrato.valor))}</span>
      </p>
      <p className="text-slate-600">Pagamento: {contrato.pagamento}</p>
      <p className="text-slate-600">
        Comissão ({fmtPercent(contrato.comissaoPercentual ?? 0)}):{" "}
        <span className="font-bold text-slate-900">{fmtCents(toCents(contrato.comissaoValor))}</span>
        {contrato.status !== "APROVADO" && " (a confirmar)"}
      </p>
      {contrato.aprovadoEm && (
        <p className="text-sm text-slate-500">
          Aprovado por {contrato.aprovadoPorNome} em {fmtData(contrato.aprovadoEm)}
        </p>
      )}
      {contrato.status === "PENDENTE" && (
        <div className="grid gap-2 pt-1">
          <Link href={`/coletor/leads/${leadId}/contrato`} className="btn btn-ghost w-full">
            Editar contrato
          </Link>
          <form action={cancelarContrato}>
            <input type="hidden" name="id" value={contrato.id} />
            <button type="submit" className="btn btn-danger w-full">
              Cancelar contrato
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
