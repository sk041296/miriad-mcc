// /api/parse-eap — identifica a EAP analítica de uma planilha orçamentária via API da Anthropic
import { sessao } from "./_lib.js";
export const config = { maxDuration: 60 };

const MODELOS_FALLBACK = ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"];

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { linhas, nomeObra, diagnostico } = req.body || {};

  // modo diagnóstico: confere chave/ambiente e LISTA os modelos disponíveis na conta
  if (diagnostico) {
    let modelosDisponiveis = null, erroLista = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=20", {
          headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        });
        const d = await r.json();
        if (r.ok) modelosDisponiveis = (d.data || []).map((m) => m.id);
        else erroLista = d?.error?.message || `HTTP ${r.status}`;
      } catch (e) { erroLista = e.message; }
    }
    return res.status(200).json({
      temChave: Boolean(process.env.ANTHROPIC_API_KEY),
      modeloConfigurado: process.env.ANTHROPIC_MODEL || "(não definido — usando fallback)",
      modelosDisponiveis, erroLista,
      tamanhoConteudo: linhas ? String(linhas).length : 0,
    });
  }

  if (!linhas) return res.status(400).json({ error: "Conteúdo da planilha ausente" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor (Vercel → Settings → Environment Variables)" });

  const conteudo = String(linhas).slice(0, 70000);
  const prompt = `Conteúdo textual de uma planilha orçamentária analítica de obra (colunas separadas por " | ").
Extraia a Estrutura Analítica do Projeto (EAP): itens com código/numeração, descrição, UNIDADE DE MEDIDA (m, m2, m3, un, kg, vb, % etc.), quantidade, CUSTO UNITÁRIO SEM BDI, BDI (se houver, fracionário) e valor total.
Para cada item, classifique "ambiente" como "externo" se a atividade ocorre em área exposta ao tempo (cobertura, telhado, drenagem, pavimentação, pintura externa, fachada, muro, terraplenagem, impermeabilização externa, calçada) ou "interno" caso contrário.
Regras: ignore cabeçalhos, BDI isolado, resumos e totais gerais; se faltar qtde/valor unit mas houver total, use unidade "%", qtde 100, custoSemBdi=total/100. Se a planilha tiver só custo de referência (sem BDI explícito), informe bdi 0 e custoSemBdi = valor unitário. Sugira um código curto para a obra.
Responda APENAS com JSON válido (sem markdown, sem comentários, sem texto antes ou depois):
{"nomeObra":"...","codigoSugerido":"...","itens":[{"codigo":"1.1","descricao":"...","unidade":"m2","qtde":120.5,"custoSemBdi":28.5,"bdi":0.27,"valorTotal":4360.0,"disciplina":"...","ambiente":"interno"}]}
Obra de referência: ${nomeObra || "(derivar)"}.
PLANILHA:
${conteudo}`;

  // se ANTHROPIC_MODEL está definido, usa SÓ ele (evita cascata lenta que estoura o tempo do Vercel);
  // só cai para os fallbacks se o modelo configurado não existir.
  const modelos = process.env.ANTHROPIC_MODEL ? [process.env.ANTHROPIC_MODEL] : MODELOS_FALLBACK;
  let ultimoErro = "";

  for (const modelo of modelos) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: modelo, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        ultimoErro = data?.error?.message || `HTTP ${resp.status}`;
        if (/model/i.test(ultimoErro) && /not.*found|does not exist|invalid/i.test(ultimoErro)) {
          // modelo configurado inválido: tenta os fallbacks
          for (const fb of MODELOS_FALLBACK) { if (fb !== modelo) modelos.push(fb); }
          continue;
        }
        if (/authentication|api[_ ]?key|x-api-key|401|invalid header/i.test(ultimoErro)) return res.status(502).json({ error: `Erro de autenticação na API da Anthropic: ${ultimoErro}. Verifique se ANTHROPIC_API_KEY contém apenas a chave (sk-ant-...), sem texto extra.` });
        continue;
      }
      const stop = data.stop_reason;
      let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

      let eap;
      try { eap = JSON.parse(text); }
      catch {
        // tenta recuperar o maior objeto JSON da resposta (caso venha truncado/cercado)
        const ini = text.indexOf("{"); const fim = text.lastIndexOf("}");
        if (ini >= 0 && fim > ini) { try { eap = JSON.parse(text.slice(ini, fim + 1)); } catch {} }
      }
      if (!eap || !Array.isArray(eap.itens) || !eap.itens.length) {
        if (stop === "max_tokens") { ultimoErro = "A resposta foi truncada (planilha muito grande). Tente uma planilha com menos linhas ou só a aba analítica."; continue; }
        ultimoErro = "A IA não retornou itens reconhecíveis. Verifique se a aba enviada é a planilha analítica (com colunas de item, unidade, quantidade e valor).";
        continue;
      }
      return res.status(200).json({ eap, modeloUsado: modelo });
    } catch (e) {
      ultimoErro = e.message || String(e);
    }
  }
  console.error("parse-eap falhou:", ultimoErro);
  return res.status(500).json({ error: `Não foi possível identificar a EAP: ${ultimoErro}` });
}
