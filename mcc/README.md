# Miriad Construction Control (MCC)

## v10.24 — Metas de Custo por EAP (Alarmes de verba — Fatia A)
- Nova aba "Metas de Custo" no Operacional: para cada obra, mostra os itens de EAP com memorial e compara a verba (custo s/BDI) com o consumido (soma das OCs/OSs daquela EAP).
- Por item: verba, consumido, saldo e % consumido, com destaque visual (verde/laranja/vermelho) e itens acima da verba destacados.
- KPIs: verba total, consumido, saldo e nº de itens acima da verba.
- Base de cálculo que alimenta as próximas fatias (alarme na criação de OC/OS, integração com aprovação, painel de furos).

## v10.23 — Exportação do orçamento em PDF/XLSX (Fatia 3d)
- Barra "Exportar orçamento da obra" no construtor, com duas opções combináveis:
  - BDI embutido: mostra valores já com BDI (sem expor o BDI), com EAP, descrição, qtd, valor unit c/BDI, subtotal e total.
  - Composição analítica aberta: detalha cada insumo; desligada, sai só o resumo sintético por EAP.
- PDF no papel timbrado da Miriad (logo + dados). XLSX nativo via SheetJS.
- Conclui a Fatia 3 (construtor de memorial: manual + determinístico + IA + exportação).

## v10.22 — Robustez do preenchimento com IA
- Corrige "Erro na IA: Expected ',' or ']'": a resposta da IA às vezes vinha com JSON imperfeito.
- Três defesas: (1) teto de tokens maior (evita truncamento), (2) prompt mais estrito sobre o formato JSON, (3) parser tolerante que repara JSON comum (vírgula faltando, texto extra, fechamento de estruturas).
- Limite de 8 insumos por item para respostas mais enxutas e confiáveis.

## v10.21 — Preenchimento com IA no construtor (Fatia 3c)
- Botão "✨ IA" por item: sugere a composição analítica daquele item de EAP (material, mão de obra, equipamentos, locações) via API Anthropic.
- Botão "✨ Preencher todos com IA": gera memoriais preliminares para todos os itens da EAP sem memorial, de uma vez.
- A IA propõe insumos e coeficientes; o sistema completa preços com o histórico de OCs/OSs quando possível. Tudo entra como preliminar para revisão antes de salvar.
- Novo endpoint api/sugerir-composicao.js (reusa ANTHROPIC_API_KEY já configurada; maxDuration 60s no vercel.json).

> Sem migração nova.

## v10.20 — Correção da busca de último preço
- Ajuste na similaridade: agora mede a cobertura das palavras da BUSCA no item histórico (não pune descrições de OC longas/detalhadas).
- Ex.: "tela tapume" agora casa com "TELA TAPUME LARANJA PLASTCOR 1,20X50M".
- Corte em 60% de cobertura para evitar falsos positivos.

## v10.19 — Inteligência determinística no construtor (Fatia 3b)
- Botão "Copiar de [obra]": reaproveita composições da mesma EAP já feitas em outras obras.
- Botão "⚡" em cada insumo: busca o último preço unitário pago nas OCs/OSs por similaridade de nome e preenche o valor.
- Busca por palavras-chave (normaliza acento/maiúscula/pontuação), determinística, roda no navegador.
- Próximas: 3c (preencher com IA), 3d (geração de PDF/XLSX).

## v10.18 — Construtor de Memorial Executivo (Fatia 3a — manual)
- Tela na tab Novo Projeto para montar a composição analítica de cada EAP.
- Funciona a partir de um item de EAP existente OU avulso.
- Insumos agrupados por segmento (Material, Mão de obra, Equipamentos, Locações), com qtd, valor unit e subtotais com/sem BDI calculados ao vivo.
- BDI configurável por memorial. Salva em memoriais_custo + memoriais_itens.
- Ao salvar, marca a EAP com tem_memorial e grava a verba_contratacao (custo s/ BDI).
- Próximas fatias: 3b inteligência (busca determinística + último preço), 3c IA, 3d geração de PDF/XLSX.

> Sem migração nova — usa as tabelas da v10.16 e os catálogos da v10.17.

