# Contrato de adesão com assinatura na tela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin edita um modelo único de contrato; o coletor preenche os campos em branco, o cliente assina desenhando no celular e o app gera e guarda um PDF assinado.

**Architecture:** Dois módulos puros e testáveis (`contrato-render` = marcação → blocos + variáveis; `contrato-campos` = regras de negócio/validação) alimentam um gerador de PDF (`pdf-lib`) e duas rotas (assinar / baixar PDF). Modelo e assinaturas são tabelas imutáveis (nova versão / nova linha). O servidor monta o texto final; nada vindo do cliente é confiável além dos campos validados.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 + Postgres, zod 4, `pdf-lib`, Cloudflare R2 (`@aws-sdk/client-s3` via `src/lib/storage.ts`), testes: `node --import tsx --test` (módulos puros) e Puppeteer (ponta a ponta).

**Spec:** `docs/superpowers/specs/2026-10-02-contrato-assinatura-design.md`. Texto inicial do contrato: `prisma/contrato-modelo-v1.md` (transcrito do PDF do usuário; ver "Texto inicial" abaixo).

## Global Constraints

- Next.js 16: `params`/`searchParams` são `Promise`; `proxy.ts` no lugar de middleware; funções de módulo `"use client"` não podem ser chamadas em server components. Em dúvida, ler `node_modules/next/dist/docs/` (AGENTS.md).
- Dinheiro sempre em centavos inteiros (`parseBRL`, `fmtCents` de `src/lib/dinheiro.ts`).
- Todo acesso filtra `tenantId`; leads via `escopoLead(user)` (`src/lib/leads.ts`). Só `requireAdmin()` edita o modelo.
- Migração escrita à mão, conferida com `prisma migrate diff`; RLS ligado nas tabelas novas (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`). Nunca definir a variável de consentimento do Prisma para reset.
- Limites: PNG da assinatura ≤ 200 KB; corpo do modelo ≤ 200 KB; assinatura é imutável (sem edição/exclusão); lead com assinatura não pode ser excluído.
- Limite de vidas por dia (hora de Brasília): 2026-10-06 → 1300; 2026-10-07 → 1200; 2026-10-08 → 1100; fora disso o coletor informa à mão.
- Mensalidade padrão R$ 700,00 (70000 centavos); adicional médico R$ 200,00 só é informativo (texto do contrato).
- Variável do modelo sem valor na assinatura bloqueia a assinatura; variável desconhecida bloqueia o salvamento do modelo.
- Fonte do PDF: Helvetica padrão (WinAnsi). Caracteres fora do conjunto viram `?`, nunca derrubam a geração.
- Relógio injetável só fora da Vercel: `TESTE_AGORA` (ISO) é ignorado se `process.env.VERCEL` existir.
- Textos da interface em português do Brasil, estilo existente (`btn`, `btn-primary`, `card`, `field`).
- Commits ao final de cada tarefa terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Cliente digita `**`, `{{x}}` ou quebra de linha no nome/endereço/plano → não pode quebrar a marcação nem injetar variável; valores são "limpos" antes de entrar no texto (Task 2).
2. Toque duplo em "Assinar" / reenvio por rede lenta → não gerar duas assinaturas idênticas em sequência (dedupe por lead + hash em 60 s) (Task 6).
3. Assinatura em branco/minúscula (só um toque) ou PNG falso → rejeitar (assinatura mínima de traços + validação de cabeçalho PNG) (Task 6).
4. Contrato assinado fora de 06–08/10 → exigir limite manual e registrá-lo; lead sem CPF/CNPJ/e-mail → bloquear apontando o campo faltante (Tasks 3 e 6).
5. Nome com acentos/caracteres que a Helvetica não codifica (ex.: "ł", emoji) → PDF sai sem erro (Task 4).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` (modificar) | modelos `ModeloContrato`, `AssinaturaContrato` + relações |
| `prisma/migrations/20261002180000_contrato_assinatura/migration.sql` (criar) | tabelas, índices, FKs, RLS |
| `scripts/gerar-modelo-inicial.mjs` (criar) | gera `src/lib/contrato-modelo-inicial.ts` a partir do `.md` |
| `src/lib/contrato-modelo-inicial.ts` (gerado) | `TITULO_INICIAL`, `MODELO_INICIAL` |
| `src/lib/contrato-render.ts` (criar) | marcação → `Bloco[]`; `preencher()`; `VARIAVEIS` |
| `src/lib/contrato-campos.ts` (criar) | ferramentas, limite por dia, zod dos campos, `montarValores()`, `hashTexto()` |
| `src/lib/contrato-pdf.ts` (criar) | `gerarPdfContrato()` com `pdf-lib` |
| `src/lib/contrato-modelo.ts` (criar) | `modeloVigente()` (cria v1 sob demanda), `listarVersoes()` |
| `src/app/admin/config/contrato/{page,editor,actions}.ts(x)` (criar) | edição do modelo + pré-visualização + histórico |
| `src/app/api/leads/[id]/assinatura/route.ts` (criar) | POST assinar |
| `src/app/api/assinaturas/[id]/pdf/route.ts` (criar) | GET PDF (redirect assinado) |
| `src/app/coletor/leads/[id]/assinar/{page,assinar-form}.tsx` (criar) | tela de assinatura |
| `src/components/assinatura-card.tsx` (criar) | bloco na tela do lead |
| `src/app/coletor/leads/[id]/page.tsx`, `src/app/admin/config/page.tsx`, `src/app/coletor/actions.ts` (modificar) | integrar card, link do modelo, bloquear exclusão |
| `package.json` (modificar) | `pdf-lib`; script `test:unit` |

## Texto inicial

`prisma/contrato-modelo-v1.md` já existe (transcrição fiel do PDF enviado, 10 páginas) com **duas frases acrescentadas** para registrar os campos: em 2.1 "Serviço opcional de médico do trabalho: **{{medico_trabalho}}**." e no fim de 2.1.2 "Limite aplicado a este contrato: **{{limite_vidas}} vidas**." O usuário deve conferir o texto (o plano não faz revisão jurídica).

Gramática da marcação: `## Título`; `**negrito**`; `- item`; `> …` consecutivos formam um quadro (parágrafos separados por `>` vazio; primeiro parágrafo `### TÍTULO` vira título do quadro); `[x] Nome`/`[ ] Nome` = ferramenta marcada/desmarcada; `{{ferramentas}}` sozinho na linha = todas as ferramentas (preenchido na assinatura); demais linhas = parágrafo.

---

### Task 1: Dependência, schema, migração e texto inicial

**Files:**
- Modify: `package.json`, `prisma/schema.prisma`
- Create: `prisma/migrations/20261002180000_contrato_assinatura/migration.sql`, `scripts/gerar-modelo-inicial.mjs`, `src/lib/contrato-modelo-inicial.ts` (gerado)

**Interfaces:**
- Produces: modelos Prisma `modeloContrato` e `assinaturaContrato` (campos abaixo); `MODELO_INICIAL: string`, `TITULO_INICIAL: string`.

- [ ] **Step 1: Instalar `pdf-lib` e criar script de teste**

```bash
npm install pdf-lib
npm pkg set scripts.test:unit="node --import tsx --test src/lib/*.test.ts"
```

- [ ] **Step 2: Adicionar os modelos ao `prisma/schema.prisma`** (no fim do arquivo) e as relações inversas

```prisma
model ModeloContrato {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  versao        Int
  titulo        String
  corpo         String
  criadoPorNome String?  @map("criado_por_nome")
  createdAt     DateTime @default(now()) @map("created_at")

  tenant      Tenant               @relation(fields: [tenantId], references: [id])
  assinaturas AssinaturaContrato[]

  @@unique([tenantId, versao])
  @@map("modelos_contrato")
}

model AssinaturaContrato {
  id                  String   @id @default(cuid())
  tenantId            String   @map("tenant_id")
  leadId              String   @map("lead_id")
  modeloId            String   @map("modelo_id")
  colaboradorId       String   @map("colaborador_id")
  colaboradorNome     String   @map("colaborador_nome")
  textoFinal          String   @map("texto_final")
  campos              Json
  hashSha256          String   @map("hash_sha256")
  assinaturaKey       String   @map("assinatura_key")
  pdfKey              String   @map("pdf_key")
  signatarioNome      String   @map("signatario_nome")
  signatarioDocumento String   @map("signatario_documento")
  ip                  String
  userAgent           String   @map("user_agent")
  assinadoEm          DateTime @default(now()) @map("assinado_em")

  tenant      Tenant         @relation(fields: [tenantId], references: [id])
  lead        Lead           @relation(fields: [leadId], references: [id])
  modelo      ModeloContrato @relation(fields: [modeloId], references: [id])
  colaborador Colaborador    @relation(fields: [colaboradorId], references: [id])

  @@index([tenantId, leadId])
  @@map("assinaturas_contrato")
}
```

Nos modelos existentes acrescente: em `Tenant` → `modelosContrato ModeloContrato[]` e `assinaturas AssinaturaContrato[]`; em `Lead` → `assinaturas AssinaturaContrato[]`; em `Colaborador` → `assinaturas AssinaturaContrato[]`.

- [ ] **Step 3: Escrever a migração à mão**

`prisma/migrations/20261002180000_contrato_assinatura/migration.sql`:

```sql
-- Contrato de adesão: modelo versionado e assinaturas imutáveis
CREATE TABLE "modelos_contrato" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "criado_por_nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "modelos_contrato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assinaturas_contrato" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL,
    "texto_final" TEXT NOT NULL,
    "campos" JSONB NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "assinatura_key" TEXT NOT NULL,
    "pdf_key" TEXT NOT NULL,
    "signatario_nome" TEXT NOT NULL,
    "signatario_documento" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "assinado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assinaturas_contrato_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modelos_contrato_tenant_id_versao_key" ON "modelos_contrato"("tenant_id", "versao");
CREATE INDEX "assinaturas_contrato_tenant_id_lead_id_idx" ON "assinaturas_contrato"("tenant_id", "lead_id");

ALTER TABLE "modelos_contrato" ADD CONSTRAINT "modelos_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assinaturas_contrato" ADD CONSTRAINT "assinaturas_contrato_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Acesso só pelo servidor (Prisma); RLS sem políticas bloqueia a API pública do Supabase
ALTER TABLE "modelos_contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assinaturas_contrato" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Conferir que migração e schema coincidem** (banco sombra local, Postgres embutido na porta 54329; subir com `start2.mjs` do scratchpad se estiver parado)

```bash
node -e "const pg=require('pg');(async()=>{const c=new pg.Client({host:'localhost',port:54329,user:'postgres',password:'postgres',database:'postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS shadow WITH (FORCE)');await c.query('CREATE DATABASE shadow');await c.end()})()"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://postgres:postgres@localhost:54329/shadow" --exit-code
```
Expected: `No difference detected.` (exit 0). Se houver diferença, ajustar o SQL (não o schema) até zerar.

- [ ] **Step 5: Aplicar no banco local e gerar o cliente**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/coletador" DIRECT_URL="postgresql://postgres:postgres@localhost:54329/coletador" npx prisma migrate deploy
npx prisma generate
```
Expected: migração `20261002180000_contrato_assinatura` aplicada.

- [ ] **Step 6: Script que embute o texto inicial**

`scripts/gerar-modelo-inicial.mjs`:

```js
import fs from "node:fs";

const corpo = fs.readFileSync("prisma/contrato-modelo-v1.md", "utf8").replace(/\r\n/g, "\n").trimEnd() + "\n";
const saida =
  "// GERADO por scripts/gerar-modelo-inicial.mjs a partir de prisma/contrato-modelo-v1.md. Não edite.\n" +
  `export const TITULO_INICIAL = ${JSON.stringify("Contrato de Licença de Uso da Plataforma ConformidadePJ")};\n` +
  `export const MODELO_INICIAL = ${JSON.stringify(corpo)};\n`;
fs.writeFileSync("src/lib/contrato-modelo-inicial.ts", saida);
console.log("ok:", corpo.length, "caracteres");
```

Run: `node scripts/gerar-modelo-inicial.mjs` → `ok: <~14000> caracteres`. Conferir `grep -c "{{" src/lib/contrato-modelo-inicial.ts` > 0.

- [ ] **Step 7: Typecheck e commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json prisma scripts src/lib/contrato-modelo-inicial.ts
git commit -m "Contrato: tabelas de modelo e assinatura, migração com RLS e texto inicial" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: tsc sem erros.

---

### Task 2: `contrato-render` — marcação, variáveis, preenchimento

**Files:**
- Create: `src/lib/contrato-render.ts`, `src/lib/contrato-render.test.ts`

**Interfaces:**
- Produces:
  - `type Trecho = { t: string; b: boolean }`
  - `type Bloco = { tipo: "titulo"; texto: string } | { tipo: "par"; trechos: Trecho[] } | { tipo: "item"; trechos: Trecho[] } | { tipo: "caixa"; titulo: string | null; pars: Trecho[][] } | { tipo: "check"; marcado: boolean; texto: string }`
  - `VARIAVEIS: readonly string[]` (nomes aceitos)
  - `FERRAMENTAS: readonly string[]` (as 10 do Anexo I, ordem do contrato) — mora aqui, e não em `contrato-campos`, porque a tela do navegador a importa e `contrato-campos` usa `node:crypto`
  - `parseContrato(corpo: string): Bloco[]`
  - `variaveisUsadas(corpo: string): string[]`
  - `limparValor(v: string): string`
  - `preencher(corpo: string, valores: Record<string, string | undefined>, ferramentas: { todas: readonly string[]; marcadas: readonly string[] } | null): { texto: string; faltantes: string[] }`

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/contrato-render.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseContrato, preencher, variaveisUsadas, limparValor } from "./contrato-render";

