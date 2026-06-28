// /api/sugerir-composicao — sugere composição analítica de um item de EAP via IA
import { sessao } from "./_lib.js";

const MODELOS_FALLBACK = ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"];

async function chamarModelo(prompt, maxTokens) {
  const modelos = process.env.ANTHROPIC_MODEL ? [process.env.ANTHROPIC_MODEL] : [...MODELOS_FALLBACK];
  let ultimoErro = "";
  for (let i = 0; i < modelos.length; i++) {
    const modelo = modelos[i];
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: modelo, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        ultimoErro = data?.error?.message || `HTTP ${resp.status}`;
        if (/authentication|api[_ ]?key|x-api-key|401/i.test(ultimoErro)) throw new Error(`Autenticação: ${ultimoErro}`);
        continue;
      }
      let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      return text;
    } catch (e) { ultimoErro = e.message || String(e); }
  }
  throw new Error(ultimoErro || "Falha ao chamar o modelo");
}

function montarPrompt(itens) {
  // itens: [{ eap_codigo, descricao, unidade, quantidade }]
  const lista = itens.map((i, n) => `${n + 1}. EAP ${i.eap_codigo || "-"} | ${i.descricao || "(sem descrição)"} | unidade: ${i.unidade || "-"} | quantidade: ${i.quantidade ?? "-"}`).join("\n");
  return `Você é um engenheiro orçamentista de obras civis no Brasil. Para cada item de EAP abaixo, sugira a composição analítica de custo unitário (os insumos necessários para executar UMA unidade do serviço).

Para cada insumo, classifique no segmento correto:
- MATERIAL: materiais e insumos físicos
- MAO_DE_OBRA: horas de profissionais (oficial, servente, etc.)
- EQUIPAMENTO: equipamentos e ferramentas
- LOCACAO: locações de máquinas/equipamentos

Itens da EAP:
${lista}

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON), no formato:
{
  "composicoes": [
    {
      "eap_codigo": "<código do item>",
      "insumos": [
        { "segmento": "MATERIAL|MAO_DE_OBRA|EQUIPAMENTO|LOCACAO", "descricao": "<insumo>", "unidade": "<un>", "quantidade": <número por unidade do serviço>, "valor_unit": <estimativa de preço em R$ ou 0 se não souber> }
      ]
    }
  ]
}

Regras:
- Quantidades são por UMA unidade do serviço (coeficientes de composição).
- Se não tiver certeza do preço, use 0 (o usuário preencherá).
- Seja realista e específico para construção civil brasileira.
- Inclua mão de obra sempre que o serviço exigir execução.`;
}

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no Vercel" });

  const { itens } = req.body || {};
  if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ error: "Informe ao menos um item de EAP." });
  if (itens.length > 40) return res.status(400).json({ error: "Máximo de 40 itens por chamada." });

  try {
    const maxTokens = Math.min(8000, 600 + itens.length * 400);
    const texto = await chamarModelo(montarPrompt(itens), maxTokens);
    let parsed;
    try { parsed = JSON.parse(texto); }
    catch (_) {
      const m = texto.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Resposta da IA não veio em JSON válido.");
    }
    const composicoes = Array.isArray(parsed?.composicoes) ? parsed.composicoes : [];
    return res.status(200).json({ composicoes });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