## v10.17 — Catálogo de insumos (Fatia 2 do módulo de Orçamentos)
- Tabelas catalogo_financeiro (plano de contas / naturezas) e catalogo_mao_obra (custos de MO) — fundação do construtor de memorial.
- Consulta do catálogo na tab Novo Projeto (plano de contas + mão de obra, com busca).
- Backend: catálogos e tabelas de memorial registrados na whitelist.

> **Migração:** rode `supabase/migration_v10_17.sql` (cria as tabelas) e depois `carga_catalogos.sql` (insere os 60+21 itens da DATABASE da empresa).

## v10.16 — Tab "Novo Projeto" (Bloco I do módulo de Orçamentos)
- Nova aba "Novo Projeto" no módulo Operacional, com o fluxo de abertura: upload da EAP → desconto → escolha entre Meta de custo (%) ou Memorial Executivo.
- Reaproveita o upload de EAP existente (sem alterar a lógica testada).
- Bifurcação memorial vs meta% preparada (construtor de memorial vem nas próximas fatias).
- Migração v10_16 inclusa (tabelas memoriais_custo e memoriais_itens + campos de verba na eap_itens) — necessária para as próximas fatias do módulo.

## v10.15 — Kanban de OPs por faixa de vencimento + gráfico
- Cada coluna do Kanban (Pendente NF / Liberada / Paga) agora agrupa as OPs por faixa de vencimento: 0-30, 31-60 e após 60 dias, com seções expansíveis (clique no cabeçalho).
- Gráfico no topo com os valores a vencer (OPs em aberto) em 7, 15, 60 dias e total.
- Cada card de OP mostra a descrição do material comprado (cruzado da OC de origem).

## v10.14 — Aprovação de OC-i / OS-i (Suprimentos + Diretoria)
- OC/OS acima de R$ 1.000 entram como "aguardando aprovação" e só geram OP após aprovação dupla.
- Aprovação independe de ordem, mas exige Coord. de Suprimentos E um Diretor.
- Selo de status e botões de aprovar/rejeitar nas abas OC-i e OS-i (operacional).
- Espelho de pendências no Painel Geral: Suprimentos/Diretoria veem ao abrir o sistema "X ordens aguardando sua aprovação".
- OCs/OS abaixo do limite e as já existentes ficam aprovadas automaticamente.
- Limite configurável em config_financeiro (chave limite_aprovacao_oc).

> **Migração:** rode `supabase/migration_v10_14.sql` UMA vez (idempotente; termina com reload schema).

## v10.13 — Ordens de Pagamento (Kanban do Financeiro)
- Nova aba "Ordens de Pagamento" no módulo Financeiro (papéis CEO, Diretor, Financeiro).
- Kanban com 3 colunas: Pendente NF -> Liberada -> Paga.
- Cards mostram fornecedor, valor, vencimento, obra e centro de custo; OPs vencidas destacadas em laranja.
- Conferência de NF (número + valor) ao liberar, com aviso se o valor da NF divergir do valor da OP.
- Marcar como paga registra a data de pagamento.
- Filtro por obra e KPIs (total em aberto, já pago, nº de OPs).
- Inclui as correções anteriores: realizado por item (eap_codigo da OC) e medição projetada (deslocamento por mês cheio).

> **Migração:** rode `supabase/migration_ordens_pagamento.sql` (cria a tabela) e depois `supabase/gerar_OPs_de_OCs.sql` (gera as OPs a partir das OC-i existentes). Ambos idempotentes.

## v10.11 — fix: medição projetada no Painel Gerencial
- Corrige o empilhamento de meses na linha "Entradas (medições projetadas)": o deslocamento pelo prazo de recebimento agora é por **mês cheio** (não mais por dias corridos a partir do dia 01, que fazia jun+jul colidirem em julho).
- PMM de cada mês passa a cair limpo no mês seguinte conforme o prazo (ex.: junho→julho, julho→agosto). Campo "Prazo de recebimento (dias)" mantido; convertido para meses via round(dias/30).

> Sem migração de banco nesta versão.


