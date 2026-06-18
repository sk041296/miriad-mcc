// Utilitários compartilhados: Supabase + autenticação por sessão (JWT simples assinado)
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SECRET = process.env.APP_SECRET || "mcc-dev-secret";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

export function hashSenha(senha) {
  return crypto.createHash("sha256").update(senha + SECRET).digest("hex");
}
export function emitirToken(usuario) {
  const payload = b64({ id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel,
    exp: Date.now() + 1000 * 60 * 60 * 12 }); // 12h
  return `${payload}.${sign(payload)}`;
}
export function validarToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, assinatura] = token.split(".");
  if (sign(payload) !== assinatura) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (dados.exp < Date.now()) return null;
    return dados;
  } catch { return null; }
}
// Lê a sessão do header; retorna {id,nome,papel,...} ou null
export function sessao(req) {
  const h = req.headers["authorization"] || "";
  return validarToken(h.replace(/^Bearer\s+/i, ""));
}
