// /api/data — CRUD genérico do MCC com controle de papel
import { supabase, sessao } from "./_lib.js";

const TABELAS = {
  obras: { ordem: "criado_em", asc: false },
  eap_itens: { ordem: "ordem", asc: true, filtro: "obra_id" },
  contratos_servico: { ordem: "criado_em", asc: false },
  ordens_compra: { ordem: "data", asc: false },
  funcionarios: { ordem: "nome", asc: true },
  rdos: { ordem: "data", asc: false, filtro: "obra_id" },
  restricoes_material: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  usuarios: { ordem: "nome", asc: true, somenteGestor: true },
};
// recursos financeiros e de gestão de usuários: só gestor
const SO_GESTOR = new Set(["usuarios", "financeiro_estado"]);

export default async function handler(req, res) {
  const s = sessao(req);
  if (!s) return res.status(401).json({ error: "Sessão inválida ou expirada" });

  // ---- estado financeiro (key-value), restrito a gestor ----
  if ((req.query.t || req.body?.t) === "financeiro_estado") {
    if (s.papel !== "gestor") return res.status(403).json({ error: "Acesso restrito a gestores" });
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

  if (req.method === "GET") {
    const t = String(req.query.t || "");
    if (t === "ping") return res.status(200).json({ ok: true, papel: s.papel });
    const cfg = TABELAS[t];
    if (!cfg) return res.status(400).json({ error: "Recurso não permitido" });
    if (SO_GESTOR.has(t) && s.papel !== "gestor") return res.status(403).json({ error: "Acesso restrito a gestores" });
    let q = supabase.from(t).select(t === "usuarios" ? "id,nome,email,papel,ativo,criado_em" : "*").order(cfg.ordem, { ascending: cfg.asc });
    if (cfg.filtro && req.query[cfg.filtro]) q = q.eq(cfg.filtro, req.query[cfg.filtro]);
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
    if (!TABELAS[t] && t !== "rdo_completo") return res.status(400).json({ error: "Recurso não permitido" });
    if (SO_GESTOR.has(t) && s.papel !== "gestor") return res.status(403).json({ error: "Acesso restrito a gestores" });

    // RDO + restrições de material (restrições nunca vão ao PDF do cliente)
    if (t === "rdo_completo") {
      const { rdo, restricoes } = req.body;
      const { data: r, error } = await supabase.from("rdos").insert(rdo).select().single();
      if (error) return res.status(500).json({ error: error.message });
      if (Array.isArray(restricoes) && restricoes.length) {
        await supabase.from("restricoes_material").insert(restricoes.map((x) => ({ ...x, rdo_id: r.id, obra_id: rdo.obra_id })));
      }
      return res.status(200).json({ row: r });
    }

    // hash de senha ao criar usuário
    if (t === "usuarios") {
      const { hashSenha } = await import("./_lib.js");
      const payload = { ...row, email: String(row.email).toLowerCase(), senha_hash: hashSenha(row.senha) };
      delete payload.senha;
      const { data, error } = await supabase.from("usuarios").insert(payload).select("id,nome,email,papel,ativo").single();
      if (error) return res.status(500).json({ error: error.message.includes("duplicate") ? "E-mail já cadastrado" : error.message });
      return res.status(200).json({ row: data });
    }

    const { data, error } = await supabase.from(t).insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  if (req.method === "PATCH") {
    const { t, id, patch } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (SO_GESTOR.has(t) && s.papel !== "gestor") return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).update(patch).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { t, id } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (SO_GESTOR.has(t) && s.papel !== "gestor") return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método não suportado" });
}
