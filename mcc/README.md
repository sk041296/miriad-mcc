# Miriad Construction Control (MCC)

## Correção v3.3 — extração da EAP, meta unitária e Supervisor Residente
- **Valores exorbitantes corrigidos**: a planilha SINAPI/SECID tem colunas repetidas
  (custo unitário e custo total ambos com "MATERIAL/MÃO DE OBRA"), e a IA confundia a
  coluna de quantidade com a de mão de obra, gerando metas de milhões. Agora, quando a
  planilha tem o cabeçalho padrão (ITEM/DESCRIÇÃO/UNIDADE/QUANTIDADE/CUSTO UNITÁRIO/CUSTO
  TOTAL), os valores são lidos **por posição de coluna** (determinístico, exato), e a IA
  é usada só para classificar interno/externo e nomear a obra. Conferido na CENSE Londrina:
  soma bate com o subtotal da planilha (R$ 315.104,13).
- **Meta unitária**: a tabela de EAP & Custos agora mostra **Custo unit. × Meta unit.**
  lado a lado (além das bases totais), para o Suprimentos negociar com o preço-alvo por
  unidade em mãos.
- **Supervisor Residente** (novo papel): o gestor cria o usuário e designa **uma obra**;
  esse usuário acessa só o módulo Operacional e enxerga **apenas a sua obra** (filtro
  aplicado no servidor). Requer a migração `supabase/migration_v3.sql`.

## Correção v3.3 — coluna de meta de custo (apresentação)
A tabela de EAP & Custos mostrava o **custo unitário** s/BDI ao lado da **meta total**,
o que fazia a meta parecer maior que o custo. A matemática e os dados no banco sempre
estiveram corretos — era só a apresentação. Agora a tabela exibe tudo em **base total**
(Qtde · Custo unit. s/BDI · Custo total s/BDI · Meta % · Meta total · Realizado), de
forma que a meta aparece corretamente como uma fração do custo total. Nada precisa ser
reprocessado.

## Correção v3.2 — upload de EAP em LOTES (plano Vercel Hobby)
No plano Hobby do Vercel toda função tem teto fixo de **10 segundos**, e gerar uma EAP
inteira numa só chamada estourava esse limite (erro 504). Agora o upload processa a
planilha **em lotes de ~20 itens**: o navegador faz várias chamadas curtas ao
`/api/parse-eap` (cada uma bem abaixo de 10s) e junta o resultado, com **barra de
progresso**. Uma planilha de ~100 itens vira ~6 chamadas rápidas. Não precisa plano pago.

## Correção v3.1 — upload de EAP (erro 504 / timeout)
- A planilha agora é **pré-filtrada no navegador** antes de ir à IA: enviamos só as linhas
  que são itens da EAP (código 1, 1.1, 2.3…) mais o cabeçalho, reduzindo o conteúdo em ~75%.
  Isso elimina o timeout em planilhas grandes (ex.: 1000+ linhas).
- `max_tokens` reduzido e, com `ANTHROPIC_MODEL` definido, a função não testa mais vários
  modelos em cascata (era o que estourava o tempo). `vercel.json` fixa `maxDuration` de 60s
  para `api/parse-eap`.
- **Importante:** defina `ANTHROPIC_MODEL = claude-sonnet-4-6` no Vercel (confirmado como
  modelo válido da sua conta pelo diagnóstico) e garanta que `ANTHROPIC_API_KEY` contém
  **apenas a chave `sk-ant-...`**, sem texto/comando em volta.

## Novidades da v3
- **Edição de RDO**: na lista "RDOs registrados", o botão **Editar** carrega o relatório no
  formulário (atividades, equipe, fotos e restrições); salvar grava por cima do mesmo registro.
- **Legenda no PDF**: a legenda de cada foto aparece em destaque no PDF do cliente, com o
  código da EAP como rótulo secundário (antes saía só o número da EAP).
- **Upload de EAP robusto** (corrige a falha "Não foi possível identificar a EAP"):
  - o serviço agora **tenta vários modelos** e **recupera JSON truncado** de planilhas grandes;
  - mensagens de erro passam a indicar a **causa real** (chave, modelo, truncamento, formato);
  - botão **Executar diagnóstico** na aba Obras: mostra se a chave está configurada e
    **lista os modelos disponíveis na sua conta** da Anthropic.

### Se o upload da EAP falhar
1. Na aba **Operacional → Obras**, tente o upload; se falhar, clique em **Executar diagnóstico**.
2. Veja o nome de um modelo válido na linha "Modelos disponíveis na sua conta".
3. No **Vercel → Settings → Environment Variables**, defina/ajuste **`ANTHROPIC_MODEL`** com esse
   nome exato e faça **Redeploy**. (A causa mais comum da falha é o `ANTHROPIC_MODEL` antigo
   apontar para um modelo que não existe mais na API.)


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
