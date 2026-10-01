"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SEG = 180;

function escolherMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Grava áudio no aparelho. Entrega o Blob ao pai; o envio é feito por quem usa. */
export function AudioRecorder({ onChange }: { onChange: (b: Blob | null) => void }) {
  const [estado, setEstado] = useState<"idle" | "gravando" | "pronto">("idle");
  const [seg, setSeg] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  function parar() {
    if (timer.current) clearInterval(timer.current);
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }

  async function iniciar() {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErro("Este navegador não permite gravar áudio.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = escolherMime();
      const r = new MediaRecorder(s, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32000, // voz: ~240 KB/min
      });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" });
        setUrl(URL.createObjectURL(blob));
        setEstado("pronto");
        onChange(blob);
      };
      rec.current = r;
      r.start();
      setSeg(0);
      setEstado("gravando");
      timer.current = setInterval(() => {
        setSeg((v) => {
          if (v + 1 >= MAX_SEG) parar();
          return v + 1;
        });
      }, 1000);
    } catch {
      setErro("Sem acesso ao microfone. Permita o uso do microfone no navegador.");
    }
  }

  function refazer() {
    setUrl(null);
    setEstado("idle");
    onChange(null);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 p-3">
      {estado === "idle" && (
        <button type="button" onClick={iniciar} className="btn btn-ghost w-full">
          🎙️ Gravar áudio
        </button>
      )}
      {estado === "gravando" && (
        <div className="space-y-2 text-center">
          <p className="text-3xl font-extrabold tabular-nums text-red-600">
            ● {mmss(seg)} <span className="text-base font-semibold text-slate-500">/ {mmss(MAX_SEG)}</span>
          </p>
          <button type="button" onClick={parar} className="btn btn-danger w-full">
            ⏹ Parar gravação
          </button>
        </div>
      )}
      {estado === "pronto" && url && (
        <div className="space-y-2">
          <p className="text-center text-sm font-semibold text-slate-600">Gravação de {mmss(seg)}</p>
          <audio src={url} controls className="w-full" />
          <button type="button" onClick={refazer} className="btn btn-ghost w-full">
            Regravar
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-sm font-medium text-red-700">{erro}</p>}
    </div>
  );
}
