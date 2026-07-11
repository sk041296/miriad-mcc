import React, { useState, useEffect, useMemo } from "react";
import { C, fmt, fmtR, sum, Card, Btn, Lbl, inp, NumInput, listar, criar, editar, remover } from "./core.jsx";

/* ---------- tabelas de encargos (referência 2025 — editáveis na folha) ---------- */
// INSS progressivo (empregado)
export function calcINSS(base) {
  const faixas = [[1518.00, 0.075], [2793.88, 0.09], [4190.83, 0.12], [8157.41, 0.14]];
  let ant = 0, inss = 0;
  for (const [teto, aliq] of faixas) {
    if (base > ant) { inss += (Math.min(base, teto) - ant) * aliq; ant = teto; } else break;
  }
  return Math.round(inss * 100) / 100;
}
// IRRF mensal (tabela progressiva 2025) sobre base = tributável - INSS - dependentes
export function calcIRRF(base) {
  const t = [
    [2259.20, 0, 0],
    [2826.65, 0.075, 169.44],
    [3751.05, 0.15, 381.44],
    [4664.68, 0.225, 662.77],
    [Infinity, 0.275, 896.00],
  ];
  for (const [teto, aliq, ded] of t) { if (base <= teto) return Math.round(Math.max(0, base * aliq - ded) * 100) / 100; }
  return 0;
}
const nowYM = () => new Date().toISOString().slice(0, 7);
const CONTRATOS = ["CLT", "Estagiário", "MEI/Sócio", "Prestador"];
const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function ModuloRH({ usuario }) {
  const [sub, setSub] = useState("folha");
  const TABS = [["colaboradores", "Colaboradores"], ["folha", "Folha CLT"], ["resumo", "Resumo mensal"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ background: sub === id ? C.preto : C.branco, color: sub === id ? "#fff" : C.dim, border: `1px solid ${sub === id ? C.preto : C.linha}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {sub === "colaboradores" && <Colaboradores />}
      {sub === "folha" && <FolhaCLT usuario={usuario} />}
      {sub === "resumo" && <ResumoMensal />}
    </div>
  );
}

/* ================= COLABORADORES ================= */
function Colaboradores() {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState(false);
  const vazio = { nome: "", cpf: "", cargo: "", area: "", tipo_contrato: "CLT", salario_base: 0, horas_mensais: 220, vt_dia: 0, va_mensal: 0, periculosidade_pct: 0, insalubridade_pct: 0, admissao: "", ativo: true };
  const [f, setF] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const carregar = () => listar("rh_colaboradores").then(setLista).catch(() => setLista([]));
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    if (!f.nome.trim()) { alert("Informe o nome."); return; }
    setBusy(true);
    try {
      const row = { ...f, nome: f.nome.trim(), salario_base: Number(f.salario_base) || 0, horas_mensais: Number(f.horas_mensais) || 220, vt_dia: Number(f.vt_dia) || 0, va_mensal: Number(f.va_mensal) || 0, periculosidade_pct: Number(f.periculosidade_pct) || 0, insalubridade_pct: Number(f.insalubridade_pct) || 0, admissao: f.admissao || null };
      if (editId) await editar("rh_colaboradores", editId, row); else await criar("rh_colaboradores", row);
      setF(vazio); setEditId(null); await carregar();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const editarC = (c) => { setEditId(c.id); setF({ ...vazio, ...c, admissao: c.admissao ? String(c.admissao).slice(0, 10) : "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const excluir = async (c) => { if (!confirm(`Excluir ${c.nome}?`)) return; try { await remover("rh_colaboradores", c.id); await carregar(); } catch (e) { alert(e.message); } };
  if (lista === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando colaboradores…</div>;
  const nb = norm(busca);
  const filtrados = nb ? lista.filter((c) => norm(c.nome).includes(nb) || norm(c.cargo).includes(nb) || norm(c.area).includes(nb)) : lista;
  const campo = (lbl, k, tipo = "text", w) => (
    <div><Lbl>{lbl}</Lbl>{tipo === "num"
      ? <NumInput value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} w={w || 130} />
      : <input type={tipo} value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} />}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title={editId ? "Editar colaborador" : "Novo colaborador"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 12 }}>
          {campo("Nome", "nome")}
          {campo("CPF", "cpf")}
          {campo("Cargo", "cargo")}
          {campo("Área", "area")}
          <div><Lbl>Tipo de contrato</Lbl>
            <select value={f.tipo_contrato} onChange={(e) => setF({ ...f, tipo_contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })}>
              {CONTRATOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {campo("Salário base (R$)", "salario_base", "num")}
          {campo("Horas mensais", "horas_mensais", "num", 90)}
          {campo("VT / dia (R$)", "vt_dia", "num", 100)}
          {campo("Auxílio alimentação / mês (R$)", "va_mensal", "num")}
          <div><Lbl>Periculosidade (%)</Lbl>
            <select value={f.periculosidade_pct} onChange={(e) => setF({ ...f, periculosidade_pct: Number(e.target.value) })} style={inp({ width: "100%", boxSizing: "border-box" })}>
              <option value={0}>0%</option><option value={30}>30%</option>
            </select>
          </div>
          <div><Lbl>Insalubridade (%)</Lbl>
            <select value={f.insalubridade_pct} onChange={(e) => setF({ ...f, insalubridade_pct: Number(e.target.value) })} style={inp({ width: "100%", boxSizing: "border-box" })}>
              <option value={0}>0%</option><option value={10}>10%</option><option value={20}>20%</option><option value={40}>40%</option>
            </select>
          </div>
          {campo("Admissão", "admissao", "date")}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn disabled={busy} onClick={salvar}>{busy ? "Salvando…" : editId ? "Salvar" : "Cadastrar"}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setEditId(null); setF(vazio); }}>Cancelar</Btn>}
        </div>
      </Card>

      <Card title={`Colaboradores (${filtrados.length})`} right={<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, cargo, área…" style={inp({ width: 220, fontSize: 12 })} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr style={{ background: C.preto }}>{["Nome", "Cargo / Área", "Contrato", "Salário base", "Adicionais", "Ativo", ""].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{filtrados.map((c) => (
              <tr key={c.id} style={{ opacity: c.ativo !== false ? 1 : 0.5 }}>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{c.nome}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.cargo || "—"}{c.area ? ` · ${c.area}` : ""}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.tipo_contrato}</td>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 700 }}>{fmtR(c.salario_base)}</td>
                <td style={{ padding: "7px 10px", fontSize: 11.5, borderBottom: `1px solid ${C.linha}`, color: C.dim }}>{[c.periculosidade_pct ? `peric ${c.periculosidade_pct}%` : "", c.insalubridade_pct ? `insal ${c.insalubridade_pct}%` : ""].filter(Boolean).join(" · ") || "—"}</td>
                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}` }}><button onClick={async () => { await editar("rh_colaboradores", c.id, { ativo: !(c.ativo !== false) }); carregar(); }} style={{ cursor: "pointer", border: "none", background: (c.ativo !== false) ? C.verde : C.cinza2, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{(c.ativo !== false) ? "ativo" : "inativo"}</button></td>
                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}`, whiteSpace: "nowrap" }}><Btn small kind="ghost" onClick={() => editarC(c)}>Editar</Btn> <Btn small kind="danger" onClick={() => excluir(c)}>Excluir</Btn></td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum colaborador.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================= FOLHA CLT ================= */
// calcula proventos, descontos e líquido a partir das entradas
function calcLinha(d) {
  const base = Number(d.salario_base) || 0;
  const valorHora = base / (Number(d.horas_mensais) || 220);
  const he = (Number(d.he50_h) || 0) * valorHora * 1.5 + (Number(d.he100_h) || 0) * valorHora * 2;
  const peric = base * ((Number(d.periculosidade_pct) || 0) / 100);
  const insal = base * ((Number(d.insalubridade_pct) || 0) / 100);
  const salFamilia = Number(d.salario_familia) || 0;
  const va = Number(d.auxilio_alim) || 0;
  const outrosProv = Number(d.outros_prov) || 0;
  const diasFalta = Number(d.faltas_dias) || 0;
  const descFaltas = diasFalta * (base / 30);
  const proventos = base + he + peric + insal + salFamilia + va + outrosProv;
  // base para encargos (não inclui benefícios não incidentes como VA/sal família)
  const baseEncargos = base + he + peric + insal - descFaltas;
  const inss = d.inss_manual != null && d.inss_manual !== "" ? Number(d.inss_manual) : calcINSS(baseEncargos);
  const baseIR = Math.max(0, baseEncargos - inss);
  const irrf = d.irrf_manual != null && d.irrf_manual !== "" ? Number(d.irrf_manual) : calcIRRF(baseIR);
  const vtDesc = Number(d.vt_desc) || 0;
  const adiant = Number(d.adiantamento) || 0;
  const outrosDesc = Number(d.outros_desc) || 0;
  const descontos = inss + irrf + vtDesc + adiant + descFaltas + outrosDesc;
  const liquido = proventos - descontos;
  return { valorHora, he, peric, insal, descFaltas, proventos, baseEncargos, inss, irrf, descontos, liquido };
}

function FolhaCLT({ usuario }) {
  const [mes, setMes] = useState(nowYM());
  const [colabs, setColabs] = useState(null);
  const [folha, setFolha] = useState({}); // colaborador_id -> dados
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState(null);

  const carregar = async () => {
    const [cs, fs] = await Promise.all([listar("rh_colaboradores"), listar("rh_folha", { mes })]);
    const clt = cs.filter((c) => c.tipo_contrato === "CLT" && c.ativo !== false);
    const map = {};
    clt.forEach((c) => {
      const existente = (fs || []).find((x) => x.colaborador_id === c.id);
      map[c.id] = existente ? { ...existente.dados, _rowId: existente.id } : {
        salario_base: c.salario_base, horas_mensais: c.horas_mensais || 220,
        periculosidade_pct: c.periculosidade_pct || 0, insalubridade_pct: c.insalubridade_pct || 0,
        auxilio_alim: c.va_mensal || 0, vt_desc: 0, he50_h: 0, he100_h: 0, salario_familia: 0,
        adiantamento: 0, faltas_dias: 0, outros_prov: 0, outros_desc: 0, inss_manual: "", irrf_manual: "",
      };
    });
    setColabs(clt); setFolha(map);
  };
  useEffect(() => { setColabs(null); carregar().catch(() => setColabs([])); /* eslint-disable-next-line */ }, [mes]);

  const upd = (cid, patch) => setFolha((f) => ({ ...f, [cid]: { ...f[cid], ...patch } }));
  const salvar = async () => {
    setBusy(true);
    try {
      for (const c of colabs) {
        const d = folha[c.id]; const r = calcLinha(d);
        const row = { mes, colaborador_id: c.id, dados: { ...d, _rowId: undefined }, bruto: Math.round(r.proventos * 100) / 100, descontos: Math.round(r.descontos * 100) / 100, liquido: Math.round(r.liquido * 100) / 100 };
        if (d._rowId) await editar("rh_folha", d._rowId, row); else await criar("rh_folha", row);
      }
      await carregar();
      alert("Folha do mês salva.");
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (colabs === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando folha…</div>;
  const linhas = colabs.map((c) => ({ c, d: folha[c.id], r: calcLinha(folha[c.id]) }));
  const tot = (k) => sum(linhas.map((l) => l.r[k] || 0));
  const num = (cid, k, w = 80) => <NumInput value={folha[cid][k]} onChange={(v) => upd(cid, { [k]: v })} w={w} dec={2} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title="Folha de Pagamento — CLT" right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div><Lbl>Mês</Lbl><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={inp({ fontSize: 13 })} /></div>
        <Btn small disabled={busy} onClick={salvar}>{busy ? "Salvando…" : "Salvar folha do mês"}</Btn>
      </div>}>
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Colaboradores CLT ativos. INSS e IRRF são <b>calculados</b> pelas tabelas de referência 2025 e podem ser <b>ajustados manualmente</b> por linha. Expanda um colaborador para lançar horas extras, adicionais, benefícios e descontos.</div>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr", gap: 6, fontSize: 10.5, fontWeight: 800, color: "#fff", background: C.preto, padding: "8px 10px", borderRadius: "8px 8px 0 0", textTransform: "uppercase" }}>
          <span>Colaborador</span><span style={{ textAlign: "right" }}>Proventos</span><span style={{ textAlign: "right" }}>INSS</span><span style={{ textAlign: "right" }}>IRRF</span><span style={{ textAlign: "right" }}>Líquido</span>
        </div>
        {linhas.map(({ c, d, r }) => (
          <div key={c.id} style={{ borderBottom: `1px solid ${C.linha}` }}>
            <div onClick={() => setAberto(aberto === c.id ? null : c.id)} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr", gap: 6, padding: "8px 10px", cursor: "pointer", alignItems: "center", background: aberto === c.id ? C.cinza : "#fff" }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{aberto === c.id ? "▾" : "▸"} {c.nome} <span style={{ color: C.dim, fontWeight: 400, fontSize: 11 }}>· {c.cargo || "—"}</span></span>
              <span style={{ textAlign: "right", fontSize: 12.5 }}>{fmt(r.proventos)}</span>
              <span style={{ textAlign: "right", fontSize: 12.5, color: C.vermelho }}>{fmt(r.inss)}</span>
              <span style={{ textAlign: "right", fontSize: 12.5, color: C.vermelho }}>{fmt(r.irrf)}</span>
              <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800 }}>{fmt(r.liquido)}</span>
            </div>
            {aberto === c.id && (
              <div style={{ padding: "6px 14px 16px", background: C.cinza }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
                  <div><Lbl>Salário base</Lbl>{num(c.id, "salario_base", 120)}</div>
                  <div><Lbl>HE 50% (horas)</Lbl>{num(c.id, "he50_h")}</div>
                  <div><Lbl>HE 100% (horas)</Lbl>{num(c.id, "he100_h")}</div>
                  <div><Lbl>Salário família</Lbl>{num(c.id, "salario_familia")}</div>
                  <div><Lbl>Auxílio alimentação</Lbl>{num(c.id, "auxilio_alim", 110)}</div>
                  <div><Lbl>Outros proventos</Lbl>{num(c.id, "outros_prov")}</div>
                  <div><Lbl>Faltas (dias)</Lbl>{num(c.id, "faltas_dias", 70)}</div>
                  <div><Lbl>Desconto VT</Lbl>{num(c.id, "vt_desc")}</div>
                  <div><Lbl>Adiantamento</Lbl>{num(c.id, "adiantamento")}</div>
                  <div><Lbl>Outros descontos</Lbl>{num(c.id, "outros_desc")}</div>
                  <div><Lbl>INSS (auto: {fmt(calcINSS(r.baseEncargos))})</Lbl><NumInput value={folha[c.id].inss_manual} onChange={(v) => upd(c.id, { inss_manual: v })} w={110} dec={2} /></div>
                  <div><Lbl>IRRF (auto: {fmt(r.irrf)})</Lbl><NumInput value={folha[c.id].irrf_manual} onChange={(v) => upd(c.id, { irrf_manual: v })} w={110} dec={2} /></div>
                </div>
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>
                  Adicionais: periculosidade {c.periculosidade_pct || 0}% = {fmtR(r.peric)} · insalubridade {c.insalubridade_pct || 0}% = {fmtR(r.insal)} · HE = {fmtR(r.he)} · desconto faltas = {fmtR(r.descFaltas)}. Deixe INSS/IRRF em branco para usar o cálculo automático.
                </div>
              </div>
            )}
          </div>
        ))}
        {linhas.length === 0 && <div style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum colaborador CLT ativo. Cadastre em “Colaboradores”.</div>}
        {linhas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr", gap: 6, padding: "10px", background: C.laranjaClaro, borderRadius: "0 0 8px 8px", fontWeight: 800, fontSize: 13 }}>
            <span>TOTAL ({linhas.length})</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("proventos"))}</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("inss"))}</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("irrf"))}</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("liquido"))}</span>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= RESUMO MENSAL ================= */
function ResumoMensal() {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    listar("rh_folha").then((rows) => {
      const porMes = {};
      (rows || []).forEach((r) => {
        const m = r.mes; if (!porMes[m]) porMes[m] = { mes: m, bruto: 0, descontos: 0, liquido: 0, n: 0 };
        porMes[m].bruto += Number(r.bruto) || 0; porMes[m].descontos += Number(r.descontos) || 0; porMes[m].liquido += Number(r.liquido) || 0; porMes[m].n++;
      });
      setDados(Object.values(porMes).sort((a, b) => b.mes.localeCompare(a.mes)));
    }).catch(() => setDados([]));
  }, []);
  if (dados === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando resumo…</div>;
  const mesBR = (ym) => { const [y, m] = ym.split("-"); return `${m}/${y}`; };
  return (
    <Card title="Resumo — Pagamentos mensais (Folha CLT)">
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Consolidação por mês da Folha CLT. (Estagiários, MEI/Sócios e Prestadores entram nas próximas etapas do módulo.)</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>{["Mês", "Colaboradores", "Total bruto", "Total descontos", "Total líquido"].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: h === "Mês" || h === "Colaboradores" ? "left" : "right", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{dados.map((d) => (
          <tr key={d.mes}>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 700 }}>{mesBR(d.mes)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}>{d.n}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right" }}>{fmtR(d.bruto)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right", color: C.vermelho }}>{fmtR(d.descontos)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right", fontWeight: 800 }}>{fmtR(d.liquido)}</td>
          </tr>
        ))}
        {dados.length === 0 && <tr><td colSpan={5} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhuma folha salva ainda.</td></tr>}</tbody>
      </table>
    </Card>
  );
}
