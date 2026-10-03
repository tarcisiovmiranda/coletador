import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { parseContrato, type Trecho } from "./contrato-render";

export type DadosPdf = {
  titulo: string;
  textoFinal: string;
  assinaturaPng: Uint8Array;
  signatarioNome: string;
  signatarioDocumento: string;
  contratadaNome: string;
  contratadaCnpj: string;
  evidencias: { assinadoEm: string; ip: string; userAgent: string; hash: string; versao: number; id: string };
};

const W = 595.28;
const H = 841.89;
const M = 54; // margem
const TAM = 10.5;
const ENT = 14.5; // entrelinha
const LARG = W - 2 * M;
const COR = rgb(0.1, 0.1, 0.12);
const CINZA = rgb(0.4, 0.42, 0.46);
const LARANJA = rgb(0.72, 0.33, 0.07);

export async function gerarPdfContrato(d: DadosPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const neg = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const ok = new Set([...reg.getCharacterSet(), ...neg.getCharacterSet()]);
  // a Helvetica padrão só codifica WinAnsi: o resto vira "?" em vez de derrubar a geração
  const seguro = (s: string) =>
    [...s.replace(/\r?\n/g, " ")]
      .map((c) => (ok.has(c.codePointAt(0)!) ? c : "?"))
      .join("");

  // largura SEM kerning: o drawText não aplica kerning, e widthOfTextAtSize aplica
  // (medir com kerning deixa a palavra mais larga que o medido e ela cola na seguinte)
  const medir = (f: PDFFont, s: string, tam: number) =>
    [...s].reduce((soma, c) => soma + f.widthOfTextAtSize(c, tam), 0);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const nova = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const garantir = (h: number) => {
    if (y - h < M + 20) nova();
  };

  // palavras com a fonte de cada trecho, quebradas por largura. `sp` = havia espaço antes da palavra
  // no texto original: pontuação colada ao negrito ("Ana**,**") não ganha espaço.
  type Palavra = { t: string; f: PDFFont; sp: boolean };
  const quebrar = (ts: Trecho[], tam: number, largura: number): Palavra[][] => {
    const linhas: Palavra[][] = [];
    let linha: Palavra[] = [];
    let w = 0;
    let pendente = false;
    const esp = reg.widthOfTextAtSize(" ", tam);
    for (const tr of ts) {
      const f = tr.b ? neg : reg;
      for (const parte of seguro(tr.t).split(/(\s+)/)) {
        if (!parte) continue;
        if (/^\s+$/.test(parte)) {
          pendente = true;
          continue;
        }
        const pw = medir(f, parte, tam);
        const sp = pendente && linha.length > 0;
        if (linha.length && w + (sp ? esp : 0) + pw > largura) {
          linhas.push(linha);
          linha = [];
          w = 0;
        }
        const comEspaco = pendente && linha.length > 0;
        w += (comEspaco ? esp : 0) + pw;
        linha.push({ t: parte, f, sp: comEspaco });
        pendente = false;
      }
    }
    if (linha.length) linhas.push(linha);
    return linhas;
  };

  const desenhaLinha = (l: Palavra[], x: number, tam: number, cor = COR) => {
    let cx = x;
    const esp = reg.widthOfTextAtSize(" ", tam);
    for (const p of l) {
      if (p.sp) cx += esp;
      page.drawText(p.t, { x: cx, y, size: tam, font: p.f, color: cor });
      cx += medir(p.f, p.t, tam);
    }
  };

  const paragrafo = (ts: Trecho[], x = M, largura = LARG, tam = TAM) => {
    for (const l of quebrar(ts, tam, largura)) {
      garantir(ENT);
      y -= ENT;
      desenhaLinha(l, x, tam);
    }
    y -= 4;
  };

  // título
  garantir(60);
  for (const l of quebrar([{ t: d.titulo, b: true }], 18, LARG)) {
    y -= 23;
    desenhaLinha(l, M, 18);
  }
  page.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 1.2, color: COR });
  y -= 22;

  for (const b of parseContrato(d.textoFinal)) {
    if (b.tipo === "titulo") {
      garantir(40);
      y -= 8;
      for (const l of quebrar([{ t: b.texto, b: true }], 12.5, LARG)) {
        y -= 17;
        desenhaLinha(l, M, 12.5, LARANJA);
      }
      y -= 3;
    } else if (b.tipo === "par") {
      paragrafo(b.trechos);
    } else if (b.tipo === "item") {
      const linhas = quebrar(b.trechos, TAM, LARG - 16);
      linhas.forEach((l, i) => {
        garantir(ENT);
        y -= ENT;
        if (i === 0) page.drawText("-", { x: M + 4, y, size: TAM, font: reg, color: COR });
        desenhaLinha(l, M + 16, TAM);
      });
      y -= 3;
    } else if (b.tipo === "check") {
      garantir(ENT + 4);
      y -= ENT + 2;
      page.drawRectangle({ x: M + 2, y: y - 1, width: 9, height: 9, borderColor: COR, borderWidth: 0.8, color: b.marcado ? COR : undefined });
      if (b.marcado) {
        page.drawLine({ start: { x: M + 3.5, y: y + 3.5 }, end: { x: M + 6, y: y + 1 }, thickness: 1.2, color: rgb(1, 1, 1) });
        page.drawLine({ start: { x: M + 6, y: y + 1 }, end: { x: M + 10, y: y + 7 }, thickness: 1.2, color: rgb(1, 1, 1) });
      }
      page.drawText(seguro(b.texto.toUpperCase()), { x: M + 18, y, size: 9.5, font: reg, color: COR });
    } else {
      // quadro: barra lateral + fundo cinza claro, desenhado linha a linha (pode atravessar páginas)
      const x = M + 10;
      const larg = LARG - 16;
      const itens: { ts: Trecho[]; tam: number }[] = [];
      if (b.titulo) itens.push({ ts: [{ t: b.titulo, b: true }], tam: 8.5 });
      for (const p of b.pars) itens.push({ ts: p, tam: TAM });
      y -= 6;
      for (const it of itens) {
        for (const l of quebrar(it.ts, it.tam, larg - 8)) {
          garantir(ENT + 2);
          y -= ENT;
          page.drawRectangle({ x: M, y: y - 4, width: LARG, height: ENT, color: rgb(0.95, 0.95, 0.95) });
          page.drawRectangle({ x: M, y: y - 4, width: 3, height: ENT, color: COR });
          desenhaLinha(l, x, it.tam, it.tam < TAM ? LARANJA : COR);
        }
        y -= 5;
      }
      y -= 3;
    }
  }

  // assinaturas (sempre juntas, em página com espaço suficiente)
  garantir(230);
  y -= 16;
  page.drawText("Assinaturas", { x: M, y, size: 12.5, font: neg, color: LARANJA });
  y -= 18;
  const colW = (LARG - 24) / 2;
  const topo = y;
  page.drawText("CONTRATADA", { x: M, y: topo - 2, size: 8, font: neg, color: CINZA });
  page.drawText(seguro(d.contratadaNome), { x: M, y: topo - 56, size: 9.5, font: neg, color: COR });
  page.drawText(seguro(`CNPJ ${d.contratadaCnpj}`), { x: M, y: topo - 69, size: 9, font: reg, color: CINZA });
  page.drawLine({ start: { x: M, y: topo - 48 }, end: { x: M + colW, y: topo - 48 }, thickness: 0.8, color: COR });
  const x2 = M + colW + 24;
  page.drawText("CONTRATANTE", { x: x2, y: topo - 2, size: 8, font: neg, color: CINZA });
  const img = await pdf.embedPng(d.assinaturaPng);
  const esc = Math.min(colW / img.width, 40 / img.height, 1);
  page.drawImage(img, { x: x2, y: topo - 46, width: img.width * esc, height: img.height * esc });
  page.drawLine({ start: { x: x2, y: topo - 48 }, end: { x: x2 + colW, y: topo - 48 }, thickness: 0.8, color: COR });
  page.drawText(seguro(d.signatarioNome), { x: x2, y: topo - 56, size: 9.5, font: neg, color: COR });
  page.drawText(seguro(`CPF/CNPJ ${d.signatarioDocumento}`), { x: x2, y: topo - 69, size: 9, font: reg, color: CINZA });
  y = topo - 96;

  // evidências (cláusula 12.1)
  const ev = d.evidencias;
  const linhasEv = [
    `Assinatura eletrônica simples (art. 4º, I, Lei 14.063/2020) - modelo versão ${ev.versao} - id ${ev.id}`,
    `Hora do servidor: ${ev.assinadoEm} - IP: ${ev.ip}`,
    `Aparelho: ${ev.userAgent.slice(0, 150)}`,
  ];
  garantir(90);
  for (const t of linhasEv) {
    for (const l of quebrar([{ t, b: false }], 8, LARG)) {
      y -= 11;
      desenhaLinha(l, M, 8, CINZA);
    }
  }
  y -= 8;
  page.drawText("Resumo criptográfico (SHA-256) do texto assinado:", { x: M, y, size: 8, font: neg, color: CINZA });
  y -= 12;
  page.drawText(ev.hash.slice(0, 64), { x: M, y, size: 8.5, font: mono, color: COR });

  // rodapé em todas as páginas
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${paginas.length}`, { x: W / 2 - 30, y: 26, size: 8.5, font: reg, color: CINZA });
  });

  return pdf.save();
}