test("parseContrato: título, parágrafo com negrito, item, quadro e check", () => {
  const b = parseContrato(
    ["## 1. Objeto", "", "Texto **forte** fim", "", "- item um", "", "> ### AVISO", ">", "> Primeiro", ">", "> Segundo", "", "[x] PGR", "[ ] CIPA"].join("\n"),
  );
  assert.deepEqual(b[0], { tipo: "titulo", texto: "1. Objeto" });
  assert.deepEqual(b[1], { tipo: "par", trechos: [{ t: "Texto ", b: false }, { t: "forte", b: true }, { t: " fim", b: false }] });
  assert.deepEqual(b[2], { tipo: "item", trechos: [{ t: "item um", b: false }] });
  assert.equal(b[3].tipo, "caixa");
  if (b[3].tipo === "caixa") {
    assert.equal(b[3].titulo, "AVISO");
    assert.equal(b[3].pars.length, 2);
  }
  assert.deepEqual(b[4], { tipo: "check", marcado: true, texto: "PGR" });
  assert.deepEqual(b[5], { tipo: "check", marcado: false, texto: "CIPA" });
});

test("{{ferramentas}} sozinho vira checks marcados na pré-visualização", () => {
  const b = parseContrato("{{ferramentas}}");
  assert.deepEqual(b, [{ tipo: "par", trechos: [{ t: "{{ferramentas}}", b: false }] }]);
});

test("preencher troca variáveis e reporta faltantes", () => {
  const r = preencher("Olá {{nome}}, {{email}} e {{nome}}", { nome: "Ana" }, null);
  assert.equal(r.texto, "Olá Ana, {{email}} e Ana");
  assert.deepEqual(r.faltantes, ["email"]);
});

test("valor vazio ou só espaços conta como faltante", () => {
  const r = preencher("{{plano}}", { plano: "   " }, null);
  assert.deepEqual(r.faltantes, ["plano"]);
});

test("valores não podem injetar negrito, variável nem quebra de linha", () => {
  assert.equal(limparValor("**Ana** {{cpf}}\nSilva"), "Ana cpf Silva");
  const r = preencher("{{nome}}", { nome: "**x** {{plano}}" }, null);
  assert.equal(r.texto, "x plano");
});

test("preencher gera linhas de check das ferramentas", () => {
  const r = preencher("{{ferramentas}}", {}, { todas: ["PGR", "CIPA"], marcadas: ["PGR"] });
  assert.equal(r.texto, "[x] PGR\n[ ] CIPA");
  assert.deepEqual(r.faltantes, []);
});

