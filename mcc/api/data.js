// /api/data — CRUD genérico do MCC com controle de acesso por papel
import { supabase, sessao, emitirConvite } from "./_lib.js";

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
  usuarios: { ordem: "nome", asc: true },
};

// Grupos de papéis
const VE_FINANCEIRO   = new Set(["ceo", "diretor", "financeiro"]);
const GERENCIA_USUARIOS = new Set(["ceo", "diretor", "coord_suprimentos", "coord_planejamento", "coord_obras", "coord_orcamentos"]);
const ADMIN_TOTAL     = new Set(["ceo", "diretor"]);
// papéis cujo acesso é restrito às obras em que foram designados
const OBRA_SCOPED     = new Set(["sup_obras", "op_suprimentos", "op_planejamento", "op_orcamento"]);

// quem pode criar qual papel
function podeCriarPapel(criador, alvo) {
  if (criador === "ceo") return true;
  if (criador === "diretor") return alvo !== "diretor" && alvo !== "ceo";
  if (criador === "coord_suprimentos") return alvo === "op_suprimentos";
  if (criador === "coord_planejamento") return alvo === "op_planejamento";
  if (criador === "coord_obras") return alvo === "sup_obras";
  if (criador === "coord_orcamentos") return alvo === "op_orcamento";
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
  const TEM_OBRA_ID = new Set(["obras", "eap_itens", "contratos_servico", "ordens_compra", "funcionarios", "rdos", "restricoes_material", "sm_itens", "ss_itens"]);

  if (req.method === "GET") {
    const t = String(req.query.t || "");
    if (t === "ping") return res.status(200).json({ ok: true, papel: s.papel });

    // lista enxuta de colaboradores para os dropdowns de responsável (qualquer autenticado)
    if (t === "colaboradores") {
      const { data, error } = await supabase.from("usuarios").select("id,nome,papel,ativo").eq("ativo", true).order("nome");
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ rows: data });
    }

    const cfg = TABELAS[t];
    if (!cfg) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    let q = supabase.from(t).select(t === "usuarios" ? "id,nome,email,papel,ativo,criado_em,obra_id,senha_definida,travado" : "*").order(cfg.ordem, { ascending: cfg.asc });
    if (cfg.filtro && req.query[cfg.filtro]) q = q.eq(cfg.filtro, req.query[cfg.filtro]);
    if (obrasPermitidas && TEM_OBRA_ID.has(t)) q = q.in(t === "obras" ? "id" : "obra_id", obrasPermitidas);
    const { data, error } = await q.limit(5000);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }

  if (req.method === "POST") {
    const { t, row, obra, itens } = req.body || {};
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
      if (!podeCriarPapel(s.papel, row.papel)) return res.status(403).json({ error: "Você não tem permissão para criar este papel de usuário." });
      const { hashSenha } = await import("./_lib.js");
      const temSenha = !!row.senha;
      const payload = { nome: row.nome, email: String(row.email).toLowerCase(), papel: row.papel,
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

    const { data, error } = await supabase.from(t).insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  if (req.method === "PATCH") {
    const { t, id, patch } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "financeiro_estado" && !VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).update(patch).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { t, id } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método não suportado" });
}