## v10.10 — Import de SS-i/OS-i com a lógica validada da EAP
Reescrevi o reconhecimento de itens no import de planilha (SS-i e OS-i) para usar a MESMA lógica do
upload de EAP da aba Obras, que já funciona bem:
- O código do item passa a ser o **ITEM pontilhado** da planilha (ex.: 3.20, 5.2), via a regra `ehCod`.
  Códigos SINAPI avulsos (88417, 99861…) deixam de ser usados como código — eram a causa dos conflitos
  e dos "códigos não cadastrados na EAP".
- Detecção de colunas robusta (ITEM/EAP, DESCRIÇÃO, UNIDADE, QUANTIDADE) e coluna de valor que aceita
  "MÃO DE OBRA TOTAL"/"VALOR TOTAL"/"CUSTO TOTAL"; parser numérico BR ("1.606,21" → 1606,21).
- Itens importados carregam descrição, unidade, quantidade e valor; o casamento com a EAP da obra usa o
  ITEM (que é como a EAP da obra é cadastrada), aumentando muito o reconhecimento automático.
- Helper único `extrairItensPlanilha` no core, compartilhado por SS-i e OS-i.

> Sem migração de banco. Itens cujo ITEM pontilhado não existir na EAP da obra continuam sinalizados
> pela conferência (isso é esperado e é apoio à revisão).

## v10.9 — Correção do import de planilha (SS-i e OS-i)
Corrige o reconhecimento dos dados ao importar a planilha modelo:
- **Valor total:** a coluna de valor agora é detectada mesmo quando o cabeçalho é "MÃO DE OBRA TOTAL"
  (sem a palavra "VALOR"/"R$"). Antes ficava R$ 0,00 na OS-i.
- **Números em formato BR:** parser corrigido — "R$ 1.606,21" passa a ser lido como 1606,21 (antes o
  ponto de milhar quebrava o valor). Vale para valor e quantidade.
- **Unidade de medida:** os itens da OS-i passam a guardar a unidade (e a quantidade) lidas da planilha —
  some o alerta de "unidades ausentes".
- **Coluna de código "EAP":** além de "ITEM"/"CÓDIGO", o cabeçalho "EAP" também é reconhecido como o
  código do item, melhorando o casamento automático com a EAP da obra.

> Sem migração de banco. Observação: códigos que realmente não existem na EAP da obra (ex.: SINAPI
> avulsos) continuam sendo sinalizados para revisão — isso é esperado.

## v10.8 — Login com Google (e-mail da empresa) + login por senha
- **Entrar com o Google** na tela de login, usando o e-mail corporativo (Workspace). O botão oficial do Google aparece acima do formulário, com divisor "ou com senha".
- **Login por senha continua igual** — nada muda para quem já usa e-mail + senha.
- **Como funciona:** o Google devolve um ID token ao navegador; o back-end valida esse token no próprio Google (`tokeninfo`), confere `aud` (Client ID), `email_verified`, emissor e, se configurado, o domínio corporativo. Só então procura o e-mail em `usuarios` (precisa existir e estar ativo) e emite o mesmo token de sessão de 12h. O Google **não cria conta** — apenas autentica quem já está cadastrado.
- **Ações novas no `api/auth.js`:** `config` (expõe o Client ID público ao front) e `google` (valida o ID token e loga). Sem dependência nova — validação via `fetch` ao Google.

### Configuração necessária (uma vez, no Google Cloud + Vercel)
1. Google Cloud Console → APIs e Serviços → **Tela de consentimento OAuth** (tipo "Interno" para restringir ao Workspace `miriadsolutions.com`).
2. **Credenciais → Criar → ID do cliente OAuth → Aplicativo da Web.** Em *Origens JavaScript autorizadas*, adicione a URL do app (ex.: `https://miriadcontrol.com` e o domínio `.vercel.app`). Não precisa de "URI de redirecionamento" (o GIS usa o fluxo de ID token).
3. Copie o **Client ID** e configure no Vercel:
   - `GOOGLE_CLIENT_ID` = o Client ID (`...apps.googleusercontent.com`).
   - `GOOGLE_ALLOWED_DOMAIN` = `miriadsolutions.com` (opcional, mas recomendado — restringe ao domínio).
4. Redeploy. Sem a variável `GOOGLE_CLIENT_ID`, o botão simplesmente não aparece e o login por senha segue normal.

