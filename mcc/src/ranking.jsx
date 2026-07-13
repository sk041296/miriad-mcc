import React, { useState, useEffect } from "react";
import { C, fmt, pct, sum, Card, listar, verbaEfetivaItem, consumidoPorEapObra } from "./core.jsx";

const DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); const dia = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dia); x.setHours(0, 0, 0, 0); return x; };
const primeiroDiaMes = (d, off = 0) => new Date(d.getFullYear(), d.getMonth() + off, 1);
const isoMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const valorUnit = (e) => { const q = Number(e?.qtde) || 0; return q > 0 ? (Number(e?.valor_total) || 0) / q : 0; };

/* ============================ cálculo do ranking ============================ */
function calcular({ usuarios, obras, designacoes, eapPorObra, rdos, pos, pmm }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const sups = usuarios.filter((u) => u.papel === "sup_obras");

  // dias úteis dos últimos 14 dias (até ontem)
  const diasUteis = [];
  for (let i = 1; i <= 14; i++) { const d = addDias(hoje, -i); const dow = d.getDay(); if (dow >= 1 && dow <= 5) diasUteis.push(iso(d)); }
  // últimas 4 semanas (segundas) já vencidas e últimos 3 meses
  const semanas = [1, 2, 3, 4].map((k) => iso(addDias(mondayOf(hoje), -7 * k)));
  const meses = [1, 2, 3].map((k) => isoMes(primeiroDiaMes(hoje, -k)));

  return sups.map((s) => {
    const obrasIds = designacoes.filter((d) => d.usuario_id === s.id).map((d) => d.obra_id);
    const obrasS = obras.filter((o) => obrasIds.includes(o.id));

    // 1) RDO em dia: por obra e dia útil, existe RDO entregue no prazo (até o dia seguinte)?
    let espRdo = 0, okRdo = 0;
    obrasS.forEach((o) => diasUteis.forEach((bd) => {
      espRdo++;
      const r = rdos.find((x) => x.obra_id === o.id && String(x.data).slice(0, 10) === bd);
      if (r && new Date(r.criado_em) <= addDias(new Date(bd + "T00:00:00"), 2)) okRdo++;
    }));
    const sRdo = espRdo ? okRdo / espRdo : null;

    // 2) POS no prazo: para cada semana, POS criado até a sexta da semana anterior
    let okPos = 0;
    semanas.forEach((seg) => {
      const prazo = addDias(new Date(seg + "T00:00:00"), -3); prazo.setHours(23, 59, 59); // sexta anterior
      const p = pos.find((x) => x.supervisor_id === s.id && String(x.semana).slice(0, 10) === seg);
      if (p && new Date(p.criado_em) <= prazo) okPos++;
    });
    const sPos = okPos / semanas.length;

    // 3) PMM no prazo: para cada mês, PMM criado até o dia 25 do mês anterior
    let okPmm = 0;
    meses.forEach((m) => {
      const ref = new Date(m + "T00:00:00"); const prazo = new Date(ref.getFullYear(), ref.getMonth() - 1, 25, 23, 59, 59);
      const p = pmm.find((x) => x.supervisor_id === s.id && String(x.mes).slice(0, 10) === m);
      if (p && new Date(p.criado_em) <= prazo) okPmm++;
    });
    const sPmm = okPmm / meses.length;

    // 4) Obra no prazo: avanço físico-financeiro vs tempo decorrido
    let somaObra = 0, nObra = 0;
    obrasS.forEach((o) => {
      const eap = eapPorObra[o.id] || [];
      const contrato = sum(eap.map((e) => Number(e.valor_total) || 0));
      if (!contrato) return;
      let med = 0;
      rdos.filter((r) => r.obra_id === o.id).forEach((r) => (r.atividades || []).forEach((a) => { const it = eap.find((e) => e.codigo === a.eap); if (it) med += (Number(a.qtde_dia ?? a.avanco) || 0) * valorUnit(it); }));
      const progresso = Math.min(med / contrato, 1);
      const ini = o.data_inicio ? new Date(o.data_inicio + "T00:00:00") : null;
      const prazoDias = Number(o.prazo_dias) || 0;
      if (ini && prazoDias > 0) {
        const decorrido = Math.max(0, Math.min((hoje - ini) / DIA / prazoDias, 1.2));
        somaObra += decorrido <= 0 ? 1 : Math.min(progresso / decorrido, 1); nObra++;
      }
    });
    const sObra = nObra ? somaObra / nObra : null;

    // 5) Assertividade do POS: produção planejada vs realizada nos RDOs da semana
    let somaAss = 0, nAss = 0;
    pos.filter((p) => p.supervisor_id === s.id && semanas.includes(String(p.semana).slice(0, 10))).forEach((p) => {
      const ini = new Date(String(p.semana).slice(0, 10) + "T00:00:00"); const fim = addDias(ini, 6);
      (p.frentes || []).forEach((fr) => {
        const plan = Number(fr.producao_planejada) || 0; if (plan <= 0) return;
        let real = 0;
        rdos.filter((r) => r.obra_id === p.obra_id).forEach((r) => { const dd = new Date(String(r.data).slice(0, 10) + "T00:00:00"); if (dd >= ini && dd <= fim) (r.atividades || []).filter((a) => a.eap === fr.eap_codigo).forEach((a) => { real += Number(a.qtde_dia ?? a.avanco) || 0; }); });
        somaAss += Math.max(0, 1 - Math.abs(real - plan) / plan); nAss++;
      });
    });
    const sAss = nAss ? somaAss / nAss : null;

    // nota final ponderada (métricas sem dados contam como 0)
    const v = (x) => x == null ? 0 : x;
    const nota = v(sRdo) * 0.30 + sPos * 0.20 + sPmm * 0.20 + v(sObra) * 0.15 + v(sAss) * 0.15;
    return { sup: s, obras: obrasS.length, sRdo, sPos, sPmm, sObra, sAss, nota };
  }).sort((a, b) => b.nota - a.nota);
}

