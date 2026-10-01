-- Contrato interno: sem assinatura do cliente; aprovação pelo admin.

-- Status: RASCUNHO/AGUARDANDO_ASSINATURA/ASSINADO/CANCELADO -> PENDENTE/APROVADO/CANCELADO
ALTER TABLE "contratos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ContratoStatus" RENAME TO "ContratoStatus_old";
CREATE TYPE "ContratoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'CANCELADO');
ALTER TABLE "contratos" ALTER COLUMN "status" TYPE "ContratoStatus" USING (
  CASE "status"::text
    WHEN 'ASSINADO' THEN 'APROVADO'
    WHEN 'CANCELADO' THEN 'CANCELADO'
    ELSE 'PENDENTE'
  END::"ContratoStatus"
);
ALTER TABLE "contratos" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
DROP TYPE "ContratoStatus_old";

-- Assinatura -> aprovação interna
ALTER TABLE "contratos" DROP COLUMN "assinatura_key";
ALTER TABLE "contratos" RENAME COLUMN "assinado_em" TO "aprovado_em";
ALTER TABLE "contratos" ADD COLUMN "aprovado_por_nome" TEXT;

-- Percentual de comissão configurável por tenant (começa em 0 até o admin definir)
ALTER TABLE "tenants" ADD COLUMN "comissao_percentual" DECIMAL(5,2) NOT NULL DEFAULT 0;