> **Migração:** nenhuma. Apenas variáveis de ambiente.

## v10.7 — Reconhecimento de EAP no import + PMM sobre a EAP inteira
- **Importação SS-i/OS-i agora reconhece a EAP da obra automaticamente.** Ao importar a planilha modelo, cada item é cruzado com a EAP cadastrada (por código e, como reforço, por descrição) e recebe o código real da EAP. O aviso informa quantos itens foram reconhecidos.
- **PMM reformulado — obra primeiro.** O supervisor escolhe a obra (entre as que tem acesso) e o mês; só então a EAP daquela obra é carregada (sob demanda, sem puxar a EAP de todas as obras de uma vez).
- **Preenchimento do PMM sobre a EAP inteira.** A EAP completa aparece em tabela e o avanço previsto pode ser lançado por quantidade (na unidade da EAP) ou por % do contratado — os dois campos se convertem entre si. Filtro de busca, total de itens preenchidos, avanço físico e medição prevista em tempo real.
- **O que já foi declarado "à medir" vem carregado e é editável** ao reabrir/atualizar o PMM do mês.
- **Conferência da importação por IA (SS-i/OS-i).** Após o parse, uma verificação rápida (Anthropic, no máx. 5s) confere se a extração está coerente — sinaliza linhas de cabeçalho/total capturadas como item, unidades/quantidades implausíveis e códigos incoerentes. É um apoio: aparece um aviso (✓ conferida / ⚠ pontos a revisar / indisponível) e **nunca bloqueia** o import. Endpoint `api/verificar-import.js`.

> **Migração:** nenhuma. Mudanças client-side + 1 endpoint novo. A `ANTHROPIC_API_KEY` (já usada no parse-eap) atende a conferência; opcionalmente defina `ANTHROPIC_MODEL_VERIFICACAO` na Vercel para fixar o modelo (padrão: Haiku, mais rápido).

## v10.6 — Import na OS-i, SS-i → OS-i, kanban da SS-i e atribuições editáveis
1. **OS-i — importar planilha modelo (.xlsx):** mesmo recurso da SS-i agora na OS-i. Lê ITEM, CÓDIGO,
   DESCRIÇÃO, UNIDADE, QUANTIDADE e também VALOR/PREÇO (se houver), e anexa os itens ao contrato.
2. **SS-i → OS-i:** botão "→ Gerar OS-i" no card da SS-i quando ela está *ativa* ou *baixada* (atendida),
   pré-preenchendo a OS-i com os itens. Continua valendo o atalho ao marcar como ativa.
3. **Kanban da SS-i:** visão em colunas (Aberta/Em atendimento/Ativa/Baixada) com cartões em ordem
   cronológica pela data necessária e borda de vencimento (igual ao painel das SM-is). Visível a todos os
   coordenadores, CEO, diretores e operadores; liberável na tela **Permissões** (novo "Ver kanban SS-i").
4. **Prestadores — atribuição editável:** no cadastro, opção "+ Criar nova atribuição…" que salva a nova
   atribuição no banco (app_config) e passa a aparecer nas próximas seleções.

> Sem migração de banco nesta versão.

## v10.5 — Import de planilha na SS-i, dia sem atividades no RDO e blindagem de login
1. **SS-i — importar planilha modelo (.xlsx):** no formulário da SS-i, botão "Importar planilha modelo"
   lê uma planilha (ex.: a PLANILHA_SINTÉTICA do escopo) e preenche os itens automaticamente —
   identifica as colunas ITEM, CÓDIGO, DESCRIÇÃO DO SERVIÇO, UNIDADE e QUANTIDADE e ignora linhas de
   seção/observação. Ideal para contratos com muitos itens de EAP.
2. **RDO-i — "Dia sem atividades":** checkbox para registrar dias sem produção (chuva, feriado, sem
   frente). Exige informar o motivo em Ocorrências; o RDO é salvo sem atividades e aparece com o selo
   "SEM ATIVIDADES" no kanban.
3. **Blindagem de login:** o login passou a comparar e-mail com trim + sem diferenciar maiúsculas e a
   tolerar registros duplicados (escolhe o que tem senha definida). Cadastro/edição salvam o e-mail já
   normalizado. Corrige de vez o problema que impediu acessos (e-mail com espaço).

