// /api/auth — login e bootstrap do primeiro gestor
import { supabase, hashSenha, emitirToken } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { acao, email, senha, nome } = req.body || {};

  if (acao === "login") {
    const { data: u } = await supabase.from("usuarios").select("*").eq("email", String(email || "").toLowerCase()).eq("ativo", true).maybeSingle();
    if (!u || u.senha_hash !== hashSenha(senha || "")) return res.status(401).json({ error: "E-mail ou senha inválidos" });
    return res.status(200).json({ token: emitirToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, obra_id: u.obra_id || null } });
  }

  if (acao === "bootstrap") {
    // cria o primeiro gestor apenas se não houver nenhum usuário
    const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
    if (count > 0) return res.status(403).json({ error: "Já existe usuário cadastrado. Peça a um gestor para criar seu acesso." });
    const { data: u, error } = await supabase.from("usuarios")
      .insert({ nome, email: String(email).toLowerCase(), senha_hash: hashSenha(senha), papel: "gestor" })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ token: emitirToken(u), usuario: { nome: u.nome, email: u.email, papel: u.papel } });
  }

  if (acao === "precisa_bootstrap") {
    const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
    return res.status(200).json({ bootstrap: (count || 0) === 0 });
  }

  return res.status(400).json({ error: "Ação inválida" });
}
