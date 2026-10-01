-- Idempotência do envio offline: reenviar o mesmo lead não cria duplicata.
ALTER TABLE "leads" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "leads_tenant_id_client_id_key" ON "leads"("tenant_id", "client_id");
