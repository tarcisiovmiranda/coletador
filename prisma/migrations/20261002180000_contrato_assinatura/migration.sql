-- Contrato de adesão: modelo versionado e assinaturas imutáveis
CREATE TABLE "modelos_contrato" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "criado_por_nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "modelos_contrato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assinaturas_contrato" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL,
    "texto_final" TEXT NOT NULL,
    "campos" JSONB NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "assinatura_key" TEXT NOT NULL,
    "pdf_key" TEXT NOT NULL,
    "signatario_nome" TEXT NOT NULL,
    "signatario_documento" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "assinado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assinaturas_contrato_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modelos_contrato_tenant_id_versao_key" ON "modelos_contrato"("tenant_id", "versao");
CREATE INDEX "assinaturas_contrato_tenant_id_lead_id_idx" ON "assinaturas_contrato"("tenant_id", "lead_id");

ALTER TABLE "modelos_contrato" ADD CONSTRAINT "modelos_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Acesso só pelo servidor (Prisma); RLS sem políticas bloqueia a API pública do Supabase
ALTER TABLE "modelos_contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assinaturas_contrato" ENABLE ROW LEVEL SECURITY;
