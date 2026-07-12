// /api/data — CRUD genérico do MCC com controle de acesso por papel
import { supabase, sessao, emitirConvite, enviarEmail } from "./_lib.js";

const TABELAS = {
  obras: { ordem: "criado_em", asc: false },
  eap_itens: { ordem: "ordem", asc: true, filtro: "obra_id" },
  contratos_servico: { ordem: "criado_em", asc: false },
  ordens_compra: { ordem: "data", asc: false },
  funcionarios: { ordem: "nome", asc: true },
  rdos: { ordem: "data", asc: false, filtro: "obra_id" },
  restricoes_material: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  sm_itens: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  ss_itens: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  designacoes: { ordem: "criado_em", asc: false },
  envio_semanal: { ordem: "semana", asc: false },
  pos: { ordem: "semana", asc: false, filtro: "obra_id" },
  pmm: { ordem: "mes", asc: false, filtro: "obra_id" },
  boletins_medicao: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  ordens_pagamento: { ordem: "vencimento", asc: true },
  config_financeiro: { ordem: "chave", asc: true },
  catalogo_financeiro: { ordem: "codigo", asc: true },
  catalogo_mao_obra: { ordem: "prestador", asc: true },
  orcamentos_comerciais: { ordem: "criado_em", asc: false },
  papeis_customizados: { ordem: "criado_em", asc: false },
  acoes_usuario_pendentes: { ordem: "solicitado_em", asc: false },
  gastos_escritorio: { ordem: "data", asc: false },
  gastos_unidades: { ordem: "ordem", asc: true },
  gastos_descricoes: { ordem: "ordem", asc: true },
  memoriais_custo: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  memoriais_itens: { ordem: "ordem", asc: true, filtro: "memorial_id" },
  travamentos: { ordem: "criado_em", asc: false },
  custos_fixos: { ordem: "descricao", asc: true },
  rh_colaboradores: { ordem: "nome", asc: true },
  rh_folha: { ordem: "criado_em", asc: false, filtro: "mes" },
  usuarios: { ordem: "nome", asc: true },
};
const RH_TABELAS = new Set(["rh_colaboradores", "rh_folha"]);
const RH_ROLES = new Set(["ceo", "diretor", "financeiro"]);

// Grupos de papéis
const VE_FINANCEIRO   = new Set(["ceo", "diretor", "financeiro"]);
const GERENCIA_USUARIOS = new Set(["ceo", "diretor", "coord_suprimentos", "coord_planejamento", "coord_obras", "coord_orcamentos"]);
const ADMIN_TOTAL     = new Set(["ceo", "diretor"]);
const SUPRIMENTOS     = new Set(["op_suprimentos", "coord_suprimentos"]);
const ALOCA_SUPERVISOR = new Set(["ceo", "diretor", "coord_planejamento"]);
const GERENCIA_ORCCOM = new Set(["ceo", "diretor", "coord_planejamento"]);
// coord_planejamento pode gerenciar usuários, mas suas ações de criar/excluir passam por aprovação de diretoria
// papéis cujo acesso é restrito às obras em que foram designados
const OBRA_SCOPED     = new Set(["sup_obras", "op_suprimentos", "op_planejamento", "op_orcamento"]);

// segunda-feira (ISO) da semana de uma data, em yyyy-mm-dd
function mondayISO(d = new Date()) {
  const x = new Date(d); const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia); x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
// segunda-feira da próxima semana
function proximaSegundaISO(d = new Date()) {
  const m = new Date(mondayISO(d) + "T00:00:00"); m.setDate(m.getDate() + 7);
  return m.toISOString().slice(0, 10);
}
// primeiro dia do próximo mês (yyyy-mm-01)
function proximoMesISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1); return x.toISOString().slice(0, 10);
}

// registra um travamento no log (idempotente: não duplica se já há um aberto para o mesmo motivo/semana)
async function registrarTravamento(supabase, usuario_id, tipo, motivo, ref) {
  const { data: aberto } = await supabase.from("travamentos")
    .select("id").eq("usuario_id", usuario_id).eq("tipo", tipo).eq("ref", ref).is("destravado_em", null).limit(1);
  if (aberto && aberto.length) return;
  await supabase.from("travamentos").insert({ usuario_id, tipo, motivo, ref });
}

// Gera as Ordens de Pagamento (uma por parcela) a partir de uma OC/OS aprovada.
// Idempotente: o índice único (origem_tipo, origem_id, parcela) impede duplicar.
async function gerarOPsDaOrigem(supabase, tabela, origem) {
  const tipo = tabela === "ordens_compra" ? "oc" : "bmp";
  // centro de custo vem da obra
  let centro = null;
  if (origem.obra_id) {
    const { data: ob } = await supabase.from("obras").select("centro_custo").eq("id", origem.obra_id).maybeSingle();
    centro = ob?.centro_custo || null;
  }
  const cond = origem.condicao_pagamento || {};
  const modoPct = cond.modo === "pct";            // OS-i "% de avanço": a parcela guarda só o pct
  const totalOrigem = Number(origem.valor) || 0;
  let parcelas = Array.isArray(cond.parcelas) && cond.parcelas.length
    ? cond.parcelas
    : [{ parcela: "1/1", valor: totalOrigem, vencimento: origem.data_faturamento || origem.data || null, obs: "" }];
  const nP = parcelas.length;
  const forn = origem.fornecedor || origem.empresa || origem.responsavel || null;
  const cnpj = (origem.dados_oc && origem.dados_oc.cnpj) || origem.cnpj || null;
  const linhas = parcelas.map((p, i) => {
    const chaveParc = p.parcela || `${i + 1}/${nP}`;   // chave única por parcela (evita colisão no índice)
    // no modo "% de avanço" o valor absoluto é pct/100 × total da origem; senão usa o valor gravado na parcela.
    const valorParc = modoPct
      ? Math.round(((Number(p.pct) || 0) / 100) * totalOrigem * 100) / 100
      : (Number(p.valor) || 0);
    return {
      origem_tipo: tipo,
      origem_id: origem.id,
      obra_id: origem.obra_id || null,
      numero: (origem.numero || (tipo === "oc" ? "OC" : "OS")) + "-" + chaveParc,
      fornecedor: forn,
      cnpj,
      centro_custo: centro,
      descricao: (tipo === "oc" ? "OC " : "OS ") + (origem.numero || "") + " · parcela " + chaveParc,
      valor: valorParc,
      vencimento: p.vencimento || null,
      status: "pendente_nf",
      payload: { parcela: chaveParc, obs: p.obs || "", origem: tipo + "_aprovada" },
    };
  });
  // insere ignorando conflitos (idempotente)
  for (const l of linhas) {
    await supabase.from("ordens_pagamento").upsert(l, { onConflict: "origem_tipo,origem_id,(payload->>'parcela')", ignoreDuplicates: true });
  }
  return linhas.length;
}


