-- Etapas do kanban deixam de ser um enum fixo e viram uma tabela editável pelo admin.

CREATE TABLE "etapas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "fechamento" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "etapas_tenant_id_nome_key" ON "etapas"("tenant_id", "nome");
CREATE INDEX "etapas_tenant_id_ordem_idx" ON "etapas"("tenant_id", "ordem");
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- As 6 etapas atuais, para cada tenant. O id carrega a chave antiga só para ligar os leads abaixo.
INSERT INTO "etapas" ("id", "tenant_id", "nome", "cor", "ordem", "fechamento")
SELECT 'etapa_' || t."id" || '_' || e."chave", t."id", e."nome", e."cor", e."ordem", e."fechamento"
FROM "tenants" t
CROSS JOIN (VALUES
  ('NOVO',     'Novo',       'slate',   0, false),
  ('CONTATO',  'Em contato', 'sky',     1, false),
  ('REUNIAO',  'Reunião',    'violet',  2, false),
  ('PROPOSTA', 'Proposta',   'amber',   3, false),
  ('FECHADO',  'Fechado',    'emerald', 4, true),
  ('PERDIDO',  'Perdido',    'red',     5, false)
) AS e("chave", "nome", "cor", "ordem", "fechamento");

-- Leads: etapa_kanban (enum) -> etapa_id (FK)
ALTER TABLE "leads" ADD COLUMN "etapa_id" TEXT;
UPDATE "leads" SET "etapa_id" = 'etapa_' || "tenant_id" || '_' || "etapa_kanban"::text;
ALTER TABLE "leads" ALTER COLUMN "etapa_id" SET NOT NULL;
ALTER TABLE "leads" ADD CONSTRAINT "leads_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "leads_tenant_id_etapa_kanban_idx";
ALTER TABLE "leads" DROP COLUMN "etapa_kanban";
DROP TYPE "EtapaKanban";
CREATE INDEX "leads_tenant_id_etapa_id_idx" ON "leads"("tenant_id", "etapa_id");

-- Acesso só pelo servidor (Prisma); RLS sem políticas bloqueia a API pública do Supabase
ALTER TABLE "etapas" ENABLE ROW LEVEL SECURITY;
