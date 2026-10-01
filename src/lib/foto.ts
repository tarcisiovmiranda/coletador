/** Reduz a foto no próprio celular antes de enviar: ~300 KB em vez de vários MB. */
export async function reduzirFoto(arquivo: File, ladoMax = 1600, qualidade = 0.82): Promise<Blob> {
  let largura: number;
  let altura: number;
  let desenhar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  if (typeof createImageBitmap === "function") {
    // imageOrientation: respeita a rotação gravada pela câmera (foto de pé não sai deitada)
    const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    largura = bmp.width;
    altura = bmp.height;
    desenhar = (ctx, w, h) => {
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
    };
  } else {
    const url = URL.createObjectURL(arquivo);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("imagem inválida"));
      i.src = url;
    });
    largura = img.naturalWidth;
    altura = img.naturalHeight;
    desenhar = (ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
    };
  }

  const escala = Math.min(1, ladoMax / Math.max(largura, altura));
  const w = Math.round(largura * escala);
  const h = Math.round(altura * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  desenhar(ctx, w, h);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("falha ao comprimir"))), "image/jpeg", qualidade),
  );
}
