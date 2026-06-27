import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ReferenceLine,
} from "recharts";
import {
  C, fmt, fmtK, fmtR, pct, sum, z8, Card, Btn, Kpi, Th, Td, Lbl, NumInput, ChartTip,
  getFin, setFin, listar, hojeISO, addDiasISO, ymISO,
} from "./core.jsx";
import { resumoPmm } from "./pmm.jsx";

/* ================================================================
   MÓDULO FINANCEIRO — motor de fluxo de caixa (planilha RE01)
   Premissas · Antecipação · Antes×Depois · Sensibilidade · EAP&Custos
   ================================================================ */
const MESES = ["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = ["Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ANO = 2026;

const IMPOSTOS_DEF = [
  ["iss","ISS","Imposto sobre Serviços (municipal)"], ["pis","PIS","PIS (federal)"],
  ["cofins","COFINS","COFINS (federal)"], ["inss","INSS","Retenção previdenciária 11%"],
  ["irpj","IRPJ","IRPJ retido na fonte"], ["csll","CSLL","CSLL retida"],
];
const MATRIZ_PADRAO = { iss: 1, pis: 1, cofins: 1, inss: 0, irpj: 0, csll: 0 };
function getRetencao(p, c) {
  if (c.matriz && p.impostos) return IMPOSTOS_DEF.reduce((s, [k]) => s + (c.matriz[k] ? (p.impostos[k] || 0) : 0), 0);
  return c.retencao || 0;
}

export const SEED_PREMISSAS = {
  saldoInicial: 2706, pisoCaixa: 50000, fatorRealizacao: 1.0,
  impostos: { iss: 0.05, pis: 0.0165, cofins: 0.076, inss: 0.11, irpj: 0.02, csll: 0.038 },
  contratos: [
    { id: "camara", nome: "Câmara Vereadores Bal. Camboriú", prazo: 5, matriz: { ...MATRIZ_PADRAO },
      medicoes: [130000,140000,0,0,0,0,0,0], despesas: z8() },
    { id: "cppi", nome: "CPPI", prazo: 15, matriz: { ...MATRIZ_PADRAO },
      medicoes: [212000,8500,0,0,0,0,0,0], despesas: [0,60000,30000,0,0,0,0,0] },
    { id: "ifsc", nome: "IFSC", prazo: 30, matriz: { ...MATRIZ_PADRAO, irpj: 1, csll: 1 },
      medicoes: [24000,350000,780000,100000,0,0,0,0], despesas: [0,0,200000,250000,120000,178000,70000,0] },
    { id: "pmesp", nome: "PMESP", prazo: 30, matriz: { ...MATRIZ_PADRAO },
      medicoes: [0,0,465000,0,0,0,0,0], despesas: [0,0,0,114000,114000,0,0,0] },
    { id: "cense", nome: "CENSE (19 sub-obras)", prazo: 30, matriz: { ...MATRIZ_PADRAO }, regimeCaixa: true,
      medicoes: [0,331175.72,582742.74,965558.37,965558.37,965558.37,965558.28,0],
      despesas: [182146.65,320508.51,531057.1,531057.1,531057.1,531057.05,0,0] },
    { id: "boticario", nome: "BOTICÁRIO", prazo: 5, matriz: { ...MATRIZ_PADRAO },
      medicoes: [95000,0,0,30000,0,0,30000,0], despesas: [0,20000,0,0,0,0,0,0] },
  ],
  estrutural: { folha: [0,60000,60000,60000,60000,60000,60000,60000], fixos: [0,40000,40000,40000,40000,40000,40000,40000], emprestimos: [116500,111653,111640,112110,103000,103000,74000,70000] },
  antecipacao: { taxaMes: 0.028, porContrato: { cense: [0,210900,489000,0,46800,149800,0,0] } },
  regimeCaixaParams: { entradaMO: 0.1, entradaMAT: 0.2, pesoMO: 0.4, pesoMAT: 0.6 },
};

export function computeCashflow(p, overrides = {}) {
  const fator = overrides.fator ?? p.fatorRealizacao;
  const custoMult = overrides.custoMult ?? 1;
  const haircut = overrides.haircut ?? 0;
  const antPorContrato = overrides.antPorContrato ?? p.antecipacao.porContrato ?? {};
  const { entradaMO, entradaMAT, pesoMO, pesoMAT } = p.regimeCaixaParams;
  const fIn = pesoMO * entradaMO + pesoMAT * entradaMAT, fOut = pesoMO * (1 - entradaMO) + pesoMAT * (1 - entradaMAT);
  const recebTotalArr = z8(); let despDiretaPaga = z8(), custoAnt = z8(); const antDetalhe = [];

  for (const c of p.contratos) {
    const ret = getRetencao(p, c);
    let med = c.medicoes.map((v) => (Number(v) || 0) * fator);
    if (haircut > 0) { const last = med.reduce((a, v, i) => (v > 0 ? i : a), -1); if (last >= 0) { let d = 0; med = med.map((v, i) => { if (i === last) return v + d; const cut = v * haircut; d += cut; return v - cut; }); } }
    const liq = med.map((v) => v * (1 - ret)); const receb = z8();
    if (c.prazo <= 5) { for (let m = 0; m < 8; m++) receb[m] += liq[m]; }
    else {
      const antArr = antPorContrato[c.id] || z8(); const taxa = p.antecipacao.taxaMes;
      for (let m = 0; m < 8; m++) {
        const ant = Math.min(Number(antArr[m]) || 0, med[m]); const liqAnt = ant * (1 - ret);
        receb[m] += liqAnt; custoAnt[m] += ant * taxa; if (m + 1 < 8) receb[m + 1] += (med[m] - ant) * (1 - ret);
        if (ant > 0) antDetalhe.push({ contratoId: c.id, contrato: c.nome, mes: m, prazo: c.prazo, bruto: med[m], antecipado: ant, desagio: ant * taxa, retencao: ant * ret, liquido: liqAnt, pctMed: med[m] ? ant / med[m] : 0 });
      }
    }
    for (let m = 0; m < 8; m++) recebTotalArr[m] += receb[m];
    const desp = c.despesas.map((v) => (Number(v) || 0) * custoMult);
    const paga = c.regimeCaixa ? z8().map((_, m) => fIn * desp[m] + fOut * (m > 0 ? desp[m - 1] : 0)) : desp.slice();
    despDiretaPaga = despDiretaPaga.map((v, m) => v + paga[m]);
  }
  const estrutural = z8().map((_, m) => (p.estrutural.folha[m] || 0) + (p.estrutural.fixos[m] || 0) + (p.estrutural.emprestimos[m] || 0));
  const desembolso = z8().map((_, m) => despDiretaPaga[m] + estrutural[m] + custoAnt[m]);
  const fluxo = z8().map((_, m) => recebTotalArr[m] - desembolso[m]);
  const saldo = []; let s = p.saldoInicial; for (let m = 0; m < 8; m++) { s += fluxo[m]; saldo.push(s); }
  return { recebTotal: recebTotalArr, despDiretaPaga, estrutural, custoAnt, desembolso, fluxo, saldo, antDetalhe,
    piorSaldo: Math.min(...saldo), saldoDez: saldo[7], totalReceb: sum(recebTotalArr), totalDesemb: sum(desembolso) };
}
function autoAnticipate(p) {
  const taxa = p.antecipacao.taxaMes; const eleg = p.contratos.filter((c) => c.prazo > 5); const fator = p.fatorRealizacao;
  const porContrato = {}; eleg.forEach((c) => { porContrato[c.id] = z8(); }); let aporte = 0;
  for (let m = 0; m < 8; m++) {
    const cf = computeCashflow({ ...p, saldoInicial: p.saldoInicial + aporte }, { antPorContrato: porContrato });
    let deficit = p.pisoCaixa - cf.saldo[m]; if (deficit <= 0.01) continue;
    const cands = eleg.map((c) => ({ c, disp: Math.max((c.medicoes[m] || 0) * fator - porContrato[c.id][m], 0) })).filter((x) => x.disp > 0).sort((a, b) => b.disp - a.disp);
    for (const x of cands) { if (deficit <= 0.01) break; const fl = (1 - getRetencao(p, x.c)) - taxa; const usado = Math.min(deficit / fl, x.disp);
      porContrato[x.c.id][m] = Math.min(Math.ceil((porContrato[x.c.id][m] + usado) / 100) * 100, (x.c.medicoes[m] || 0) * fator); deficit -= usado * fl; }
    if (deficit > 0.01) { const cf2 = computeCashflow({ ...p, saldoInicial: p.saldoInicial + aporte }, { antPorContrato: porContrato }); const resta = p.pisoCaixa - cf2.saldo[m]; if (resta > 0.01) aporte += Math.ceil(resta); }
  }
  return { porContrato, aporte };
}

/* ---------- Sub-abas do módulo financeiro ---------- */
const FIN_TABS = [["premissas","Premissas"],["antecipacao","Antecipação"],["comparativo","Antes × Depois"],["sensibilidade","Sensibilidade"],["resultado","Resultado"],["custos","Custos por obra"],["custosdir","Custos diretos (auto)"],["medprojetada","Medição projetada"]];

export function ModuloFinanceiro({ sub: subProp, setSub: setSubProp }) {
  const [subLocal, setSubLocal] = useState("premissas");
  const sub = subProp ?? subLocal;
  const setSub = setSubProp ?? setSubLocal;
  const controlado = subProp != null;
  const [premissas, setPremissas] = useState(SEED_PREMISSAS);
  const [pronto, setPronto] = useState(false);
  useEffect(() => { getFin("premissas").then((v) => { if (v) { const p = v; if (!p.impostos) p.impostos = SEED_PREMISSAS.impostos; if (p.antecipacao && p.antecipacao.valores && !p.antecipacao.porContrato) p.antecipacao = { taxaMes: p.antecipacao.taxaMes, porContrato: { cense: p.antecipacao.valores } }; setPremissas(p); } setPronto(true); }).catch(() => setPronto(true)); }, []);
  useEffect(() => { if (pronto) { const t = setTimeout(() => setFin("premissas", premissas).catch(() => {}), 800); return () => clearTimeout(t); } }, [premissas, pronto]);
  const cf = useMemo(() => computeCashflow(premissas), [premissas]);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando premissas…</div>;

  return (
    <div>
      {!controlado && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {FIN_TABS.map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)} style={{ background: sub === id ? C.preto : C.branco, color: sub === id ? "#fff" : C.dim, border: `1px solid ${sub === id ? C.preto : C.linha}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      )}
      {sub === "premissas" && <Premissas premissas={premissas} setPremissas={setPremissas} cf={cf} />}
      {sub === "antecipacao" && <Antecipacao premissas={premissas} setPremissas={setPremissas} cf={cf} />}
      {sub === "comparativo" && <Comparativo premissas={premissas} cf={cf} />}
      {sub === "sensibilidade" && <Sensibilidade premissas={premissas} />}
      {sub === "resultado" && <Resultado premissas={premissas} />}
      {sub === "custos" && <CustosPorObra />}
      {sub === "custosdir" && <CustosDiretosAuto />}
      {sub === "medprojetada" && <MedicaoProjetada />}
    </div>
  );
}

function Premissas({ premissas, setPremissas, cf }) {
  const up = (patch) => setPremissas((p) => ({ ...p, ...patch }));
  const upC = (id, f, i, v) => setPremissas((p) => ({ ...p, contratos: p.contratos.map((c) => c.id === id ? { ...c, [f]: c[f].map((x, j) => j === i ? v : x) } : c) }));
  const upM = (id, k) => setPremissas((p) => ({ ...p, contratos: p.contratos.map((c) => c.id === id ? { ...c, matriz: { ...c.matriz, [k]: c.matriz?.[k] ? 0 : 1 } } : c) }));
  const upImp = (k, v) => setPremissas((p) => ({ ...p, impostos: { ...p.impostos, [k]: v } }));
  const upE = (cat, i, v) => setPremissas((p) => ({ ...p, estrutural: { ...p.estrutural, [cat]: p.estrutural[cat].map((x, j) => j === i ? v : x) } }));
  const fator = premissas.fatorRealizacao;
  const linhas = premissas.contratos.map((c) => { const ret = getRetencao(premissas, c); const liq = c.medicoes.map((v) => (Number(v) || 0) * fator * (1 - ret)); const bt = sum(c.medicoes) * fator; const lt = sum(liq); const dt = sum(c.despesas); const lb = lt - dt; return { c, ret, liq, bt, lt, dt, lb, lbPct: bt ? lb / bt : null }; });
  const liqMes = z8().map((_, m) => sum(linhas.map((l) => l.liq[m])));
  const chk = (on) => ({ width: 16, height: 16, borderRadius: 3, cursor: "pointer", display: "inline-block", background: on ? C.laranja : C.cinza, border: `1px solid ${on ? C.laranja : C.linha}` });
  const lbEmp = sum(linhas.map((l) => l.lb)); const btEmp = sum(linhas.map((l) => l.bt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Parâmetros gerais" right={<Btn kind="ghost" small onClick={() => { if (confirm("Restaurar premissas da planilha RE01?")) setPremissas(JSON.parse(JSON.stringify(SEED_PREMISSAS))); }}>Restaurar planilha</Btn>}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12, color: C.dim }}>Saldo inicial <NumInput value={premissas.saldoInicial} onChange={(v) => up({ saldoInicial: v })} /></label>
          <label style={{ fontSize: 12, color: C.dim }}>Piso de caixa <NumInput value={premissas.pisoCaixa} onChange={(v) => up({ pisoCaixa: v })} /></label>
          <label style={{ fontSize: 12, color: C.dim }}>Fator realização <NumInput w={70} dec value={premissas.fatorRealizacao} onChange={(v) => up({ fatorRealizacao: v })} /></label>
        </div>
      </Card>
      <Card title="1 · Medições brutas por contrato (R$/mês)">
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Contrato</Th><Th right>Prazo</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>{premissas.contratos.map((c) => <tr key={c.id}><Td>{c.nome}</Td><Td right>{c.prazo}d</Td>{c.medicoes.map((v, i) => <Td key={i} right><NumInput value={v} w={104} onChange={(nv) => upC(c.id, "medicoes", i, nv)} /></Td>)}<Td right color={C.laranja}>{fmt(sum(c.medicoes))}</Td></tr>)}</tbody>
        </table></div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) 2fr", gap: 16 }}>
        <Card title="2 · Alíquotas dos impostos">
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Imposto</Th><Th right>Alíquota</Th></tr></thead>
            <tbody>{IMPOSTOS_DEF.map(([k, n, d]) => <tr key={k}><Td style={{ cursor: "help" }} title={d}>{n}</Td><Td right><NumInput w={72} dec value={premissas.impostos[k]} onChange={(v) => upImp(k, v)} /></Td></tr>)}</tbody></table>
        </Card>
        <Card title="3 · Matriz de retenção (clique p/ alternar)">
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Contrato</Th>{IMPOSTOS_DEF.map(([k, n]) => <Th key={k} right>{n}</Th>)}<Th right>% Efetiva</Th></tr></thead>
            <tbody>{premissas.contratos.map((c) => <tr key={c.id}><Td>{c.nome}</Td>{IMPOSTOS_DEF.map(([k]) => <Td key={k} right><span style={chk(c.matriz?.[k])} onClick={() => upM(c.id, k)} /></Td>)}<Td right color={C.laranja}>{pct(getRetencao(premissas, c), 2)}</Td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card title="4 · Medições líquidas (após retenção) — automático">
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Contrato</Th><Th right>% Ret.</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>{linhas.map(({ c, ret, liq, lt }) => <tr key={c.id}><Td>{c.nome}</Td><Td right color={C.dim}>{pct(ret, 2)}</Td>{liq.map((v, i) => <Td key={i} right color={v ? C.verde : C.dim}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.verde}>{fmt(lt)}</Td></tr>)}
            <tr><Td style={{ fontWeight: 800 }}>TOTAL LÍQUIDO</Td><Td />{liqMes.map((v, i) => <Td key={i} right style={{ fontWeight: 800 }} color={C.verde}>{fmt(v)}</Td>)}<Td right color={C.verde} style={{ fontWeight: 800 }}>{fmt(sum(liqMes))}</Td></tr></tbody>
        </table></div>
      </Card>
      <Card title="5 · Despesas diretas por obra — lucro bruto automático">
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Obra</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Desp.</Th><Th right>Lucro Bruto</Th><Th right>LB%</Th></tr></thead>
          <tbody>{linhas.map(({ c, dt, lb, lbPct }) => <tr key={c.id}><Td>{c.nome}{c.regimeCaixa && <span style={{ color: C.dim, fontSize: 10 }}> · caixa</span>}</Td>{c.despesas.map((v, i) => <Td key={i} right><NumInput value={v} w={104} onChange={(nv) => upC(c.id, "despesas", i, nv)} /></Td>)}<Td right>{fmt(dt)}</Td><Td right color={lb >= 0 ? C.verde : C.vermelho} style={{ fontWeight: 700 }}>{fmt(lb)}</Td><Td right color={lb >= 0 ? C.verde : C.vermelho}>{lbPct === null ? "—" : pct(lbPct)}</Td></tr>)}
            <tr><Td style={{ fontWeight: 800 }}>TOTAL</Td>{MESES.map((_, i) => <Td key={i} right style={{ fontWeight: 800 }}>{fmt(sum(premissas.contratos.map((c) => c.despesas[i])))}</Td>)}<Td right style={{ fontWeight: 800 }}>{fmt(sum(linhas.map((l) => l.dt)))}</Td><Td right color={lbEmp >= 0 ? C.verde : C.vermelho} style={{ fontWeight: 800 }}>{fmt(lbEmp)}</Td><Td right color={lbEmp >= 0 ? C.verde : C.vermelho} style={{ fontWeight: 800 }}>{btEmp ? pct(lbEmp / btEmp) : "—"}</Td></tr></tbody>
        </table></div>
      </Card>
      <Card title="6 · Despesas estruturais">
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Categoria</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>{[["folha","Folha"],["fixos","Custos fixos"],["emprestimos","Empréstimos"]].map(([k, l]) => <tr key={k}><Td>{l}</Td>{premissas.estrutural[k].map((v, i) => <Td key={i} right><NumInput value={v} w={104} onChange={(nv) => upE(k, i, nv)} /></Td>)}<Td right color={C.laranja}>{fmt(sum(premissas.estrutural[k]))}</Td></tr>)}
            <tr><Td>Deságio antecipação</Td>{cf.custoAnt.map((v, i) => <Td key={i} right color={C.dim}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.dim}>{fmt(sum(cf.custoAnt))}</Td></tr></tbody>
        </table></div>
      </Card>
    </div>
  );
}

function Antecipacao({ premissas, setPremissas, cf }) {
  const [res, setRes] = useState(null);
  const eleg = premissas.contratos.filter((c) => c.prazo > 5);
  const pc = premissas.antecipacao.porContrato || {};
  const getA = (id) => pc[id] || z8();
  const upA = (id, i, v) => setPremissas((p) => { const a = (p.antecipacao.porContrato && p.antecipacao.porContrato[id]) || z8(); return { ...p, antecipacao: { ...p.antecipacao, porContrato: { ...(p.antecipacao.porContrato || {}), [id]: a.map((x, j) => j === i ? v : x) } } }; });
  const recalc = () => { const { porContrato, aporte } = autoAnticipate(premissas); setPremissas((p) => ({ ...p, antecipacao: { ...p.antecipacao, porContrato } })); setRes({ aporte, quando: new Date().toLocaleTimeString("pt-BR") }); };
  const totAnt = z8().map((_, m) => sum(eleg.map((c) => Math.min(getA(c.id)[m] || 0, (c.medicoes[m] || 0) * premissas.fatorRealizacao))));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Antecipação de recebíveis — contratos com prazo > 5 dias" right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><label style={{ fontSize: 12, color: C.dim }}>Taxa %a.m. <NumInput w={64} dec value={premissas.antecipacao.taxaMes} onChange={(v) => setPremissas((p) => ({ ...p, antecipacao: { ...p.antecipacao, taxaMes: v } }))} /></label><Btn onClick={recalc}>⟳ Recalcular automático</Btn></div>}>
        {res && <div style={{ background: res.aporte > 0 ? `${C.amareloAlerta}22` : `${C.verde}18`, border: `1px solid ${res.aporte > 0 ? C.amareloAlerta : C.verde}55`, borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>Recalculado às {res.quando}. {res.aporte > 0 ? `Aporte adicional necessário: ${fmtR(res.aporte)}.` : "Piso atendido só com antecipação."}</div>}
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Contrato / antecipado (bruto)</Th><Th right>Ret.</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>{eleg.map((c) => { const a = getA(c.id); return (<React.Fragment key={c.id}>
            <tr><Td style={{ fontWeight: 600 }}>{c.nome}</Td><Td right>{pct(getRetencao(premissas, c), 2)}</Td>{MESES.map((_, m) => <Td key={m} right><NumInput value={a[m] || 0} w={100} onChange={(v) => upA(c.id, m, v)} /></Td>)}<Td right color={C.laranja}>{fmt(sum(a))}</Td></tr>
            <tr><Td style={{ fontSize: 10, color: C.dim, paddingLeft: 16 }}>medição disponível</Td><Td />{MESES.map((_, m) => { const med = (c.medicoes[m] || 0) * premissas.fatorRealizacao; const ac = (a[m] || 0) > med + 0.01; return <Td key={m} right style={{ fontSize: 10 }} color={ac ? C.vermelho : C.dim}>{med ? fmt(med) : "—"}{ac ? " ⚠" : ""}</Td>; })}<Td /></tr>
          </React.Fragment>); })}
            <tr><Td style={{ fontWeight: 800 }}>TOTAL ANTECIPADO</Td><Td />{totAnt.map((v, m) => <Td key={m} right style={{ fontWeight: 800 }} color={C.laranja}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.laranja} style={{ fontWeight: 800 }}>{fmt(sum(totAnt))}</Td></tr>
            <tr><Td>Deságio</Td><Td />{cf.custoAnt.map((v, m) => <Td key={m} right color={C.vermelho}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.vermelho}>{fmt(sum(cf.custoAnt))}</Td></tr>
            <tr><Td style={{ fontWeight: 800 }}>Saldo resultante</Td><Td />{cf.saldo.map((v, m) => <Td key={m} right style={{ fontWeight: 800 }} color={v >= premissas.pisoCaixa ? C.verde : v >= 0 ? C.amareloAlerta : C.vermelho}>{fmt(v)}</Td>)}<Td /></tr></tbody>
        </table></div>
      </Card>
    </div>
  );
}

function Comparativo({ premissas, cf }) {
  const cfSem = useMemo(() => computeCashflow(premissas, { antPorContrato: {} }), [premissas]);
  const piso = premissas.pisoCaixa; const furo = (s) => (s < piso ? piso - s : 0);
  const fSem = cfSem.saldo.map(furo), fCom = cf.saldo.map(furo);
  const sanados = MESES.filter((_, m) => fSem[m] > 0 && fCom[m] <= 0).length, comFuro = fSem.filter((f) => f > 0).length;
  const totAnt = z8().map((_, m) => sum(cf.antDetalhe.filter((o) => o.mes === m).map((o) => o.antecipado)));
  const cor = (v) => (v >= piso ? C.verde : v >= 0 ? C.amareloAlerta : C.vermelho);
  const data = MESES.map((m, i) => ({ mes: m, "Sem antecipação": cfSem.saldo[i], "Com antecipação": cf.saldo[i], "Antecipado": totAnt[i] }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi label="Pior saldo SEM antecipação" value={fmtK(cfSem.piorSaldo)} accent={cor(cfSem.piorSaldo)} sub={`${comFuro} ${comFuro === 1 ? "mês" : "meses"} abaixo do piso`} />
        <Kpi label="Pior saldo COM antecipação" value={fmtK(cf.piorSaldo)} accent={cor(cf.piorSaldo)} sub={`${sanados} de ${comFuro} furos sanados`} />
        <Kpi label="Maior furo original" value={fmtK(Math.max(...fSem, 0))} accent={C.vermelho} />
        <Kpi label="Custo (deságio)" value={fmtK(sum(cf.custoAnt))} accent={C.laranja} sub={`sobre ${fmtK(sum(totAnt))}`} />
      </div>
      <Card title="Saldo projetado — sem × com antecipação">
        <ResponsiveContainer width="100%" height={300}><ComposedChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.linha} strokeDasharray="2 4" vertical={false} /><XAxis dataKey="mes" tick={{ fill: C.dim, fontSize: 11 }} /><YAxis tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} width={70} />
          <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={0} stroke={C.vermelho} strokeDasharray="3 3" /><ReferenceLine y={piso} stroke={C.amareloAlerta} strokeDasharray="4 4" />
          <Bar dataKey="Antecipado" fill={`${C.azul}55`} barSize={26} radius={[3, 3, 0, 0]} /><Line dataKey="Sem antecipação" stroke={C.vermelho} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} /><Line dataKey="Com antecipação" stroke={C.verde} strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart></ResponsiveContainer>
      </Card>
      {[["ORIGINAL — sem antecipação", cfSem, fSem, false], ["COM antecipação — furos sanados", cf, fCom, true]].map(([titulo, c, furos, comAnt], idx) => (
        <Card key={idx} title={`${idx + 1} · Fluxo ${titulo}`}>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Indicador</Th>{MESES.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Total</Th></tr></thead>
            <tbody>
              {comAnt && <tr><Td color={C.azul}>Antecipado no mês</Td>{totAnt.map((v, i) => <Td key={i} right color={C.azul}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.azul}>{fmt(sum(totAnt))}</Td></tr>}
              <tr><Td>Recebimentos líquidos</Td>{c.recebTotal.map((v, i) => <Td key={i} right>{fmt(v)}</Td>)}<Td right color={C.verde}>{fmt(sum(c.recebTotal))}</Td></tr>
              <tr><Td>Desembolsos</Td>{c.desembolso.map((v, i) => <Td key={i} right>{fmt(v)}</Td>)}<Td right>{fmt(sum(c.desembolso))}</Td></tr>
              <tr><Td style={{ fontWeight: 700 }}>Saldo final</Td>{c.saldo.map((v, i) => <Td key={i} right style={{ fontWeight: 700, background: comAnt ? (fSem[i] > 0 && fCom[i] <= 0 ? `${C.verde}1c` : furos[i] > 0 ? `${C.vermelho}22` : "transparent") : (furos[i] > 0 ? `${C.vermelho}22` : "transparent") }} color={cor(v)}>{fmt(v)}</Td>)}<Td /></tr>
              <tr><Td color={C.vermelho}>FURO (vs piso)</Td>{furos.map((f, i) => <Td key={i} right color={C.vermelho} style={{ fontWeight: f > 0 ? 700 : 400 }}>{f > 0 ? fmt(f) : "—"}</Td>)}<Td right color={C.vermelho} style={{ fontWeight: 700 }}>{fmt(sum(furos))}</Td></tr>
            </tbody>
          </table></div>
        </Card>
      ))}
    </div>
  );
}

function Sensibilidade({ premissas }) {
  const mults = [0.95, 1.0, 1.05, 1.1, 1.15]; const atrasos = [0, 0.05, 0.1, 0.15];
  const grid = useMemo(() => mults.map((cm) => atrasos.map((h) => computeCashflow(premissas, { custoMult: cm, haircut: h }))), [premissas]);
  const uni = useMemo(() => mults.map((cm) => computeCashflow(premissas, { custoMult: cm })), [premissas]);
  const heat = (v) => v >= premissas.pisoCaixa ? `${C.verde}26` : v >= 0 ? `${C.amareloAlerta}26` : `${C.vermelho}${Math.min(60, 20 + Math.round(Math.abs(v) / 30000)).toString(16).padStart(2, "0")}`;
  const lbl = (cm) => cm === 1 ? "Base" : `${cm > 1 ? "+" : ""}${Math.round((cm - 1) * 100)}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Sensibilidade unidimensional — variação de custo">
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Indicador</Th>{mults.map((m) => <Th key={m} right>{lbl(m)}</Th>)}</tr></thead>
          <tbody>
            <tr><Td>Pior saldo do ano</Td>{uni.map((r, i) => <Td key={i} right color={r.piorSaldo >= 0 ? C.verde : C.vermelho}>{fmt(r.piorSaldo)}</Td>)}</tr>
            <tr><Td>Saldo final Dez</Td>{uni.map((r, i) => <Td key={i} right color={r.saldoDez >= 0 ? C.verde : C.vermelho}>{fmt(r.saldoDez)}</Td>)}</tr>
            <tr><Td>Necessidade máx. financiamento</Td>{uni.map((r, i) => <Td key={i} right>{r.piorSaldo < 0 ? fmt(-r.piorSaldo) : "—"}</Td>)}</tr>
          </tbody></table>
      </Card>
      <Card title="Sensibilidade bidimensional — custo × atraso de medição (pior saldo)">
        <table style={{ borderCollapse: "collapse" }}><thead><tr><Th>Custo ↓ / Atraso →</Th>{atrasos.map((h) => <Th key={h} right>{pct(h, 0)}</Th>)}</tr></thead>
          <tbody>{mults.map((cm, i) => <tr key={cm}><Td>{lbl(cm)}</Td>{atrasos.map((h, j) => <Td key={j} right style={{ background: heat(grid[i][j].piorSaldo), minWidth: 110 }} color={grid[i][j].piorSaldo >= 0 ? C.verde : C.preto}>{fmt(grid[i][j].piorSaldo)}</Td>)}</tr>)}</tbody></table>
      </Card>
    </div>
  );
}

/* ================================================================
   RESULTADO — projetado × realizado por obra
   Valor total (venda EAP) − impostos − custo (meta projetada / realizado efetivo)
   ================================================================ */
// replica a lógica de meta/realizado do módulo operacional (mantém consistência)
function metaItemFin(e) {
  const csb = Number(e.custo_sem_bdi);
  if (e.meta_valor != null) return Number(e.meta_valor) * (Number(e.qtde) || 0);
  if (csb && e.meta_pct != null) return csb * (1 - (Number(e.desconto) || 0)) * (Number(e.meta_pct) || 0) * (Number(e.qtde) || 0);
  return Number(e.valor_total) || 0;
}
function realizadoPorItemFin(ocs, contratos, obraId) {
  const m = {};
  const add = (cod, val) => { const c = String(cod || "").split(" ")[0].trim(); if (!c) return; m[c] = (m[c] || 0) + (Number(val) || 0); };
  ocs.filter((o) => o.obra_id === obraId).forEach((o) => { if (o.eap_codigo) add(o.eap_codigo, o.valor); else if (Array.isArray(o.itens_eap) && o.itens_eap.length && o.itens_eap.some((x) => x.eap_codigo)) o.itens_eap.forEach((x) => add(x.eap_codigo, x.valor != null ? x.valor : x.valor_total)); else add(o.eap_codigo, o.valor); });
  contratos.filter((c) => c.obra_id === obraId).forEach((c) => {
    if (Array.isArray(c.itens_eap) && c.itens_eap.length) { if (c.tipo === "direto") { const v = (Number(c.custo_mensal) || 0) * (Number(c.meses) || 0); const n = c.itens_eap.length || 1; c.itens_eap.forEach((x) => add(x.eap_codigo, v / n)); } else c.itens_eap.forEach((x) => add(x.eap_codigo, x.valor)); }
    else add(c.escopo_eap, c.valor);
  });
  return m;
}

function Resultado({ premissas }) {
  const [dados, setDados] = useState(null);
  const [matrizes, setMatrizes] = useState({}); // { obraId: {iss:1,...} }
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { (async () => {
    const obras = await listar("obras");
    const eap = {}, ocs = [], contratos = await listar("contratos_servico"), todasOcs = await listar("ordens_compra");
    await Promise.all(obras.map(async (o) => { eap[o.id] = await listar("eap_itens", { obra_id: o.id }); }));
    const mtz = (await getFin("matrizes_resultado")) || {};
    setMatrizes(mtz);
    setDados({ obras, eap, contratos, ocs: todasOcs });
  })(); }, []);

  const salvarMatrizes = async (nova) => { setMatrizes(nova); await setFin("matrizes_resultado", nova).catch(() => {}); setSalvo(true); setTimeout(() => setSalvo(false), 1500); };
  const toggleImposto = (obraId, k) => { const atual = matrizes[obraId] || { ...MATRIZ_PADRAO }; salvarMatrizes({ ...matrizes, [obraId]: { ...atual, [k]: atual[k] ? 0 : 1 } }); };
  const retencaoObra = (obraId) => { const mtz = matrizes[obraId] || MATRIZ_PADRAO; return IMPOSTOS_DEF.reduce((s, [k]) => s + (mtz[k] ? (premissas.impostos[k] || 0) : 0), 0); };

  if (!dados) return <div style={{ color: C.dim, padding: 20 }}>Carregando obras e custos…</div>;

  const linhas = dados.obras.map((o) => {
    const itens = dados.eap[o.id] || [];
    const real = realizadoPorItemFin(dados.ocs, dados.contratos, o.id);
    const valorTotal = sum(itens.map((e) => Number(e.valor_total) || 0)); // venda EAP (c/ BDI e desconto)
    const valorRef = sum(itens.map((e) => (Number(e.custo_sem_bdi) || 0) * (1 + (Number(e.bdi) || 0)) * (Number(e.qtde) || 0))); // referência s/ desconto (c/ BDI)
    const desconto = Number(o.desconto) || 0;
    const ret = retencaoObra(o.id);
    const impostos = valorTotal * ret;
    const metaTotal = sum(itens.map((e) => metaItemFin(e)));
    // realizado: para itens COM realizado lançado usa o custo real; para os SEM, usa a meta
    let custoRealizadoMix = 0;
    itens.forEach((e) => { const rl = real[e.codigo] || 0; custoRealizadoMix += rl > 0 ? rl : metaItemFin(e); });
    const custoRealEfetivo = sum(itens.map((e) => real[e.codigo] || 0));
    const projetado = valorTotal - impostos - metaTotal;
    const realizado = valorTotal - impostos - custoRealizadoMix;
    return { o, valorTotal, valorRef, desconto, ret, impostos, metaTotal, custoRealEfetivo, custoRealizadoMix, projetado, realizado,
      margemProj: valorTotal ? projetado / valorTotal : 0, margemReal: valorTotal ? realizado / valorTotal : 0 };
  });
  const tot = (k) => sum(linhas.map((l) => l[k]));
  const chk = (on) => ({ width: 15, height: 15, borderRadius: 3, cursor: "pointer", display: "inline-block", background: on ? C.laranja : C.cinza2, border: `1px solid ${on ? C.laranja : C.linha}` });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi dark label="Resultado projetado — empresa" value={fmtR(tot("projetado"))} accent={tot("projetado") >= 0 ? C.laranja : C.vermelho} sub="valor − impostos − meta de custo" />
        <Kpi label="Resultado realizado — empresa" value={fmtR(tot("realizado"))} accent={tot("realizado") >= 0 ? C.verde : C.vermelho} sub="custo real nos itens executados" />
        <Kpi label="Valor total contratado" value={fmtR(tot("valorTotal"))} sub="já com desconto da licitação" />
        <Kpi label="Valor de referência (s/ desconto)" value={fmtR(tot("valorRef"))} sub="antes do desconto da licitação" />
        <Kpi label="Impostos totais" value={fmtR(tot("impostos"))} accent={C.dim} />
      </div>

      <Card title="Matriz de retenção por obra — selecione os impostos que incidem" right={salvo && <span style={{ color: C.verde, fontSize: 12, fontWeight: 700 }}>salvo</span>}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Clique para marcar/desmarcar cada imposto. As alíquotas vêm da aba Premissas. A retenção define a medição líquida de cada projeto.</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Obra</Th>{IMPOSTOS_DEF.map(([k, n]) => <Th key={k} right>{n}</Th>)}<Th right>% Retenção</Th></tr></thead>
          <tbody>{dados.obras.map((o) => { const mtz = matrizes[o.id] || MATRIZ_PADRAO; return (
            <tr key={o.id}><Td style={{ fontWeight: 600 }}>{o.codigo}</Td>
              {IMPOSTOS_DEF.map(([k]) => <Td key={k} right><span style={chk(mtz[k])} onClick={() => toggleImposto(o.id, k)} /></Td>)}
              <Td right color={C.laranja} style={{ fontWeight: 700 }}>{pct(retencaoObra(o.id), 2)}</Td></tr>
          ); })}</tbody>
        </table></div>
      </Card>

      <Card title="Resultado por obra — projetado × realizado">
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Obra</Th><Th right>Valor ref.</Th><Th right>Desc.</Th><Th right>Valor total</Th><Th right>% Ret.</Th><Th right>Impostos</Th><Th right>Meta custo</Th><Th right>Realizado (efetivo)</Th><Th right>Result. Projetado</Th><Th right>Margem proj.</Th><Th right>Result. Realizado</Th><Th right>Margem real.</Th></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.o.id}>
              <Td style={{ fontWeight: 600 }}>{l.o.codigo}</Td>
              <Td right color={C.dim}>{fmt(l.valorRef)}</Td>
              <Td right color={l.desconto ? C.laranja : C.dim} style={{ fontWeight: l.desconto ? 700 : 400 }}>{l.desconto ? pct(l.desconto, 1) : "—"}</Td>
              <Td right>{fmt(l.valorTotal)}</Td>
              <Td right color={C.dim}>{pct(l.ret, 1)}</Td>
              <Td right color={C.dim}>{fmt(l.impostos)}</Td>
              <Td right>{fmt(l.metaTotal)}</Td>
              <Td right color={C.azul}>{fmt(l.custoRealEfetivo)}</Td>
              <Td right color={l.projetado >= 0 ? C.preto : C.vermelho} style={{ fontWeight: 700 }}>{fmt(l.projetado)}</Td>
              <Td right color={l.margemProj >= 0 ? C.laranja : C.vermelho}>{pct(l.margemProj)}</Td>
              <Td right color={l.realizado >= 0 ? C.verde : C.vermelho} style={{ fontWeight: 700 }}>{fmt(l.realizado)}</Td>
              <Td right color={l.margemReal >= 0 ? C.verde : C.vermelho}>{pct(l.margemReal)}</Td>
            </tr>
          ))}
            <tr style={{ background: C.preto }}>
              <Td style={{ color: "#fff", fontWeight: 800 }}>TOTAL</Td>
              <Td right style={{ color: "#fff", fontWeight: 800 }}>{fmt(tot("valorRef"))}</Td><Td />
              <Td right style={{ color: "#fff", fontWeight: 800 }}>{fmt(tot("valorTotal"))}</Td><Td />
              <Td right style={{ color: "#fff", fontWeight: 700 }}>{fmt(tot("impostos"))}</Td>
              <Td right style={{ color: "#fff", fontWeight: 700 }}>{fmt(tot("metaTotal"))}</Td>
              <Td right style={{ color: "#fff", fontWeight: 700 }}>{fmt(tot("custoRealEfetivo"))}</Td>
              <Td right style={{ color: C.laranja, fontWeight: 800 }}>{fmt(tot("projetado"))}</Td><Td />
              <Td right style={{ color: C.verde, fontWeight: 800 }}>{fmt(tot("realizado"))}</Td><Td />
            </tr>
          </tbody>
        </table></div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>
          <b>Projetado</b> = Valor total − impostos − meta de custo (todos os itens). <b>Realizado</b> = Valor total − impostos − [custo real dos itens já executados/comprados/contratados + meta dos itens ainda não realizados]. À medida que OC-i, OS-i e RDO-i alimentam o realizado, o resultado realizado converge do projetado para o efetivo.
        </div>
      </Card>

      <Card title="Projetado × Realizado por obra">
        <ResponsiveContainer width="100%" height={Math.max(180, linhas.length * 54)}>
          <BarChart data={linhas.map((l) => ({ nome: l.o.codigo, Projetado: l.projetado, Realizado: l.realizado }))} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke={C.linha} strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} /><YAxis type="category" dataKey="nome" width={120} tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine x={0} stroke={C.vermelho} />
            <Bar dataKey="Projetado" fill={C.laranja} radius={[0, 3, 3, 0]} /><Bar dataKey="Realizado" fill={C.verde} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ================================================================
   CUSTOS POR OBRA — alocação mensal: SERVIÇO (OS-i, por medição) × MATERIAL (OC-i, por parcelas)
   • Serviço (OS-i indireto): valor do item × fração do avanço físico medido (RDO) no mês.
   • Serviço (OS-i direto): custo mensal alocado aos meses com RDO, até a duração contratada.
   • Material (OC-i): parcelas da condição de pagamento, no mês do vencimento (faturamento + dias).
   ================================================================ */
