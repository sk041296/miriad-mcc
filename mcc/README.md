# Miriad Construction Control (MCC)

> **Atualização v2 (em produção):** antes de subir o novo código, rode a migração do banco.
> No Supabase → SQL Editor, execute **uma vez** o arquivo `supabase/migration_v2.sql`.
> Ele preserva todos os dados já existentes (ALTER TABLE idempotente), cria as colunas de
> meta/desconto, os arrays de múltiplas EAPs em OC/OS, os campos de prestadores
> diretos/indiretos, a coluna de fotos do RDO e o **bucket de Storage `rdo-fotos`**.
> Depois, faça o deploy normal (push no GitHub → Vercel). As novas funções `/api/upload`
> já vão junto. Nenhuma variável de ambiente nova é necessária.

## Novidades da v2
- **RDO-i com fotos**: anexe imagens (galeria ou câmera no celular) e vincule cada foto a um
  item da EAP; as fotos entram no PDF do cliente. Armazenadas no Supabase Storage.
- **OS-i** (antiga RSO-i): Ordem de Serviço Inteligente, com escolha **direto/indireto**;
  contratos diretos pedem **custo mensal × nº de meses**; ambos aceitam **vários itens da EAP**.
- **OC-i** com **múltiplos itens da EAP** por ordem de compra (um fornecimento pode cobrir
  vários itens).
- **Prestadores** (nova aba): cadastro segmentado em **diretos e indiretos**, com custo mensal
  e vínculo a obra/contrato.
- **EAP & Custos** com **Meta de Custo**: aplique o **desconto da licitação** a toda a EAP de
  uma vez (para planilhas que vieram só com preço de referência) e **defina a meta** como um
  percentual sobre o custo SEM BDI — global ou item a item. Inclui **dashboards** de
  desempenho vs meta por obra e **consolidado da empresa**.


Plataforma única de gestão de obras da Miriad, unificando **gestão financeira** e
**operação de campo (RDO-i)** sobre o mesmo banco de dados.

## Módulos (menu lateral)

- **Painel Geral** *(gestor)* — consolidação de todas as obras: avanço físico-financeiro,
  equipe presente, condição climática, disciplinas em execução, restrições de material em
  aberto e **projeção automática de término** por produtividade.
- **Financeiro** *(gestor)* — fluxo de caixa: Premissas, Antecipação, Antes × Depois,
  Sensibilidade (motor calibrado pela planilha RE01).
- **Operacional** *(todos)*:
  - **RDO-i** — preenchimento do Relatório Diário Inteligente. Avanço na **unidade física
    da EAP** (m², m³, kg…), com **% calculado automaticamente** sobre o quantitativo
    contratado. Gera **PDF no papel timbrado da Miriad** para envio ao cliente.
  - **RSO-i** — contratos de serviço (empreiteiros), indexados pela EAP.
  - **OC-i** — ordens de compra de materiais, indexadas pela EAP.
  - **EAP & Custos** — índice de custo (CPI) por item: realizado (OCs) × meta × avanço.
  - **Obras** — upload da planilha analítica → **EAP identificada por IA**, com
    classificação interno/externo de cada item.

## Conceitos-chave

- **EAP obrigatória antes do RDO**: sem planilha analítica carregada, o RDO-i exibe
  *"Faça o upload da EAP para responder a este RDO"*.
- **Produtividade e projeção**: produtividade diária por item = média das **3 últimas
  observações do mesmo projeto na mesma condição climática**. Itens marcados como
  **externos** têm a produtividade ponderada pelo fator do clima (chuva rende menos).
- **Restrições de material**: área do RDO-i preenchida pelo supervisor (item da EAP +
  material em falta + data da solicitação ao suprimentos). **Nunca** aparece no PDF do
  cliente; alimenta o OC-i e o Painel Geral, e pode ser baixada quando a OC é lançada.
- **Hierarquia de acesso**: `gestor` vê tudo; `supervisor` acessa apenas o Operacional.

## Arquitetura

```
Navegador (index.html autocontido — React compilado)
   │  Authorization: Bearer <token de sessão> (12h, assinado HMAC)
   ├── /api/auth        → login, bootstrap do 1º gestor
   ├── /api/data        → CRUD com controle de papel (Supabase Postgres)
   └── /api/parse-eap   → identificação da EAP por IA (API da Anthropic)
```

## Publicação (GitHub privado + Vercel + Supabase)

### 1. Supabase
1. Crie um projeto em https://supabase.com
2. SQL Editor → execute `supabase/schema.sql`
3. (Dados reais) SQL Editor → execute `supabase/seed_cppi.sql` — obra CPPI com 37 itens
   de EAP e 17 RDOs históricos (calibra a produtividade do Painel Geral).
4. (Opcional) `supabase/seed_maringa.sql` — obra Maringá com EAP em unidade física.
5. Settings → API: copie **Project URL** e **service_role key**.

### 2. GitHub
Repositório **privado** (contém dados financeiros) com todo o conteúdo desta pasta na raiz:
`index.html`, `api/` (4 arquivos), `package.json`, `vercel.json`, `supabase/`, `README.md`.

### 3. Vercel
Importe o repositório e configure as Environment Variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (console.anthropic.com)
- `ANTHROPIC_MODEL` (opcional; padrão `claude-sonnet-4-6`)
- `APP_SECRET` (string aleatória longa — assina os tokens de sessão)

Deploy. No primeiro acesso, a tela de login pede o cadastro do **primeiro gestor**
(bootstrap). Os demais usuários são criados em **⚙ Usuários** (somente gestor).

> Recomendações de segurança: mantenha o repositório **privado** e ative a
> **Deployment Protection** no projeto Vercel.
