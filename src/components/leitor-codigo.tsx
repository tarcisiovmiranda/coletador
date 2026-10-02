"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { interpretarCodigo } from "@/lib/codigo-cracha";

// Os formatos mais comuns em crachás e ingressos de feira.
const FORMATOS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.PDF_417,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
];

const NOME_FORMATO: Record<number, string> = {
  [BarcodeFormat.QR_CODE]: "QR Code",
  [BarcodeFormat.CODE_128]: "Code 128",
  [BarcodeFormat.CODE_39]: "Code 39",
  [BarcodeFormat.CODE_93]: "Code 93",
  [BarcodeFormat.EAN_13]: "EAN-13",
  [BarcodeFormat.EAN_8]: "EAN-8",
  [BarcodeFormat.UPC_A]: "UPC-A",
  [BarcodeFormat.ITF]: "ITF",
  [BarcodeFormat.CODABAR]: "Codabar",
  [BarcodeFormat.PDF_417]: "PDF417",
  [BarcodeFormat.DATA_MATRIX]: "Data Matrix",
  [BarcodeFormat.AZTEC]: "Aztec",
};

type Estado =
  | { tipo: "parado" }
  | { tipo: "abrindo" }
  | { tipo: "lendo" }
  | { tipo: "ok"; codigo: string; n: number; soNumero: boolean; formato: string }
  | { tipo: "erro"; msg: string };

/**
 * Lê código de barras ou QR pela câmera, direto no aparelho (sem internet).
 * Devolve o texto lido; quem usa decide em quais campos ele entra.
 */
export function LeitorCodigo({ onLido }: { onLido: (texto: string) => number }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<IScannerControls | null>(null);
  // cada abertura tem um número: respostas atrasadas de uma abertura já cancelada são descartadas
  const sessao = useRef(0);
  const abrindo = useRef(false);
  const aberto = estado.tipo === "abrindo" || estado.tipo === "lendo";

  const parar = useCallback(() => {
    sessao.current++;
    abrindo.current = false;
    controles.current?.stop();
    controles.current = null;
  }, []);

  // sempre solta a câmera ao sair da tela
  useEffect(() => parar, [parar]);

  // ESC fecha
  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (e: KeyboardEvent) => e.key === "Escape" && cancelar();
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function cancelar() {
    parar();
    setEstado({ tipo: "parado" });
  }

  async function abrir() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado({ tipo: "erro", msg: "Este navegador não permite usar a câmera aqui." });
      return;
    }
    setEstado({ tipo: "abrindo" });
    const minha = ++sessao.current;
    abrindo.current = true;
    // câmera que não abre (permissão ignorada, app travado): não deixa a tela presa
    const limite = setTimeout(() => {
      if (sessao.current !== minha || !abrindo.current) return;
      parar();
      setEstado({ tipo: "erro", msg: "A câmera demorou para abrir. Feche outros apps que a usam e tente de novo." });
    }, 12_000);
    // o <video> só existe depois do próximo render
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (!video.current) return;

    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, FORMATOS],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const leitor = new BrowserMultiFormatReader(hints as Map<DecodeHintType, never>, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 600,
    });

    try {
      controles.current = await leitor.decodeFromConstraints(
        {
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        },
        video.current,
        (resultado, _erro, ctl) => {
          if (!resultado || sessao.current !== minha) return; // "não achou código neste quadro": segue tentando
          ctl.stop();
          controles.current = null;
          abrindo.current = false;
          clearTimeout(limite);
          try {
            navigator.vibrate?.(80);
          } catch {
            /* sem vibração */
          }
          const texto = resultado.getText();
          const n = onLido(texto);
          // código curto = só um identificador (os dados da pessoa ficam no cadastro da feira, não nas barras)
          const soNumero = Object.keys(interpretarCodigo(texto)).every((k) => k === "inscricao");
          const formato = NOME_FORMATO[resultado.getBarcodeFormat()] ?? "código";
          setEstado({ tipo: "ok", codigo: texto, n, soNumero, formato });
        },
      );
      clearTimeout(limite);
      if (sessao.current !== minha) {
        // cancelou (ou deu o tempo) enquanto a câmera abria: solta a câmera que acabou de abrir
        controles.current?.stop();
        controles.current = null;
      } else if (abrindo.current) {
        // só vira "lendo" se o código já não tiver sido lido durante a abertura
        abrindo.current = false;
        setEstado({ tipo: "lendo" });
      }
    } catch (e) {
      clearTimeout(limite);
      if (sessao.current !== minha) return;
      parar();
      const nome = e instanceof Error ? e.name : "";
      setEstado({
        tipo: "erro",
        msg:
          nome === "NotAllowedError"
            ? "Sem permissão para a câmera. Permita o uso da câmera no navegador e tente de novo."
            : nome === "NotFoundError" || nome === "OverconstrainedError"
              ? "Não encontrei uma câmera neste aparelho."
              : "Não consegui abrir a câmera. Feche outros apps que a usam e tente de novo.",
      });
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={abrir} disabled={aberto} className="btn btn-ghost w-full">
        ▥ Ler código de barras
      </button>

      {estado.tipo === "ok" && (
        <p role="status" className="break-all text-center text-sm font-semibold text-emerald-800">
          Código lido: {estado.codigo.length > 60 ? estado.codigo.slice(0, 60) + "…" : estado.codigo} ({estado.formato})
          {estado.n > 0 ? ` · ${estado.n} ${estado.n === 1 ? "campo preenchido" : "campos preenchidos"}` : " · nada novo para preencher"}
        </p>
      )}
      {estado.tipo === "ok" && estado.soNumero && (
        <p className="text-center text-xs text-slate-600">
          Este código traz só o nº de inscrição. Para nome, empresa e cargo, use também “Ler crachá com a câmera”.
        </p>
      )}
      {estado.tipo === "ok" && (
        <button type="button" onClick={abrir} className="mx-auto block text-sm font-bold text-brand-600 underline">
          O crachá tem outro código (QR)? Ler outro
        </button>
      )}
      {estado.tipo === "erro" && (
        <p role="alert" className="text-center text-sm font-semibold text-red-700">
          {estado.msg}
        </p>
      )}

      {aberto && (
        <div role="dialog" aria-label="Leitor de código de barras" className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-[80%] max-w-md rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            <p className="absolute inset-x-0 top-6 px-6 text-center text-lg font-bold text-white">
              {estado.tipo === "abrindo" ? "Abrindo a câmera…" : "Aponte para o código do crachá"}
            </p>
          </div>
          <div className="bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={cancelar} className="btn btn-ghost w-full">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
