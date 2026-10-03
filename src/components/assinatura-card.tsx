import Link from "next/link";
import { fmtData } from "@/lib/leads";

export type AssinaturaResumo = { id: string; assinadoEm: Date; signatarioNome: string };

/** Bloco "Contrato de adesão" na tela do lead (coletador e admin). */
export function AssinaturaCard({ leadId, assinaturas }: { leadId: string; assinaturas: AssinaturaResumo[] }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-bold text-slate-900">Contrato de adesão</h2>
      {assinaturas.length === 0 && <p className="text-slate-600">Ainda não assinado.</p>}
      {assinaturas.map((a) => (
        <p key={a.id} className="text-slate-700">
          Assinado por <strong>{a.signatarioNome}</strong> em {fmtData(a.assinadoEm)} ·{" "}
          <a href={`/api/assinaturas/${a.id}/pdf`} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-700 underline">
            Baixar PDF
          </a>
        </p>
      ))}
      <Link href={`/coletor/leads/${leadId}/assinar`} className="btn btn-primary w-full">
        {assinaturas.length ? "Assinar novamente" : "Coletar assinatura"}
      </Link>
    </section>
  );
}