/* ===== Nota do Coordenador de Planejamento (critérios da empresa como um todo) ===== */
function calcCoordPlanejamento({ usuarios, obras, eapPorObra, rdos, pos, pmm, sm, ocs, contratos }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diasUteis = [];
  for (let i = 1; i <= 14; i++) { const dd = addDias(hoje, -i); const dow = dd.getDay(); if (dow >= 1 && dow <= 5) diasUteis.push(iso(dd)); }
  const semanas = [1, 2, 3, 4].map((k) => iso(addDias(mondayOf(hoje), -7 * k)));
  const meses = [1, 2, 3].map((k) => isoMes(primeiroDiaMes(hoje, -k)));
  const sups = usuarios.filter((u) => u.papel === "sup_obras");
  const contratoObra = (o) => sum((eapPorObra[o.id] || []).map((e) => Number(e.valor_total) || 0));

  // 1) RDOs da empresa no prazo
  let espRdo = 0, okRdo = 0;
  obras.forEach((o) => diasUteis.forEach((bd) => { espRdo++; const r = rdos.find((x) => x.obra_id === o.id && String(x.data).slice(0, 10) === bd); if (r && new Date(r.criado_em) <= addDias(new Date(bd + "T00:00:00"), 2)) okRdo++; }));
  const sRdo = espRdo ? okRdo / espRdo : null;

  // 4) POS da empresa no prazo
  let espPos = 0, okPos = 0;
  sups.forEach((s) => semanas.forEach((seg) => { espPos++; const prazo = addDias(new Date(seg + "T00:00:00"), -3); prazo.setHours(23, 59, 59); const p = pos.find((x) => x.supervisor_id === s.id && String(x.semana).slice(0, 10) === seg); if (p && new Date(p.criado_em) <= prazo) okPos++; }));
  const sPos = espPos ? okPos / espPos : null;

  // 5) SM-i semanais no prazo — proxy de planejamento: proporção de SM-i NÃO emergenciais
  const smValidas = (sm || []).filter((x) => x.status !== "cancelada");
  const sSm = smValidas.length ? smValidas.filter((x) => !x.emergencial).length / smValidas.length : null;

  // 2) Assertividade do PMM vs avanço real (RDO), ponderada por valor do item
  let assNum = 0, assDen = 0;
  pmm.filter((p) => meses.includes(String(p.mes).slice(0, 10))).forEach((p) => {
    const eap = eapPorObra[p.obra_id] || []; const mes = String(p.mes).slice(0, 10); const ref = new Date(mes + "T00:00:00");
    (p.itens || []).forEach((it) => {
      const e = eap.find((x) => x.codigo === it.eap_codigo); if (!e) return;
      const prev = Number(it.producao_prevista) || 0; if (prev <= 0) return;
      let real = 0;
      rdos.filter((r) => r.obra_id === p.obra_id).forEach((r) => { const dr = new Date(String(r.data).slice(0, 10) + "T00:00:00"); if (dr.getFullYear() === ref.getFullYear() && dr.getMonth() === ref.getMonth()) (r.atividades || []).filter((a) => a.eap === it.eap_codigo).forEach((a) => { real += Number(a.qtde_dia ?? a.avanco) || 0; }); });
      const peso = prev * valorUnit(e); const assert = Math.max(0, 1 - Math.abs(real - prev) / prev);
      assNum += assert * peso; assDen += peso;
    });
  });
  const sAss = assDen ? assNum / assDen : null;

  // 3) Obras no prazo (média ponderada por valor de contrato)
  let prazoNum = 0, prazoDen = 0;
  obras.forEach((o) => {
    const eap = eapPorObra[o.id] || []; const contrato = contratoObra(o); if (!contrato) return;
    let med = 0; rdos.filter((r) => r.obra_id === o.id).forEach((r) => (r.atividades || []).forEach((a) => { const it = eap.find((e) => e.codigo === a.eap); if (it) med += (Number(a.qtde_dia ?? a.avanco) || 0) * valorUnit(it); }));
    const progresso = Math.min(med / contrato, 1);
    const ini = o.data_inicio ? new Date(o.data_inicio + "T00:00:00") : null; const prazoDias = Number(o.prazo_dias) || 0;
    if (ini && prazoDias > 0) { const decorrido = Math.max(0, Math.min((hoje - ini) / DIA / prazoDias, 1.2)); const nota = decorrido <= 0 ? 1 : Math.min(progresso / decorrido, 1); prazoNum += nota * contrato; prazoDen += contrato; }
  });
  const sPrazo = prazoDen ? prazoNum / prazoDen : null;

  // 6) Obras dentro do custo planejado (verba × consumido, média ponderada por contrato)
  const sCusto = notaCustoPlanejado(obras, eapPorObra, ocs, contratos);

  const v = (x) => x == null ? 0 : x;
  const nota = v(sCusto) * 0.30 + v(sAss) * 0.25 + v(sPrazo) * 0.20 + v(sRdo) * 0.10 + v(sPos) * 0.08 + v(sSm) * 0.07;
  const coords = usuarios.filter((u) => u.papel === "coord_planejamento");
  return { coords, sRdo, sPos, sSm, sAss, sPrazo, sCusto, nota };
}