// quem pode criar qual papel. Para papéis customizados (custom_*), valida contra o papel-base informado.
function podeCriarPapel(criador, alvo, baseAlvo) {
  const efetivo = (typeof alvo === "string" && alvo.startsWith("custom_") && baseAlvo) ? baseAlvo : alvo;
  if (criador === "ceo") return true;
  if (criador === "diretor") return efetivo !== "diretor" && efetivo !== "ceo";
  if (criador === "coord_suprimentos") return efetivo === "op_suprimentos";
  if (criador === "coord_planejamento") return efetivo !== "diretor" && efetivo !== "ceo";
  if (criador === "coord_obras") return efetivo === "sup_obras";
  if (criador === "coord_orcamentos") return efetivo === "op_orcamento";
  return false;
}

export default async function handler(req, res) {
  const s = sessao(req);
  if (!s) return res.status(401).json({ error: "Sessão inválida ou expirada" });

  // obras às quais o usuário tem acesso (papéis escopados por designação)
  let obrasPermitidas = null;
  if (OBRA_SCOPED.has(s.papel)) {
    const { data: des } = await supabase.from("designacoes").select("obra_id").eq("usuario_id", s.id);
    obrasPermitidas = [...new Set((des || []).map((d) => d.obra_id).filter(Boolean))];
    if (obrasPermitidas.length === 0) obrasPermitidas = ["00000000-0000-0000-0000-000000000000"]; // nenhuma → vazio
  }

  // ---- estado financeiro (key-value) ----
  if ((req.query.t || req.body?.t) === "financeiro_estado") {
    if (!VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito ao Financeiro" });
    if (req.method === "GET") {
      const { data } = await supabase.from("financeiro_estado").select("valor").eq("chave", req.query.chave).maybeSingle();
      return res.status(200).json({ valor: data ? data.valor : null });
    }
    if (req.method === "POST") {
      const { chave, valor } = req.body;
      const { error } = await supabase.from("financeiro_estado").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // tabelas que possuem coluna obra_id (para escopo por designação)
  const TEM_OBRA_ID = new Set(["obras", "eap_itens", "contratos_servico", "ordens_compra", "funcionarios", "rdos", "restricoes_material", "sm_itens", "ss_itens", "pos", "pmm", "boletins_medicao", "ordens_pagamento"]);

  if (req.method === "GET") {
    const t = String(req.query.t || "");
    if (t === "ping") return res.status(200).json({ ok: true, papel: s.papel });

    // configuração de acesso por cargo (leitura liberada a qualquer autenticado)
    if (t === "config") {
      const { data } = await supabase.from("app_config").select("valor").eq("chave", req.query.chave || "acesso").maybeSingle();
      return res.status(200).json({ valor: data ? data.valor : null });
    }

    // lista enxuta de colaboradores para os dropdowns de responsável (qualquer autenticado)
    if (t === "colaboradores") {
      const { data, error } = await supabase.from("usuarios").select("id,nome,papel,ativo").eq("ativo", true).order("nome");
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ rows: data });
    }

    // resumo enxuto de RDOs de uma obra: acumulado por item de EAP + maior nº (para o RDO-i)
    if (t === "rdo_resumo") {
      const obra_id = req.query.obra_id;
      if (!obra_id) return res.status(400).json({ error: "obra_id obrigatório" });
      if (obrasPermitidas && !obrasPermitidas.includes(obra_id)) return res.status(200).json({ acum: {}, maxNumero: 0 });
      const { data, error } = await supabase.from("rdos").select("numero,atividades").eq("obra_id", obra_id).limit(20000);
      if (error) return res.status(500).json({ error: error.message });
      const acum = {}; let maxNumero = 0;
      (data || []).forEach((r) => {
        const n = parseInt(String(r.numero || "").replace(/\D/g, ""), 10); if (!isNaN(n) && n > maxNumero) maxNumero = n;
        (r.atividades || []).forEach((a) => { if (a && a.eap != null) acum[a.eap] = (acum[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); });
      });
      return res.status(200).json({ acum, maxNumero });
    }

    // pendências e travamentos por usuário (Diretoria / Coord. de Planejamento)
    if (t === "pendencias_usuarios") {
      if (!ALOCA_SUPERVISOR.has(s.papel)) return res.status(403).json({ error: "Acesso restrito." });
      const DIA = 86400000;
      const agora = new Date();
      const isoD = (d) => d.toISOString().slice(0, 10);
      const ontem = isoD(new Date(agora.getTime() - DIA));
      const segSemana = mondayISO();                 // segunda desta semana (ref do envio SM-i)
      const proxSeg = proximaSegundaISO();           // POS da próxima semana
      const proxMes = proximoMesISO();               // PMM do próximo mês
      const [{ data: usuarios }, { data: desig }, { data: obras }, { data: pos }, { data: pmm }, { data: ss }, { data: envio }, { data: rdosOntem }, { data: travs }] = await Promise.all([
        supabase.from("usuarios").select("id,nome,email,papel,travado,travado_em,ativo"),
        supabase.from("designacoes").select("usuario_id,obra_id"),
        supabase.from("obras").select("id,codigo"),
        supabase.from("pos").select("supervisor_id,semana"),
        supabase.from("pmm").select("supervisor_id,mes"),
        supabase.from("ss_itens").select("solicitante_id,status,criado_em"),
        supabase.from("envio_semanal").select("usuario_id,semana,sem_necessidade,confirmado_em"),
        supabase.from("rdos").select("obra_id,data").gte("data", ontem),
        supabase.from("travamentos").select("*").order("criado_em", { ascending: false }),
      ]);
      const codObra = (id) => (obras || []).find((o) => o.id === id)?.codigo || "—";
      const nomeU = (id) => (usuarios || []).find((u) => u.id === id)?.nome || "—";
      const prazoSMi = new Date(segSemana + "T00:00:00"); prazoSMi.setHours(23, 59, 59, 0);            // segunda 23:59
      const prazoPOS = (() => { const g = new Date(segSemana + "T00:00:00"); g.setDate(g.getDate() + 4); g.setHours(23, 59, 59, 0); return g; })(); // sexta 23:59
      const prazoPMM = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59);
      const statusDe = (prazo) => { const dt = prazo.getTime() - agora.getTime(); if (dt < 0) return "atrasado"; if (dt <= 2 * DIA) return "proximo"; return "ok"; };
      const sups = (usuarios || []).filter((u) => u.papel === "sup_obras");
      const linhas = sups.map((u) => {
        const obrasU = (desig || []).filter((d) => d.usuario_id === u.id).map((d) => d.obra_id);
        const pend = [];
        if (obrasU.length) {
          const semRdo = obrasU.filter((oid) => !(rdosOntem || []).some((r) => r.obra_id === oid && String(r.data).slice(0, 10) === ontem));
          if (semRdo.length) pend.push({ area: "rdo", titulo: "RDO de ontem", detalhe: `${semRdo.length} obra(s) sem RDO de ${ontem.split("-").reverse().join("/")}`, prazo: null, status: "atrasado" });
          if (!(envio || []).some((e) => e.usuario_id === u.id && String(e.semana).slice(0, 10) === segSemana))
            pend.push({ area: "smi", titulo: "Envio semanal de SM-i", detalhe: "envio da semana não confirmado", prazo: prazoSMi.toISOString(), status: statusDe(prazoSMi) });
          if (!(pos || []).some((p) => p.supervisor_id === u.id && String(p.semana).slice(0, 10) === proxSeg))
            pend.push({ area: "pos", titulo: "POS da próxima semana", detalhe: "ainda não enviado", prazo: prazoPOS.toISOString(), status: statusDe(prazoPOS) });
          if (!(pmm || []).some((p) => p.supervisor_id === u.id && String(p.mes).slice(0, 10) === proxMes))
            pend.push({ area: "pmm", titulo: "PMM do próximo mês", detalhe: "ainda não enviado", prazo: prazoPMM.toISOString(), status: statusDe(prazoPMM) });
        }
        const ssVelhas = (ss || []).filter((x) => x.solicitante_id === u.id && !["baixada", "cancelada"].includes(x.status) && (agora - new Date(x.criado_em)) / DIA >= 60);
        if (ssVelhas.length) pend.push({ area: "ssi", titulo: "SS-i pendente", detalhe: `${ssVelhas.length} solicitação(ões) aberta(s) há mais de 60 dias`, prazo: null, status: "atrasado" });
        const meusTrav = (travs || []).filter((x) => x.usuario_id === u.id).slice(0, 20).map((x) => ({
          tipo: x.tipo, motivo: x.motivo, ref: x.ref, criado_em: x.criado_em,
          destravado_em: x.destravado_em, destravado_por_nome: x.destravado_por ? nomeU(x.destravado_por) : null,
        }));
        return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, obras: obrasU.map(codObra), travado: !!u.travado, travado_em: u.travado_em, pendencias: pend, travamentos: meusTrav };
      });
      return res.status(200).json({ rows: linhas });
    }

    const cfg = TABELAS[t];
    if (!cfg) return res.status(400).json({ error: "Recurso não permitido" });
    if (RH_TABELAS.has(t) && !RH_ROLES.has(s.papel)) return res.status(403).json({ error: "Acesso restrito à folha de pagamento." });
    if (t === "usuarios" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    let q = supabase.from(t).select(t === "usuarios" ? "id,nome,email,papel,ativo,criado_em,obra_id,senha_definida,travado" : "*").order(cfg.ordem, { ascending: cfg.asc });
    if (cfg.filtro && req.query[cfg.filtro]) q = q.eq(cfg.filtro, req.query[cfg.filtro]);
    if (t === "rdos" && req.query.desde) q = q.gte("data", req.query.desde);
    if (obrasPermitidas && TEM_OBRA_ID.has(t)) q = q.in(t === "obras" ? "id" : "obra_id", obrasPermitidas);
    // emergenciais só aparecem para o OPERADOR de Suprimentos depois de autorizadas;
    // o Coordenador de Suprimentos precisa vê-las pendentes para autorizar.
    if (t === "sm_itens" && s.papel === "op_suprimentos") q = q.or("emergencial.eq.false,autorizada_emergencial.eq.true");
    if (t === "ss_itens" && SUPRIMENTOS.has(s.papel)) q = q.or("emergencial.eq.false,autorizada_emergencial.eq.true");
    const { data, error } = await q.limit(20000);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }

  if (req.method === "POST") {
    const { t, row, obra, itens } = req.body || {};
    if (RH_TABELAS.has(t) && !RH_ROLES.has(s.papel)) return res.status(403).json({ error: "Acesso restrito à folha de pagamento." });

    // alocação de supervisor numa obra + e-mail de comunicação
    if (t === "aprovar_ordem" || t === "rejeitar_ordem") {
      const { tabela, id, motivo } = req.body || {};
      if (tabela !== "ordens_compra" && tabela !== "contratos_servico") return res.status(400).json({ error: "Tabela inválida" });
      const ehSuprimentos = s.papel === "coord_suprimentos" || s.papel === "coord_planejamento";
      const ehDiretor = s.papel === "ceo" || s.papel === "diretor";
      if (!ehSuprimentos && !ehDiretor) return res.status(403).json({ error: "Apenas Coord. de Suprimentos, Coord. de Planejamento ou Diretoria podem aprovar/rejeitar." });
      const { data: ordem } = await supabase.from(tabela).select("*").eq("id", id).maybeSingle();
      if (!ordem) return res.status(404).json({ error: "Ordem não encontrada" });

      if (t === "rejeitar_ordem") {
        await supabase.from(tabela).update({ status_aprovacao: "rejeitada", rejeitada_por: s.id, rejeitada_em: new Date().toISOString(), rejeicao_motivo: motivo || null }).eq("id", id);
        return res.status(200).json({ ok: true, status: "rejeitada" });
      }

      // aprovar: registra a aprovação do papel correspondente
      const patch = {};
      if (ehSuprimentos) { patch.aprov_suprimentos_por = s.id; patch.aprov_suprimentos_em = new Date().toISOString(); }
      if (ehDiretor) { patch.aprov_diretor_por = s.id; patch.aprov_diretor_em = new Date().toISOString(); }
      const temSup = patch.aprov_suprimentos_por || ordem.aprov_suprimentos_por;
      const temDir = patch.aprov_diretor_por || ordem.aprov_diretor_por;
      if (temSup && temDir) patch.status_aprovacao = "aprovada";
      await supabase.from(tabela).update(patch).eq("id", id);

      // se ficou completa, gera as OPs
      let ops = 0;
      if (temSup && temDir) {
        const ordemAtual = { ...ordem, ...patch };
        try { ops = await gerarOPsDaOrigem(supabase, tabela, ordemAtual); } catch (e) { return res.status(500).json({ error: "Aprovada, mas falhou ao gerar OP: " + e.message }); }
      }
      return res.status(200).json({ ok: true, status: temSup && temDir ? "aprovada" : "aguardando", ops_geradas: ops });
    }

    // aprovar/rejeitar um Boletim de Medição (BMP) — ao aprovar, gera a OP pelo líquido medido
    if (t === "aprovar_bmp" || t === "rejeitar_bmp") {
      const { id, motivo } = req.body || {};
      if (!["ceo", "diretor", "coord_planejamento", "coord_obras"].includes(s.papel))
        return res.status(403).json({ error: "Apenas Coord. de Obras, Coord. de Planejamento ou Diretoria podem aprovar boletins." });
      const { data: bmp } = await supabase.from("boletins_medicao").select("*").eq("id", id).maybeSingle();
      if (!bmp) return res.status(404).json({ error: "Boletim não encontrado." });
      if (t === "rejeitar_bmp") {
        await supabase.from("boletins_medicao").update({ status: "rejeitado", aprovado_por: s.id, aprovado_em: new Date().toISOString(), rejeicao_motivo: motivo || null }).eq("id", id);
        return res.status(200).json({ ok: true, status: "rejeitado" });
      }
      if (bmp.status === "aprovado" && bmp.op_gerada) return res.status(200).json({ ok: true, status: "aprovado", ja: true, op_valor: Number(bmp.liquido) || 0 });
      await supabase.from("boletins_medicao").update({ status: "aprovado", aprovado_por: s.id, aprovado_em: new Date().toISOString(), op_gerada: true }).eq("id", id);
      // dados do contrato/obra para compor a OP
      const { data: ct } = await supabase.from("contratos_servico").select("empresa,responsavel,cnpj,numero").eq("id", bmp.contrato_id).maybeSingle();
      let centro = null;
      if (bmp.obra_id) { const { data: ob } = await supabase.from("obras").select("centro_custo").eq("id", bmp.obra_id).maybeSingle(); centro = ob?.centro_custo || null; }
      const liquido = Number(bmp.liquido) || 0;
      const chaveParc = "BMP-" + (bmp.numero || "1");
      const op = {
        origem_tipo: "bmp",
        origem_id: bmp.id,
        obra_id: bmp.obra_id || null,
        numero: (ct?.numero || "OS") + "-" + chaveParc,
        fornecedor: ct?.empresa || ct?.responsavel || null,
        cnpj: ct?.cnpj || null,
        centro_custo: centro,
        descricao: "Medição (BMP) nº " + (bmp.numero || "") + " · " + (ct?.empresa || ct?.responsavel || ""),
        valor: liquido,
        vencimento: null,
        status: "pendente_nf",
        payload: { parcela: chaveParc, obs: bmp.observacao || "", origem: "bmp_aprovada", boletim_id: bmp.id },
      };
      await supabase.from("ordens_pagamento").upsert(op, { onConflict: "origem_tipo,origem_id,(payload->>'parcela')", ignoreDuplicates: true });
      return res.status(200).json({ ok: true, status: "aprovado", op_valor: liquido });
    }

    // aprovar/rejeitar ações de usuário pendentes (só diretoria)
    if (t === "decidir_acao_usuario") {
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas Diretoria pode decidir ações de usuário." });
      const { id, aprovar, motivo } = req.body || {};
      const { data: acao } = await supabase.from("acoes_usuario_pendentes").select("*").eq("id", id).maybeSingle();
      if (!acao) return res.status(404).json({ error: "Ação não encontrada." });
      if (acao.status !== "aguardando") return res.status(400).json({ error: "Ação já decidida." });
      if (!aprovar) {
        await supabase.from("acoes_usuario_pendentes").update({ status: "rejeitada", decidido_por: s.id, decidido_em: new Date().toISOString(), motivo_rejeicao: motivo || null }).eq("id", id);
        return res.status(200).json({ ok: true, status: "rejeitada" });
      }
      if (acao.tipo === "criar") {
        const r = acao.payload || {};
        const { hashSenha } = await import("./_lib.js");
        const temSenha = !!r.senha;
        const payload = { nome: r.nome, email: String(r.email).trim().toLowerCase(), papel: r.papel, senha_hash: temSenha ? hashSenha(r.senha) : null, senha_definida: temSenha };
        const { data, error } = await supabase.from("usuarios").insert(payload).select("id,nome,email,papel").single();
        if (error) return res.status(500).json({ error: error.message.includes("duplicate") ? "E-mail já cadastrado" : error.message });
        if (Array.isArray(r.obras) && r.obras.length) await supabase.from("designacoes").insert(r.obras.map((oid) => ({ usuario_id: data.id, obra_id: oid, funcao: r.papel })));
        const convite = temSenha ? null : emitirConvite(data);
        await supabase.from("acoes_usuario_pendentes").update({ status: "aprovada", decidido_por: s.id, decidido_em: new Date().toISOString() }).eq("id", id);
        return res.status(200).json({ ok: true, status: "aprovada", convite });
      }
      if (acao.tipo === "excluir") {
        const uid = acao.payload?.id;
        const { data: alvo } = await supabase.from("usuarios").select("papel").eq("id", uid).maybeSingle();
        if (alvo && (alvo.papel === "ceo" || alvo.papel === "diretor")) return res.status(403).json({ error: "Não é possível excluir CEO/Diretor." });
        await supabase.from("usuarios").delete().eq("id", uid);
        await supabase.from("acoes_usuario_pendentes").update({ status: "aprovada", decidido_por: s.id, decidido_em: new Date().toISOString() }).eq("id", id);
        return res.status(200).json({ ok: true, status: "aprovada" });
      }
      return res.status(400).json({ error: "Tipo de ação desconhecido." });
    }

    // converter uma solicitação (SM/SS/OC/OS) em gasto de escritório
    if (t === "converter_gasto_escritorio") {
      const { origem_tipo, origem_id, unidade, descricao, detalhe, valor, data } = req.body || {};
      if (!unidade || !descricao) return res.status(400).json({ error: "Informe a unidade e a descrição do gasto." });
      const gasto = {
        unidade, descricao, detalhe: detalhe || null,
        valor: Number(valor) || 0,
        data: data || new Date().toISOString().slice(0, 10),
        origem_tipo: origem_tipo || "manual", origem_id: origem_id || null,
        criado_por: s.id,
      };
      const { data: novo, error } = await supabase.from("gastos_escritorio").insert(gasto).select().single();
      if (error) return res.status(500).json({ error: error.message });
      // se veio de uma solicitação, marca/remove a original conforme o tipo
      if (origem_id && origem_tipo) {
        const tabelaOrigem = { sm: "sm_itens", ss: "ss_itens", oc: "ordens_compra", os: "contratos_servico" }[origem_tipo];
        if (tabelaOrigem) { try { await supabase.from(tabelaOrigem).delete().eq("id", origem_id); } catch (_) {} }
      }
      return res.status(200).json({ ok: true, gasto: novo });
    }

    // converter proposta comercial em projeto (obra)
    if (t === "tornar_projeto") {
      const ehDiretor = s.papel === "ceo" || s.papel === "diretor";
      const ehPlanejamento = s.papel === "coord_planejamento";
      if (!ehDiretor && !ehPlanejamento) return res.status(403).json({ error: "Apenas Diretoria ou Coord. de Planejamento podem converter propostas em projeto." });
      const { id } = req.body || {};
      const { data: prop } = await supabase.from("orcamentos_comerciais").select("*").eq("id", id).maybeSingle();
      if (!prop) return res.status(404).json({ error: "Proposta não encontrada" });
      if (prop.obra_id) return res.status(400).json({ error: "Esta proposta já foi convertida em projeto." });
      // cria a obra a partir da proposta (campos básicos seguros)
      const novaObra = {
        codigo: prop.codigo || (prop.cliente ? String(prop.cliente).slice(0, 24) : "PROJETO"),
        nome: prop.descricao || prop.cliente || "Projeto convertido",
      };
      const { data: obraCriada, error: errObra } = await supabase.from("obras").insert(novaObra).select().maybeSingle();
      if (errObra) return res.status(500).json({ error: "Falha ao criar obra: " + errObra.message });
      await supabase.from("orcamentos_comerciais").update({ status: "convertida", obra_id: obraCriada.id, convertida_em: new Date().toISOString(), convertida_por: s.id, atualizado_em: new Date().toISOString() }).eq("id", id);
      return res.status(200).json({ ok: true, obra_id: obraCriada.id });
    }

    if (t === "alocar_supervisor") {
      if (!ALOCA_SUPERVISOR.has(s.papel)) return res.status(403).json({ error: "Sem permissão para alocar supervisores." });
      const { obra_id, supervisor_id } = req.body;
      if (!obra_id || !supervisor_id) return res.status(400).json({ error: "Informe obra e supervisor." });
      const { data: usuarioAloc } = await supabase.from("usuarios").select("papel").eq("id", supervisor_id).maybeSingle();
      await supabase.from("designacoes").upsert({ usuario_id: supervisor_id, obra_id, funcao: usuarioAloc?.papel || "sup_obras" }, { onConflict: "usuario_id,obra_id" });
      const { data: sup } = await supabase.from("usuarios").select("nome,email").eq("id", supervisor_id).maybeSingle();
      const { data: obra } = await supabase.from("obras").select("codigo,nome").eq("id", obra_id).maybeSingle();
      let email = { ok: false, motivo: "sem_destinatario" };
      if (sup && sup.email) {
        email = await enviarEmail({
          to: sup.email,
          subject: `Você foi alocado na obra ${obra?.codigo || ""}`.trim(),
          html: `<div style="font-family:Arial,sans-serif"><h2 style="color:#f37335">Miriad Construction Control</h2><p>Olá, ${(sup.nome || "").split(" ")[0]}.</p><p>Você foi alocado(a) como Supervisor de Obras na obra <b>${obra?.codigo || ""}${obra?.nome ? " — " + obra.nome : ""}</b>.</p><p>Acesse o MCC para registrar o RDO diário e seus planejamentos (POS/PMM) desta obra.</p></div>`,
        });
      }
      return res.status(200).json({ ok: true, email });
    }

    // gravação da configuração de acesso por cargo (apenas CEO/Diretor)
    if (t === "config") {      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem alterar as permissões." });
      const { chave, valor } = req.body;
      const { error } = await supabase.from("app_config").upsert({ chave: chave || "acesso", valor, atualizado_em: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ---- conformidade semanal de envio das SM-is (Supervisor de Obras) ----
    if (t === "confirmar_envio") {
      const semana = mondayISO();
      const { error } = await supabase.from("envio_semanal").upsert({ usuario_id: s.id, semana, sem_necessidade: false, confirmado_em: new Date().toISOString() }, { onConflict: "usuario_id,semana" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, semana });
    }
    // ---- Supervisor declara que não há necessidade de SM-is nesta semana (não trava; fica no histórico) ----
    if (t === "sm_sem_necessidade") {
      const semana = mondayISO();
      const { error } = await supabase.from("envio_semanal").upsert({ usuario_id: s.id, semana, sem_necessidade: true, confirmado_em: new Date().toISOString() }, { onConflict: "usuario_id,semana" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, semana, sem_necessidade: true });
    }
    // ---- gera as OPs dos custos fixos ativos para um mês (idempotente) ----
    if (t === "gerar_custos_fixos_mes") {
      const ym = (req.body && req.body.ym) || new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const { data: fixos } = await supabase.from("custos_fixos").select("*").eq("ativo", true);
      let n = 0;
      for (const cf of (fixos || [])) {
        const dia = Math.min(Math.max(parseInt(cf.dia_vencimento, 10) || 5, 1), 28);
        const vencimento = `${ym}-${String(dia).padStart(2, "0")}`;
        const chaveParc = "CF-" + ym;
        let centro = cf.centro_custo || null;
        if (!centro && cf.obra_id) { const { data: ob } = await supabase.from("obras").select("centro_custo").eq("id", cf.obra_id).maybeSingle(); centro = ob?.centro_custo || null; }
        const op = {
          origem_tipo: "custo_fixo",
          origem_id: cf.id,
          obra_id: cf.obra_id || null,
          numero: "CF-" + ym + "-" + (cf.conta_codigo || ""),
          fornecedor: cf.fornecedor || cf.descricao,
          cnpj: cf.cnpj || null,
          centro_custo: centro,
          descricao: "Custo fixo · " + cf.descricao + " (" + (cf.conta_codigo || "") + ") · " + ym,
          valor: Number(cf.valor) || 0,
          vencimento,
          status: "pendente_nf",
          payload: { parcela: chaveParc, origem: "custo_fixo", categoria: cf.categoria || "custo_fixo", conta_codigo: cf.conta_codigo, conta_nome: cf.conta_nome, ym },
        };
        const { error } = await supabase.from("ordens_pagamento").upsert(op, { onConflict: "origem_tipo,origem_id,(payload->>'parcela')", ignoreDuplicates: true });
        if (!error) n++;
      }
      return res.status(200).json({ ok: true, ym, geradas: n });
    }

    // ---- gera as OPs da folha (uma por colaborador e por tipo de despesa) ----
    if (t === "gerar_folha_ops") {
      const ym = (req.body && req.body.ym) || new Date().toISOString().slice(0, 7);
      const itens = (req.body && req.body.itens) || [];
      let n = 0;
      for (const it of itens) {
        for (const comp of (it.comps || [])) {
          const valor = Math.round((Number(comp.valor) || 0) * 100) / 100;
          if (!valor) continue; // não gera OP de componente zerado
          const op = {
            origem_tipo: "folha",
            origem_id: it.colaborador_id,
            obra_id: null,
            numero: "FL-" + ym + "-" + (comp.tipo || "").slice(0, 12),
            fornecedor: it.nome,
            descricao: (comp.tipo || "Folha") + " · " + it.nome + " · " + ym,
            valor,
            vencimento: comp.vencimento || `${ym}-05`,
            status: "pendente_nf",
            payload: { parcela: ym + "|" + comp.tipo, origem: "folha", categoria: comp.categoria || "folha", tipo: comp.tipo, conta_codigo: comp.conta_codigo || null, conta_nome: comp.conta_nome || null, colaborador: it.nome, ym },
          };
          const { error } = await supabase.from("ordens_pagamento").upsert(op, { onConflict: "origem_tipo,origem_id,(payload->>'parcela')", ignoreDuplicates: false });
          if (!error) n++;
        }
      }
      return res.status(200).json({ ok: true, ym, geradas: n });
    }

    if (t === "destravar_usuario") {
      if (!ALOCA_SUPERVISOR.has(s.papel)) return res.status(403).json({ error: "Apenas CEO, Diretor ou Coord. de Planejamento podem destravar acessos." });
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      const { error } = await supabase.from("usuarios").update({ travado: false, travado_em: null }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      await supabase.from("travamentos").update({ destravado_em: new Date().toISOString(), destravado_por: s.id }).eq("usuario_id", id).is("destravado_em", null);
      return res.status(200).json({ ok: true });
    }
    // ---- reset de senha (CEO/Diretor): invalida a senha e gera novo convite ----
    if (t === "resetar_senha") {
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem resetar senhas." });
      const { id } = req.body;
      const { data: alvo } = await supabase.from("usuarios").select("id,nome,email,papel").eq("id", id).maybeSingle();
      if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });
      if (alvo.papel === "ceo" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode resetar um CEO." });
      const { error } = await supabase.from("usuarios").update({ senha_hash: null, senha_definida: false, travado: false, travado_em: null }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, convite: emitirConvite(alvo) });
    }

    // ---- conformidade do PMM: planejar o próximo mês até o dia 25 + 24h ----
    if (t === "pmm_compliance") {
      const alvoMes = proximoMesISO();
      const agora = new Date();
      const prazo = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59);   // dia 25 do mês atual
      const trava = new Date(prazo.getTime() + 24 * 3600 * 1000);
      const { data: existe } = await supabase.from("pmm").select("id").eq("supervisor_id", s.id).eq("mes", alvoMes).limit(1);
      const preenchido = !!(existe && existe.length);
      let travado = false;
      if (s.papel === "sup_obras" && !preenchido && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        await registrarTravamento(supabase, s.id, "pmm", `PMM do mês ${alvoMes} não planejado até o prazo (dia 25 + 24h).`, alvoMes);
        travado = true;
      }
      return res.status(200).json({ mes: alvoMes, preenchido, atrasado: !preenchido && agora > prazo, travado, prazo: prazo.toISOString() });
    }

    // ---- conformidade do POS (Plano Operacional Semanal): prazo sexta-feira + 24h ----
    if (t === "pos_compliance") {
      const alvoSemana = proximaSegundaISO();                                // semana-alvo do POS
      const seg = new Date(mondayISO() + "T00:00:00");
      const sexta = new Date(seg); sexta.setDate(sexta.getDate() + 4); sexta.setHours(23, 59, 59, 0); // sexta 23:59
      const trava = new Date(sexta.getTime() + 24 * 3600 * 1000);
      const agora = new Date();
      const { data: existe } = await supabase.from("pos").select("id").eq("supervisor_id", s.id).eq("semana", alvoSemana).limit(1);
      const preenchido = !!(existe && existe.length);
      let travado = false;
      if (s.papel === "sup_obras" && !preenchido && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        await registrarTravamento(supabase, s.id, "pos", `POS da semana ${alvoSemana} não enviado até o prazo (sexta + 24h).`, alvoSemana);
        travado = true;
      }
      return res.status(200).json({ semana: alvoSemana, preenchido, atrasado: !preenchido && agora > sexta, travado, prazo: sexta.toISOString() });
    }

    if (t === "sm_compliance") {      const semana = mondayISO();
      const seg = new Date(semana + "T00:00:00");
      const prazo = new Date(seg); prazo.setHours(23, 59, 59, 0);            // segunda 23:59
      const trava = new Date(prazo.getTime() + 24 * 3600 * 1000);            // +24h
      const agora = new Date();
      const { data: conf } = await supabase.from("envio_semanal").select("id").eq("usuario_id", s.id).eq("semana", semana).maybeSingle();
      const confirmado = !!conf;
      let travado = false;
      if (s.papel === "sup_obras" && !confirmado && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        await registrarTravamento(supabase, s.id, "sm", `Envio semanal de SM-i (semana ${semana}) não confirmado até o prazo (segunda + 24h).`, semana);
        travado = true;
      }
      return res.status(200).json({ semana, confirmado, atrasado: !confirmado && agora > prazo, travado, prazo: prazo.toISOString() });
    }

    // criação de obra + EAP em transação lógica
    if (t === "obra_com_eap") {
      const { data: ob, error: e1 } = await supabase.from("obras").insert(obra).select().single();
      if (e1) return res.status(500).json({ error: e1.message });
      if (Array.isArray(itens) && itens.length) {
        const { error: e2 } = await supabase.from("eap_itens").insert(itens.map((i) => ({ ...i, obra_id: ob.id })));
        if (e2) { await supabase.from("obras").delete().eq("id", ob.id); return res.status(500).json({ error: e2.message }); }
      }
      return res.status(200).json({ ok: true, obra: ob });
    }

    // aplica desconto da licitação a TODOS os itens da EAP de uma obra (sobre custo sem BDI)
    if (t === "eap_aplicar_desconto") {
      const { obra_id, desconto } = req.body; // desconto fracionário (0.11)
      const { data: itens } = await supabase.from("eap_itens").select("*").eq("obra_id", obra_id);
      for (const it of itens || []) {
        const csb = Number(it.custo_sem_bdi) || 0;
        const csbDesc = csb * (1 - (Number(desconto) || 0));
        const vu = csbDesc * (1 + (Number(it.bdi) || 0));
        await supabase.from("eap_itens").update({
          desconto: Number(desconto) || 0,
          valor_unit: vu,
          valor_total: vu * (Number(it.qtde) || 0),
          meta_valor: it.meta_pct != null ? csbDesc * (Number(it.meta_pct) || 0) : it.meta_valor,
        }).eq("id", it.id);
      }
      await supabase.from("obras").update({ desconto: Number(desconto) || 0 }).eq("id", obra_id);
      return res.status(200).json({ ok: true, n: (itens || []).length });
    }

    // define meta de custo: % sobre custo SEM BDI (já com desconto), p/ todos ou itens específicos
    if (t === "eap_definir_meta") {
      const { obra_id, meta_pct, ids } = req.body; // ids opcional (subset)
      let q = supabase.from("eap_itens").select("*").eq("obra_id", obra_id);
      if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
      const { data: itens } = await q;
      for (const it of itens || []) {
        const csbDesc = (Number(it.custo_sem_bdi) || 0) * (1 - (Number(it.desconto) || 0));
        await supabase.from("eap_itens").update({
          meta_pct: Number(meta_pct) || 0,
          meta_valor: csbDesc * (Number(meta_pct) || 0),
        }).eq("id", it.id);
      }
      if (!Array.isArray(ids) || !ids.length) await supabase.from("obras").update({ meta_pct_padrao: Number(meta_pct) || 0 }).eq("id", obra_id);
      return res.status(200).json({ ok: true, n: (itens || []).length });
    }

    if (!TABELAS[t] && t !== "rdo_completo") return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "financeiro_estado" && !VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito ao Financeiro" });
    if ((t === "designacoes") && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });

    // RDO + restrições de material (restrições nunca vão ao PDF do cliente)
    if (t === "rdo_completo") {
      const { rdo, restricoes, rdo_id } = req.body;
      let r;
      if (rdo_id) {
        // edição: atualiza o RDO e substitui as restrições vinculadas
        const { data, error } = await supabase.from("rdos").update(rdo).eq("id", rdo_id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        r = data;
        await supabase.from("restricoes_material").delete().eq("rdo_id", rdo_id);
      } else {
        const { data, error } = await supabase.from("rdos").insert(rdo).select().single();
        if (error) return res.status(500).json({ error: error.message });
        r = data;
      }
      if (Array.isArray(restricoes) && restricoes.length) {
        await supabase.from("restricoes_material").insert(restricoes.map((x) => ({ ...x, rdo_id: r.id, obra_id: rdo.obra_id })));
      }
      return res.status(200).json({ row: r });
    }

    // criação de usuário: respeita quem-pode-criar-quem e gera convite (link p/ definir senha)
    if (t === "usuarios") {
      if (!GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
      let baseAlvo = null;
      if (typeof row.papel === "string" && row.papel.startsWith("custom_")) {
        const { data: pc } = await supabase.from("papeis_customizados").select("papel_base").eq("chave", row.papel).maybeSingle();
        baseAlvo = pc?.papel_base || null;
        if (!baseAlvo) return res.status(400).json({ error: "Papel customizado inválido." });
      }
      if (!podeCriarPapel(s.papel, row.papel, baseAlvo)) return res.status(403).json({ error: "Você não tem permissão para criar este papel de usuário." });
      // coord_planejamento: criação vira ação pendente de aprovação da diretoria
      if (s.papel === "coord_planejamento") {
        const desc = `Criar usuário "${row.nome}" (${row.email}) como ${row.papel}`;
        await supabase.from("acoes_usuario_pendentes").insert({ tipo: "criar", payload: row, descricao: desc, solicitado_por: s.id });
        return res.status(200).json({ ok: true, pendente: true, mensagem: "Solicitação registrada. Aguardando aprovação da diretoria." });
      }
      const temSenha = !!row.senha;
      const payload = { nome: row.nome, email: String(row.email).trim().toLowerCase(), papel: row.papel,
        senha_hash: temSenha ? hashSenha(row.senha) : null, senha_definida: temSenha };
      const { data, error } = await supabase.from("usuarios").insert(payload).select("id,nome,email,papel,ativo,senha_definida").single();
      if (error) return res.status(500).json({ error: error.message.includes("duplicate") ? "E-mail já cadastrado" : error.message });
      // designações (obras) enviadas junto, se houver
      if (Array.isArray(row.obras) && row.obras.length) {
        await supabase.from("designacoes").insert(row.obras.map((oid) => ({ usuario_id: data.id, obra_id: oid, funcao: row.papel })));
      }
      const convite = temSenha ? null : emitirConvite(data);
      return res.status(200).json({ row: data, convite });
    }

    // SM-i: criar a solicitação também conta como envio da semana (conformidade)
    if (t === "sm_itens") {
      const { data, error } = await supabase.from("sm_itens").insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      if (s.papel === "sup_obras") {
        await supabase.from("envio_semanal").upsert({ usuario_id: s.id, semana: mondayISO(), confirmado_em: new Date().toISOString() }, { onConflict: "usuario_id,semana" });
      }
      return res.status(200).json({ row: data });
    }

    // OC-i / OS-i: portão de aprovação por valor (Suprimentos + Diretor)
    if (t === "ordens_compra" || t === "contratos_servico") {
      let limite = 1000;
      try {
        const { data: cfg } = await supabase.from("config_financeiro").select("valor").eq("chave", "limite_aprovacao_oc").maybeSingle();
        if (cfg && cfg.valor != null) limite = Number(cfg.valor) || 1000;
      } catch (_) {}
      const valorOC = Number(row.valor) || (t === "contratos_servico" ? (Number(row.custo_mensal) || 0) * (Number(row.meses) || 0) : 0);
      // entra em aprovação se passar do limite OU se o lançamento furou a verba de contratação (sinalizado pelo frontend)
      const furouVerba = row.furou_verba === true;
      delete row.furou_verba; // não é coluna da tabela
      row.status_aprovacao = (valorOC > limite || furouVerba) ? "aguardando" : "aprovada";
      const { data, error } = await supabase.from(t).insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      // Se já nasce aprovada (abaixo do limite), gera OP imediatamente
      if (data.status_aprovacao === "aprovada") { try { await gerarOPsDaOrigem(supabase, t, data); } catch (_) {} }
      return res.status(200).json({ row: data });
    }

    // criação de papel customizado: só Coord. de Planejamento e Diretoria; gera chave "custom_*"
    if (t === "papeis_customizados") {
      if (!GERENCIA_ORCCOM.has(s.papel)) return res.status(403).json({ error: "Apenas Coord. de Planejamento ou Diretoria podem criar papéis." });
      const nome = String(row.nome || "").trim();
      if (!nome) return res.status(400).json({ error: "Informe o nome do papel." });
      if (!row.papel_base) return res.status(400).json({ error: "Informe o papel-base." });
      const slug = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      row.chave = "custom_" + (slug || Date.now());
      row.criado_por = s.id;
    }

    const { data, error } = await supabase.from(t).insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  if (req.method === "PATCH") {
    const { t, id, patch } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (RH_TABELAS.has(t) && !RH_ROLES.has(s.papel)) return res.status(403).json({ error: "Acesso restrito à folha de pagamento." });
    if (t === "usuarios") {
      if (!GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
      // coordenadores só podem (des)travar ou (in)ativar; editar cadastro é CEO/Diretor
      if (!ADMIN_TOTAL.has(s.papel)) {
        const permitido = ["travado", "travado_em", "ativo"];
        if (Object.keys(patch || {}).some((k) => !permitido.includes(k))) return res.status(403).json({ error: "Apenas CEO/Diretor podem editar o cadastro do usuário." });
      } else if (patch && patch.papel && !podeCriarPapel(s.papel, patch.papel)) {
        return res.status(403).json({ error: "Você não pode atribuir este papel." });
      }
      const { data: alvo } = await supabase.from("usuarios").select("papel").eq("id", id).maybeSingle();
      if (alvo && alvo.papel === "ceo" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode alterar um CEO." });
      if (patch && patch.email) patch.email = String(patch.email).trim().toLowerCase();
    }
    if (t === "financeiro_estado" && !VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).update(patch).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { t, id } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (RH_TABELAS.has(t) && !RH_ROLES.has(s.papel)) return res.status(403).json({ error: "Acesso restrito à folha de pagamento." });
    if (t === "usuarios") {
      // coord_planejamento pode solicitar exclusão (exceto CEO/Diretor), mas passa por aprovação
      if (s.papel === "coord_planejamento") {
        if (id === s.id) return res.status(400).json({ error: "Não é possível excluir o próprio usuário." });
        const { data: alvo } = await supabase.from("usuarios").select("nome,email,papel").eq("id", id).maybeSingle();
        if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });
        if (alvo.papel === "ceo" || alvo.papel === "diretor") return res.status(403).json({ error: "Coord. de Planejamento não pode excluir CEO ou Diretor." });
        const desc = `Excluir usuário "${alvo.nome}" (${alvo.email}, ${alvo.papel})`;
        await supabase.from("acoes_usuario_pendentes").insert({ tipo: "excluir", payload: { id }, descricao: desc, solicitado_por: s.id });
        return res.status(200).json({ ok: true, pendente: true, mensagem: "Solicitação de exclusão registrada. Aguardando aprovação da diretoria." });
      }
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem excluir usuários." });
      if (id === s.id) return res.status(400).json({ error: "Não é possível excluir o próprio usuário." });
      const { data: alvo } = await supabase.from("usuarios").select("papel").eq("id", id).maybeSingle();
      if (alvo?.papel === "ceo") {
        if (s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode excluir um CEO." });
        const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("papel", "ceo");
        if ((count || 0) <= 1) return res.status(400).json({ error: "Não é possível excluir o único CEO." });
      }
      if (alvo?.papel === "diretor" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode excluir um Diretor." });
    }
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "orcamentos_comerciais" && !GERENCIA_ORCCOM.has(s.papel)) return res.status(403).json({ error: "Apenas Diretoria ou Coord. de Planejamento podem excluir propostas." });
    // Excluir obra: remove/desvincula as dependências antes (evita erro de foreign key)
    if (t === "obras") {
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem excluir obras." });
      // 1) desvincula a proposta comercial de origem (FK RESTRICT — não apaga a proposta)
      try { await supabase.from("orcamentos_comerciais").update({ obra_id: null }).eq("obra_id", id); } catch (_) {}
      // 2) memoriais: apaga os itens (por memorial) antes dos cabeçalhos
      try {
        const { data: mems } = await supabase.from("memoriais_custo").select("id").eq("obra_id", id);
        const memIds = (mems || []).map((m) => m.id);
        if (memIds.length) await supabase.from("memoriais_itens").delete().in("memorial_id", memIds);
      } catch (_) {}
      // 3) desvincula funcionários (obra e contrato) para não violar FK ao apagar contratos
      try {
        const { data: cts } = await supabase.from("contratos_servico").select("id").eq("obra_id", id);
        const ctIds = (cts || []).map((c) => c.id);
        await supabase.from("funcionarios").update({ obra_id: null, contrato_id: null }).eq("obra_id", id);
        if (ctIds.length) await supabase.from("funcionarios").update({ contrato_id: null }).in("contrato_id", ctIds);
      } catch (_) {}
      const dependentes = ["eap_itens", "rdos", "pos", "pmm", "sm_itens", "ss_itens", "ordens_compra", "contratos_servico", "designacoes", "ordens_pagamento", "boletins_medicao", "restricoes_material", "memoriais_custo"];
      for (const tab of dependentes) {
        const { error: eDep } = await supabase.from(tab).delete().eq("obra_id", id);
        if (eDep) return res.status(500).json({ error: `Falha ao excluir dependência (${tab}): ${eDep.message}` });
      }
      const { error: eObra } = await supabase.from("obras").delete().eq("id", id);
      if (eObra) return res.status(500).json({ error: "Falha ao excluir obra: " + eObra.message });
      return res.status(200).json({ ok: true });
    }
    const { error } = await supabase.from(t).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método não suportado" });
}
