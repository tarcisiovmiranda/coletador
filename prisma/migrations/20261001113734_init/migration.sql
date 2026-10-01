-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'COLETADOR');

-- CreateEnum
CREATE TYPE "EtapaKanban" AS ENUM ('NOVO', 'CONTATO', 'REUNIAO', 'PROPOSTA', 'FECHADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "ContratoStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO_ASSINATURA', 'ASSINADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT,
    "perfil" "Perfil" NOT NULL DEFAULT 'COLETADOR',
    "codigo_hash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "empresa" TEXT,
    "inscricao" TEXT,
    "whatsapp" TEXT,
    "cnpj" TEXT,
    "etapa_kanban" "EtapaKanban" NOT NULL DEFAULT 'NOVO',
    "audio_key" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "colaborador_nome_snapshot" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "pagamento" TEXT NOT NULL,
    "status" "ContratoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "comissao_percentual" DECIMAL(5,2),
    "comissao_valor" DECIMAL(12,2),
    "assinatura_key" TEXT,
    "assinado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "colaboradores_tenant_id_perfil_idx" ON "colaboradores"("tenant_id", "perfil");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_tenant_id_codigo_hash_key" ON "colaboradores"("tenant_id", "codigo_hash");

-- CreateIndex
CREATE INDEX "leads_tenant_id_colaborador_id_idx" ON "leads"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_etapa_kanban_idx" ON "leads"("tenant_id", "etapa_kanban");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_lead_id_key" ON "contratos"("lead_id");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_colaborador_id_idx" ON "contratos"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "contratos_tenant_id_status_idx" ON "contratos"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
