# Miriad Construction Control (MCC)

## v8.3 — Ranking de Supervisores
Botão **Ranking** no menu lateral (Diretoria e CEO). Nota composta por:
- **RDO em dia (30%)** — RDO entregue no prazo, por obra, nos últimos 14 dias úteis.
- **POS no prazo (20%)** — POS criado até a sexta da semana anterior, nas últimas 4 semanas.
- **PMM no prazo (20%)** — PMM criado até o dia 25 do mês anterior, nos últimos 3 meses.
- **Obra no prazo (15%)** — avanço físico-financeiro x tempo decorrido (início + prazo).
- **Assertividade do POS (15%)** — produção planejada no POS x realizada nos RDOs da semana.

Cada parâmetro aparece em % por supervisor, com a nota final de 0 a 100 e medalhas para o top 3.
Métricas sem dados no período contam como zero.

> **Sem migração** — usa dados já existentes (RDO, POS, PMM, EAP, designações). Conclui a V8.


## v8.2 — Medição projetada no Financeiro
Nova aba **Medição projetada** no módulo Financeiro, alimentada pelos **PMM**:
- Consolida a medição prevista de cada obra **alocada por mês**, em matriz obra × mês (com totais),
  no mesmo estilo da área de medições das Premissas.
- Cada célula soma os PMM da obra no mês: valor contratado **com BDI** × % de avanço previsto de
  cada item da EAP.
- **Acesso:** Diretoria e CEO (que veem todo o Financeiro) e também o **Coordenador de Planejamento**,
  que passa a ter no menu lateral apenas a aba Medição projetada do Financeiro.

> **Sem migração** — usa a tabela `pmm` (criada na v8.1). Próxima etapa: v8.3 (ranking de supervisores).


## v8.1 — PMM (Plano de Medição Mensal)
Mesma lógica do POS, porém mensal e voltado à medição prevista da obra:
- **Preenchimento (Supervisor de Obras):** por obra e mês, os itens da EAP com a medição prevista
  e a unidade. O sistema mostra o avanço físico previsto e a **medição prevista com BDI** (valor
  contratado c/ BDI × % de avanço de cada item).
- **Prazo e trava:** o PMM do próximo mês deve ser preenchido **até o dia 25**; passadas 24h sem
  preenchimento, o acesso é bloqueado — o Coordenador de Obras destrava.
- **Gestão (Coord. de Obras, Diretoria e CEO):** tabela com todos os PMM (obra, mês, supervisor,
  avanço físico e medição prevista), com filtro por mês e detalhamento por item.

Esses dados são a base da **Medição projetada** do Financeiro, que entra na v8.2.

> **Migração:** rode `supabase/migration_v8_1.sql` (cria a tabela `pmm`).


## v8.0 — POS (Plano Operacional Semanal) e Financeiro no menu lateral
- **POS (Plano Operacional Semanal):** lookahead da semana seguinte, **exclusivo do Supervisor de
  Obras**. Ele indica as frentes (itens da EAP) que vai desenvolver, com a equipe e a produção
  planejada de cada item. Deve ser preenchido **até sexta-feira**; passadas 24h do prazo sem
  preenchimento, o acesso é **bloqueado** (mesma lógica das SM-is) — o Coordenador de Planejamento
  destrava.
- **Gestão do POS** (Coord. de Planejamento, Diretoria e CEO): vê todos os POS individualmente e em
  **tabela com avanço físico e financeiro estimado** da semana. O financeiro vem do valor contratado
  **com BDI** multiplicado pelo % de avanço planejado de cada item da EAP.
- **Financeiro no menu lateral:** as abas do módulo Financeiro (Premissas, Antecipação, Antes×Depois,
  Sensibilidade, Resultado, Custos por obra, Custos diretos) foram para a lateral, com notas, igual
  ao Operacional.

> **Migração:** rode `supabase/migration_v8.sql` (cria a tabela `pos`). Próximas etapas: v8.1 (PMM),
> v8.2 (Medição projetada no Financeiro) e v8.3 (ranking de supervisores).


## v7.4 — SS-i (Solicitação de Serviço)
Mesma lógica da SM-i, agora para serviços de **empreitada**, **locação de equipamentos** e outros:
- **Formulário (Supervisor de Obras):** obra, tipo (empreitada/locação/outros), serviços/locações
  vinculados a atividades da EAP (com quantidade e unidade), data de necessidade e observações
  (prazo de locação, condições). Detecta emergencial igual à SM-i.
- **Kanban:** Aberta → Em atendimento → Ativa → Baixada. O Suprimentos atende e marca como
  contratado/ativo; a **baixa é feita pelo Supervisor de Obras** ao concluir o serviço ou encerrar
  a locação.