> **Migração:** rode `supabase/migration_v10_5.sql` (adiciona `rdos.sem_atividades` e normaliza e-mails
> existentes).

## v10.4 — Escala: recarga granular, agregado de RDO e índices
Preparação para ~25 obras e ~30 usuários simultâneos.
- **Recarga granular:** salvar SM-i/SS-i/POS/PMM não recarrega mais EAP/RDOs de todas as obras
  (essas telas já atualizam a própria lista). Reduz muito o tráfego com muitos usuários ativos.
- **Agregado de RDO no servidor (`rdo_resumo`):** o acumulado por item da EAP e o próximo nº do RDO-i
  vêm de um cálculo enxuto no servidor por obra, em vez de processar todo o histórico no navegador.
- **Índices de banco** em obra_id/data nas tabelas grandes (EAP, RDO, restrições, OC, contratos, SM, SS,
  POS, PMM, designações) — consultas filtradas ficam mais rápidas sob concorrência.
- RDOs continuam carregados por completo onde as somas exigem histórico (EAP & Custos, Medição), para
  não comprometer a exatidão dos números.

> **Migração:** rode `supabase/migration_v10_4.sql` (somente índices — seguro e idempotente).
> Recomendado também: Vercel Pro (cold start/concorrência) — Supabase já está no Pro.

## v10.3 — Desempenho do carregamento operacional
- O módulo Operacional carregava EAP, RDOs e restrições **uma obra por vez** (3 requisições por obra).
  Com o crescimento (mais obras, EAP do IFSC com 160 itens), isso virava dezenas de requisições a cada
  abertura/salvamento — causando o "lag" da tela "Carregando dados operacionais…".
- Agora o sistema busca **em massa**: 1 requisição para EAP, 1 para RDOs e 1 para restrições (agrupadas
  no cliente). Passou de ~3×N para 3 requisições no total, reduzindo bastante a espera.
- Teto de linhas por consulta ampliado para acompanhar o crescimento.

> Sem migração de banco.


## v10.2 — Assinatura no RDO, destravar em Permissões, kanban de RDOs e medições na OS-i
1. **Assinatura digital no PDF do RDO:** rodapé com nome do emissor, função e a frase "Emitido por",
   além de carimbo "Assinatura digital gerada pelo MCC" com nº e data do RDO.
2. **Destravar em Permissões:** CEO e Diretor agora destravam usuários bloqueados por perda de prazo
   diretamente na tela Permissões (card "Usuários bloqueados por perda de prazo"), além dos coordenadores.
3. **RDO-i em kanban:** a lista de RDOs virou um navegador — selecione a obra (cartões) e veja os últimos
   10 RDOs, com "Mostrar mais 10". Cada cartão tem Editar/PDF/excluir. Busca por data, atividade da EAP
   ou prestador: lista todos os RDOs correspondentes e destaca a atividade/prestador encontrado.
4. **OS-i — condição de pagamento por medições:** botões "+ Entrada" e "+ Adicionar medição" (1ª, 2ª, 3ª…),
   permitindo estruturar Entrada + medições conforme a duração do serviço (por valor ou % de avanço).

> Sem migração de banco nesta versão.


## v10.1 — BMP: kanban de OS-is e geração de medição (2ª etapa da V10)
- Nova tela **Medições (BMP)** (📐) para Supervisor, Coord. de Planejamento e Diretoria: kanban com as
  OS-is (contratos de serviço), mostrando valor do contrato, já medido, saldo e itens.
- Botão **Gerar medição** abre o boletim pré-preenchido com os itens da EAP da OS-i. Por item: quantidade
  avançada (na unidade do contrato), comentário de pendência, foto com legenda e retenção técnica (%).
  O sistema calcula avanço, valor medido, retenção e líquido por item e no total.
- **Confirmar medição** mostra o quadro resumo; **Gerar medição** cria o BMP com status
  *aguardando aprovação*. O card da OS-i passa a refletir o já medido e o saldo (total e por item).
- **Centro de custo** adicionado ao cadastro/edição da obra.