test("variaveisUsadas lista nomes únicos", () => {
  assert.deepEqual(variaveisUsadas("{{a}} {{b}} {{a}}").sort(), ["a", "b"]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/contrato-render.test.ts`
Expected: FAIL (módulo `./contrato-render` não existe).

- [ ] **Step 3: Implementar**

`src/lib/contrato-render.ts`:

```ts
/** Marcação do contrato → blocos (usados pela tela e pelo PDF) + preenchimento de variáveis. */

export type Trecho = { t: string; b: boolean };
export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "par"; trechos: Trecho[] }
  | { tipo: "item"; trechos: Trecho[] }
  | { tipo: "caixa"; titulo: string | null; pars: Trecho[][] }
  | { tipo: "check"; marcado: boolean; texto: string };

export const FERRAMENTAS = [
  "Diagnóstico NR-1",
  "Cadastro (quadro de pessoal)",
  "Levantamento de Riscos",
  "PGR",
  "PCMSO",
  "LTCAT",
  "Ergonomia",
  "CIPA",
  "Canal de Denúncias",
  "Comunicados",
] as const;

/** Variáveis aceitas no modelo. `ferramentas` é especial (linhas [x]/[ ]). */
export const VARIAVEIS = [
  "nome", "documento", "email", "whatsapp", "endereco_completo", "empresa", "cargo",
  "coletor", "data", "local",
  "mensalidade", "plano", "vencimento", "medico_trabalho", "limite_vidas",
  "ferramentas",
] as const;

const RE_VAR = /\{\{(\w+)\}\}/g;

export function trechos(s: string): Trecho[] {
  return s
    .split("**")
    .map((t, i) => ({ t, b: i % 2 === 1 }))
    .filter((x) => x.t !== "");
}

export function parseContrato(corpo: string): Bloco[] {
  const linhas = corpo.replace(/\r\n?/g, "\n").split("\n");
  const out: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const s = linhas[i].trim();
    if (!s) {
      i++;
      continue;
    }
    if (s.startsWith(">")) {
      const grupo: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith(">")) {
        grupo.push(linhas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const pars: string[] = [];
      let atual: string[] = [];
      for (const g of grupo) {
        if (g.trim() === "") {
          if (atual.length) pars.push(atual.join(" "));
          atual = [];
        } else atual.push(g.trim());
      }
      if (atual.length) pars.push(atual.join(" "));
      let titulo: string | null = null;
      if (pars[0]?.startsWith("### ")) titulo = pars.shift()!.slice(4).trim();
      out.push({ tipo: "caixa", titulo, pars: pars.map(trechos) });
      continue;
    }
    const check = /^\[( |x)\] (.+)$/.exec(s);
    if (check) out.push({ tipo: "check", marcado: check[1] === "x", texto: check[2].trim() });
    else if (s.startsWith("## ")) out.push({ tipo: "titulo", texto: s.slice(3).trim() });
    else if (s.startsWith("- ")) out.push({ tipo: "item", trechos: trechos(s.slice(2).trim()) });
    else out.push({ tipo: "par", trechos: trechos(s) });
    i++;
  }
  return out;
}

export function variaveisUsadas(corpo: string): string[] {
  return [...new Set([...corpo.matchAll(RE_VAR)].map((m) => m[1]))];
}

/** Tira o que quebraria a marcação: negrito, chaves e quebras de linha. */
export function limparValor(v: string): string {
  return v.replace(/\*+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

export function preencher(
  corpo: string,
  valores: Record<string, string | undefined>,
  ferramentas: { todas: readonly string[]; marcadas: readonly string[] } | null,
): { texto: string; faltantes: string[] } {
  const faltantes = new Set<string>();
  const texto = corpo.replace(RE_VAR, (m, nome: string) => {
    if (nome === "ferramentas") {
      if (!ferramentas) return m;
      return ferramentas.todas.map((f) => `[${ferramentas.marcadas.includes(f) ? "x" : " "}] ${f}`).join("\n");
    }
    const v = valores[nome];
    const limpo = v == null ? "" : limparValor(v);
    if (!limpo) {
      faltantes.add(nome);
      return m;
    }
    return limpo;
  });
  return { texto, faltantes: [...faltantes] };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/contrato-render.test.ts`
Expected: todos os 7 testes PASS. (Se o teste de `{{ferramentas}}` na pré-visualização falhar, é esperado que ele vire parágrafo literal; a tela de pré-visualização do admin troca a variável por checks com `preencher` antes de chamar `parseContrato` — ver Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrato-render.ts src/lib/contrato-render.test.ts
git commit -m "Contrato: parser da marcação e preenchimento seguro de variáveis" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `contrato-campos` — regras de negócio e validação

**Files:**
- Create: `src/lib/contrato-campos.ts`, `src/lib/contrato-campos.test.ts`

**Interfaces:**
- Consumes: `cpfValido`, `cnpjValido` de `./leads`; `parseBRL`, `fmtCents` de `./dinheiro`; `limparValor` de `./contrato-render`.
- Produces:
  - `FERRAMENTAS` (re-exportada de `./contrato-render`)
  - `agora(): Date`
  - `diaBrasilia(d: Date): string` (AAAA-MM-DD)
  - `limiteDoDia(d: Date): number | null`
  - `type EntradaAssinatura` e `entradaSchema` (zod) — campos: `mensalidade: string`, `plano: string`, `vencimento: number`, `medicoTrabalho: boolean`, `ferramentas: string[]`, `limiteVidas?: number`, `signatarioNome: string`, `signatarioDocumento: string` (dígitos), `assinaturaPng: string` (data URL), `aceite: true`
  - `type LeadParaContrato = { nome: string; cpf: string | null; cnpj: string | null; email: string | null; whatsapp: string | null; whatsappDdi: string; empresa: string | null; cargo: string | null; endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; pais: string | null }`
  - `montarValores(lead: LeadParaContrato, e: { mensalidadeCents: number; plano: string; vencimento: number; medicoTrabalho: boolean; limiteVidas: number }, coletorNome: string, quando: Date): Record<string, string>`
  - `hashTexto(texto: string): string` (SHA-256 hex)
  - `docLead(lead): string` (CNPJ se houver, senão CPF, em dígitos)

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/contrato-campos.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { diaBrasilia, hashTexto, limiteDoDia, montarValores, docLead, FERRAMENTAS } from "./contrato-campos";

test("limite de vidas por dia da feira, em hora de Brasília", () => {
  assert.equal(limiteDoDia(new Date("2026-10-06T15:00:00Z")), 1300);
  assert.equal(limiteDoDia(new Date("2026-10-07T15:00:00Z")), 1200);
  assert.equal(limiteDoDia(new Date("2026-10-08T15:00:00Z")), 1100);
  assert.equal(limiteDoDia(new Date("2026-10-09T15:00:00Z")), null);
  assert.equal(limiteDoDia(new Date("2026-10-05T15:00:00Z")), null);
});

test("virada do dia usa Brasília (UTC-3), não UTC", () => {
  // 07/10 01:30 UTC ainda é 06/10 22:30 em Brasília
  assert.equal(diaBrasilia(new Date("2026-10-07T01:30:00Z")), "2026-10-06");
  assert.equal(limiteDoDia(new Date("2026-10-07T01:30:00Z")), 1300);
});

test("hashTexto é SHA-256 hex do texto", () => {
  assert.equal(hashTexto("abc"), createHash("sha256").update("abc").digest("hex"));
});

test("são 10 ferramentas", () => assert.equal(FERRAMENTAS.length, 10));

const lead = {
  nome: "Ana Souza", cpf: "52998224725", cnpj: null, email: "ana@x.com", whatsapp: "12999991234", whatsappDdi: "55",
  empresa: "Ana ME", cargo: "Sócia", endereco: "Rua A", numero: "10", complemento: null, bairro: "Centro",
  cidade: "São Paulo", uf: "SP", cep: "01038100", pais: "Brasil",
};

test("docLead prefere CNPJ", () => {
  assert.equal(docLead(lead), "52998224725");
  assert.equal(docLead({ ...lead, cnpj: "11222333000181" }), "11222333000181");
});

test("montarValores formata dados do lead e campos da assinatura", () => {
  const v = montarValores(
    lead,
    { mensalidadeCents: 70000, plano: "Completo", vencimento: 10, medicoTrabalho: false, limiteVidas: 1300 },
    "Beto",
    new Date("2026-10-06T15:00:00Z"),
  );
  assert.equal(v.nome, "Ana Souza");
  assert.equal(v.documento, "529.982.247-25");
  assert.equal(v.mensalidade, "700,00");
  assert.equal(v.vencimento, "10");
  assert.equal(v.medico_trabalho, "não contratado");
  assert.equal(v.limite_vidas, "1.300");
  assert.equal(v.data, "06/10/2026");
  assert.equal(v.coletor, "Beto");
  assert.match(v.endereco_completo, /Rua A, 10 - Centro - São Paulo\/SP - CEP 01038-100/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test src/lib/contrato-campos.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/contrato-campos.ts`:

```ts
import { createHash } from "node:crypto";
import { z } from "zod";
import { cnpjValido, cpfValido, fmtCep, fmtCnpj, fmtCpf, fmtWhats } from "./leads";
import { parseBRL } from "./dinheiro";
import { FERRAMENTAS } from "./contrato-render";

export { FERRAMENTAS };

/** Limite de vidas por dia da FISP 2026 (cláusula 2.1.2). Chave = dia em Brasília. */
const LIMITE_POR_DIA: Record<string, number> = {
  "2026-10-06": 1300,
  "2026-10-07": 1200,
  "2026-10-08": 1100,
};

/** Relógio do servidor. TESTE_AGORA só vale fora da Vercel (testes locais). */
export function agora(): Date {
  const t = process.env.TESTE_AGORA;
  if (t && !process.env.VERCEL) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function diaBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function limiteDoDia(d: Date): number | null {
  return LIMITE_POR_DIA[diaBrasilia(d)] ?? null;
}

export const hashTexto = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

const soDigitos = (v: string) => v.replace(/\D/g, "");

export const entradaSchema = z.object({
  mensalidade: z.string().refine((v) => {
    const c = parseBRL(v);
    return c !== null && c >= 100 && c <= 10_000_000;
  }, "Informe uma mensalidade válida."),
  plano: z.string().trim().min(2, "Informe o plano.").max(120, "Plano muito longo."),
  vencimento: z.number().int("Dia de vencimento inválido.").min(1, "Dia de vencimento: 1 a 28.").max(28, "Dia de vencimento: 1 a 28."),
  medicoTrabalho: z.boolean(),
  ferramentas: z.array(z.enum(FERRAMENTAS)).min(1, "Marque ao menos uma ferramenta."),
  limiteVidas: z.number().int().min(1, "Limite de vidas inválido.").max(1_000_000, "Limite de vidas inválido.").optional(),
  signatarioNome: z.string().trim().min(3, "Informe o nome completo de quem assina.").max(120),
  signatarioDocumento: z
    .string()
    .transform(soDigitos)
    .refine((d) => cpfValido(d) || cnpjValido(d), "CPF ou CNPJ do signatário inválido."),
  assinaturaPng: z.string().max(400_000, "Assinatura grande demais."),
  aceite: z.literal(true, { message: "É preciso marcar “Li e concordo”." }),
});
export type EntradaAssinatura = z.infer<typeof entradaSchema>;

export type LeadParaContrato = {
  nome: string; cpf: string | null; cnpj: string | null; email: string | null;
  whatsapp: string | null; whatsappDdi: string; empresa: string | null; cargo: string | null;
  endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; pais: string | null;
};

export const docLead = (l: Pick<LeadParaContrato, "cpf" | "cnpj">) => l.cnpj || l.cpf || "";

const fmtDoc = (d: string) => (d.length === 14 ? fmtCnpj(d) : fmtCpf(d));

function enderecoCompleto(l: LeadParaContrato) {
  const rua = [l.endereco, l.numero].filter(Boolean).join(", ") + (l.complemento ? ` (${l.complemento})` : "");
  const cidade = [l.cidade, l.uf].filter(Boolean).join("/");
  const partes = [rua, l.bairro, cidade, l.cep ? `CEP ${fmtCep(l.cep)}` : "", l.pais && l.pais !== "Brasil" ? l.pais : ""];
  return partes.filter((p) => p && p.trim()).join(" - ");
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function montarValores(
  lead: LeadParaContrato,
  e: { mensalidadeCents: number; plano: string; vencimento: number; medicoTrabalho: boolean; limiteVidas: number },
  coletorNome: string,
  quando: Date,
): Record<string, string> {
  const doc = docLead(lead);
  return {
    nome: lead.nome,
    documento: doc ? fmtDoc(doc) : "",
    email: lead.email ?? "",
    whatsapp: fmtWhats(lead.whatsapp, lead.whatsappDdi),
    endereco_completo: enderecoCompleto(lead),
    empresa: lead.empresa ?? "",
    cargo: lead.cargo ?? "",
    coletor: coletorNome,
    data: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(quando),
    local: "São Paulo/SP",
    mensalidade: brl(e.mensalidadeCents),
    plano: e.plano,
    vencimento: String(e.vencimento),
    medico_trabalho: e.medicoTrabalho ? "contratado (+ R$ 200,00 por mês)" : "não contratado",
    limite_vidas: e.limiteVidas.toLocaleString("pt-BR"),
  };
}
```

> Nota: `fmtCep`, `fmtCnpj`, `fmtCpf`, `fmtWhats` já são exportadas por `src/lib/leads.ts`. `leads.ts` não importa `server-only`; se importar, os testes `tsx` falham — nesse caso extrair só essas funções puras para o teste ou mockar. Verificar com o Step 4.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/contrato-campos.test.ts`
Expected: todos PASS. Se falhar por `import "server-only"` em `leads.ts`/`dinheiro.ts`, rodar com `node --conditions=react-server --import tsx --test …` (a condição faz o pacote `server-only` virar no-op) e usar esse mesmo comando em `test:unit` (`npm pkg set scripts.test:unit="node --conditions=react-server --import tsx --test src/lib/*.test.ts"`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrato-campos.ts src/lib/contrato-campos.test.ts package.json
git commit -m "Contrato: regras de negócio (limite por dia, validação, valores do lead)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `contrato-pdf` — geração do PDF

**Files:**
- Create: `src/lib/contrato-pdf.ts`, `src/lib/contrato-pdf.test.ts`

**Interfaces:**
- Consumes: `Bloco`, `Trecho`, `parseContrato` de `./contrato-render`.
- Produces: `gerarPdfContrato(d: DadosPdf): Promise<Uint8Array>` com
  `type DadosPdf = { titulo: string; textoFinal: string; assinaturaPng: Uint8Array; signatarioNome: string; signatarioDocumento: string; contratadaNome: string; contratadaCnpj: string; evidencias: { assinadoEm: string; ip: string; userAgent: string; hash: string; versao: number; id: string } }`

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/contrato-pdf.test.ts` (gera um PNG 1×1 válido inline):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { gerarPdfContrato } from "./contrato-pdf";

// PNG 1x1 transparente
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const base = {
  titulo: "Contrato de Teste",
  assinaturaPng: PNG,
  signatarioNome: "Ana Souza",
  signatarioDocumento: "529.982.247-25",
  contratadaNome: "CONFORMIDADE PJ SERVIÇOS LTDA",
  contratadaCnpj: "66.914.632/0001-79",
  evidencias: { assinadoEm: "06/10/2026 10:00:00 (Brasília)", ip: "1.2.3.4", userAgent: "UA", hash: "a".repeat(64), versao: 1, id: "abc123" },
};

test("gera um PDF válido com várias páginas para texto longo", async () => {
  const paragrafos = Array.from({ length: 120 }, (_, i) => `${i + 1}.1. Cláusula **importante** número ${i} com acentuação: ação, coração, § 1º — “aspas”.`);
  const texto = ["## 1. Objeto", ...paragrafos, "> ### AVISO", ">", "> Texto do quadro", "[x] PGR", "[ ] CIPA"].join("\n");
  const bytes = await gerarPdfContrato({ ...base, textoFinal: texto });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, `páginas: ${doc.getPageCount()}`);
});

test("caracteres fora da Helvetica não derrubam a geração", async () => {
  const bytes = await gerarPdfContrato({ ...base, signatarioNome: "Łukasz 😀 Souza", textoFinal: "Nome: Łukasz 😀 ✓ → fim" });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
});

test("texto vazio ainda gera PDF com assinatura e evidências", async () => {
  const bytes = await gerarPdfContrato({ ...base, textoFinal: "" });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:unit -- 2>&1 | tail -20` (ou `npx tsx --test src/lib/contrato-pdf.test.ts`) → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/contrato-pdf.ts`:

```ts
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { parseContrato, trechos, type Trecho } from "./contrato-render";

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
  const seguro = (s: string) =>
    [...s.replace(/\r?\n/g, " ")]
      .map((c) => (ok.has(c.codePointAt(0)!) ? c : "?"))
      .join("");

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const nova = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const garantir = (h: number) => {
    if (y - h < M + 20) nova();
  };

  // palavras com a fonte de cada trecho, quebradas por largura
  type Palavra = { t: string; f: PDFFont };
  const quebrar = (ts: Trecho[], tam: number, largura: number): Palavra[][] => {
    const linhas: Palavra[][] = [];
    let linha: Palavra[] = [];
    let w = 0;
    const esp = reg.widthOfTextAtSize(" ", tam);
    for (const tr of ts) {
      const f = tr.b ? neg : reg;
      for (const p of seguro(tr.t).split(/\s+/).filter(Boolean)) {
        const pw = f.widthOfTextAtSize(p, tam);
        if (linha.length && w + esp + pw > largura) {
          linhas.push(linha);
          linha = [];
          w = 0;
        }
        w += (linha.length ? esp : 0) + pw;
        linha.push({ t: p, f });
      }
    }
    if (linha.length) linhas.push(linha);
    return linhas;
  };

  const desenhaLinha = (l: Palavra[], x: number, tam: number, cor = COR) => {
    let cx = x;
    const esp = reg.widthOfTextAtSize(" ", tam);
    for (const p of l) {
      page.drawText(p.t, { x: cx, y, size: tam, font: p.f, color: cor });
      cx += p.f.widthOfTextAtSize(p.t, tam) + esp;
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
      // quadro: barra lateral + fundo cinza claro, desenhado por trechos (pode atravessar páginas)
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
```

> `trechos` é importado só para uso futuro de quadros; se o linter reclamar de import não usado, remover.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test src/lib/contrato-pdf.test.ts` (ou `npm run test:unit`)
Expected: 3 testes PASS. Gerar um PDF de amostra para olhar: `npx tsx -e "import('./src/lib/contrato-pdf').then(async m=>{const {MODELO_INICIAL}=await import('./src/lib/contrato-modelo-inicial');const {preencher}=await import('./src/lib/contrato-render');const {FERRAMENTAS}=await import('./src/lib/contrato-campos');const t=preencher(MODELO_INICIAL,{nome:'Ana Souza',documento:'529.982.247-25',email:'a@x.com',whatsapp:'(12) 99999-1234',endereco_completo:'Rua A, 10',mensalidade:'700,00',plano:'Completo',vencimento:'10',medico_trabalho:'não contratado',limite_vidas:'1.300',data:'06/10/2026',local:'São Paulo/SP'},{todas:FERRAMENTAS,marcadas:FERRAMENTAS}).texto;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');const b=await m.gerarPdfContrato({titulo:'Contrato de Licença de Uso da Plataforma ConformidadePJ',textoFinal:t,assinaturaPng:png,signatarioNome:'Ana Souza',signatarioDocumento:'529.982.247-25',contratadaNome:'CONFORMIDADE PJ SERVIÇOS LTDA',contratadaCnpj:'66.914.632/0001-79',evidencias:{assinadoEm:'x',ip:'1.1.1.1',userAgent:'UA',hash:'a'.repeat(64),versao:1,id:'x'}});require('fs').writeFileSync(process.env.TEMP+'/amostra.pdf',b);console.log('ok',b.length)})"` e abrir `%TEMP%/amostra.pdf` para conferir visualmente (quadros, check do Anexo I, assinatura).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrato-pdf.ts src/lib/contrato-pdf.test.ts
git commit -m "Contrato: geração do PDF assinado com pdf-lib" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Modelo no banco e tela do admin

**Files:**
- Create: `src/lib/contrato-modelo.ts`, `src/app/admin/config/contrato/page.tsx`, `src/app/admin/config/contrato/editor.tsx`, `src/app/admin/config/contrato/actions.ts`
- Modify: `src/app/admin/config/page.tsx`

**Interfaces:**
- Consumes: `MODELO_INICIAL`, `TITULO_INICIAL`; `VARIAVEIS`, `variaveisUsadas`, `parseContrato`, `preencher` de `contrato-render`; `FERRAMENTAS` de `contrato-render`; `requireAdmin`.
- Produces:
  - `modeloVigente(tenantId: string): Promise<{ id: string; versao: number; titulo: string; corpo: string }>` (cria a v1 se não existir, tolerante a corrida)
  - `salvarModelo(prev: ModeloState, fd: FormData): Promise<ModeloState>` com `type ModeloState = { erro?: string; ok?: string }`
  - `validarModelo(titulo: string, corpo: string): string | null` (mensagem de erro ou null)

- [ ] **Step 1: Implementar `src/lib/contrato-modelo.ts`**

```ts
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MODELO_INICIAL, TITULO_INICIAL } from "./contrato-modelo-inicial";
import { VARIAVEIS, variaveisUsadas } from "./contrato-render";

const MAX_CORPO = 200_000;

export async function modeloVigente(tenantId: string) {
  const achar = () =>
    prisma.modeloContrato.findFirst({
      where: { tenantId },
      orderBy: { versao: "desc" },
      select: { id: true, versao: true, titulo: true, corpo: true },
    });
  const atual = await achar();
  if (atual) return atual;
  try {
    return await prisma.modeloContrato.create({
      data: { tenantId, versao: 1, titulo: TITULO_INICIAL, corpo: MODELO_INICIAL, criadoPorNome: "Modelo inicial" },
      select: { id: true, versao: true, titulo: true, corpo: true },
    });
  } catch (e) {
    // duas requisições criando a v1 ao mesmo tempo: a segunda cai aqui
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const de_novo = await achar();
      if (de_novo) return de_novo;
    }
    throw e;
  }
}

export function validarModelo(titulo: string, corpo: string): string | null {
  if (titulo.trim().length < 3) return "Informe o título do contrato.";
  if (corpo.trim().length < 50) return "O texto do contrato está vazio ou curto demais.";
  if (corpo.length > MAX_CORPO) return "O texto do contrato é grande demais (máximo 200 KB).";
  const conhecidas = new Set<string>(VARIAVEIS);
  const desconhecidas = variaveisUsadas(corpo).filter((v) => !conhecidas.has(v));
  if (desconhecidas.length) {
    return `Variável desconhecida: ${desconhecidas.map((v) => `{{${v}}}`).join(", ")}. Confira a lista ao lado do editor.`;
  }
  return null;
}
```

- [ ] **Step 2: Server action `src/app/admin/config/contrato/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { modeloVigente, validarModelo } from "@/lib/contrato-modelo";

export type ModeloState = { erro?: string; ok?: string };

export async function salvarModelo(_prev: ModeloState, fd: FormData): Promise<ModeloState> {
  const admin = await requireAdmin();
  const titulo = String(fd.get("titulo") ?? "").trim();
  const corpo = String(fd.get("corpo") ?? "").replace(/\r\n?/g, "\n");
  const erro = validarModelo(titulo, corpo);
  if (erro) return { erro };

  const atual = await modeloVigente(admin.tenantId);
  if (atual.titulo === titulo && atual.corpo === corpo) return { ok: "Nada mudou: o texto é igual à versão atual." };

  try {
    const novo = await prisma.modeloContrato.create({
      data: { tenantId: admin.tenantId, versao: atual.versao + 1, titulo, corpo, criadoPorNome: admin.nome },
    });
    revalidatePath("/admin/config/contrato");
    return { ok: `Versão ${novo.versao} salva. Novas assinaturas já usam este texto.` };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { erro: "Outra pessoa salvou uma versão agora. Recarregue a página e tente de novo." };
    }
    throw e;
  }
}
```

- [ ] **Step 3: Editor client `editor.tsx`** — textarea (altura 70vh, fonte mono), campo título, lista de variáveis clicáveis que inserem `{{nome}}` na posição do cursor, aba "Pré-visualização" que renderiza `parseContrato(preencher(corpo, EXEMPLO, { todas: FERRAMENTAS, marcadas: FERRAMENTAS }).texto)` (com valores de exemplo; variáveis faltantes ficam visíveis como `{{x}}`), e botão Salvar (`useActionState(salvarModelo, {})`) com mensagens `erro`/`ok` no padrão do `comissao-form.tsx`. Componente `Blocos({ blocos })` exportado de `src/components/contrato-blocos.tsx` (criar nesta tarefa, reaproveitado na tela de assinatura): renderiza `titulo` → `<h3 className="mt-5 text-lg font-bold text-orange-700">`, `par` → `<p className="my-2 leading-relaxed">` com `<strong>` nos trechos `b`, `item` → `<li>` dentro de `<ul className="ml-5 list-disc">`, `caixa` → `<div className="my-3 border-l-4 border-slate-900 bg-slate-100 p-3">` com título `text-xs font-bold uppercase tracking-wide text-orange-700`, `check` → linha com `<span>` quadrado marcado/desmarcado + texto em caixa alta.

Código de `src/components/contrato-blocos.tsx`:

```tsx
import type { Bloco, Trecho } from "@/lib/contrato-render";

function Tr({ ts }: { ts: Trecho[] }) {
  return (
    <>
      {ts.map((x, i) => (x.b ? <strong key={i}>{x.t}</strong> : <span key={i}>{x.t}</span>))}
    </>
  );
}

export function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <div className="text-[15px] leading-relaxed text-slate-900">
      {blocos.map((b, i) => {
        if (b.tipo === "titulo") return <h3 key={i} className="mt-5 text-lg font-bold text-orange-700">{b.texto}</h3>;
        if (b.tipo === "par") return <p key={i} className="my-2"><Tr ts={b.trechos} /></p>;
        if (b.tipo === "item") return <ul key={i} className="ml-5 list-disc"><li><Tr ts={b.trechos} /></li></ul>;
        if (b.tipo === "check")
          return (
            <p key={i} className="my-1 flex items-center gap-2 text-sm font-semibold uppercase">
              <span aria-hidden className={`inline-flex h-4 w-4 items-center justify-center rounded border border-slate-900 text-[11px] text-white ${b.marcado ? "bg-slate-900" : "bg-white"}`}>{b.marcado ? "✓" : ""}</span>
              <span>{b.texto}</span>
            </p>
          );
        return (
          <div key={i} className="my-3 border-l-4 border-slate-900 bg-slate-100 p-3">
            {b.titulo && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-700">{b.titulo}</p>}
            {b.pars.map((p, j) => <p key={j} className="my-1.5"><Tr ts={p} /></p>)}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Página `page.tsx`** (server component)

```tsx
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtData } from "@/lib/leads";
import { modeloVigente } from "@/lib/contrato-modelo";
import { AppShell } from "@/components/app-shell";
import { EditorModelo } from "./editor";

export default async function ModeloContratoPage() {
  const admin = await requireAdmin();
  const atual = await modeloVigente(admin.tenantId);
  const versoes = await prisma.modeloContrato.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: { versao: "desc" },
    select: { versao: true, criadoPorNome: true, createdAt: true, _count: { select: { assinaturas: true } } },
  });
  return (
    <AppShell user={admin} title="Modelo de contrato">
      <EditorModelo titulo={atual.titulo} corpo={atual.corpo} versao={atual.versao} />
      <section className="card mt-4 lg:max-w-xl">
        <h2 className="mb-2 text-lg font-bold text-slate-900">Versões</h2>
        <ul className="space-y-1 text-slate-700">
          {versoes.map((v) => (
            <li key={v.versao}>
              Versão {v.versao} · {v.criadoPorNome ?? "—"} · {fmtData(v.createdAt)} · {v._count.assinaturas} assinatura(s)
              {v.versao === atual.versao && <strong> (vigente)</strong>}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
```

`EditorModelo({ titulo, corpo, versao })` é o client component do Step 3 (`"use client"`, `useActionState(salvarModelo, {})`, textarea `name="corpo"` com `defaultValue={corpo}`, input `name="titulo"`).

- [ ] **Step 5: Link na Config** — em `src/app/admin/config/page.tsx`, acrescentar depois de `<ComissaoForm …/>`:

```tsx
<Link href="/admin/config/contrato" className="card mt-4 block lg:max-w-xl">
  <h2 className="text-lg font-bold text-slate-900">Modelo de contrato</h2>
  <p className="text-sm text-slate-600">Editar o texto que o cliente assina no estande.</p>
</Link>
```
(importar `Link from "next/link"`).

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` sem erros; `npx eslint src/app/admin/config src/components/contrato-blocos.tsx src/lib/contrato-modelo.ts` sem erros. (A verificação funcional completa é a do Task 8.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/contrato-modelo.ts src/app/admin/config src/components/contrato-blocos.tsx
git commit -m "Contrato: modelo versionado e tela de edição do admin" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: API de assinatura e download do PDF

**Files:**
- Create: `src/app/api/leads/[id]/assinatura/route.ts`, `src/app/api/assinaturas/[id]/pdf/route.ts`

**Interfaces:**
- Consumes: `getSessionUser`, `escopoLead`, `modeloVigente`, `entradaSchema`, `limiteDoDia`, `agora`, `montarValores`, `hashTexto`, `FERRAMENTAS`, `preencher`, `gerarPdfContrato`, `enviarAudio(key, bytes, mime)` e `urlAudio(key, mime)` de `@/lib/storage` (funções genéricas de upload/URL assinada apesar do nome), `parseBRL`.
- Produces: `POST /api/leads/[id]/assinatura` → `201 { id }` | `400 { erro, erros?: {campo, mensagem}[] }` | `401` | `404` | `409` | `413` | `429` | `503`; `GET /api/assinaturas/[id]/pdf` → 302 para URL assinada (5 min) | `401` | `404` | `503`.

- [ ] **Step 1: Implementar `POST`**

`src/app/api/leads/[id]/assinatura/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { escopoLead } from "@/lib/leads";
import { parseBRL } from "@/lib/dinheiro";
import { enviarAudio, storageConfigurado } from "@/lib/storage";
import { modeloVigente } from "@/lib/contrato-modelo";
import { preencher } from "@/lib/contrato-render";
import { FERRAMENTAS, agora, entradaSchema, hashTexto, limiteDoDia, montarValores } from "@/lib/contrato-campos";
import { gerarPdfContrato } from "@/lib/contrato-pdf";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PNG = 200 * 1024;
const MIN_PNG = 600; // um toque solto gera PNG minúsculo: exige traço de verdade
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 20 assinaturas / 10 min por usuário (instância em memória: freio simples contra abuso)
const janela = new Map<string, number[]>();
function acimaDoLimite(userId: string) {
  const agoraMs = Date.now();
  const l = (janela.get(userId) ?? []).filter((t) => agoraMs - t < 10 * 60_000);
  l.push(agoraMs);
  janela.set(userId, l);
  return l.length > 20;
}

function decodificarPng(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  if (bytes.byteLength > MAX_PNG || bytes.byteLength < MIN_PNG) return null;
  return PNG_MAGIC.every((b, i) => bytes[i] === b) ? bytes : null;
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!storageConfigurado()) return NextResponse.json({ erro: "Armazenamento não configurado." }, { status: 503 });
  if (acimaDoLimite(user.id)) return NextResponse.json({ erro: "Muitas assinaturas seguidas. Aguarde alguns minutos." }, { status: 429 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }
  const r = entradaSchema.safeParse(corpo);
  if (!r.success) {
    const erros = r.error.issues.map((i) => ({ campo: String(i.path[0] ?? ""), mensagem: i.message }));
    return NextResponse.json({ erro: erros[0]?.mensagem ?? "Dados inválidos.", erros }, { status: 400 });
  }
  const e = r.data;

  const png = decodificarPng(e.assinaturaPng);
  if (!png) {
    return NextResponse.json({ erro: "Assinatura ausente ou muito simples. Desenhe a assinatura de novo.", erros: [{ campo: "assinaturaPng", mensagem: "Assinatura inválida." }] }, { status: 400 });
  }

  const quando = agora();
  const limite = limiteDoDia(quando) ?? e.limiteVidas;
  if (!limite) {
    return NextResponse.json({ erro: "Fora dos dias da feira: informe o limite de vidas.", erros: [{ campo: "limiteVidas", mensagem: "Informe o limite de vidas." }] }, { status: 400 });
  }
  const mensalidadeCents = parseBRL(e.mensalidade)!;

  const modelo = await modeloVigente(user.tenantId);
  const valores = montarValores(
    lead,
    { mensalidadeCents, plano: e.plano, vencimento: e.vencimento, medicoTrabalho: e.medicoTrabalho, limiteVidas: limite },
    user.nome,
    quando,
  );
  const { texto, faltantes } = preencher(modelo.corpo, valores, { todas: FERRAMENTAS, marcadas: e.ferramentas });
  if (faltantes.length) {
    const rot: Record<string, string> = { email: "e-mail", documento: "CPF ou CNPJ", endereco_completo: "endereço", whatsapp: "WhatsApp" };
    const nomes = faltantes.map((f) => rot[f] ?? f).join(", ");
    return NextResponse.json({ erro: `Faltam dados do lead para o contrato: ${nomes}. Edite o lead e tente de novo.`, faltantes }, { status: 400 });
  }
  const hash = hashTexto(texto);

  // toque duplo / reenvio: a mesma assinatura (mesmo texto) nos últimos 60 s devolve a já gravada
  const recente = await prisma.assinaturaContrato.findFirst({
    where: { tenantId: user.tenantId, leadId: lead.id, hashSha256: hash, assinadoEm: { gte: new Date(quando.getTime() - 60_000) } },
    select: { id: true },
  });
  if (recente) return NextResponse.json({ id: recente.id }, { status: 200 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  const userAgent = (req.headers.get("user-agent") ?? "desconhecido").slice(0, 300);
  const sufixo = `${Date.now()}`;
  const base = `${user.tenantId}/${lead.id}/assinaturas/${sufixo}`;
  const assinaturaKey = `${base}-assinatura.png`;
  const pdfKey = `${base}-contrato.pdf`;

  let pdf: Uint8Array;
  try {
    pdf = await gerarPdfContrato({
      titulo: modelo.titulo,
      textoFinal: texto,
      assinaturaPng: png,
      signatarioNome: e.signatarioNome,
      signatarioDocumento: e.signatarioDocumento.length === 14
        ? e.signatarioDocumento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
        : e.signatarioDocumento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"),
      contratadaNome: "CONFORMIDADE PJ SERVIÇOS LTDA",
      contratadaCnpj: "66.914.632/0001-79",
      evidencias: {
        assinadoEm: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(quando) + " (Brasília)",
        ip,
        userAgent,
        hash,
        versao: modelo.versao,
        id: sufixo,
      },
    });
    await enviarAudio(assinaturaKey, png, "image/png");
    await enviarAudio(pdfKey, pdf, "application/pdf");
  } catch (err) {
    console.error("Assinatura: falha ao gerar/guardar", err);
    const tipo = err instanceof Error ? err.name : "desconhecido";
    return NextResponse.json({ erro: `Não foi possível gerar o contrato (${tipo}). Tente de novo.` }, { status: 502 });
  }

  const criada = await prisma.assinaturaContrato.create({
    data: {
      tenantId: user.tenantId,
      leadId: lead.id,
      modeloId: modelo.id,
      colaboradorId: user.id,
      colaboradorNome: user.nome,
      textoFinal: texto,
      campos: {
        mensalidadeCents, plano: e.plano, vencimento: e.vencimento, medicoTrabalho: e.medicoTrabalho,
        ferramentas: e.ferramentas, limiteVidas: limite, limiteManual: limiteDoDia(quando) === null,
      },
      hashSha256: hash,
      assinaturaKey,
      pdfKey,
      signatarioNome: e.signatarioNome,
      signatarioDocumento: e.signatarioDocumento,
      ip,
      userAgent,
      assinadoEm: quando,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: criada.id }, { status: 201 });
}
```

> O PNG ≥ `MIN_PNG` bytes é um filtro simples: um traço real de canvas 600×200 passa de 1 KB; um toque único fica abaixo. Se o teste do Task 8 mostrar que traços curtos legítimos são recusados, ajustar a constante (não removê-la).

- [ ] **Step 2: Implementar `GET` do PDF**

`src/app/api/assinaturas/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { escopoLead } from "@/lib/leads";
import { urlAudio } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Redireciona para o PDF no R2 (URL de 5 min) depois de checar tenant + escopo do lead. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ass = await prisma.assinaturaContrato.findFirst({
    where: { id, tenantId: user.tenantId, lead: escopoLead(user) },
    select: { pdfKey: true },
  });
  if (!ass) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  try {
    const url = await urlAudio(ass.pdfKey, "application/pdf");
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ erro: "PDF indisponível." }, { status: 503 });
  }
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` e `npx eslint src/app/api` sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leads src/app/api/assinaturas
git commit -m "Contrato: API de assinatura (texto montado no servidor, PDF no R2) e download seguro" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tela de assinatura, card no lead e bloqueio de exclusão

**Files:**
- Create: `src/app/coletor/leads/[id]/assinar/page.tsx`, `src/app/coletor/leads/[id]/assinar/assinar-form.tsx`, `src/components/assinatura-card.tsx`
- Modify: `src/app/coletor/leads/[id]/page.tsx`, `src/app/coletor/actions.ts`

**Interfaces:**
- Consumes: `modeloVigente`, `preencher`, `parseContrato`, `montarValores`, `limiteDoDia`, `agora`, `FERRAMENTAS`, `docLead`; `Blocos` de `@/components/contrato-blocos`; rota `POST /api/leads/[id]/assinatura`.
- Produces: rota `/coletor/leads/[id]/assinar`; `<AssinaturaCard leadId assinaturas />`.

- [ ] **Step 1: `page.tsx` (server)** — carrega lead com `escopoLead`, `modeloVigente`, `limiteDoDia(agora())`; calcula **pré-visualização com os dados do lead** usando `montarValores` com os padrões (mensalidade 70000, plano vazio→"—") apenas para exibir; passa ao client: `leadId`, `lead` mínimo (nome, documento sugerido via `docLead`, faltando: lista de campos obrigatórios do lead ausentes — `email`, documento, endereço), `modelo: { corpo, titulo, versao }`, `limiteAuto: number | null`. Se faltar e-mail/documento/endereço, mostrar aviso "Complete o cadastro do lead" com link para `/coletor/leads/{id}/editar` e **não** renderizar o formulário.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { modeloVigente } from "@/lib/contrato-modelo";
import { agora, docLead, limiteDoDia, montarValores } from "@/lib/contrato-campos";
import { AssinarForm } from "./assinar-form";

export default async function AssinarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
  if (!lead) notFound();

  const faltando = [
    !lead.email && "e-mail",
    !docLead(lead) && "CPF ou CNPJ",
    !lead.endereco && "endereço",
  ].filter(Boolean) as string[];

  return (
    <AppShell user={user} title="Contrato para assinar">
      {faltando.length ? (
        <div className="card space-y-3">
          <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
            Faltam dados do lead para o contrato: {faltando.join(", ")}.
          </p>
          <Link href={`/coletor/leads/${lead.id}/editar`} className="btn btn-primary w-full">Completar cadastro</Link>
        </div>
      ) : (
        await (async () => {
          const modelo = await modeloVigente(user.tenantId);
          const quando = agora();
          const limiteAuto = limiteDoDia(quando);
          const valores = montarValores(
            lead,
            { mensalidadeCents: 0, plano: "", vencimento: 0, medicoTrabalho: false, limiteVidas: limiteAuto ?? 0 },
            user.nome,
            quando,
          );
          // só os dados do lead seguem para o navegador; o texto final é montado no servidor ao assinar
          const dadosLead = {
            nome: valores.nome, documento: valores.documento, email: valores.email, whatsapp: valores.whatsapp,
            endereco_completo: valores.endereco_completo, empresa: valores.empresa, cargo: valores.cargo,
            coletor: valores.coletor, data: valores.data, local: valores.local,
          };
          return (
            <AssinarForm
              leadId={lead.id}
              modelo={{ corpo: modelo.corpo, titulo: modelo.titulo, versao: modelo.versao }}
              dadosLead={dadosLead}
              limiteAuto={limiteAuto}
              documentoInicial={docLead(lead)}
              nomeInicial={lead.nome}
            />
          );
        })()
      )}
    </AppShell>
  );
}
```

- [ ] **Step 2: `assinar-form.tsx` (client)** — passos em uma única tela:
  1. **Campos do contrato**: `mensalidade` (input `inputMode="decimal"`, `defaultValue="700,00"`, usa `maskBRL` de `@/lib/dinheiro`), `plano` (texto, obrigatório), `vencimento` (select 1–28), `medicoTrabalho` (checkbox "Contratar médico do trabalho (+ R$ 200,00/mês)"), `ferramentas` (10 checkboxes todos marcados), `limiteVidas` (input numérico só aparece/obrigatório quando `limiteAuto === null`; quando há `limiteAuto`, mostra "Limite de vidas pelo dia da assinatura: N").
  2. **Leitura**: `Blocos` com `parseContrato(preencher(modelo.corpo, { ...dadosLead, mensalidade, plano, vencimento, medico_trabalho, limite_vidas }, { todas: FERRAMENTAS, marcadas }).texto)` dentro de um `div` com `max-h-[60vh] overflow-y-auto` e `onScroll` que marca `leuTudo` quando `scrollTop + clientHeight >= scrollHeight - 24` (se o conteúdo não rola, `leuTudo` = true). Exibir "Role até o fim para liberar a assinatura."
  3. **Assinatura**: nome (`nomeInicial`) e CPF/CNPJ (`documentoInicial`, `maskCpf`/`maskCnpj` conforme tamanho), canvas 600×200 (CSS `w-full`, `touch-action: none`) com pointer events (`pointerdown/move/up`, `lineWidth 2.5`, `lineCap round`, `strokeStyle #0f172a`), botão "Limpar", checkbox "Li e concordo com o contrato" (desabilitado até `leuTudo`), botão "Assinar" (desabilitado até `leuTudo && aceite && temTraco`). `temTraco` vira true após ≥ 3 pontos desenhados em um `pointermove`.
  4. Envio: `fetch(`/api/leads/${leadId}/assinatura`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ mensalidade, plano, vencimento: Number(vencimento), medicoTrabalho, ferramentas, limiteVidas: limiteAuto === null ? Number(limiteVidas) : undefined, signatarioNome, signatarioDocumento, assinaturaPng: canvas.toDataURL("image/png"), aceite: true }) })`; durante o envio desabilita o botão (evita toque duplo). Em `400`, mostra `erro` e, se houver `erros[].campo`, foca o campo. Em sucesso troca para a tela **"Contrato assinado"**: botão "Ver PDF" (`/api/assinaturas/${id}/pdf`, `target="_blank"`), botão "Enviar por WhatsApp" (`https://wa.me/<fone>?text=` com mensagem "Segue o seu contrato assinado: <origin>/api/assinaturas/<id>/pdf" — o link exige login, então a mensagem deve dizer "Em anexo o PDF" e o coletor anexa o PDF baixado; texto: "Olá! Segue o contrato assinado da Conformidade PJ (PDF em anexo)."), e "Voltar ao lead".
  Se o canvas for redimensionado (rotação do celular), preservar o desenho: redesenhar a partir de uma lista de traços guardada em `useRef`.

Arquivo completo `src/app/coletor/leads/[id]/assinar/assinar-form.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Blocos } from "@/components/contrato-blocos";
import { FERRAMENTAS, parseContrato, preencher } from "@/lib/contrato-render";
import { maskCnpj, maskCpf } from "@/lib/masks";

type Props = {
  leadId: string;
  modelo: { corpo: string; titulo: string; versao: number };
  dadosLead: Record<string, string>;
  limiteAuto: number | null;
  documentoInicial: string;
  nomeInicial: string;
  linkWhatsApp: string | null;
};

const MEDICO = "contratado (+ R$ 200,00 por mês)";

export function AssinarForm(p: Props) {
  const [mensalidade, setMensalidade] = useState("700,00");
  const [plano, setPlano] = useState("");
  const [vencimento, setVencimento] = useState("10");
  const [medico, setMedico] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([...FERRAMENTAS]);
  const [limiteManual, setLimiteManual] = useState("");
  const [leuTudo, setLeuTudo] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [nome, setNome] = useState(p.nomeInicial);
  const [doc, setDoc] = useState(
    p.documentoInicial.length === 14 ? maskCnpj(p.documentoInicial) : maskCpf(p.documentoInicial),
  );
  const [temTraco, setTemTraco] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const leitura = useRef<HTMLDivElement>(null);
  const desenhando = useRef(false);
  const pontos = useRef(0);

  // pré-visualização; o texto final (e o que vale) é montado no servidor ao assinar
  const blocos = useMemo(() => {
    const limite = p.limiteAuto !== null ? p.limiteAuto.toLocaleString("pt-BR") : limiteManual.trim();
    const { texto } = preencher(
      p.modelo.corpo,
      {
        ...p.dadosLead,
        mensalidade: mensalidade.trim() || "—",
        plano: plano.trim() || "(plano a informar)",
        vencimento,
        medico_trabalho: medico ? MEDICO : "não contratado",
        limite_vidas: limite || "(a informar)",
      },
      { todas: FERRAMENTAS, marcadas },
    );
    return parseContrato(texto);
  }, [p.modelo.corpo, p.dadosLead, p.limiteAuto, mensalidade, plano, vencimento, medico, limiteManual, marcadas]);

  // contrato curto que não rola: já conta como lido
  useEffect(() => {
    const el = leitura.current;
    if (el && el.scrollHeight <= el.clientHeight + 24) setLeuTudo(true);
  }, [blocos]);

  function aoRolar() {
    const el = leitura.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLeuTudo(true);
  }

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }
  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhando.current = true;
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    pontos.current += 1;
    if (pontos.current >= 15) setTemTraco(true);
  }
  function terminar() {
    desenhando.current = false;
  }
  function limpar() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    pontos.current = 0;
    setTemTraco(false);
  }

  const alternar = (f: string) =>
    setMarcadas((m) => (m.includes(f) ? m.filter((x) => x !== f) : [...m, f]));

  const camposOk =
    plano.trim().length >= 2 &&
    marcadas.length > 0 &&
    (p.limiteAuto !== null || Number(limiteManual) >= 1) &&
    nome.trim().length >= 3 &&
    doc.replace(/\D/g, "").length >= 11;
  const podeAssinar = camposOk && leuTudo && aceite && temTraco && !enviando;

  async function assinar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/leads/${p.leadId}/assinatura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensalidade,
          plano,
          vencimento: Number(vencimento),
          medicoTrabalho: medico,
          ferramentas: FERRAMENTAS.filter((f) => marcadas.includes(f)),
          limiteVidas: p.limiteAuto === null ? Number(limiteManual) : undefined,
          signatarioNome: nome,
          signatarioDocumento: doc,
          assinaturaPng: canvas.current!.toDataURL("image/png"),
          aceite: true,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; erro?: string };
      if (!r.ok || !j.id) {
        setErro(j.erro ?? "Não foi possível assinar. Tente de novo.");
        return;
      }
      setFeito(j.id);
    } catch {
      setErro("Sem conexão. Verifique a internet e toque em Assinar de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    const msg = encodeURIComponent("Olá! Segue o contrato assinado da Conformidade PJ (PDF em anexo).");
    return (
      <div className="card space-y-3 lg:max-w-xl">
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-lg font-bold text-emerald-800">
          Contrato assinado.
        </p>
        <a href={`/api/assinaturas/${feito}/pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
          Ver / baixar PDF
        </a>
        {p.linkWhatsApp && (
          <a href={`${p.linkWhatsApp}?text=${msg}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
            Abrir WhatsApp do cliente (anexe o PDF)
          </a>
        )}
        <Link href={`/coletor/leads/${p.leadId}`} className="btn btn-ghost w-full">
          Voltar ao lead
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:max-w-3xl">
      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-slate-900">1. Dados do contrato</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Mensalidade (R$)</span>
          <input name="mensalidade" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} inputMode="decimal" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Plano</span>
          <input name="plano" value={plano} onChange={(e) => setPlano(e.target.value)} className="field" autoComplete="off" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Dia do vencimento</span>
          <select name="vencimento" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="field">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="medico" checked={medico} onChange={(e) => setMedico(e.target.checked)} className="h-6 w-6" />
          <span className="font-medium text-slate-800">Contratar médico do trabalho (+ R$ 200,00 por mês)</span>
        </label>
        {p.limiteAuto !== null ? (
          <p className="text-slate-700">
            Limite de vidas pelo dia da assinatura: <strong>{p.limiteAuto.toLocaleString("pt-BR")}</strong>
          </p>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Limite de vidas (fora dos dias da feira)</span>
            <input name="limiteVidas" value={limiteManual} onChange={(e) => setLimiteManual(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="field" />
          </label>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-slate-700">Ferramentas (Anexo I)</legend>
          {FERRAMENTAS.map((f) => (
            <label key={f} className="flex items-center gap-3">
              <input type="checkbox" checked={marcadas.includes(f)} onChange={() => alternar(f)} className="h-5 w-5" />
              <span className="text-slate-800">{f}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold text-slate-900">2. Leitura do contrato</h2>
        <p className="text-sm text-slate-600">Peça ao cliente para ler e rolar até o fim para liberar a assinatura.</p>
        <div ref={leitura} onScroll={aoRolar} data-testid="leitura" className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 p-3">
          <h1 className="text-xl font-bold text-slate-900">{p.modelo.titulo}</h1>
          <Blocos blocos={blocos} />
        </div>
        {!leuTudo && <p className="text-sm font-semibold text-amber-700">Role até o fim para liberar a assinatura.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-slate-900">3. Assinatura do cliente</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Nome completo de quem assina</span>
          <input name="signatarioNome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">CPF ou CNPJ</span>
          <input
            name="signatarioDocumento"
            value={doc}
            inputMode="numeric"
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 14);
              setDoc(d.length > 11 ? maskCnpj(d) : maskCpf(d));
            }}
            className="field"
          />
        </label>
        <div>
          <canvas
            ref={canvas}
            width={600}
            height={200}
            data-testid="assinatura"
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            className="h-40 w-full rounded-xl border-2 border-dashed border-slate-400 bg-white"
            style={{ touchAction: "none" }}
          />
          <button type="button" onClick={limpar} className="btn btn-ghost mt-2 w-full">Limpar assinatura</button>
        </div>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="aceite" checked={aceite} disabled={!leuTudo} onChange={(e) => setAceite(e.target.checked)} className="h-6 w-6" />
          <span className="font-medium text-slate-800">Li e concordo com o contrato</span>
        </label>
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">{erro}</p>}
        <button type="button" onClick={assinar} disabled={!podeAssinar} className="btn btn-primary w-full">
          {enviando ? "Assinando…" : "Assinar"}
        </button>
      </section>
    </div>
  );
}
```

Na `page.tsx`, passar também `linkWhatsApp={lead.whatsapp ? linkWhats(lead.whatsapp, lead.whatsappDdi) : null}` (importar `linkWhats` de `@/lib/leads`).


- [ ] **Step 3: `assinatura-card.tsx`** e integração em `src/app/coletor/leads/[id]/page.tsx`

```tsx
import Link from "next/link";
import { fmtData } from "@/lib/leads";

export type AssinaturaResumo = { id: string; assinadoEm: Date; signatarioNome: string };

export function AssinaturaCard({ leadId, assinaturas }: { leadId: string; assinaturas: AssinaturaResumo[] }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-bold text-slate-900">Contrato de adesão</h2>
      {assinaturas.length === 0 && <p className="text-slate-600">Ainda não assinado.</p>}
      {assinaturas.map((a) => (
        <p key={a.id} className="text-slate-700">
          Assinado por <strong>{a.signatarioNome}</strong> em {fmtData(a.assinadoEm)} ·{" "}
          <a href={`/api/assinaturas/${a.id}/pdf`} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-700 underline">
            Baixar PDF
          </a>
        </p>
      ))}
      <Link href={`/coletor/leads/${leadId}/assinar`} className="btn btn-primary w-full">
        {assinaturas.length ? "Assinar novamente" : "Coletar assinatura"}
      </Link>
    </section>
  );
}
```

Na `page.tsx` do lead: incluir `assinaturas: { orderBy: { assinadoEm: "desc" }, select: { id: true, assinadoEm: true, signatarioNome: true } }` no `include` da consulta e renderizar `<AssinaturaCard leadId={lead.id} assinaturas={lead.assinaturas} />` logo abaixo de `<ContratoCard … />`.

- [ ] **Step 4: Bloquear exclusão de lead com assinatura** — em `excluirLead` (`src/app/coletor/actions.ts`), incluir `_count: { select: { assinaturas: true } }` no `select` e, depois do bloco do contrato ativo:

```ts
if (lead._count.assinaturas > 0) {
  return { ok: false, erro: "Este lead tem contrato assinado, que fica guardado como comprovante. Ele não pode ser excluído." };
}
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit`, `npx eslint src` sem erros; `npm run build` compila.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Contrato: tela de assinatura no celular, card no lead e bloqueio de exclusão" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Teste ponta a ponta, regressão e publicação

**Files:**
- Create (scratchpad, fora do repo): `...\scratchpad\pg\e2e11.mjs`
- Modify: `.env.example` (documentar `TESTE_AGORA` como variável só de teste local)

**Interfaces:** Consumes tudo acima. Usa os helpers existentes do scratchpad (`preencher.mjs`, padrão de `e2e5.mjs` para subir o servidor com R2 falso: `R2_ENDPOINT: "http://localhost:4568", R2_ACCESS_KEY_ID: "S3RVER", R2_SECRET_ACCESS_KEY: "S3RVER", R2_BUCKET: "coletador-audio"`, e o relógio com `TESTE_AGORA`).

- [ ] **Step 1: Subir infraestrutura local** — Postgres embutido (`node start2.mjs`), banco recriado (`node recreate.mjs` + `prisma migrate deploy` + seed com `SEED_ADMIN_CODIGO=W8X4B-S2R6Z`), S3 falso (`node s3.mjs` em background), `npm run build`.

- [ ] **Step 2: Escrever `e2e11.mjs`** seguindo o esqueleto de `e2e8.mjs` (servidor via `next start -p 3100` com `TESTE_AGORA=2026-10-06T15:00:00Z` e as variáveis do R2 falso; login admin `W8X4B-S2R6Z`; helpers `ok`, `esperar`, `clicarBotao`). Cenários, cada um com `ok(...)`:
  1. **Modelo inicial**: `GET /admin/config/contrato` contém "Contrato de Licença de Uso" e "Versão 1 · Modelo inicial … (vigente)"; `select count(*) from modelos_contrato` = 1.
  2. **Edição gera versão**: acrescenta ` EDITADO-V2` ao título via campo `titulo`, salva → mensagem "Versão 2 salva"; banco: 2 linhas, v1 intacta (corpo igual).
  3. **Variável desconhecida bloqueia**: corpo com `{{xyz}}` → "Variável desconhecida: {{xyz}}"; contagem continua 2.
  4. **Coletor não edita**: cria coletor via `insert` no banco (hash do código com HMAC como em `e2e.mjs`), loga com ele, `GET /admin/config/contrato` redireciona para `/coletor`.
  5. **Assinatura completa**: coletor cria lead completo (helper `preencherObrigatorios`), abre `/coletor/leads/{id}/assinar`; texto mostra o nome do lead e "Limite de vidas pelo dia da assinatura: 1.300"; botão "Assinar" começa desabilitado; preenche plano, rola o contrato até o fim (`element.scrollTop = element.scrollHeight`), marca "Li e concordo", desenha com `page.mouse` (down/move×20/up) no canvas, clica "Assinar"; espera "Contrato assinado". Banco: 1 linha em `assinaturas_contrato` com `hash_sha256` = SHA-256 de `texto_final` (conferir com `crypto`), `texto_final` contém "R$ 700,00", o plano digitado, "1.300 vidas", e nenhuma `{{`; `modelo_id` = versão 2; `campos.limiteManual=false`.
  6. **PDF**: `fetch("/api/assinaturas/{id}/pdf")` com cookies retorna bytes que começam com `%PDF-` (seguir redirect para o S3 falso) e contêm o hash (buscar a string hex no PDF descomprimido não é viável: conferir o hash via `pdf-lib`? — basta conferir `%PDF-`, tamanho > 5 KB e `Content-Type: application/pdf`).
  7. **Isolamento**: outro coletador recebe 404 em `/api/assinaturas/{id}/pdf`; admin recebe 200 (via redirect).
  8. **Reassinar mantém a anterior**: com `TESTE_AGORA` fixo, esperar > 60 s é inviável: validar via banco que alterar `assinado_em` da 1ª para 5 min atrás e assinar de novo cria a 2ª linha (2 linhas, ids distintos); e que assinar duas vezes seguidas (<60 s, mesmo texto) devolve o mesmo id (dedupe) — fazendo o POST direto duas vezes com `fetch` no `page.evaluate`.
  9. **Assinatura inválida**: POST com `assinaturaPng` = PNG 1×1 → 400 com campo `assinaturaPng`; POST com `aceite:false` → 400 "Li e concordo"; POST sem limite fora dos dias (reiniciar o servidor com `TESTE_AGORA=2026-10-20T15:00:00Z`) → 400 "Informe o limite de vidas" e, com `limiteVidas: 500`, 201 e `campos.limiteManual=true`.
  10. **Dados do lead faltando**: lead sem e-mail (inserido direto no banco) → `/assinar` mostra "Faltam dados do lead … e-mail" e não mostra o canvas; POST direto → 400 com "e-mail".
  11. **Injeção**: lead com nome `**Ana** {{cpf}}` → `texto_final` contém "Ana cpf" e não `**Ana**`.
  12. **Exclusão bloqueada**: admin tenta excluir o lead assinado → mensagem "contrato assinado… não pode ser excluído"; lead continua no banco.
  13. **Tela do lead**: mostra "Assinado por" e link "Baixar PDF".

  O arquivo deve terminar como os demais: imprime `TUDO OK`/`N FALHA(S)` e `process.exit`.

- [ ] **Step 3: Rodar `node e2e11.mjs <pasta-de-prints>`**
Expected: `TUDO OK`. Ajustar o código (não o teste) para cada FALHA; reexecutar.

- [ ] **Step 4: Regressão completa** — `npm run test:unit` e, no scratchpad, `e2e.mjs e2e2.mjs e2e3.mjs e2e4.mjs e2e5.mjs e2e7.mjs e2e8.mjs e2e9.mjs e2e10.mjs` (cada um com banco recriado e portas liberadas como nas rodadas anteriores). Expected: todos `TUDO OK`. `e2e4` (exclusão) deve continuar passando: lead sem assinatura exclui normalmente.

- [ ] **Step 5: Conferir o PDF real** — gerar um PDF pelo teste (ou baixar via S3 falso em `s3data`) e abrir no Chrome: texto legível, quadros destacados, Anexo I com 10 check, assinatura visível, bloco de evidências e hash. Mostrar ao usuário.

- [ ] **Step 6: Publicar** — documentar `TESTE_AGORA` no `.env.example` ("só para testes locais; ignorado na Vercel"); `npx tsc --noEmit`; commit; aplicar a migração no Supabase com a URL direta (`DIRECT_URL`, a mesma usada nas migrações anteriores): `npx prisma migrate deploy`; `git push origin main` e conferir o deploy na Vercel (Ready). Smoke em produção: abrir `/admin/config/contrato` como admin (cria a v1 automaticamente) — **sem** criar lead/assinatura de teste em produção sem o usuário pedir.

```bash
git add .env.example
git commit -m "Contrato: documenta TESTE_AGORA e fecha a entrega da assinatura" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin main
```

---

## Self-Review

- **Spec coverage:** modelo versionado/imutável (T1, T5) · variáveis e bloqueio por faltante/desconhecida (T2, T3, T5, T6) · limite por dia em Brasília e manual fora (T3, T6) · hash SHA-256, IP, aparelho, hora do servidor (T3, T4, T6) · PDF com quadros, Anexo I, assinatura, evidências, paginação (T4) · URL assinada, escopo/tenant (T6) · tela de assinatura com rolagem obrigatória, canvas, aceite (T7) · lead com assinatura não exclui (T7) · RLS e limites de tamanho (T1, T6) · testes de edição, assinatura, PDF, isolamento, reassinatura, regressão (T2–T4, T8) · "só online" (nenhuma tarefa mexe no outbox) · contrato atual intacto (nenhum arquivo de `contrato-*`/`ContratoCard` é alterado além de convivência na tela do lead).
- **Placeholders:** o esqueleto do `AssinarForm` (T7 Step 2) descreve a UI em itens 1–4 com todos os campos, nomes, mensagens e o payload exato; o código do esqueleto é só estado/props. É a única parte sem JSX completo — o implementador a conclui seguindo a lista; não há "TBD".
- **Tipos consistentes:** `EntradaAssinatura` ↔ payload do fetch (T7) ↔ `entradaSchema` (T3) ↔ `POST` (T6); `preencher(corpo, valores, { todas, marcadas })` igual em T2, T5, T6, T7; `montarValores` com `{ mensalidadeCents, plano, vencimento, medicoTrabalho, limiteVidas }` igual em T3, T6, T7; `gerarPdfContrato(DadosPdf)` igual em T4 e T6; `modeloVigente()` retorna `{ id, versao, titulo, corpo }` em T5, T6, T7.
- **Review Focus:** (1) injeção de marcação → `limparValor` + testes T2 + cenário 11 do T8; (2) toque duplo → dedupe 60 s + botão desabilitado + cenário 8; (3) assinatura vazia/falsa → `decodificarPng` (cabeçalho, `MIN_PNG`) + cenário 9; (4) fora da feira e lead incompleto → limite manual + `faltantes` + cenários 9 e 10; (5) glifos fora da Helvetica → `seguro()` + teste T4.
- **Pendência declarada:** as duas frases acrescentadas ao texto ({{medico_trabalho}} e {{limite_vidas}}) e a transcrição do PDF precisam da conferência do usuário antes do uso real.