const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function ymLabel(ym) { const [y, m] = String(ym).split("-"); return `${MES_ABBR[Number(m) - 1] || "?"}/${String(y).slice(2)}`; }

function computeCustosObras({ obras, eapPorObra, rdos, ocs, contratos }) {
  const porObra = {}; const mesesSet = new Set();
  for (const o of obras) {
    const itens = eapPorObra[o.id] || [];
    const qtdeContr = {}; itens.forEach((e) => { qtdeContr[e.codigo] = Number(e.qtde) || 0; });
    // OS-i: valor de serviço por código de EAP (indiretos) e contratos diretos
    const osValEap = {}; const diretos = [];
    contratos.filter((c) => c.obra_id === o.id).forEach((c) => {
      if (c.tipo === "direto") { diretos.push({ custoMensal: Number(c.custo_mensal) || 0, meses: Number(c.meses) || 0 }); }
      else {
        const arr = (Array.isArray(c.itens_eap) && c.itens_eap.length) ? c.itens_eap : (c.escopo_eap ? [{ eap_codigo: c.escopo_eap, valor: c.valor }] : []);
        arr.forEach((x) => { const cod = String(x.eap_codigo || "").split(" ")[0].trim(); if (cod) osValEap[cod] = (osValEap[cod] || 0) + (Number(x.valor) || 0); });
      }
    });
    // avanço físico (qtde) por código de EAP e por mês — vindo dos RDOs
    const avancoMes = {}; const mesesRdo = new Set();
    rdos.filter((r) => r.obra_id === o.id).forEach((r) => {
      const m = ymISO(r.data); if (!m) return; mesesRdo.add(m);
      (r.atividades || []).forEach((a) => { const q = Number(a.qtde_dia ?? a.avanco) || 0; if (!q) return; (avancoMes[a.eap] = avancoMes[a.eap] || {})[m] = ((avancoMes[a.eap] || {})[m] || 0) + q; });
    });
    const servico = {}, material = {};
    // serviços indiretos: reconhecidos pela medição do mês
    Object.entries(avancoMes).forEach(([cod, mm]) => {
      const val = osValEap[cod] || 0, qc = qtdeContr[cod] || 0; if (!val || !qc) return;
      Object.entries(mm).forEach(([m, q]) => { const frac = Math.min(q / qc, 1); servico[m] = (servico[m] || 0) + val * frac; mesesSet.add(m); });
    });
    // serviços diretos: custo mensal nos meses ativos (com RDO), limitado à duração
    const mesesAtivos = [...mesesRdo].sort();
    diretos.forEach((d) => { const n = d.meses > 0 ? Math.min(d.meses, mesesAtivos.length) : mesesAtivos.length; for (let i = 0; i < n; i++) { const m = mesesAtivos[i]; if (!m) break; servico[m] = (servico[m] || 0) + d.custoMensal; mesesSet.add(m); } });
    // materiais: parcelas das OC-i no mês do vencimento
    ocs.filter((oc) => oc.obra_id === o.id).forEach((oc) => {
      const base = oc.data_faturamento || oc.data || hojeISO();
      const cond = oc.condicao_pagamento;
      let parcelas = (cond && Array.isArray(cond.parcelas) && cond.parcelas.length) ? cond.parcelas : [{ dias: 0, valor: Number(oc.valor) || 0 }];
      parcelas.forEach((p) => { const m = ymISO(addDiasISO(base, p.dias)); if (!m) return; material[m] = (material[m] || 0) + (Number(p.valor) || 0); mesesSet.add(m); });
    });
    porObra[o.id] = { servico, material };
  }
  return { mesesAxis: [...mesesSet].sort(), porObra };
}

