import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { mascararChave } from "@/lib/pix";
import { NovoColaboradorForm } from "./novo-form";
import { PixForm } from "./pix-form";
import { desativarColaborador, reativarColaborador } from "./actions";

export default async function EquipePage() {
  const admin = await requireAdmin();
  const equipe = await prisma.colaborador.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, whatsapp: true, perfil: true, ativo: true, pixChave: true, pixTipo: true },
  });

  return (
    <AppShell user={admin} title="Equipe">
      <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-6">
        <NovoColaboradorForm />
      </div>

      <div>
      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900 lg:mt-0">
        Colaboradores ({equipe.length})
      </h2>
      <ul className="grid gap-3 2xl:grid-cols-2">
        {equipe.map((c) => (
          <li key={c.id} className={`card ${c.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-900">{c.nome}</p>
                <p className="text-sm text-slate-500">
                  {c.perfil === "ADMIN" ? "Admin" : "Coletador"}
                  {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                  c.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                }`}
              >
                {c.ativo ? "Ativo" : "Desativado"}
              </span>
            </div>
            <PixForm id={c.id} tipo={c.pixTipo} atual={c.pixChave && c.pixTipo ? mascararChave(c.pixTipo, c.pixChave) : null} />
            {c.id !== admin.id && (
              <form action={c.ativo ? desativarColaborador : reativarColaborador} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className={`btn w-full lg:w-auto lg:px-8 ${c.ativo ? "btn-danger" : "btn-primary"}`}
                >
                  {c.ativo ? "Desativar acesso" : "Reativar acesso"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      </div>
      </div>
    </AppShell>
  );
}
