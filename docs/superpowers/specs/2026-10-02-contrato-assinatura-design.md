# Contrato de adesão com assinatura na tela — design

Data: 2026-10-02 · Prazo: usável no estande até 06/10/2026 (FISP 2026, C93B).

## Objetivo
O admin mantém um **modelo único de contrato** (texto editável com variáveis). No estande, o coletor abre o contrato de um lead, preenche os campos em branco, o cliente lê e **assina desenhando no celular**. O app gera um **PDF assinado** com as evidências da cláusula 12.1 e o entrega no ato (cláusula 12.2).

Fora de escopo: assinatura offline, testemunhas, certificado ICP-Brasil, integração com serviço externo de assinatura, revisão jurídica do texto (responsabilidade do usuário), cobrança Asaas do cliente. Não substitui a tela "Contrato" existente (negócio fechado + aprovação).

## Modelo de dados (Prisma + migração escrita à mão, RLS ligado)
- `ModeloContrato`: id, tenantId, versao (int, única por tenant), titulo, corpo (texto com marcação e variáveis), criadoPorId, criadoEm. Imutável: editar = inserir nova versão. Versão vigente = maior `versao`.
- `AssinaturaContrato`: id, tenantId, leadId, modeloId, colaboradorId (quem coletou), textoFinal (texto já preenchido, exatamente o assinado), campos (JSON: mensalidade, plano, vencimento, medicoTrabalho, ferramentas[], limiteVidas, valores usados), hashSha256 (do textoFinal), assinaturaKey (PNG no R2), pdfKey, signatarioNome, signatarioDocumento, ip, userAgent, assinadoEm (hora do servidor). Imutável; refazer cria nova linha. Índice (tenantId, leadId).
- Seed/migração inicial cria a versão 1 com o texto do PDF enviado (“contrato cliente coletador.pdf”), sem alterações.

## Modelo e variáveis
- Marcação mínima: `## Título`, `**negrito**`, listas `- item`, `> quadro destacado` (parágrafo/quadro “leia com atenção”), linhas em branco separam parágrafos. Renderizada por um único módulo (`src/lib/contrato-render.ts`) que produz uma árvore de blocos usada pela tela e pelo PDF.
- Variáveis do lead: `{{nome}} {{documento}} {{email}} {{whatsapp}} {{endereco_completo}} {{empresa}} {{cargo}} {{coletor}} {{data}} {{local}}`; `{{documento}}` = CNPJ se houver, senão CPF. “Representada por” = `{{nome}}`.
- Variáveis preenchidas na assinatura: `{{mensalidade}} {{plano}} {{vencimento}} {{medico_trabalho}} {{limite_vidas}}` e o Anexo I (`{{ferramentas}}`).
- Variável sem valor no momento da assinatura bloqueia a assinatura e é apontada (nunca vai “{{x}}” para o PDF).

## Regras de negócio
- Campos da assinatura: mensalidade (padrão R$ 700,00), plano (texto), dia de vencimento (1–28), adicional médico do trabalho (sim/não, +R$ 200,00), ferramentas do Anexo I (10, todas marcadas, desmarcáveis).
- Limite de vidas por data da assinatura (hora de Brasília): 06/10/2026 → 1.300; 07/10 → 1.200; 08/10 → 1.100. Fora dessas datas o coletor informa limite e valores manualmente (cláusula 2.1.5). Calculado no servidor.
- Hash SHA-256 do `textoFinal` calculado no servidor e impresso no PDF.

## Fluxo
1. Admin: Config → “Modelo de contrato” (editor + pré-visualização + histórico de versões). Salvar cria versão nova.
2. Coletor: tela do lead → “Contrato para assinar” → formulário dos campos em branco → leitura (rolagem) → nome e CPF/CNPJ do signatário (pré-preenchidos do lead) → “Li e concordo” → desenhar assinatura (canvas) → Assinar.
3. `POST /api/leads/[id]/assinatura` (autenticado, `escopoLead`): valida tudo, monta `textoFinal` no servidor a partir do modelo vigente (nunca confia no texto do cliente), grava PNG (≤200 KB, validado como PNG) e PDF no R2, grava a linha, retorna id.
4. Tela de sucesso: ver/baixar PDF, botão WhatsApp com link para o PDF.
5. Download: `GET /api/assinaturas/[id]/pdf` redireciona para URL assinada de 5 min no R2, após checar tenant + `escopoLead` (admin vê todos).

## PDF
Biblioteca `pdf-lib` (JS puro, roda no Vercel), fonte padrão (WinAnsi cobre acentos, º, §, —). Conteúdo: texto renderizado dos blocos (títulos, negrito, quadros com barra lateral), Anexo I com ferramentas, bloco de assinaturas (CONTRATADA com nome e CNPJ impressos; CONTRATANTE com a imagem desenhada, nome e documento), local/data, e rodapé de evidências: hora do servidor, IP, aparelho, hash SHA-256, versão do modelo, id da assinatura. Paginação automática com “Página X de Y”.

## Segurança e isolamento
- Todas as consultas filtram `tenantId`; leads via `escopoLead(user)`; só admin edita o modelo.
- Tabelas novas com RLS ligado (como as demais).
- Limites: assinatura PNG ≤ 200 KB; corpo do modelo ≤ 200 KB; rate limit simples por colaborador.
- Chaves R2 aleatórias; bucket privado; sem URL pública.
- Assinatura é imutável; não há edição nem exclusão. Excluir um lead com assinatura é bloqueado (o contrato é evidência).

## Testes (Puppeteer + Postgres embutido + S3 falso, como os demais)
- Admin edita modelo → nova versão; versão antiga preservada; coletor não edita.
- Coletor assina: campos em branco obrigatórios, limite por data (com relógio injetável), variável faltando bloqueia.
- PDF baixado: começa com `%PDF`, contém hash e nome; hash confere com `textoFinal`.
- Isolamento: outro coletor recebe 404/403 no PDF e na assinatura.
- Reassinar cria nova linha sem apagar a anterior.
- Regressão dos 9 testes existentes.

## Riscos
- Fonte padrão do PDF não tem alguns glifos (ex.: “✓”): usar texto/desenho vetorial para o check do Anexo I.
- Contrato longo (10 págs.) no celular: tela de leitura com rolagem e “Li e concordo” habilitado só ao fim da rolagem.