- **Emergencial:** quando a necessidade é na mesma semana, vai para autorização do Coordenador de
  Obras antes de chegar ao Suprimentos.
- **Lembrete semanal ao supervisor:** alerta com as SS-is dele em aberto, para baixar serviços
  concluídos e locações fora de uso.
- **Alerta de SS-i parada:** Coordenador de Suprimentos e Diretoria veem destaque em vermelho para
  SS-is abertas há **mais de 2 meses** — para evitar locação de equipamento que não está mais em uso.

> **Sem migração nesta etapa** — usa a tabela `ss_itens` criada na v7.0.


## v7.3 — Gestão de usuários (CEO/Diretor) e ambiente de teste
- **Editar / resetar senha / excluir usuários** (apenas CEO e Diretor): na tela de Usuários, cada
  linha ganhou os botões **editar** (nome, e-mail, papel, ativo), **resetar** (invalida a senha e
  gera um novo link de convite) e **excluir**. Travas de segurança: ninguém exclui a própria conta,
  só o CEO mexe em CEO/Diretor e não é possível excluir o único CEO. A (des)trava de supervisores
  pelo Coordenador de Obras continua funcionando.
- **Ambiente de teste (somente CEO):** botão que cria um usuário de teste para cada papel da empresa
  (e-mail `teste.<papel>@miriad.test`) com uma senha única que você define. Saia e entre como cada
  um para experimentar as telas fora do seu acesso de CEO; depois exclua-os pela própria lista. Os
  papéis escopados por obra já são designados a todas as obras existentes.

> **Sem migração nesta etapa.** (A SS-i — solicitação de serviço — fica para uma próxima versão.)


## v7.2 — Prazo de envio, travamento e SM-i emergencial
Terceira etapa da V7, sobre o fluxo da SM-i:
- **Prazo semanal de envio:** o Supervisor de Obras vê um alerta vermelho lembrando de enviar,
  **até segunda-feira**, as SM-is dos materiais que precisam chegar na semana seguinte. Pode
  confirmar o envio da semana (criar uma SM-i já confirma automaticamente).
- **Travamento:** passadas 24h do prazo sem envio/confirmação, o acesso de envio do supervisor é
  **bloqueado**, com orientação para procurar o Coordenador de Obras. O coordenador (e a diretoria)
  vê a conformidade de cada supervisor e pode **destravar**.
- **SM-i emergencial:** quando a entrega é para a mesma semana, a SM-i é marcada como
  **emergencial** e só vai para o Suprimentos após **autorização do Coordenador de Obras** (até lá
  fica invisível para Suprimentos). O formulário avisa o supervisor.
- **Painel da Diretoria:** contagem de SM-is emergenciais por obra nos últimos 15 dias, com
  **alerta quando passa de 3** em uma mesma obra.

> **Migração:** rode `supabase/migration_v7_2.sql` (cria a tabela `envio_semanal`). As demais
> colunas (emergencial/autorização/travamento) já existem desde a v7.0.


## v7.1 — SM-i (Solicitação de Material Inteligente)
Segunda etapa da V7. Habilita o fluxo de pedido de material do Supervisor de Obras para o
Suprimentos:
- **Formulário (Supervisor de Obras):** escolhe a obra, adiciona itens vinculados a atividades da
  EAP — mostrando a **quantidade contratada** de cada item e **alertando** quando a quantidade
  pedida supera a contratada — define **para quando** o material precisa chegar e descreve cada
  material com sua quantidade.
- **Kanban de atendimento (Operador de Suprimentos):** vê apenas as SM-is das obras em que foi
  designado, nas colunas Aberta → Em atendimento → Atendida.
- **Kanban de gestão (Coordenador de Suprimentos / Diretoria):** vê todas as SM-is, com o
  histórico de dias desde a abertura.
- **Gestão de prazo:** cada cartão muda de cor conforme a data de necessidade — verde (>5 dias),
  amarelo (5/3/2 dias), laranja em destaque (1 dia) e vermelho (no dia ou vencida). As urgentes
  aparecem num alerta no topo. **SM-i vencida só pode ser baixada com autorização do Coordenador
  de Suprimentos** (o operador vê a trava).

> Usa as tabelas já criadas na migração v7.0 — **não há migração nova nesta etapa**. As próximas
> etapas: v7.2 (envio até segunda, travamento e SM-i emergencial) e v7.3 (SS-i).


