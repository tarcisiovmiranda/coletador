"use client";

import { useCallback, useEffect, useState } from "react";
import { aoMudar, listar, type Pendente } from "@/lib/outbox";

/** Leads deste usuário que estão gravados no aparelho aguardando envio. */
export function usePendentes(userId: string) {
  const [lista, setLista] = useState<Pendente[]>([]);

  const recarregar = useCallback(async () => {
    try {
      setLista(await listar(userId));
    } catch {
      setLista([]); // IndexedDB indisponível (ex.: aba anônima antiga): sem fila
    }
  }, [userId]);

  useEffect(() => {
    void recarregar();
    return aoMudar(() => void recarregar());
  }, [recarregar]);

  return { lista, recarregar };
}
