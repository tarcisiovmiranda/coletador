import type { ContratoStatus } from "@prisma/client";

export const PAGAMENTOS = ["PIX", "Cartão de crédito", "Boleto", "Transferência", "Outro"] as const;

export const STATUS_CONTRATO: Record<ContratoStatus, { label: string; cor: string }> = {
  PENDENTE: { label: "Aguardando aprovação", cor: "bg-amber-100 text-amber-800" },
  APROVADO: { label: "Aprovado", cor: "bg-emerald-100 text-emerald-800" },
  CANCELADO: { label: "Cancelado", cor: "bg-slate-200 text-slate-700" },
};