/* loader compartilhado das duas abas de custos */
function useDadosCustos() {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const obras = await listar("obras");
    const [contratos, ocs] = await Promise.all([listar("contratos_servico"), listar("ordens_compra")]);
    const eapPorObra = {}, rdos = [];
    await Promise.all(obras.map(async (o) => { eapPorObra[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); }));
    setD({ obras, eapPorObra, rdos, ocs, contratos });
  })(); }, []);
  return d;
}

/* ---- REQ 3: visualização analítica — custos por obra, mês a mês, serviço × material ---- */
function CustosPorObra() {
  const dados = useDadosCustos();
  if (!dados) return <div style={{ color: C.dim, padding: 20 }}>Carregando custos das obras…</div>;
  const { mesesAxis, porObra } = computeCustosObras(dados);
  const obrasComCusto = dados.obras.filter((o) => { const p = porObra[o.id]; return p && (Object.keys(p.servico).length || Object.keys(p.material).length); });
  const totServ = sum(obrasComCusto.flatMap((o) => Object.values(porObra[o.id].servico)));
  const totMat = sum(obrasComCusto.flatMap((o) => Object.values(porObra[o.id].material)));

  if (!mesesAxis.length) return (
    <Card title="Custos por obra — serviço (OS-i) × material (OC-i)"><div style={{ fontSize: 13, color: C.dim }}>
      Ainda não há dados para alocar. Os custos de <b>serviço</b> aparecem conforme as medições nos RDOs avançam (vinculadas às OS-i), e os de <b>material</b> conforme as parcelas das OC-i vencem.
    </div></Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi dark label="Custo de serviços (OS-i)" value={fmtR(totServ)} accent={C.laranja} sub="reconhecido pela medição" />
        <Kpi label="Custo de materiais (OC-i)" value={fmtR(totMat)} accent={C.azul} sub="parcelas no vencimento" />
        <Kpi label="Custo total alocado" value={fmtR(totServ + totMat)} accent={C.verde} sub={`${obrasComCusto.length} obras · ${mesesAxis.length} meses`} />
      </div>
      {obrasComCusto.map((o) => {
        const p = porObra[o.id];
        const linhaServ = mesesAxis.map((m) => p.servico[m] || 0);
        const linhaMat = mesesAxis.map((m) => p.material[m] || 0);
        const chart = mesesAxis.map((m) => ({ mes: ymLabel(m), Serviço: p.servico[m] || 0, Material: p.material[m] || 0 }));
        return (
          <Card key={o.id} title={`${o.codigo} · ${o.nome}`} right={<span style={{ fontSize: 12, color: C.dim }}>{o.contratante || ""}</span>}>
            <div style={{ overflowX: "auto", marginBottom: 12 }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Natureza</Th>{mesesAxis.map((m) => <Th key={m} right>{ymLabel(m)}</Th>)}<Th right>Total</Th></tr></thead>
              <tbody>
                <tr><Td color={C.laranja} style={{ fontWeight: 700 }}>Serviço (OS-i)</Td>{linhaServ.map((v, i) => <Td key={i} right color={v ? C.texto : C.dim}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.laranja} style={{ fontWeight: 700 }}>{fmt(sum(linhaServ))}</Td></tr>
                <tr><Td color={C.azul} style={{ fontWeight: 700 }}>Material (OC-i)</Td>{linhaMat.map((v, i) => <Td key={i} right color={v ? C.texto : C.dim}>{v ? fmt(v) : "—"}</Td>)}<Td right color={C.azul} style={{ fontWeight: 700 }}>{fmt(sum(linhaMat))}</Td></tr>
                <tr style={{ background: C.preto }}><Td style={{ color: "#fff", fontWeight: 800 }}>TOTAL</Td>{mesesAxis.map((m, i) => <Td key={i} right style={{ color: "#fff", fontWeight: 800 }}>{fmt(linhaServ[i] + linhaMat[i])}</Td>)}<Td right style={{ color: C.verde, fontWeight: 800 }}>{fmt(sum(linhaServ) + sum(linhaMat))}</Td></tr>
              </tbody>
            </table></div>
            <ResponsiveContainer width="100%" height={Math.max(160, 40 + mesesAxis.length * 8)}>
              <BarChart data={chart} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={C.linha} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.dim, fontSize: 10 }} /><YAxis tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} width={66} />
                <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Serviço" stackId="a" fill={C.laranja} radius={[0, 0, 0, 0]} /><Bar dataKey="Material" stackId="a" fill={C.azul} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        );
      })}
      <div style={{ fontSize: 11, color: C.dim }}>Serviço (OS-i indireto) reconhecido por medição: valor do item × fração do avanço físico do mês (RDO). OS-i direto: custo mensal nos meses com RDO. Material (OC-i): parcelas da condição de pagamento no mês do vencimento (faturamento + dias).</div>
    </div>
  );
}