/* média ponderada (por valor de contrato) de obras dentro do custo planejado (verba × consumido) */
function notaCustoPlanejado(obras, eapPorObra, ocs, contratos) {
  let num = 0, den = 0;
  obras.forEach((o) => {
    const eap = eapPorObra[o.id] || [];
    const contrato = sum(eap.map((e) => Number(e.valor_total) || 0)); if (!contrato) return;
    const consumido = consumidoPorEapObra(ocs, contratos, o.id);
    let verbaTot = 0, gastoTot = 0;
    eap.forEach((e) => { const vb = verbaEfetivaItem(e); if (!(vb > 0)) return; verbaTot += vb; gastoTot += (consumido[String(e.codigo).split(" ")[0].trim()] || 0); });
    if (verbaTot <= 0) return;
    const nota = gastoTot <= 0 ? 1 : Math.min(verbaTot / gastoTot, 1);
    num += nota * contrato; den += contrato;
  });
  return den ? num / den : null;
}

/* ===== Nota do Coordenador de Suprimentos ===== */
function calcCoordSuprimentos({ usuarios, obras, eapPorObra, ocs, contratos, sm, ss, ops }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazoRef = (item, diasPadrao) => { if (item.data_necessidade) return new Date(String(item.data_necessidade).slice(0, 10) + "T23:59:59"); return addDias(new Date(item.criado_em), diasPadrao); };
  const noPrazo = (item, diasPadrao) => { if (item.status === "cancelada") return null; const venc = prazoRef(item, diasPadrao); const aberta = item.status === "aberta"; return !(aberta && venc < hoje); };
  // 1) atendimento SM-i + SS-i no prazo
  let atOk = 0, atTot = 0;
  (sm || []).forEach((x) => { const r = noPrazo(x, 7); if (r == null) return; atTot++; if (r) atOk++; });
  (ss || []).forEach((x) => { const r = noPrazo(x, 15); if (r == null) return; atTot++; if (r) atOk++; });
  const sAtend = atTot ? atOk / atTot : null;
  // 2) retorno de OPs por inconsistência de NF (OC e OS)
  const ehForn = (o) => ["oc", "bmp", "os", "contrato_servico"].includes(o.origem_tipo);
  const conferidas = (ops || []).filter((o) => ehForn(o) && (o.nf_conferida || o.divergencia));
  const devolvidas = conferidas.filter((o) => o.divergencia === true);
  const sNf = conferidas.length ? 1 - devolvidas.length / conferidas.length : null;
  // 3) obras dentro do custo planejado
  const sCusto = notaCustoPlanejado(obras, eapPorObra, ocs, contratos);
  const v = (x) => x == null ? 0 : x;
  const nota = v(sAtend) * 0.50 + v(sNf) * 0.25 + v(sCusto) * 0.25;
  const coords = usuarios.filter((u) => u.papel === "coord_suprimentos");
  return { coords, sAtend, sNf, sCusto, nota, devolvidas: devolvidas.length, conferidas: conferidas.length };
}

