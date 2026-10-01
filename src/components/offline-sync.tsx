"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { protegerArmazenamento } from "@/lib/outbox";
import { sincronizar } from "@/lib/sync";
import { usePendentes } from "./use-pendentes";

const A_CADA_MS = 20_000;
const AQUECER_A_CADA_MS = 6 * 60 * 60 * 1000;

/**
 * Cuida do modo offline: registra o service worker, guarda as telas para abrir sem rede,
 * envia a fila de leads sozinho quando a conexão volta e mostra o aviso na tela.
 */
export function OfflineSync({ userId }: { userId: string }) {
  const router = useRouter();
  const { lista, recarregar } = usePendentes(userId);
  const [semRede, setSemRede] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const rodando = useRef(false);

  const enviar = useCallback(async () => {
    if (rodando.current) return;
    rodando.current = true;
    setEnviando(true);
    try {
      const r = await sincronizar(userId);
      setSemRede(r.parou === "offline" || r.parou === "servidor");
      setSessaoExpirada(r.parou === "sessao");
      const avisos = Object.values(r.resultados).flatMap((x) =>
        x.status === "enviado" && x.avisoAudio ? [x.avisoAudio] : [],
      );
      setAviso(avisos.length ? `Lead enviado, mas um áudio foi recusado: ${avisos[0]}` : null);
      if (r.enviados > 0) router.refresh();
    } finally {
      rodando.current = false;
      setEnviando(false);
      void recarregar();
    }
  }, [userId, router, recarregar]);

  // service worker + guardar telas para uso offline
  useEffect(() => {
    void protegerArmazenamento();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        let ultimo = 0;
        try {
          ultimo = Number(localStorage.getItem("coletador-aquecido") ?? 0);
        } catch {
          /* sem localStorage */
        }
        if (Date.now() - ultimo > AQUECER_A_CADA_MS) {
          reg.active?.postMessage({ type: "aquecer" });
          try {
            localStorage.setItem("coletador-aquecido", String(Date.now()));
          } catch {
            /* ignora */
          }
        }
      })
      .catch(() => {});
  }, []);

  // enviar a fila: ao abrir, quando a rede volta, ao voltar para o app e de tempos em tempos
  useEffect(() => {
    void enviar();
    const aoVoltarRede = () => {
      setSemRede(false);
      void enviar();
    };
    const aoCairRede = () => setSemRede(true);
    const aoVisivel = () => document.visibilityState === "visible" && void enviar();
    window.addEventListener("online", aoVoltarRede);
    window.addEventListener("offline", aoCairRede);
    document.addEventListener("visibilitychange", aoVisivel);
    const timer = setInterval(() => void enviar(), A_CADA_MS);
    return () => {
      window.removeEventListener("online", aoVoltarRede);
      window.removeEventListener("offline", aoCairRede);
      document.removeEventListener("visibilitychange", aoVisivel);
      clearInterval(timer);
    };
  }, [enviar]);

  const comErro = lista.filter((p) => p.erro).length;
  const aguardando = lista.length - comErro;

  if (!semRede && !sessaoExpirada && lista.length === 0 && !aviso) return null;

  return (
    <div className="mb-4 space-y-2" role="status">
      {semRede && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
          Sem conexão. Novos leads ficam salvos no aparelho e sobem sozinhos quando a internet voltar.
        </p>
      )}
      {sessaoExpirada && aguardando > 0 && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 font-medium text-red-700">
          Sua sessão expirou. Entre de novo para enviar os leads salvos no aparelho.
        </p>
      )}
      {aguardando > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3">
          <p className="font-semibold text-brand-700">
            ⏳ {aguardando} {aguardando === 1 ? "lead aguardando envio" : "leads aguardando envio"}
          </p>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            className="btn btn-primary !min-h-11 shrink-0 !px-4 !text-base"
          >
            {enviando ? "Enviando…" : "Enviar agora"}
          </button>
        </div>
      )}
      {comErro > 0 && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {comErro} {comErro === 1 ? "lead foi recusado" : "leads foram recusados"} pelo servidor. Veja em “Meus
          leads”.
        </p>
      )}
      {aviso && <p className="rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-800">{aviso}</p>}
    </div>
  );
}
