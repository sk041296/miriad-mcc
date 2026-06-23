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
  const payload = b64({ id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, obra_id: usuario.obra_id || null,
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
// Convite (link para o usuário definir a própria senha) — válido por 7 dias
export function emitirConvite(usuario) {
  const payload = b64({ id: usuario.id, conv: true, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return `${payload}.${sign(payload)}`;
}
export function validarConvite(token) {
  const d = validarToken(token);
  return d && d.conv ? d : null;
}
// Lê a sessão do header; retorna {id,nome,papel,...} ou null
export function sessao(req) {
  const h = req.headers["authorization"] || "";
  return validarToken(h.replace(/^Bearer\s+/i, ""));
}

// Envio de e-mail (opcional).
// Caminho principal: SMTP do Google Workspace (nodemailer) via SMTP_HOST/PORT/USER/PASS.
// Fallback opcional: Resend, se RESEND_API_KEY estiver definida.
export async function enviarEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `MCC Miriad <${process.env.SMTP_USER}>` : "MCC Miriad <onboarding@resend.dev>");

  // 1) SMTP (Google Workspace) — preferencial
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT) || 465;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // 465 = SSL; 587 = STARTTLS
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({ from, to, subject, html });
      return { ok: true, motivo: null, via: "smtp" };
    } catch (e) { return { ok: false, motivo: "falha_envio", erro: String(e && e.message || e) }; }
  }

  // 2) Resend — fallback
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      });
      return { ok: r.ok, motivo: r.ok ? null : "falha_envio", via: "resend" };
    } catch { return { ok: false, motivo: "erro" }; }
  }

  return { ok: false, motivo: "sem_provedor" };
}