const Cel = ({ v }) => {
  if (v == null) return <td style={{ ...tdc, color: C.dim }}>—</td>;
  const cor = v >= 0.85 ? C.verde : v >= 0.6 ? C.amareloAlerta : C.vermelho;
  return <td style={{ ...tdc, color: cor, fontWeight: 700 }}>{pct(v)}</td>;
};
const tdc = { padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right" };
const thc = { padding: "8px 10px", fontSize: 10.5, color: "#fff", textTransform: "uppercase", textAlign: "right" };

/* ============================ tela do ranking ============================ */
export function Ranking() {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const [usuarios, obras, designacoes, pos, pmm, sm, ss, ocs, contratos, ops] = await Promise.all([listar("usuarios"), listar("obras"), listar("designacoes"), listar("pos"), listar("pmm"), listar("sm_itens"), listar("ss_itens"), listar("ordens_compra"), listar("contratos_servico"), listar("ordens_pagamento")]);
    const eapPorObra = {}, rdos = [];
    await Promise.all(obras.map(async (o) => { eapPorObra[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); }));
    setD({ usuarios, obras, designacoes, eapPorObra, rdos, pos, pmm, sm, ss, ocs, contratos, ops });
  })().catch(() => setD({ usuarios: [], obras: [], designacoes: [], eapPorObra: {}, rdos: [], pos: [], pmm: [], sm: [], ss: [], ocs: [], contratos: [], ops: [] })); }, []);
  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Calculando ranking…</div>;

  const linhas = calcular(d);
  const coord = calcCoordPlanejamento(d);
  const coordSup = calcCoordSuprimentos(d);
  const medalha = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card title="Remuneração Variável — Supervisores">
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
        Nota composta dos últimos 14 dias úteis (RDO), 4 semanas (POS) e 3 meses (PMM). Pesos: RDO em dia 30% · POS no prazo 20% · PMM no prazo 20% · Obra no prazo 15% · Assertividade do POS 15%. Métricas sem dados no período contam como zero.
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>
          <th style={{ ...thc, textAlign: "left" }}>#</th>
          <th style={{ ...thc, textAlign: "left" }}>Supervisor</th>
          <th style={thc}>Obras</th><th style={thc}>RDO em dia</th><th style={thc}>POS no prazo</th><th style={thc}>PMM no prazo</th><th style={thc}>Obra no prazo</th><th style={thc}>Assertiv. POS</th><th style={thc}>Nota</th>
        </tr></thead>
        <tbody>{linhas.map((l, i) => (
          <tr key={l.sup.id} style={{ background: i < 3 ? `${C.laranja}08` : "transparent" }}>
            <td style={{ padding: "8px 10px", fontSize: 14, borderBottom: `1px solid ${C.linha}`, fontWeight: 800 }}>{medalha[i] || i + 1}</td>
            <td style={{ padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{l.sup.nome}</td>
            <td style={{ ...tdc, color: C.dim }}>{l.obras}</td>
            <Cel v={l.sRdo} /><Cel v={l.sPos} /><Cel v={l.sPmm} /><Cel v={l.sObra} /><Cel v={l.sAss} />
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}`, textAlign: "right" }}><span style={{ background: C.preto, color: "#fff", borderRadius: 7, padding: "3px 12px", fontSize: 14, fontWeight: 800 }}>{Math.round(l.nota * 100)}</span></td>
          </tr>
        ))}
        {linhas.length === 0 && <tr><td colSpan={9} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum supervisor cadastrado.</td></tr>}</tbody>
      </table></div>
    </Card>

    <Card title="Remuneração Variável — Coordenador de Planejamento">
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
        Nota da empresa como um todo. Pesos: Dentro do custo planejado 30% · Assertividade do PMM (vs RDO) 25% · Obras no prazo 20% · RDOs no prazo 10% · POS no prazo 8% · SM-i no prazo 7%. Obras no prazo e custo são médias ponderadas por valor de contrato; assertividade do PMM é ponderada por valor do item; SM-i usa a proporção de solicitações não emergenciais como proxy de planejamento. Métricas sem dados contam como zero.
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>
          <th style={{ ...thc, textAlign: "left" }}>Coordenador</th>
          <th style={thc}>Custo planej. (30%)</th><th style={thc}>Assertiv. PMM (25%)</th><th style={thc}>Obras no prazo (20%)</th><th style={thc}>RDO no prazo (10%)</th><th style={thc}>POS no prazo (8%)</th><th style={thc}>SM-i (7%)</th><th style={thc}>Nota</th>
        </tr></thead>
        <tbody>
          {(coord.coords.length ? coord.coords : [{ id: "_", nome: "— (sem coordenador de planejamento cadastrado)" }]).map((c) => (
            <tr key={c.id}>
              <td style={{ padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{c.nome}</td>
              <Cel v={coord.sCusto} /><Cel v={coord.sAss} /><Cel v={coord.sPrazo} /><Cel v={coord.sRdo} /><Cel v={coord.sPos} /><Cel v={coord.sSm} />
              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}`, textAlign: "right" }}><span style={{ background: C.preto, color: "#fff", borderRadius: 7, padding: "3px 12px", fontSize: 14, fontWeight: 800 }}>{Math.round(coord.nota * 100)}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>

    <Card title="Remuneração Variável — Coordenador de Suprimentos">
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
        Pesos: Atendimento de SM-i e SS-i no prazo 50% · Retorno de OPs por inconsistência de NF (OC/OS) 25% · Obras dentro do custo planejado 25%. SM-i no prazo = atendida antes da necessidade (SLA 7 dias sem data); SS-i SLA 15 dias. Retorno de NF = 1 − OPs devolvidas ÷ OPs de fornecedor conferidas{coordSup.conferidas ? ` (${coordSup.devolvidas}/${coordSup.conferidas})` : ""}. Custo = verba × consumido, ponderado por contrato. Métricas sem dados contam como zero.
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>
          <th style={{ ...thc, textAlign: "left" }}>Coordenador</th>
          <th style={thc}>Atend. SM-i/SS-i (50%)</th><th style={thc}>Qualidade NF (25%)</th><th style={thc}>Custo planej. (25%)</th><th style={thc}>Nota</th>
        </tr></thead>
        <tbody>
          {(coordSup.coords.length ? coordSup.coords : [{ id: "_", nome: "— (sem coordenador de suprimentos cadastrado)" }]).map((c) => (
            <tr key={c.id}>
              <td style={{ padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{c.nome}</td>
              <Cel v={coordSup.sAtend} /><Cel v={coordSup.sNf} /><Cel v={coordSup.sCusto} />
              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}`, textAlign: "right" }}><span style={{ background: C.preto, color: "#fff", borderRadius: 7, padding: "3px 12px", fontSize: 14, fontWeight: 800 }}>{Math.round(coordSup.nota * 100)}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
    </div>
  );
}
