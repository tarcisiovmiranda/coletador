export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return s;
}

export const TENANT_SLUG = process.env.TENANT_SLUG ?? "fisp2026";
