-- Acesso ao banco é só pelo servidor (Prisma, role dona das tabelas, ignora RLS).
-- Ativar RLS sem políticas bloqueia a API pública do Supabase (chaves anon/authenticated).
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "colaboradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contratos" ENABLE ROW LEVEL SECURITY;
