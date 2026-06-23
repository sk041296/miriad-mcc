// /api/parse-eap — identifica a EAP de uma planilha via API da Anthropic
// Modo LOTE: o cliente envia pedaços pequenos de linhas (para caber no limite de 10s do Vercel Hobby).
import { sessao } from "./_lib.js";
export const config = { maxDuration: 60 };

const MODELOS_FALLBACK = ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"];

async function chamarModelo(prompt, maxTokens) {
  const modelos = process.env.ANTHROPIC_MODEL ? [process.env.ANTHROPIC_MODEL] : MODELOS_FALLBACK;
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
        if (/model/i.test(ultimoErro) && /not.*found|does not exist|invalid/i.test(ultimoErro)) { for (const fb of MODELOS_FALLBACK) if (!modelos.includes(fb)) modelos.push(fb); continue; }
        if (/authentication|api[_ ]?key|x-api-key|401|invalid header/i.test(ultimoErro)) throw new Error(`Autenticação: ${ultimoErro}. Verifique se ANTHROPIC_API_KEY é só a chave sk-ant-...`);
        continue;
      }
      let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      return { text, stop: data.stop_reason, modelo };
    } catch (e) { ultimoErro = e.message || String(e); }
  }
  throw new Error(ultimoErro || "Falha ao chamar o modelo");
}

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { linhas, nomeObra, diagnostico, lote } = req.body || {};

  if (diagnostico) {
    let modelosDisponiveis = null, erroLista = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=20", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
        const d = await r.json();
        if (r.ok) modelosDisponiveis = (d.data || []).map((m) => m.id); else erroLista = d?.error?.message || `HTTP ${r.status}`;
      } catch (e) { erroLista = e.message; }
    }
    return res.status(200).json({ temChave: Boolean(process.env.ANTHROPIC_API_KEY), modeloConfigurado: process.env.ANTHROPIC_MODEL || "(não definido — usando fallback)", modelosDisponiveis, erroLista });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no Vercel" });
  if (!linhas) return res.status(400).json({ error: "Conteúdo da planilha ausente" });

  // MODO LOTE: recebe poucas linhas (itens já recortados pelo cliente) e devolve só esses itens.
  if (lote) {
    const prompt = `Linhas de uma planilha orçamentária de obra (colunas separadas por " | "). Cada linha é um item da EAP.
Para CADA linha de item, extraia: codigo (numeração tipo 1.1), descricao, unidade (m, m2, m3, un, kg, h, mes, vb, % ...), qtde, custoSemBdi (custo unitário sem BDI), bdi (fracionário; 0 se não houver), valorTotal, e ambiente ("externo" se exposto ao tempo: cobertura, telhado, drenagem, pavimentação, pintura externa, fachada, muro, terraplenagem, impermeabilização externa, calçada; senão "interno").
Ignore linhas que sejam grupo/subtotal sem unidade nem quantidade. Responda APENAS JSON, sem markdown:
{"itens":[{"codigo":"1.1","descricao":"...","unidade":"m2","qtde":120.5,"custoSemBdi":28.5,"bdi":0,"valorTotal":4360,"ambiente":"interno"}]}
LINHAS:
${String(linhas).slice(0, 30000)}`;
    try {
      const { text, stop } = await chamarModelo(prompt, 4000);
      let obj; try { obj = JSON.parse(text); } catch { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a >= 0 && b > a) { try { obj = JSON.parse(text.slice(a, b + 1)); } catch {} } }
      if (!obj || !Array.isArray(obj.itens)) {
        if (stop === "max_tokens") return res.status(500).json({ error: "Lote grande demais (resposta truncada). Reduza o tamanho do lote." });
        return res.status(500).json({ error: "Não foi possível interpretar este lote." });
      }
      return res.status(200).json({ itens: obj.itens });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // MODO COMPLETO (planilhas pequenas): mantém compatibilidade
  const prompt = `Conteúdo textual de planilha orçamentária analítica (colunas separadas por " | ").
Extraia a EAP: itens com codigo, descricao, unidade, qtde, custoSemBdi, bdi (fracionário), valorTotal e ambiente ("externo"/"interno"). Sugira nomeObra e codigoSugerido (curto).
Responda APENAS JSON, sem markdown:
{"nomeObra":"...","codigoSugerido":"...","itens":[{"codigo":"1.1","descricao":"...","unidade":"m2","qtde":120.5,"custoSemBdi":28.5,"bdi":0,"valorTotal":4360,"ambiente":"interno"}]}
Obra: ${nomeObra || "(derivar)"}.
PLANILHA:
${String(linhas).slice(0, 40000)}`;
  try {
    const { text, stop } = await chamarModelo(prompt, 6000);
    let eap; try { eap = JSON.parse(text); } catch { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a >= 0 && b > a) { try { eap = JSON.parse(text.slice(a, b + 1)); } catch {} } }
    if (!eap || !Array.isArray(eap.itens) || !eap.itens.length) {
      if (stop === "max_tokens") return res.status(500).json({ error: "Planilha grande: a resposta foi truncada. O envio em lotes resolve — atualize o app." });
      return res.status(500).json({ error: "A IA não retornou itens reconhecíveis." });
    }
    return res.status(200).json({ eap });
  } catch (e) { return res.status(500).json({ error: `Não foi possível identificar a EAP: ${e.message}` }); }
}