> **Migração:** rode `supabase/migration_v10_1.sql` (centro de custo + tabela `boletins_medicao`).
> Fotos usam o mesmo bucket do RDO (`rdo-fotos`).

### Próximo (v10.2): aprovação do BMP (Coord. Obras/Planejamento/Diretor de Engenharia) + e-mail ao
prestador autorizando a NF. (v10.3): OP e kanbans do financeiro.


## v10.0 — OS-i com condição de pagamento (1ª etapa da V10)
- A OS-i ganhou **condição de pagamento** com tabela aberta de parcelas, preenchida manualmente.
  Dois modos: **por valor (R$)** ou **por % de avanço** (mostra o valor estimado de cada parcela e
  confere se soma 100% / o valor do contrato).
- Adicionar/remover parcelas livremente; salvo junto da OS-i e recuperado na edição.

> **Migração:** rode `supabase/migration_v10_0.sql` (adiciona `condicao_pagamento` em
> `contratos_servico`).

### V10 — em etapas (próximas)
O Boletim de Medição de Prestadores (BMP), o kanban de OS-is por contrato, as aprovações
(planejamento/obras/diretor de engenharia), o e-mail/comunicação ao prestador, a geração de OP e os
kanbans de OP no financeiro serão entregues nas versões v10.1+ (precisam de definições de cargo,
SMS e centro de custo — ver perguntas).


## v9.8 — Edição de OC-i e OS-i
- Cada Ordem de Compra (OC-i) e Ordem de Serviço (OS-i) na lista agora tem botão **Editar**: ele
  carrega todos os dados de volta no formulário, você ajusta e clica em **Salvar alterações**
  (atualiza o registro existente em vez de criar um novo). Há também **Cancelar edição**.
- Na OC-i, o editar recupera fornecedor, itens, condição de pagamento, entrega e observações; na OS-i,
  empresa, tipo, itens e valores. O PDF da OC-i reflete as alterações após salvar.

> Sem migração. Apenas frontend.


## v9.7 — Correção: dropdown da EAP mostrava só 16 itens
- O seletor de item da EAP (usado em RDO-i, OC-i e OS-i) limitava a lista a 16 itens, então obras com
  EAP grande (ex.: IFSC com 160 itens) só exibiam parte deles no dropdown.
- Agora o dropdown lista até 300 itens (com rolagem) e mostra a contagem total; acima disso, basta
  digitar para filtrar. Todos os itens continuam pesquisáveis por código, descrição ou disciplina.

> Sem migração. Apenas frontend.


## v9.6 — Data de início da obra, EAP colapsável, endereço e notificações por e-mail
1. **Data de início da obra:** definida na aba Obras (no cadastro e na edição); o prazo passa a ser
   contado a partir dela (faltam X dias / término previsto), inclusive em Meus Projetos.
2. **EAP colapsável na aba Obras:** a EAP de cada obra fica oculta por padrão, com botão **Expandir EAP**
   — deixa a página leve mesmo com muitas obras.
3. **Endereço nos PDFs:** corrigido para *R. Dr. Roberto Barrozo, 528 — Centro Cívico — Curitiba/PR —
   CEP 80.520-092*.
4. **Notificações por e-mail de prazos vencidos:** o sistema avisa os supervisores por e-mail sobre
   RDO, POS, PMM, envio de SM-i e SS-i em atraso, com botão **Regularizar** que abre direto a área no
   sistema. Roda automaticamente todo dia (cron 08h BRT) e há um botão **✉ Notificar pendências** no
   Painel Gerencial para disparar na hora.

> **Sem migração de banco.** Requer, na Vercel:
> - `APP_URL` = a URL pública do sistema (ex.: `https://incorp360.com`) — usada nos links do e-mail.
> - `CRON_SECRET` = um texto secreto qualquer — protege o disparo automático do cron.
> - As variáveis de SMTP da v9.5 (`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`) para o envio.
> Depois de cadastrar, faça **Redeploy**.


## v9.5 — E-mail via Google Workspace (SMTP)
- O envio de e-mail (alocação de supervisor) passa a usar o **SMTP do Google Workspace** via
  nodemailer. Resend continua como fallback opcional.
