import { supabase, sessao, enviarEmail } from "./_lib.js";

const DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const wdMon = (d) => (d.getDay() + 6) % 7; // Mon=0 ... Sun=6

function proximaSegunda(base) { const d = new Date(base); const w = wdMon(d); d.setDate(d.getDate() + (7 - w)); d.setHours(0, 0, 0, 0); return iso(d); }
function segundaDestaSemana(base) { const d = new Date(base); d.setDate(d.getDate() - wdMon(d)); d.setHours(0, 0, 0, 0); return iso(d); }
function primeiroProxMes(base) { const d = new Date(base.getFullYear(), base.getMonth() + 1, 1); return iso(d); }

const AREA = { rdo: "rdo", pos: "pos", pmm: "pmm", smi: "smi", ssi: "ssi" };

export default async function handler(req, res) {
  // Autorização: cron da Vercel (Bearer CRON_SECRET) OU sessão de CEO/Diretor (disparo manual)
  const auth = req.headers["authorization"] || "";
  const cronOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  let manualOk = false;
  if (!cronOk) { const s = sessao(req); manualOk = s && (s.papel === "ceo" || s.papel === "diretor"); }
  if (!cronOk && !manualOk) return res.status(403).json({ error: "Não autorizado." });

  const APP_URL = (process.env.APP_URL || "https://incorp360.com").replace(/\/$/, "");
  const agora = new Date();
  const wd = wdMon(agora);
  const diaMes = agora.getDate();
  const ontem = iso(new Date(agora.getTime() - DIA));
  const proxSeg = proximaSegunda(agora);
  const segSemana = segundaDestaSemana(agora);
  const proxMes = primeiroProxMes(agora);

  const [{ data: usuarios }, { data: desig }, { data: pos }, { data: pmm }, { data: ss }, { data: envio }, { data: rdosOntem }] = await Promise.all([
    supabase.from("usuarios").select("id,nome,email,papel"),
    supabase.from("designacoes").select("usuario_id,obra_id"),
    supabase.from("pos").select("supervisor_id,semana"),
    supabase.from("pmm").select("supervisor_id,mes"),
    supabase.from("ss_itens").select("solicitante_id,status,criado_em"),
    supabase.from("envio_semanal").select("usuario_id,semana"),
    supabase.from("rdos").select("obra_id,data").gte("data", ontem),
  ]);

  const sups = (usuarios || []).filter((u) => u.papel === "sup_obras" && u.email);
  const resultados = [];

  for (const sup of sups) {
    const obrasSup = (desig || []).filter((d) => d.usuario_id === sup.id).map((d) => d.obra_id);
    const pend = [];

    // RDO de ontem (por obra designada)
    if (obrasSup.length) {
      const semRdo = obrasSup.filter((oid) => !(rdosOntem || []).some((r) => r.obra_id === oid && String(r.data).slice(0, 10) === ontem));
      if (semRdo.length) pend.push({ area: "rdo", titulo: "RDO de ontem", detalhe: `${semRdo.length} obra(s) sem RDO de ${ontem.split("-").reverse().join("/")}` });
    }
    // POS da próxima semana (deadline sexta + 24h → cobra a partir de sexta)
    if (wd >= 4 && obrasSup.length && !(pos || []).some((p) => p.supervisor_id === sup.id && String(p.semana).slice(0, 10) === proxSeg)) {
      pend.push({ area: "pos", titulo: "POS da próxima semana", detalhe: "ainda não enviado" });
    }
    // PMM do próximo mês (deadline dia 25 + 24h)
    if (diaMes >= 26 && obrasSup.length && !(pmm || []).some((p) => p.supervisor_id === sup.id && String(p.mes).slice(0, 10) === proxMes)) {
      pend.push({ area: "pmm", titulo: "PMM do próximo mês", detalhe: "ainda não enviado" });
    }
    // Envio semanal de SM-i (deadline segunda + 24h → cobra a partir de quarta)
    if (wd >= 2 && obrasSup.length && !(envio || []).some((e) => e.usuario_id === sup.id && String(e.semana).slice(0, 10) === segSemana)) {
      pend.push({ area: "smi", titulo: "Envio semanal de SM-i", detalhe: "envio da semana não confirmado" });
    }
    // SS-i aberta há mais de 60 dias
    const ssVelhas = (ss || []).filter((x) => x.solicitante_id === sup.id && !["baixada", "cancelada"].includes(x.status) && (agora - new Date(x.criado_em)) / DIA >= 60);
    if (ssVelhas.length) pend.push({ area: "ssi", titulo: "SS-i pendente", detalhe: `${ssVelhas.length} solicitação(ões) aberta(s) há mais de 60 dias` });

    if (!pend.length) continue;

    const linhas = pend.map((p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">
          <div style="font-weight:700;color:#141414">${p.titulo}</div>
          <div style="font-size:13px;color:#666">${p.detalhe}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">
          <a href="${APP_URL}/?ir=${AREA[p.area]}" style="background:#f37335;color:#fff;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;padding:8px 14px;display:inline-block">Regularizar</a>
        </td>
      </tr>`).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#f37335;margin-bottom:4px">Miriad Construction Control</h2>
        <p style="color:#141414">Olá, ${(sup.nome || "").split(" ")[0]}. Você tem pendências de envio em atraso no MCC:</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${linhas}</table>
        <p style="font-size:12px;color:#888;margin-top:14px">Clique em “Regularizar” para abrir a área correspondente no sistema. Manter os envios em dia evita o bloqueio de acesso e melhora seu ranking de supervisor.</p>
      </div>`;

    const r = await enviarEmail({ to: sup.email, subject: "MCC — você tem pendências de envio em atraso", html });
    resultados.push({ supervisor: sup.nome, email: sup.email, pendencias: pend.length, enviado: r.ok, motivo: r.motivo || null });
  }

  return res.status(200).json({ ok: true, executado_em: agora.toISOString(), avaliados: sups.length, notificados: resultados.filter((r) => r.enviado).length, resultados });
}