/* ---- REQ 4: tabela de custos diretos de obra (automática) — layout da aba Premissas ---- */
function CustosDiretosAuto() {
  const dados = useDadosCustos();
  if (!dados) return <div style={{ color: C.dim, padding: 20 }}>Carregando despesas das obras…</div>;
  const { mesesAxis, porObra } = computeCustosObras(dados);
  const obrasComCusto = dados.obras.filter((o) => { const p = porObra[o.id]; return p && (Object.keys(p.servico).length || Object.keys(p.material).length); });

  if (!mesesAxis.length) return (
    <Card title="Custos diretos de obra (automático) — abastecido por OS-i + OC-i"><div style={{ fontSize: 13, color: C.dim }}>
      Esta tabela substitui a projeção manual da aba Premissas: as despesas diretas são alimentadas automaticamente pela <b>medição dos serviços (OS-i)</b> e pelas <b>parcelas de material (OC-i)</b> de cada mês. Lance OS-i, OC-i e RDOs para preenchê-la.
    </div></Card>
  );

  const totalObra = (o) => { const p = porObra[o.id]; return sum(mesesAxis.map((m) => (p.servico[m] || 0) + (p.material[m] || 0))); };
  const totalMes = (m) => sum(obrasComCusto.map((o) => (porObra[o.id].servico[m] || 0) + (porObra[o.id].material[m] || 0)));
  const totalGeral = sum(obrasComCusto.map((o) => totalObra(o)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi dark label="Despesa direta total (auto)" value={fmtR(totalGeral)} accent={C.laranja} sub={`${obrasComCusto.length} obras · ${mesesAxis.length} meses`} />
        <Kpi label="Serviços (OS-i)" value={fmtR(sum(obrasComCusto.flatMap((o) => Object.values(porObra[o.id].servico))))} accent={C.laranja} />
        <Kpi label="Materiais (OC-i)" value={fmtR(sum(obrasComCusto.flatMap((o) => Object.values(porObra[o.id].material))))} accent={C.azul} />
      </div>
      <Card title="Custos diretos de obra — despesas por obra alocadas por mês (automático)">
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Mesmo formato da projeção manual da aba Premissas, porém abastecida automaticamente: cada célula soma a <b>medição dos serviços (OS-i)</b> do mês com as <b>parcelas de material (OC-i)</b> a pagar naquele mês.</div>
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Obra</Th>{mesesAxis.map((m) => <Th key={m} right>{ymLabel(m)}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>
            {obrasComCusto.map((o) => { const p = porObra[o.id]; return (
              <tr key={o.id}><Td style={{ fontWeight: 600 }}>{o.codigo}</Td>
                {mesesAxis.map((m) => { const v = (p.servico[m] || 0) + (p.material[m] || 0); return <Td key={m} right color={v ? C.texto : C.dim}>{v ? fmt(v) : "—"}</Td>; })}
                <Td right color={C.laranja} style={{ fontWeight: 700 }}>{fmt(totalObra(o))}</Td></tr>
            ); })}
            <tr style={{ background: C.preto }}><Td style={{ color: "#fff", fontWeight: 800 }}>TOTAL</Td>{mesesAxis.map((m) => <Td key={m} right style={{ color: "#fff", fontWeight: 800 }}>{fmt(totalMes(m))}</Td>)}<Td right style={{ color: C.verde, fontWeight: 800 }}>{fmt(totalGeral)}</Td></tr>
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}

/* ================================================================
   MEDIÇÃO PROJETADA — consolida os PMM (Plano de Medição Mensal) por obra e por mês.
   Estrutura no estilo da área de medições das Premissas: matriz obra × mês, valores com BDI.
   Cada PMM compõe a medição prevista do mês (valor contratado c/ BDI × % de avanço por item da EAP).
   ================================================================ */
function MedicaoProjetada() {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const obras = await listar("obras");
    const eapPorObra = {};
    await Promise.all(obras.map(async (o) => { eapPorObra[o.id] = await listar("eap_itens", { obra_id: o.id }); }));
    const pmms = await listar("pmm");
    setD({ obras, eapPorObra, pmms });
  })().catch(() => setD({ obras: [], eapPorObra: {}, pmms: [] })); }, []);
  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Carregando medição projetada…</div>;

  const { obras, eapPorObra, pmms } = d;
  const mesesSet = new Set(); const porObra = {};
  pmms.forEach((pm) => {
    const ym = ymISO(pm.mes); if (!ym) return;
    const fin = resumoPmm(pm, eapPorObra[pm.obra_id] || []).financeiro;
    if (!fin) return;
    mesesSet.add(ym);
    (porObra[pm.obra_id] = porObra[pm.obra_id] || {})[ym] = (porObra[pm.obra_id]?.[ym] || 0) + fin;
  });
  const meses = [...mesesSet].sort();
  const obrasComMed = obras.filter((o) => porObra[o.id] && Object.keys(porObra[o.id]).length);
  const totalObra = (o) => sum(meses.map((m) => porObra[o.id]?.[m] || 0));
  const totalMes = (m) => sum(obrasComMed.map((o) => porObra[o.id]?.[m] || 0));
  const totalGeral = sum(obrasComMed.map((o) => totalObra(o)));

  if (!meses.length) return (
    <Card title="Medição projetada — consolidada dos PMM"><div style={{ fontSize: 13, color: C.dim }}>
      Ainda não há PMM lançado. Conforme os Supervisores preenchem o Plano de Medição Mensal (PMM), a medição prevista de cada obra aparece aqui alocada por mês, com BDI.
    </div></Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi dark label="Medição projetada total (c/ BDI)" value={fmtR(totalGeral)} accent={C.laranja} sub={`${obrasComMed.length} obras · ${meses.length} meses`} />
        {meses.length > 0 && <Kpi label="Próximo mês" value={fmtR(totalMes(meses[0]))} accent={C.azul} sub={ymLabel(meses[0])} />}
      </div>
      <Card title="Medição projetada por obra e por mês (a partir dos PMM)">
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Cada célula é a soma dos PMM da obra naquele mês: valor contratado <b>com BDI</b> × % de avanço previsto de cada item da EAP. Mesma leitura da área de medições das Premissas.</div>
        <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><Th>Obra</Th>{meses.map((m) => <Th key={m} right>{ymLabel(m)}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>
            {obrasComMed.map((o) => (
              <tr key={o.id}><Td style={{ fontWeight: 600 }}>{o.codigo}</Td>
                {meses.map((m) => { const v = porObra[o.id]?.[m] || 0; return <Td key={m} right color={v ? C.texto : C.dim}>{v ? fmt(v) : "—"}</Td>; })}
                <Td right color={C.laranja} style={{ fontWeight: 700 }}>{fmt(totalObra(o))}</Td></tr>
            ))}
            <tr style={{ background: C.preto }}><Td style={{ color: "#fff", fontWeight: 800 }}>TOTAL</Td>{meses.map((m) => <Td key={m} right style={{ color: "#fff", fontWeight: 800 }}>{fmt(totalMes(m))}</Td>)}<Td right style={{ color: C.verde, fontWeight: 800 }}>{fmt(totalGeral)}</Td></tr>
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
