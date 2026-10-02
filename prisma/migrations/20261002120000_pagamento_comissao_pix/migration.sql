-- Pagamento de comissão por Pix (Asaas)
CREATE TYPE "PixTipo" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');
CREATE TYPE "PagamentoStatus" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'FALHOU', 'VERIFICAR');

ALTER TABLE "colaboradores" ADD COLUMN "pix_chave" TEXT,
ADD COLUMN "pix_tipo" "PixTipo";

CREATE TABLE "pagamentos_comissao" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "colaborador_nome_snapshot" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PROCESSANDO',
    "pix_chave" TEXT NOT NULL,
    "pix_tipo" "PixTipo" NOT NULL,
    "asaas_transfer_id" TEXT,
    "comprovante_url" TEXT,
    "erro" TEXT,
    "criado_por_nome" TEXT NOT NULL,
    "concluido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_comissao_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contratos" ADD COLUMN "pagamento_id" TEXT;

CREATE UNIQUE INDEX "pagamentos_comissao_asaas_transfer_id_key" ON "pagamentos_comissao"("asaas_transfer_id");
CREATE INDEX "pagamentos_comissao_tenant_id_colaborador_id_idx" ON "pagamentos_comissao"("tenant_id", "colaborador_id");
CREATE INDEX "pagamentos_comissao_tenant_id_status_idx" ON "pagamentos_comissao"("tenant_id", "status");
CREATE INDEX "contratos_pagamento_id_idx" ON "contratos"("pagamento_id");

ALTER TABLE "contratos" ADD CONSTRAINT "contratos_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos_comissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagamentos_comissao" ADD CONSTRAINT "pagamentos_comissao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagamentos_comissao" ADD CONSTRAINT "pagamentos_comissao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase: bloqueia a API pública (só o servidor, via Prisma, acessa)
ALTER TABLE "pagamentos_comissao" ENABLE ROW LEVEL SECURITY;
