// /api/verificar-import — conferência rápida (IA) do parse da planilha (SS-i / OS-i).
// Camada de auditoria: NUNCA bloqueia o import. Tem orçamento de 5s por chamada (AbortController);
// se estourar ou faltar chave, devolve {ok:null, indisponivel} e o cliente segue normalmente.
import { sessao } from "./_lib.js";
export const config = { maxDuration: 30 };

// modelo de verificação: Sonnet 4.6 (preciso e rápido), com fallbacks.
const MODELOS = [
  process.env.ANTHROPIC_MODEL_VERIFICACAO,
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
].filter(Boolean);

const TIMEOUT_MS = 12000;

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

  // ===== CAMADA 1 — DETERMINÍSTICA (fatos verificáveis, sem IA, nunca alucina) =====
  const det = [];
  // 1a. códigos duplicados (com os números de linha exatos)
  const porCod = {};
  lista.forEach((it) => { const c = String(it.cod || "").trim(); if (!c) return; (porCod[c] = porCod[c] || []).push(it.n); });
  Object.entries(porCod).forEach(([cod, linhas]) => {
    if (linhas.length > 1) det.push({ item: cod, problema: `código repetido nos itens ${linhas.join(", ")}` });
  });
  // 1b. quantidade ausente, zero ou negativa
  lista.forEach((it) => {
    const q = it.qtd == null ? null : Number(String(it.qtd).replace(",", "."));
    if (q == null || isNaN(q) || q <= 0) det.push({ item: it.cod || `#${it.n}`, problema: `quantidade ausente ou inválida (${it.qtd})` });
  });
  // 1c. valor total ausente/zero (só OS-i)
  if (tipo === "osi") lista.forEach((it) => {
    const v = it.valor == null ? null : Number(String(it.valor).replace(",", "."));
    if (v == null || isNaN(v) || v <= 0) det.push({ item: it.cod || `#${it.n}`, problema: `valor total ausente ou zero` });
  });

  // ===== CAMADA 2 — IA (Sonnet): só JULGAMENTO qualitativo, com regras estritas =====
  const prompt =
`Você é um auditor de importação de planilhas de obra do sistema MCC (Miriad). Um parser extraiu os itens abaixo de uma planilha ${tipo === "osi" ? "de OS-i (contrato de serviço)" : "de SS-i (solicitação de serviço)"}${nomeObra ? ` da obra "${nomeObra}"` : ""}.

REGRAS ESTRITAS (siga à risca):
- Aponte SOMENTE problemas de JULGAMENTO que você consiga verificar lendo a própria linha citada.
- NÃO aponte códigos duplicados/repetidos — isso já é verificado por outro mecanismo. IGNORE qualquer suspeita de duplicação.
- NÃO compare itens entre si nem invente relações ("igual ao item X", "mesmo serviço do item Y"). Avalie cada linha isoladamente.
- Cada alerta DEVE citar o número "n" da linha exata e um fato presente nela.
- Se não tiver certeza, NÃO aponte. Prefira aprovar a inventar.

Tipos de problema que VOCÊ deve procurar (apenas estes):
- descrição que é claramente cabeçalho/seção/total e não um serviço (ex.: "TOTAL GERAL", "SERVIÇOS PRELIMINARES");
- unidade implausível para a descrição (ex.: tubo medido em "un" onde claramente seria "m");
- ${tipo === "osi" ? "valor unitário (valor ÷ qtd) absurdamente baixo ou alto para o tipo de serviço descrito;" : "quantidade absurda para o serviço descrito;"}
- código que claramente não corresponde à descrição, conferindo contra a EAP da obra (se fornecida).

Responda SOMENTE em JSON válido, sem texto fora dele:
{"ok": true, "resumo": "uma frase curta em português", "alertas": [{"item":"<cod>","problema":"<o que está errado, citando o item n>"}]}
Máximo 6 alertas. Se nada qualitativo a apontar, retorne alertas vazio.

ITENS EXTRAÍDOS (JSON):
${JSON.stringify(lista)}
${eapCods ? `\nEAP cadastrada da obra (codigo: descrição) para referência de coerência de código:\n${eapCods}` : ""}`;

  let alertasIA = [];
  let resumoIA = "";
  let iaIndisponivel = false;
  try {
    const text = await chamarRapido(prompt);
    let parsed;
    try { parsed = JSON.parse(text); alertasIA = Array.isArray(parsed.alertas) ? parsed.alertas : []; resumoIA = String(parsed.resumo || ""); }
    catch { iaIndisponivel = true; }
  } catch (e) { iaIndisponivel = true; }

  // ===== COMBINA as duas camadas (determinística primeiro, depois IA) =====
  // remove da IA qualquer alerta que mencione duplicação (defesa extra contra alucinação)
  const alertasIAfiltrados = alertasIA.filter((a) => !/duplicad|repetid|igual ao|mesmo (serviço|item)/i.test(String(a.problema || "")));
  const alertas = [...det, ...alertasIAfiltrados].slice(0, 10);

  let resumo;
  if (alertas.length === 0) resumo = "Importação consistente — nenhum problema detectado.";
  else {
    const partes = [];
    if (det.length) partes.push(`${det.length} verificação(ões) automática(s)`);
    if (alertasIAfiltrados.length) partes.push(`${alertasIAfiltrados.length} ponto(s) de revisão da IA`);
    resumo = `${alertas.length} ponto(s) a revisar (${partes.join(" + ")}).`;
  }

  return res.status(200).json({
    ok: alertas.length === 0,
    resumo,
    alertas,
    total: itens.length,
    conferidos: lista.length,
    ia_indisponivel: iaIndisponivel,
  });
}
