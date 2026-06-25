// /api/auth — login, bootstrap do CEO, e convite (definir senha)
import { supabase, hashSenha, emitirToken, emitirConvite, validarConvite } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { acao, email, senha, nome, token } = req.body || {};

  if (acao === "login") {
    const emailNorm = String(email || "").trim().toLowerCase();
    const { data: rows } = await supabase.from("usuarios").select("*").ilike("email", emailNorm).eq("ativo", true);
    // tolera espaço/maiúscula e múltiplos registros: prioriza o que já tem senha definida
    const lista = (rows || []).filter((r) => String(r.email || "").trim().toLowerCase() === emailNorm);
    const u = lista.find((r) => r.senha_definida && r.senha_hash) || lista[0];
    if (!u) return res.status(401).json({ error: "E-mail ou senha inválidos" });
    if (!u.senha_definida || !u.senha_hash) return res.status(403).json({ error: "Acesso ainda não ativado. Use o link de convite para criar sua senha." });
    if (u.travado) return res.status(423).json({ error: "Seu acesso está temporariamente bloqueado. Fale com seu coordenador." });
    if (u.senha_hash !== hashSenha(senha || "")) return res.status(401).json({ error: "E-mail ou senha inválidos" });
    return res.status(200).json({ token: emitirToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, obra_id: u.obra_id || null } });
  }

  if (acao === "bootstrap") {
    const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
    if (count > 0) return res.status(403).json({ error: "Já existe usuário cadastrado. Peça a um gestor para criar seu acesso." });
    const { data: u, error } = await supabase.from("usuarios")
      .insert({ nome, email: String(email).toLowerCase(), senha_hash: hashSenha(senha), papel: "ceo", senha_definida: true })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ token: emitirToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel } });
  }

  if (acao === "precisa_bootstrap") {
    const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
    return res.status(200).json({ bootstrap: (count || 0) === 0 });
  }

  // expõe ao front o Client ID público do Google (e o domínio permitido, se houver)
  if (acao === "config") {
    return res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, googleDominio: process.env.GOOGLE_ALLOWED_DOMAIN || null });
  }

  // Login com Google: valida o ID token no próprio Google e emite o mesmo token de sessão.
  // Requer que o e-mail JÁ exista em `usuarios` (ativo) — o Google não cria conta nova.
  if (acao === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: "Login com Google não está configurado." });
    const credential = req.body?.credential;
    if (!credential) return res.status(400).json({ error: "Credencial do Google ausente." });

    let info;
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { signal: ctrl.signal });
      clearTimeout(t);
      info = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(401).json({ error: "Não foi possível validar sua conta Google." });
    } catch (e) {
      return res.status(504).json({ error: "Tempo esgotado ao validar a conta Google. Tente novamente." });
    }

    // checagens de segurança do ID token
    const audOk = info.aud === clientId;
    const issOk = String(info.iss || "").includes("accounts.google.com");
    const emailOk = info.email && String(info.email_verified) === "true";
    if (!audOk || !issOk || !emailOk) return res.status(401).json({ error: "Conta Google inválida para este aplicativo." });
    const dominio = process.env.GOOGLE_ALLOWED_DOMAIN;
    if (dominio && info.hd !== dominio) return res.status(403).json({ error: `Entre com seu e-mail corporativo @${dominio}.` });

    const emailNorm = String(info.email).trim().toLowerCase();
    const { data: rows } = await supabase.from("usuarios").select("*").ilike("email", emailNorm).eq("ativo", true);
    const lista = (rows || []).filter((r) => String(r.email || "").trim().toLowerCase() === emailNorm);
    const u = lista.find((r) => r.senha_definida && r.senha_hash) || lista[0];
    if (!u) return res.status(403).json({ error: "Este e-mail não está cadastrado no MCC. Peça acesso ao seu gestor." });
    if (u.travado) return res.status(423).json({ error: "Seu acesso está temporariamente bloqueado. Fale com seu coordenador." });
    return res.status(200).json({ token: emitirToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, obra_id: u.obra_id || null } });
  }

  if (acao === "validar_convite") {
    const c = validarConvite(token);
    if (!c) return res.status(400).json({ error: "Convite inválido ou expirado." });
    const { data: u } = await supabase.from("usuarios").select("id,nome,email,senha_definida").eq("id", c.id).maybeSingle();
    if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
    if (u.senha_definida) return res.status(409).json({ error: "Este convite já foi utilizado. Faça login normalmente." });
    return res.status(200).json({ nome: u.nome, email: u.email });
  }

  if (acao === "definir_senha") {
    const c = validarConvite(token);
    if (!c) return res.status(400).json({ error: "Convite inválido ou expirado." });
    if (!senha || String(senha).length < 6) return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });
    const { data: u } = await supabase.from("usuarios").select("*").eq("id", c.id).maybeSingle();
    if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
    if (u.senha_definida) return res.status(409).json({ error: "Este convite já foi utilizado. Faça login normalmente." });
    const { error } = await supabase.from("usuarios").update({ senha_hash: hashSenha(senha), senha_definida: true }).eq("id", u.id);
    if (error) return res.status(500).json({ error: error.message });
    const u2 = { ...u, senha_definida: true };
    return res.status(200).json({ token: emitirToken(u2), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, obra_id: u.obra_id || null } });
  }

  return res.status(400).json({ error: "Ação inválida" });
}