- Configure na Vercel (Settings → Environment Variables → Production) e faça **Redeploy**:
  - `SMTP_HOST` = `smtp.gmail.com`
  - `SMTP_PORT` = `465`
  - `SMTP_USER` = `mcc-nao-responder@miriadsolutions.com`
  - `SMTP_PASS` = a senha de app de 16 caracteres (sem espaços)
  - `EMAIL_FROM` = `MCC Miriad <mcc-nao-responder@miriadsolutions.com>`
- Sem essas variáveis, a alocação continua funcionando e a tela avisa que o e-mail não foi enviado.

> Sem migração. Apenas backend (nodemailer adicionado às dependências; a Vercel instala no deploy).


## v9.4 — Atendimento, alocação, meus projetos e mais
1. **SM-i/SS-i clicáveis:** clique no cartão para expandir todos os detalhes da solicitação (itens da
   EAP, quantidades, contratado, observações), apoiando o Suprimentos no atendimento.
2. **Descartar emergencial:** SM-i e SS-i emergenciais agora têm botão **Descartar** (cancela) além de
   Autorizar, no painel do Coordenador de Obras.
3. **Alocação de Supervisor (👷):** nova tela (CEO, Diretor e Coord. de Planejamento) para alocar/editar
   o supervisor de cada obra. Ao alocar, é enviado e-mail ao supervisor comunicando a obra.
4. **Meus Projetos (🗂️):** tela do Supervisor com, por obra: prazo a vencer, % executado e pendências de
   RDO, POS, PMM, SM-i e SS-i.
5. **Atividade não descrita na EAP:** no RDO, quando a atividade não existe na EAP, o usuário descreve,
   informa a quantidade estimada e salva; o item entra na EAP marcado como “não descrito” para consulta.
6. **Painel Gerencial — produção por obra:** tabela com produção do dia, 7 dias, 15 dias, mês e
   acumulada por obra, com linha de **TOTAL da empresa**.
7. **Editar/excluir POS e PMM:** CEO, Diretor e Coord. de Planejamento podem editar ou excluir um POS/PMM
   na gestão; ao excluir, o prazo de envio **volta a contar** para o supervisor.
8. **Numeração automática de RDO:** o nº do RDO é sugerido a partir do maior número já existente na obra.

> **Migração:** rode `supabase/migration_v9_4.sql` (adiciona `eap_itens.nao_descrito`).
> **E-mail (item 3):** para o envio funcionar, configure na Vercel as variáveis `RESEND_API_KEY` e
> `EMAIL_FROM` (provedor Resend). Sem isso, a alocação ocorre normalmente e o sistema avisa que o
> e-mail não foi enviado, mostrando o endereço do supervisor.


## v9.3 — Permissões por cargo configuráveis + Planejamento nos entregáveis
- **Tela "Permissões" (🔑, só CEO/Diretor):** configure, por cargo, o que cada um acessa — módulos
  gerais (Painel, Usuários, Ranking, Painel Gerencial), telas do Operacional, abas do Financeiro e as
  capacidades dos entregáveis (criar/gerir SM-i, SS-i, POS e PMM). As escolhas são salvas e valem
  para todos os usuários daquele cargo. Itens sensíveis (dados financeiros e gestão de usuários)
  seguem protegidos no servidor, independentemente desta tela.
- **Coordenador de Planejamento** passa a, por padrão, **criar e gerir** SM-i, SS-i, POS e PMM (além
  da visão de gestão que já tinha). Tudo isso é editável na tela de Permissões.

> **Migração:** rode `supabase/migration_v9_3.sql` (cria a tabela `app_config`). Sem ela, a tela de
> Permissões não salva; o sistema continua funcionando com as permissões padrão.


## v9.2 — Painel Gerencial (CEO/Diretor)
Nova tela executiva no menu lateral (📊 Painel Gerencial), só para Diretoria e CEO:
- **Pendências de envio:** obras sem RDO hoje, supervisores sem POS da próxima semana, sem PMM do
  próximo mês, SM-is aguardando atendimento e SS-is em aberto.
- **Compras nas obras (OC-i):** valor adquirido total (regime de competência) e o desembolso por mês
  (regime de caixa), conforme as condições de pagamento das OC-i. (A SM-i não carrega valor; ele é
  realizado na OC-i.)
