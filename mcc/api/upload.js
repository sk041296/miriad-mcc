// /api/upload — upload de foto do RDO para o Supabase Storage (bucket rdo-fotos)
import { supabase, sessao } from "./_lib.js";
export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };

export default async function handler(req, res) {
  if (!sessao(req)) return res.status(401).json({ error: "Sessão inválida" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });
  const { dataUrl, nome, obraCodigo } = req.body || {};
  if (!dataUrl) return res.status(400).json({ error: "Imagem ausente" });
  try {
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "Formato de imagem inválido" });
    const mime = m[1]; const buffer = Buffer.from(m[2], "base64");
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const path = `${(obraCodigo || "obra").replace(/[^a-zA-Z0-9_-]/g, "")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("rdo-fotos").upload(path, buffer, { contentType: mime, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data } = supabase.storage.from("rdo-fotos").getPublicUrl(path);
    return res.status(200).json({ url: data.publicUrl, path });
  } catch (e) {
    console.error("upload:", e);
    return res.status(500).json({ error: "Falha no upload da imagem" });
  }
}
