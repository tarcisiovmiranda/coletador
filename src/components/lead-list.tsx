import Link from "next/link";
import type { EtapaKanban } from "@prisma/client";
import { etapaInfo, fmtData } from "@/lib/leads";

export type ItemLead = {
  id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  etapaKanban: EtapaKanban;
  audioKey: string | null;
  createdAt: Date;
  colaborador?: { nome: string };
};

export function LeadList({ leads, vazio }: { leads: ItemLead[]; vazio: string }) {
  if (leads.length === 0) {
    return <p className="card text-center text-slate-500">{vazio}</p>;
  }
  return (
    <ul className="space-y-3">
      {leads.map((l) => {
        const e = etapaInfo(l.etapaKanban);
        return (
          <li key={l.id}>
            <Link href={`/coletor/leads/${l.id}`} className="card block active:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{l.nome}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[l.cargo, l.empresa].filter(Boolean).join(" · ") || "Sem empresa"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${e.cor}`}>
                  {e.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {fmtData(l.createdAt)}
                {l.colaborador ? ` · ${l.colaborador.nome}` : ""}
                {l.audioKey ? " · 🎙️ com áudio" : ""}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
