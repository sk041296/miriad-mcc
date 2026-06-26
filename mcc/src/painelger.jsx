import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, Card, Btn, Kpi, Lbl, inp, NumInput, listar, getFin, setFin, dispararNotificacoes } from "./core.jsx";
import { resumoPmm } from "./pmm.jsx";

const DIA = 86400000;
const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymLabel = (ym) => { const [y, m] = ym.split("-"); return `${MES_ABBR[Number(m) - 1]}/${String(y).slice(2)}`; };
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMeses = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; };
const valorUnit = (e) => { const q = Number(e?.qtde) || 0; return q > 0 ? (Number(e?.valor_total) || 0) / q : 0; };
const diasDesde = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DIA) : null;
const nomeDe = (us, id) => (us.find((u) => u.id === id) || {}).nome || "—";

function medObra(obra, eap, rdos) {
  let v = 0;
  rdos.filter((r) => r.obra_id === obra.id).forEach((r) => (r.atividades || []).forEach((a) => { const it = eap.find((e) => e.codigo === a.eap); if (it) v += (Number(a.qtde_dia ?? a.avanco) || 0) * valorUnit(it); }));
  return v;
}
function prodPeriodo(obra, eap, rdos, desdeISO) {
  let v = 0;
  rdos.filter((r) => r.obra_id === obra.id && (!desdeISO || String(r.data).slice(0, 10) >= desdeISO)).forEach((r) => (r.atividades || []).forEach((a) => { const it = eap.find((e) => e.codigo === a.eap); if (it) v += (Number(a.qtde_dia ?? a.avanco) || 0) * valorUnit(it); }));
  return v;
}
function ultimoAvanco(obra, rdos) {
  const comAvanco = rdos.filter((r) => r.obra_id === obra.id && (r.atividades || []).some((a) => (Number(a.qtde_dia ?? a.avanco) || 0) > 0));
  if (!comAvanco.length) return null;
  return comAvanco.map((r) => String(r.data || r.criado_em).slice(0, 10)).sort().reverse()[0];
}

