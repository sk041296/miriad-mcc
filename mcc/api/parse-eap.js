// /api/parse-eap — identifica a EAP analítica de uma planilha orçamentária via API da Anthropic
import { sessao } from "./_lib.js";
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { linhas, nomeObra } = req.body || {};
  if (!linhas) return res.status(400).json({ error: "Conteúdo da planilha ausente" });

  const prompt = `Conteúdo textual de uma planilha orçamentária analítica de obra (colunas separadas por " | ").
Extraia a Estrutura Analítica do Projeto (EAP): itens com código/numeração, descrição, UNIDADE DE MEDIDA (m, m2, m3, un, kg, vb, % etc.), quantidade, valor unitário e valor total.
Para cada item, classifique o campo "ambiente" como "externo" se a atividade ocorre em área externa/exposta ao tempo (cobertura, telhado, drenagem, pavimentação, pintura externa, fachada, muro, terraplenagem, impermeabilização externa, calçada) ou "interno" caso contrário.
Regras: ignore cabeçalhos, BDI isolado, resumos e totais gerais; se faltar qtde/valor unit mas houver total, use unidade "%", qtde 100, valorUnit=total/100. Sugira um código curto para a obra.
Responda APENAS com JSON válido, sem markdown:
{"nomeObra":"...","codigoSugerido":"...","itens":[{"codigo":"1.1","descricao":"...","unidade":"m2","qtde":120.5,"valorUnit":35.2,"valorTotal":4241.6,"disciplina":"...","ambiente":"interno"}]}
Obra de referência: ${nomeObra || "(derivar)"}.
PLANILHA:\n${String(linhas).slice(0, 150000)}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: data?.error?.message || "Falha na API da Anthropic" });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const eap = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (!Array.isArray(eap.itens) || !eap.itens.length) throw new Error("EAP vazia");
    return res.status(200).json({ eap });
  } catch (e) {
    console.error("parse-eap:", e);
    return res.status(500).json({ error: "Não foi possível identificar a EAP na planilha" });
  }
}
