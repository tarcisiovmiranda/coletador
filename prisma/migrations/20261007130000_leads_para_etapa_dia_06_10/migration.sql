-- Pedido do admin (07/10/2026): todos os leads coletados até agora vão para a etapa "Dia 06/10/2026".
-- A etapa foi criada pelo admin na tela de etapas; onde ela não existir (outro tenant, banco novo) nada muda.
UPDATE "leads" AS l
SET "etapa_id" = e."id"
FROM "etapas" AS e
WHERE e."tenant_id" = l."tenant_id"
  AND e."nome" = 'Dia 06/10/2026'
  AND l."etapa_id" <> e."id";