export function PainelGerencial() {
  const [d, setD] = useState(null);
  const [cfg, setCfg] = useState({ folha: 0, despFin: 0, outras: 0, prazoReceb: 30 });
  const [salvo, setSalvo] = useState(false);
  const [notif, setNotif] = useState(null);

  useEffect(() => { (async () => {
    const [obras, usuarios, designacoes, pos, pmm, sm, ss, ocs, contratos] = await Promise.all([
      listar("obras"), listar("usuarios"), listar("designacoes"), listar("pos"), listar("pmm"),
      listar("sm_itens"), listar("ss_itens"), listar("ordens_compra"), listar("contratos_servico"),
    ]);
    const eapPorObra = {}, rdos = [];
    await Promise.all(obras.map(async (o) => { eapPorObra[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); }));
    let prazoModa = 30;
    try { const pr = await getFin("premissas"); if (pr && Array.isArray(pr.contratos) && pr.contratos.length) { const cnt = {}; pr.contratos.forEach((c) => { cnt[c.prazo] = (cnt[c.prazo] || 0) + 1; }); prazoModa = Number(Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]) || 30; } } catch {}
    try { const g = await getFin("painel_gerencial"); if (g) setCfg({ folha: g.folha || 0, despFin: g.despFin || 0, outras: g.outras || 0, prazoReceb: g.prazoReceb ?? prazoModa }); else setCfg((c) => ({ ...c, prazoReceb: prazoModa })); } catch { setCfg((c) => ({ ...c, prazoReceb: prazoModa })); }
    setD({ obras, usuarios, designacoes, eapPorObra, rdos, pos, pmm, sm, ss, ocs, contratos });
  })().catch(() => setD({ obras: [], usuarios: [], designacoes: [], eapPorObra: {}, rdos: [], pos: [], pmm: [], sm: [], ss: [], ocs: [], contratos: [] })); }, []);

  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Consolidando indicadores…</div>;
  const { obras, usuarios, designacoes, eapPorObra, rdos, pos, pmm, sm, ss, ocs, contratos } = d;

  const salvarCfg = async () => { try { await setFin("painel_gerencial", cfg); setSalvo(true); setTimeout(() => setSalvo(false), 2000); } catch (e) { alert(e.message); } };
  const notificar = async () => { setNotif("enviando"); try { const r = await dispararNotificacoes(); setNotif(`${r.notificados} supervisor(es) notificado(s) de ${r.avaliados} avaliado(s).`); } catch (e) { setNotif("Falha: " + e.message); } };

  // eixo de 6 meses a partir do mês atual
  const meses = []; { const dt = new Date(); dt.setDate(1); for (let i = 0; i < 6; i++) { meses.push(ymOf(dt)); dt.setMonth(dt.getMonth() + 1); } }

  // ---- pendências ----
  const sups = usuarios.filter((u) => u.papel === "sup_obras");
  const obrasDe = (uid) => designacoes.filter((x) => x.usuario_id === uid).map((x) => x.obra_id);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const proxSeg = ymOf(new Date()); // não usado; placeholder
  const segProx = (() => { const m = mondayOf(new Date()); m.setDate(m.getDate() + 7); return m.toISOString().slice(0, 10); })();
  const mesProx = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 2 > 12 ? 1 : x.getMonth() + 2).padStart(2, "0")}-01`; })();
  const semAtual = mondayOf(new Date()).toISOString().slice(0, 10);
  const rdoHojePorObra = (oid) => rdos.some((r) => r.obra_id === oid && String(r.data).slice(0, 10) === hojeISO);
  const obrasSemRdoHoje = obras.filter((o) => !rdoHojePorObra(o.id));
  const posPend = sups.filter((u) => !pos.some((p) => p.supervisor_id === u.id && String(p.semana).slice(0, 10) === segProx));
  const pmmPend = sups.filter((u) => !pmm.some((p) => p.supervisor_id === u.id && String(p.mes).slice(0, 10) === mesProx));
  const smAbertas = sm.filter((x) => x.status === "aberta");
  const ssPendentes = ss.filter((x) => ["aberta", "em_atendimento"].includes(x.status));
  const ssVelhas = ss.filter((x) => x.status !== "baixada" && x.status !== "cancelada" && (diasDesde(x.criado_em) || 0) >= 60);

  // ---- compras (OC-i): competência e caixa ----
  const totalCompetencia = sum(ocs.map((o) => Number(o.valor) || 0));
  const ocCaixa = {}; meses.forEach((m) => ocCaixa[m] = 0);
  ocs.forEach((o) => {
    const fat = new Date(String(o.data_faturamento || o.data || hojeISO).slice(0, 10) + "T00:00:00");
    const cond = o.condicao_pagamento || {};
    const parc = (cond.parcelas && cond.parcelas.length) ? cond.parcelas : [{ dias: 0, valor: Number(o.valor) || 0 }];
    parc.forEach((p) => { const ym = ymOf(addDias(fat, Number(p.dias) || 0)); if (ym in ocCaixa) ocCaixa[ym] += Number(p.valor) || 0; });
  });

  // ---- fluxo de caixa projetado ----
  const osCaixa = {}; meses.forEach((m) => osCaixa[m] = 0);
  contratos.forEach((c) => {
    const ini = new Date(String(c.criado_em || hojeISO).slice(0, 10) + "T00:00:00");
    if (c.tipo === "direto" && c.custo_mensal) { const n = Number(c.meses) || 1; for (let k = 0; k < n; k++) { const dd = new Date(ini); dd.setMonth(dd.getMonth() + k); const ym = ymOf(dd); if (ym in osCaixa) osCaixa[ym] += Number(c.custo_mensal) || 0; } }
    else { const ym = ymOf(ini); if (ym in osCaixa) osCaixa[ym] += Number(c.valor) || 0; }
  });
  const entradas = {}; meses.forEach((m) => entradas[m] = 0);
  pmm.forEach((pm) => { const fin = resumoPmm(pm, eapPorObra[pm.obra_id] || []).financeiro; if (!fin) return; const base = new Date(String(pm.mes).slice(0, 10) + "T00:00:00"); const mesesReceb = Math.round((Number(cfg.prazoReceb) || 0) / 30); const ym = ymOf(addMeses(base, mesesReceb)); if (ym in entradas) entradas[ym] += fin; });
  const saidaMes = (m) => ocCaixa[m] + osCaixa[m] + (Number(cfg.folha) || 0) + (Number(cfg.despFin) || 0) + (Number(cfg.outras) || 0);
  let acum = 0; const fluxo = meses.map((m) => { const ent = entradas[m]; const sai = saidaMes(m); const saldo = ent - sai; acum += saldo; return { m, ent, oc: ocCaixa[m], os: osCaixa[m], sai, saldo, acum }; });

  // ---- ranking de obras por avanço ----
  const ranking = obras.map((o) => { const eap = eapPorObra[o.id] || []; const contrato = sum(eap.map((e) => Number(e.valor_total) || 0)); const med = medObra(o, eap, rdos); return { o, contrato, med, pct: contrato ? med / contrato : 0 }; }).sort((a, b) => b.pct - a.pct);

  // produção por obra por período (regime de RDO)
  const isoDe = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const iniMes = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })();
  const prod = obras.map((o) => { const eap = eapPorObra[o.id] || []; return {
    o, dia: prodPeriodo(o, eap, rdos, hojeISO), d7: prodPeriodo(o, eap, rdos, isoDe(6)), d15: prodPeriodo(o, eap, rdos, isoDe(14)), mes: prodPeriodo(o, eap, rdos, iniMes), acum: prodPeriodo(o, eap, rdos, null),
  }; }).sort((a, b) => b.acum - a.acum);
  const totProd = { dia: sum(prod.map((p) => p.dia)), d7: sum(prod.map((p) => p.d7)), d15: sum(prod.map((p) => p.d15)), mes: sum(prod.map((p) => p.mes)), acum: sum(prod.map((p) => p.acum)) };

  // ---- alertas de avanço ----
  const alertasAvanco = obras.map((o) => { const ult = ultimoAvanco(o, rdos); return { o, ult, dias: ult ? diasDesde(ult) : null }; }).filter((x) => x.dias === null || x.dias > 3);

  // ---- últimas atividades ----
  const ev = [];
  rdos.forEach((r) => ev.push({ t: r.criado_em || r.data, quem: r.responsavel_nome || nomeDe(usuarios, r.responsavel_id), o: r.obra_id, txt: "registrou um RDO" }));
  pos.forEach((p) => ev.push({ t: p.criado_em, quem: nomeDe(usuarios, p.supervisor_id), o: p.obra_id, txt: "enviou um POS" }));
  pmm.forEach((p) => ev.push({ t: p.criado_em, quem: nomeDe(usuarios, p.supervisor_id), o: p.obra_id, txt: "enviou um PMM" }));
  sm.forEach((x) => ev.push({ t: x.criado_em, quem: nomeDe(usuarios, x.solicitante_id), o: x.obra_id, txt: `criou uma SM-i${x.status === "atendida" ? " (baixada)" : ""}` }));
  ss.forEach((x) => ev.push({ t: x.criado_em, quem: nomeDe(usuarios, x.solicitante_id), o: x.obra_id, txt: "criou uma SS-i" }));
  ocs.forEach((o) => ev.push({ t: o.criado_em || o.data, quem: (o.dados_oc && o.dados_oc.comprador) || "Suprimentos", o: o.obra_id, txt: "emitiu uma OC-i" }));
  const codObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const feed = ev.filter((e) => e.t).sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 15);
  const quando = (t) => { const dd = diasDesde(t); return dd === 0 ? "hoje" : dd === 1 ? "ontem" : `há ${dd} dias`; };

  const th = { padding: "7px 9px", fontSize: 10.5, color: "#fff", textAlign: "right", textTransform: "uppercase" };
  const td = { padding: "6px 9px", fontSize: 12.5, borderBottom: `1px solid ${C.linha}`, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const Pend = ({ n, label, cor }) => <div style={{ flex: 1, minWidth: 150, background: "#fff", border: `1px solid ${C.linha}`, borderLeft: `4px solid ${n ? cor : C.verde}`, borderRadius: 12, padding: "12px 14px" }}><div style={{ fontSize: 26, fontWeight: 800, color: n ? cor : C.verde }}>{n}</div><div style={{ fontSize: 11.5, color: C.dim, fontWeight: 600 }}>{label}</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pendências */}
      <Card title="Pendências de envio" right={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12, color: C.dim }}>{notif && notif !== "enviando" ? notif : ""}</span><Btn small kind="ghost" disabled={notif === "enviando"} onClick={notificar}>{notif === "enviando" ? "Enviando…" : "✉ Notificar pendências"}</Btn></div>}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Pend n={obrasSemRdoHoje.length} label="Obras sem RDO hoje" cor={C.vermelho} />
          <Pend n={posPend.length} label="Supervisores sem POS da próxima semana" cor={C.amareloAlerta} />
          <Pend n={pmmPend.length} label="Supervisores sem PMM do próximo mês" cor={C.amareloAlerta} />
          <Pend n={smAbertas.length} label="SM-is aguardando atendimento" cor={C.laranja} />
          <Pend n={ssPendentes.length} label="SS-is em aberto/atendimento" cor={C.azul} />
        </div>
        {(posPend.length > 0 || pmmPend.length > 0) && <div style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>
          {posPend.length > 0 && <div>POS pendente: {posPend.map((u) => u.nome.split(" ")[0]).join(", ")}.</div>}
          {pmmPend.length > 0 && <div>PMM pendente: {pmmPend.map((u) => u.nome.split(" ")[0]).join(", ")}.</div>}
        </div>}
      </Card>

      {/* Compras */}
      <Card title="Compras nas obras (OC-i) — competência e caixa">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <Kpi dark label="Valor adquirido total (competência)" value={fmtR(totalCompetencia)} accent={C.laranja} sub={`${ocs.length} OC-i emitidas`} />
          <Kpi label="A pagar (caixa) — próximos 6 meses" value={fmtR(sum(meses.map((m) => ocCaixa[m])))} accent={C.azul} sub="conforme condições de pagamento" />
        </div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.preto }}><th style={{ ...th, textAlign: "left" }}>Regime de caixa (OC-i)</th>{meses.map((m) => <th key={m} style={th}>{ymLabel(m)}</th>)}</tr></thead>
          <tbody><tr><td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Pagamentos de materiais</td>{meses.map((m) => <td key={m} style={td}>{ocCaixa[m] ? fmt(ocCaixa[m]) : "—"}</td>)}</tr></tbody>
        </table></div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>A SM-i não carrega valor — o valor monetário é realizado na OC-i (compra formalizada).</div>
      </Card>

      {/* Fluxo de caixa projetado */}
      <Card title="Fluxo de caixa projetado" right={<span style={{ fontSize: 12, color: salvo ? C.verde : C.dim, fontWeight: 700 }}>{salvo ? "✓ salvo" : ""}</span>}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14, background: C.cinza, borderRadius: 10, padding: "12px 14px" }}>
          <div><Lbl>Folha de escritório (mensal)</Lbl><NumInput value={cfg.folha} onChange={(v) => setCfg({ ...cfg, folha: v })} /></div>
          <div><Lbl>Despesas financeiras (mensal)</Lbl><NumInput value={cfg.despFin} onChange={(v) => setCfg({ ...cfg, despFin: v })} /></div>
          <div><Lbl>Outras despesas fixas (mensal)</Lbl><NumInput value={cfg.outras} onChange={(v) => setCfg({ ...cfg, outras: v })} /></div>
          <div><Lbl>Prazo de recebimento (dias)</Lbl><input type="number" value={cfg.prazoReceb} onChange={(e) => setCfg({ ...cfg, prazoReceb: parseInt(e.target.value) || 0 })} style={inp({ width: 90, textAlign: "right" })} /></div>
          <Btn small onClick={salvarCfg}>Salvar parâmetros</Btn>
        </div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.preto }}><th style={{ ...th, textAlign: "left" }}>R$</th>{meses.map((m) => <th key={m} style={th}>{ymLabel(m)}</th>)}</tr></thead>
          <tbody>
            <tr><td style={{ ...td, textAlign: "left", color: C.verde, fontWeight: 700 }}>Entradas (medições projetadas)</td>{fluxo.map((f) => <td key={f.m} style={{ ...td, color: C.verde }}>{f.ent ? fmt(f.ent) : "—"}</td>)}</tr>
            <tr><td style={{ ...td, textAlign: "left", paddingLeft: 18, color: C.dim }}>Pagamentos OC-i (materiais)</td>{fluxo.map((f) => <td key={f.m} style={{ ...td, color: C.dim }}>{f.oc ? `(${fmt(f.oc)})` : "—"}</td>)}</tr>
            <tr><td style={{ ...td, textAlign: "left", paddingLeft: 18, color: C.dim }}>Pagamentos OS-i (serviços)</td>{fluxo.map((f) => <td key={f.m} style={{ ...td, color: C.dim }}>{f.os ? `(${fmt(f.os)})` : "—"}</td>)}</tr>
            <tr><td style={{ ...td, textAlign: "left", paddingLeft: 18, color: C.dim }}>Folha + financeiras + outras</td>{meses.map((m) => { const v = (Number(cfg.folha) || 0) + (Number(cfg.despFin) || 0) + (Number(cfg.outras) || 0); return <td key={m} style={{ ...td, color: C.dim }}>{v ? `(${fmt(v)})` : "—"}</td>; })}</tr>
            <tr style={{ background: "#fafafa" }}><td style={{ ...td, textAlign: "left", fontWeight: 700 }}>Saldo do mês</td>{fluxo.map((f) => <td key={f.m} style={{ ...td, fontWeight: 700, color: f.saldo < 0 ? C.vermelho : C.verde }}>{fmt(f.saldo)}</td>)}</tr>
            <tr style={{ background: C.preto }}><td style={{ ...td, textAlign: "left", color: "#fff", fontWeight: 800 }}>Saldo acumulado</td>{fluxo.map((f) => <td key={f.m} style={{ ...td, color: f.acum < 0 ? "#ff8a7a" : "#7be0a8", fontWeight: 800 }}>{fmt(f.acum)}</td>)}</tr>
          </tbody>
        </table></div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>Entradas: medições projetadas (PMM) deslocadas pelo prazo de recebimento. Saídas: parcelas de OC-i e OS-i no mês do vencimento, mais as despesas fixas mensais informadas acima.</div>
      </Card>

      {/* Ranking de obras */}
      <Card title="Produção por obra (R$ executado pelos RDOs)">
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.preto }}><th style={{ ...th, textAlign: "left" }}>Obra</th><th style={th}>Dia</th><th style={th}>7 dias</th><th style={th}>15 dias</th><th style={th}>Mês</th><th style={th}>Acumulada</th></tr></thead>
          <tbody>
            {prod.map((p) => <tr key={p.o.id}><td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{p.o.codigo}</td><td style={td}>{p.dia ? fmt(p.dia) : "—"}</td><td style={td}>{p.d7 ? fmt(p.d7) : "—"}</td><td style={td}>{p.d15 ? fmt(p.d15) : "—"}</td><td style={td}>{p.mes ? fmt(p.mes) : "—"}</td><td style={{ ...td, fontWeight: 700, color: C.laranja }}>{fmt(p.acum)}</td></tr>)}
            {prod.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "left", color: C.dim }}>Sem produção registrada.</td></tr>}
          </tbody>
          <tfoot><tr style={{ background: C.preto }}>
            <td style={{ ...td, textAlign: "left", color: "#fff", fontWeight: 800, borderBottom: "none" }}>TOTAL EMPRESA</td>
            <td style={{ ...td, color: "#fff", fontWeight: 800, borderBottom: "none" }}>{fmt(totProd.dia)}</td>
            <td style={{ ...td, color: "#fff", fontWeight: 800, borderBottom: "none" }}>{fmt(totProd.d7)}</td>
            <td style={{ ...td, color: "#fff", fontWeight: 800, borderBottom: "none" }}>{fmt(totProd.d15)}</td>
            <td style={{ ...td, color: "#fff", fontWeight: 800, borderBottom: "none" }}>{fmt(totProd.mes)}</td>
            <td style={{ ...td, color: "#7be0a8", fontWeight: 800, borderBottom: "none" }}>{fmt(totProd.acum)}</td>
          </tr></tfoot>
        </table></div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>Produção = valor financeiro executado (avanço × valor unitário com BDI dos itens da EAP), apurado pelos RDOs no período. A última linha soma a produção geral da empresa.</div>
      </Card>

      <Card title="Produção por obra — % de avanço (pelos RDOs)">
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {ranking.map((r, i) => (
            <div key={r.o.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 22, fontSize: 13, fontWeight: 800, color: i < 3 ? C.laranja : C.dim }}>{i + 1}</div>
              <div style={{ width: 90, fontSize: 13, fontWeight: 700 }}>{r.o.codigo}</div>
              <div style={{ flex: 1, background: C.cinza, borderRadius: 8, height: 18, overflow: "hidden", minWidth: 120 }}><div style={{ width: `${Math.min(r.pct * 100, 100)}%`, height: "100%", background: C.laranja, borderRadius: 8 }} /></div>
              <div style={{ width: 56, textAlign: "right", fontSize: 13, fontWeight: 700, color: C.laranja }}>{pct(r.pct)}</div>
              <div style={{ width: 110, textAlign: "right", fontSize: 12, color: C.dim }}>{fmtR(r.med)}</div>
            </div>
          ))}
          {ranking.length === 0 && <div style={{ fontSize: 13, color: C.dim }}>Sem obras cadastradas.</div>}
        </div>
      </Card>

      {/* Alertas de avanço */}
      {alertasAvanco.length > 0 && (
        <Card title="Alertas de avanço">
          {alertasAvanco.map((a) => (
            <div key={a.o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderLeft: `4px solid ${C.vermelho}`, background: "#fff5f3", borderRadius: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{a.o.codigo}</span>
              <span style={{ fontSize: 12.5, color: C.vermelho, fontWeight: 600 }}>{a.dias === null ? "sem nenhum avanço registrado" : `sem avanço há ${a.dias} dias`}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Últimas atividades */}
      <Card title="Últimas atividades no sistema">
        {feed.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Sem atividades recentes.</div> : feed.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < feed.length - 1 ? `1px solid ${C.linha}` : "none", fontSize: 13 }}>
            <span style={{ width: 70, color: C.dim, fontSize: 11.5, flexShrink: 0 }}>{quando(e.t)}</span>
            <span><b>{e.quem}</b> {e.txt} <span style={{ color: C.dim }}>· {codObra(e.o)}</span></span>
          </div>
        ))}
      </Card>
    </div>
  );
}