## v7.0 — Fundação de acesso (11 papéis, designação por obra e convite por link)
Primeira etapa da V7. Reestrutura o controle de acesso e o menu:
- **11 papéis**: CEO, Diretor, Coord. de Suprimentos/Planejamento/Obras/Orçamentos,
  Operador de Suprimentos/Planejamento/Orçamento, Financeiro e Supervisor de Obras. Cada papel
  enxerga só os módulos a que tem direito (matriz em `src/core.jsx` → `PERMS`), com a regra
  aplicada também no backend (`api/data.js`).
- **Quem cria quem**: só o CEO cria Diretor; Diretor cria os demais; cada coordenador cria o
  operador/supervisor do seu setor.
- **Designação por obra**: coordenadores alocam operadores/supervisores a obras; quem é escopado
  por obra (Sup. de Obras e operadores) só enxerga as obras designadas (pode ser mais de uma).
- **Convite por link**: ao criar um usuário, o sistema gera um link (válido 7 dias) para ele
  **definir a própria senha** — copie e envie. (Envio automático por e-mail fica para uma etapa
  futura.)
- **Menu lateral reorganizado**: RDO-i, SM-i, SS-i, OC-i, OS-i, Prestadores, EAP & Custos e Obras
  viraram itens do módulo Operacional na lateral, cada um com uma nota explicativa. SM-i e SS-i
  aparecem como "em breve" (entram nas v7.1 e v7.3).
- **Dropdown por setor**: nos campos de solicitante/comprador da OC-i, o seletor lista os
  colaboradores do setor correspondente (CEO/Diretor veem todos).

> **Migração obrigatória:** rode `supabase/migration_v7.sql` no SQL Editor **antes** de usar.
> Ele cria as tabelas de designação e de SM-i/SS-i, os campos de convite e **migra os papéis
> antigos** (o antigo "gestor" vira **CEO** — esse é o acesso do Sérgio; "residente"/"supervisor"
> viram **Supervisor de Obras**). Sem ela, o login e a tela de usuários não funcionam.


## v6.2 — Logo oficial da Miriad
Substituído o logo genérico (cata-vento em SVG) pela **marca oficial da Miriad** em todo o
sistema: ícone do menu lateral, tela de login e cabeçalho do PDF da Ordem de Compra. Os logos
ficam embutidos em `src/logo.js` (gerados a partir de `MIRIAD.png`): `LOGO_FULL` (logo
horizontal completo, usado em fundos claros) e `LOGO_MARK` (só o cata-vento, usado como ícone
no menu escuro). Os PDFs de RDO e de medição continuam usando o papel timbrado oficial.


## v6.1 — OC-i gera PDF para o fornecedor
A OC-i agora produz um **PDF de Ordem de Compra** pronto para enviar ao fornecedor, no padrão
da Miriad. Novidades:
- **Pedido por material × atividade da EAP**: cada material da compra tem quantidade, unidade,
  valor unitário e total, e é **vinculado a um item da EAP** (coluna "Item da EAP" no PDF).
- **CNO (Cadastro Nacional de Obra)**: cadastrado por obra (aba Obras → Editar/criar) e
  destacado no bloco de NF do PDF (pode ser sobrescrito na própria OC).
- **Solicitante** (quem pediu) e **Comprador** (responsável pela emissão da OC-i) identificados.
- **Dados do fornecedor** (nome fantasia, razão social, CNPJ, vendedor, contatos, endereço),
  **condição de pagamento** com parcelas e vencimentos (faturamento + dias) e **dados de entrega**.
- Botão **PDF** na lista de ordens de compra.

> **Migração:** rode **uma vez** `supabase/migration_v6_1.sql` (adiciona `obras.cno` e
> `ordens_compra.dados_oc`). Os dados da empresa que saem no cabeçalho do PDF estão em
> `src/pdf.js` (constante `EMPRESA_OC`) — ajuste ali se algum dado mudar.

## v6 — Controle de RDOs, condição de pagamento na OC-i, custos por obra e medição PDF
Novidades desta versão:
1. **Dashboard de controle dos RDOs** (Painel Geral): tabela com o último RDO respondido de
   cada obra, status do dia (respondido × pendente), há quantos dias foi o último relatório e
   alerta destacado para obras **sem RDO respondido hoje**. O RDO-i também ganhou um aviso no
   topo listando as obras pendentes do dia.
2. **Condição de pagamento na OC-i**: à vista, **entrada + parcelamento** ou **parcelamento puro**.
   As parcelas são identificadas por **dias após o faturamento** (ex.: 30/60/90) — digite os
   vencimentos diretamente ou gere por nº de parcelas + 1º vencimento + intervalo. O sistema
   mostra a prévia das parcelas com valor e data de vencimento.
3. **Financeiro → Custos por obra** (nova aba): custos lançados por obra, alocados por mês e
   divididos em **Serviço (OS-i)** e **Material (OC-i)**, com tabela e gráfico empilhado por obra.