- **Produção por obra:** ranking de avanço físico (% medido pelos RDOs sobre o contratado).
- **Fluxo de caixa projetado (6 meses):** entradas das medições projetadas (PMM) deslocadas pelo
  prazo de recebimento (lido das premissas), menos as saídas — pagamentos de OC-i e OS-i no
  vencimento e as despesas fixas mensais informadas (folha de escritório, despesas financeiras e
  outras), com saldo do mês e acumulado.
- **Alertas de avanço:** obras sem avanço há mais de 3 dias (ou sem nenhum avanço registrado).
- **Últimas atividades:** feed das ações recentes no sistema (RDO, POS, PMM, SM-i, SS-i, OC-i).

> **Sem migração.** Os parâmetros de despesas/prazo do fluxo são salvos no estado financeiro
> (acessível a CEO/Diretor/Financeiro).


## v9.1 — SM-i/SS-i geram OC-i/OS-i pré-preenchida e acesso ao Planejamento
- **Gerar OC-i a partir da SM-i:** quando o Suprimentos baixa uma SM-i (move para Atendida), surge
  um pop-up perguntando se deseja **gerar a OC-i** já pré-preenchida com a obra, o solicitante e os
  itens da solicitação (item da EAP, material, quantidade e unidade). Basta completar fornecedor e
  valores e emitir o PDF para o fornecedor.
- **Gerar OS-i a partir da SS-i:** quando o Suprimentos marca uma SS-i como contratada/ativa, surge
  o pop-up para **gerar a OS-i** pré-preenchida com a obra e os itens da EAP do serviço.
- **Item da EAP na solicitação:** a SM-i e a SS-i continuam exigindo o item da EAP em cada linha, e
  agora esse vínculo é levado automaticamente para a OC-i/OS-i gerada.
- **Acesso do Coordenador de Planejamento:** passa a visualizar (somente leitura) as SM-is e SS-is
  de todos os supervisores, em todas as obras.

> **Sem migração** — apenas frontend. As OC-i/OS-i são geradas como rascunho na respectiva tela; nada
> é emitido sem a conferência e o salvamento pelo Suprimentos.


## v9.0 — Mobile e acabamento de UI
Otimização para celular e refinamento estético, mantendo as cores e o tema claro:
- **Layout responsivo:** no celular, barra superior fixa com botão de menu (☰) + logo + título, e
  o menu lateral vira um **drawer deslizante** com fundo escurecido; conteúdo em largura cheia com
  espaçamento adequado. No desktop, a sidebar fixa de sempre.
- **Tipografia Inter** carregada de verdade (Google Fonts) e ajustes de leitura.
- **Interações premium (CSS global):** transições suaves, anel de foco laranja nos campos, leve
  elevação em botões e cartões no hover, realce de linha nas tabelas, animação de entrada do
  conteúdo a cada troca de tela, animações de abertura do menu e scrollbars discretas.
- Acabamento nos componentes (cartões, KPIs e botões): cantos mais suaves e sombras mais leves.

> **Sem migração** — mudança apenas de frontend. Recomenda-se testar no celular; se quiser ajustes
> visuais específicos com base no buildots.com, envie um print da tela de referência.


## v9.0 — Mobile e acabamento de UI
Versão focada em experiência, mantendo as cores (laranja/preto/branco) e o tema claro:
- **Mobile:** no celular, a navegação vira uma **barra superior fixa** com botão de menu (☰), logo e
  título; o menu lateral passa a ser um **drawer deslizante** com fundo escurecido, fechando ao
  escolher um item. Conteúdo em largura cheia, espaçamentos e tipografia ajustados para telas
  pequenas. No desktop, a sidebar fixa continua igual.
- **Acabamento premium:** fonte **Inter**, transições suaves, anel de foco laranja nos campos,
  leve elevação no hover de botões e cartões, realce de linha nas tabelas, sombras mais suaves,
  scrollbars discretas e animação de entrada do conteúdo a cada troca de tela.

> **Sem migração** — mudança apenas de frontend. Recomendado testar no celular; se quiser reproduzir
> algum detalhe visual específico de uma referência, envie um print.


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
