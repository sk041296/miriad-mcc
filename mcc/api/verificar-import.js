// /api/verificar-import — conferência rápida (IA) do parse da planilha (SS-i / OS-i).
// Camada de auditoria: NUNCA bloqueia o import. Tem orçamento de 5s por chamada (AbortController);
// se estourar ou faltar chave, devolve {ok:null, indisponivel} e o cliente segue normalmente.
import { sessao } from "./_lib.js";
export const config = { maxDuration: 15 };

// modelo rápido primeiro (Haiku); cai para os modelos do parse-eap se indisponível.
const MODELOS = [
  process.env.ANTHROPIC_MODEL_VERIFICACAO,
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929",
  "claude-3-5-haiku-20241022",
].filter(Boolean);

const TIMEOUT_MS = 5000;

async function chamarRapido(prompt) {
  let ultimoErro = "";
  for (const modelo of MODELOS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: modelo, max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await resp.json();
      if (!resp.ok) {
        ultimoErro = data?.error?.message || `HTTP ${resp.status}`;
        if (/model/i.test(ultimoErro) && /not.*found|does not exist|invalid/i.test(ultimoErro)) continue;
        if (/authentication|api[_ ]?key|x-api-key|401/i.test(ultimoErro)) throw new Error(ultimoErro);
        continue;
      }
      let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      return text;
    } catch (e) {
      clearTimeout(timer);
      ultimoErro = e?.name === "AbortError" ? "timeout" : (e.message || String(e));
      if (ultimoErro === "timeout") break; // estourou o orçamento de 5s — não tenta outro modelo
    }
  }
  throw new Error(ultimoErro || "falha");
}

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ ok: null, indisponivel: true, motivo: "sem_chave" });

  const { tipo, itens, eapResumo, nomeObra } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) return res.status(200).json({ ok: null, indisponivel: true, motivo: "vazio" });

  const lista = itens.slice(0, 80).map((x, i) => ({
    n: i + 1,
    cod: x.eap_codigo || "",
    desc: String(x.descricao || x.servico || "").slice(0, 90),
    qtd: x.quantidade ?? null,
    un: x.unidade || "",
    ...(tipo === "osi" ? { valor: x.valor ?? null } : {}),
  }));
  const eapCods = Array.isArray(eapResumo) ? eapResumo.slice(0, 200).map((e) => `${e.codigo}: ${String(e.descricao || "").slice(0, 60)}`).join("\n") : "";

  const prompt =
`Você é um auditor de importação de planilhas de obra do sistema MCC (Miriad). Um parser extraiu os itens abaixo de uma planilha ${tipo === "osi" ? "de OS-i (contrato de serviço)" : "de SS-i (solicitação de serviço)"}${nomeObra ? ` da obra "${nomeObra}"` : ""}. Faça uma conferência RÁPIDA e aponte SOMENTE problemas claros de extração:
- linha de cabeçalho/seção/subtotal/total capturada como item (ex.: descrição tipo "TOTAL GERAL", "SERVIÇOS PRELIMINARES" sem ser um serviço real);
- unidade ausente ou implausível para a descrição;
- quantidade ausente, zero, negativa ou absurda;
- código (cod) que claramente não corresponde à descrição.
Não invente problemas; se estiver coerente, aprove.

Responda SOMENTE em JSON válido, sem nenhum texto fora dele, no formato exato:
{"ok": true, "resumo": "uma frase curta em português", "alertas": [{"item":"<cod>","problema":"<o que está errado, curto>"}]}
Use ok=false apenas se houver pelo menos um alerta. Máximo 8 alertas.

ITENS EXTRAÍDOS (JSON):
${JSON.stringify(lista)}
${eapCods ? `\nEAP cadastrada da obra (codigo: descrição) para referência de coerência de código:\n${eapCods}` : ""}`;

  try {
    const text = await chamarRapido(prompt);
    let parsed;
    try { parsed = JSON.parse(text); } catch { return res.status(200).json({ ok: null, indisponivel: true, motivo: "resposta_invalida" }); }
    const alertas = Array.isArray(parsed.alertas) ? parsed.alertas.slice(0, 8) : [];
    return res.status(200).json({ ok: alertas.length === 0 && parsed.ok !== false, resumo: String(parsed.resumo || "").slice(0, 200), alertas, total: itens.length, conferidos: lista.length });
  } catch (e) {
    return res.status(200).json({ ok: null, indisponivel: true, motivo: e.message === "timeout" ? "timeout" : "erro" });
  }
}