4. **Financeiro → Custos diretos (auto)** (nova aba): tabela no mesmo formato da projeção manual
   da aba Premissas (obra × mês), porém **abastecida automaticamente** — soma a medição dos
   serviços (OS-i) do mês com as parcelas de material (OC-i) a pagar naquele mês.
5. **Gerar medição (PDF)**: boletim no papel timbrado com a medição **acumulada** (ou por
   período, com data inicial e final), trazendo o avanço por **unidade de medida** e por **%**
   de cada atividade, e o valor **com e sem BDI**. (No RDO-i, card "Gerar medição".)
6. **Favicon** de capacete laranja vibrante.

> **Migração de banco:** antes do deploy, rode **uma vez** `supabase/migration_v6.sql` no SQL
> Editor do Supabase. Ele adiciona `condicao_pagamento` (jsonb) e `data_faturamento` (date) à
> tabela `ordens_compra`. É idempotente e preserva os dados existentes. OCs antigas sem condição
> de pagamento são tratadas como "à vista" na data de faturamento.


## v5.3 — importação por MODELO PADRÃO + BDI informado
Foi criada uma planilha modelo padrão (Planilha_Modelo_MCC.xlsx) com colunas em posição
fixa, célula de BDI destacada (amarela), coluna L = SUBTOTAL S/BDI e coluna M = CUSTO
TOTAL C/BDI. O importador agora:
1) reconhece o modelo (pelos títulos SUBTOTAL S/BDI + CUSTO TOTAL C/BDI), lê o BDI da
   célula destacada e extrai por posição fixa — sem ambiguidade de colunas;
2) à faturar = coluna M (c/BDI); custo de meta = coluna L (s/BDI);
3) se a planilha NÃO for o modelo, cai automaticamente no modo de detecção (reserva).
O preview mostra itens, valor à faturar e o BDI lido, para conferência antes de salvar.
> Distribua a planilha modelo para preenchimento; é o formato recomendado de importação.


## Correção v5.2 — valor à faturar (venda × custo) e integração Operacional↔Financeiro
O Painel mostrava ~234 mil (a soma de CUSTO) em vez dos 465 mil do contrato. Causa: a
extração tratava o VALOR TOTAL (já com BDI) como se fosse custo e reaplicava BDI/desconto.
Agora a extração separa **valor de venda (à faturar)** de **custo de referência (p/ metas)**,
e grava o valor de venda direto em valor_total, sem transformações. Como Painel, EAP & Custos
e Financeiro/Resultado leem o mesmo valor_total, os três passam a bater entre si.
Validado: PMSP = R$ 465.000,00 à faturar; CENSE Londrina = R$ 315.104,13.
> Reimporte as obras afetadas (excluir + subir a planilha) para atualizar os valores.


## Correção v5.1 — extração da EAP por nível analítico (valores em dobro/triplo)
Planilhas com vários níveis (título 1.0 · subgrupo 1.01 · item 01.01.03) faziam o MCC
somar todos os níveis, multiplicando o total. Agora a regra é única e robusta:
**um item da EAP é a linha que tem código numérico + unidade + quantidade > 0 + valor > 0**.
Isso importa só o nível analítico (as folhas), ignorando grupos/títulos. A detecção do
cabeçalho passou a reconhecer "ÍTEM" (com acento), "QUANT." e a coluna de valor por
"VALOR/CUSTO/PREÇO TOTAL", inclusive em cabeçalhos de 2 linhas.
Validado: PMSP = R$ 465.000,00 e CENSE Londrina = R$ 315.104,13 (batem com os contratos).
O total extraído aparece no preview para conferência antes de salvar.
> Reimporte as obras afetadas (excluir + subir a planilha de novo) para corrigir os valores.


## Novidades da v3.4
- **Linha de totais** na tabela de EAP & Custos: soma de Custo total, Meta total e
  Realizado ao pé da tabela (colunas de valor unitário não são somadas, por não fazer sentido).
- **Editar obra** (aba Obras do Operacional): botão ✎ Editar para ajustar código, nome,
  contratante, contrato, local e prazo — útil para aplicar os códigos-padrão da empresa.
- **Resultado** (nova aba do Financeiro): resultado **projetado × realizado** por obra.
  - Projetado = Valor total (venda da EAP) − impostos − meta de custo de todos os itens.
  - Realizado = Valor total − impostos − [custo real dos itens já comprados/executados/
    contratados + meta dos itens ainda não realizados]. Alimentado por RDO-i, OS-i e OC-i.
  - **Matriz de retenção selecionável por obra** (define a medição líquida); alíquotas vêm
    das Premissas. Inclui consolidado da empresa e gráfico projetado × realizado.


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
