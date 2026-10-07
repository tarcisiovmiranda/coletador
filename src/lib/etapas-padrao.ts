import type { CorEtapa } from "./etapas-cores";

/** Etapas criadas para um tenant novo (as mesmas que a migration cria para os existentes). */
export const ETAPAS_PADRAO: { nome: string; cor: CorEtapa; fechamento: boolean }[] = [
  { nome: "Novo", cor: "slate", fechamento: false },
  { nome: "Em contato", cor: "sky", fechamento: false },
  { nome: "Reunião", cor: "violet", fechamento: false },
  { nome: "Proposta", cor: "amber", fechamento: false },
  { nome: "Fechado", cor: "emerald", fechamento: true },
  { nome: "Perdido", cor: "red", fechamento: false },
];
