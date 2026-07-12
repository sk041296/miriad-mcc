import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, sum, Card, Btn, Lbl, inp, NumInput, listar, criar, editar, remover, getConfig, setConfig } from "./core.jsx";
import { ORGANOGRAMA_PADRAO, SETORES } from "./organograma.js";

/* ---------- encargos (referência 2025 — editáveis por linha) ---------- */
export function calcINSS(base) {
  const faixas = [[1518.00, 0.075], [2793.88, 0.09], [4190.83, 0.12], [8157.41, 0.14]];
  let ant = 0, inss = 0;
  for (const [teto, aliq] of faixas) { if (base > ant) { inss += (Math.min(base, teto) - ant) * aliq; ant = teto; } else break; }
  return Math.round(inss * 100) / 100;
}
export function calcIRRF(base) {
  const t = [[2259.20, 0, 0], [2826.65, 0.075, 169.44], [3751.05, 0.15, 381.44], [4664.68, 0.225, 662.77], [Infinity, 0.275, 896.00]];
  for (const [teto, aliq, ded] of t) { if (base <= teto) return Math.round(Math.max(0, base * aliq - ded) * 100) / 100; }
  return 0;
}
const nowYM = () => new Date().toISOString().slice(0, 7);
const CONTRATOS = ["CLT", "Estagiário", "MEI/Sócio", "Prestador"];
const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dBR = (d) => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—";

export function ModuloRH({ usuario }) {
  const [sub, setSub] = useState("fechamento");
  const [org, setOrg] = useState(null); // organograma (config ou padrão)
  useEffect(() => { getConfig("rh_organograma").then((v) => setOrg(v && Object.keys(v).length ? v : ORGANOGRAMA_PADRAO)).catch(() => setOrg(ORGANOGRAMA_PADRAO)); }, []);
  const TABS = [["colaboradores", "Colaboradores"], ["folha", "Folha de pagamento"], ["fechamento", "Fechamento de folha"], ["organograma", "Organograma de Cargos"], ["resumo", "Resumo mensal"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ background: sub === id ? C.preto : C.branco, color: sub === id ? "#fff" : C.dim, border: `1px solid ${sub === id ? C.preto : C.linha}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {org === null ? <div style={{ color: C.dim, padding: 20 }}>Carregando…</div> : <>
        {sub === "colaboradores" && <Colaboradores org={org} />}
        {sub === "folha" && <FolhaCadastral org={org} />}
        {sub === "fechamento" && <Fechamento usuario={usuario} />}
        {sub === "organograma" && <Organograma usuario={usuario} org={org} setOrg={setOrg} />}
        {sub === "resumo" && <ResumoMensal />}
      </>}
    </div>
  );
}

/* ================= COLABORADORES (cadastro) ================= */
function Colaboradores({ org }) {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState(false);
  const vazio = { nome: "", cpf: "", setor: "", cargo: "", tipo_contrato: "CLT", salario_base: 0, horas_mensais: 220, vt_valor: 0, va_mensal: 0, periculosidade_pct: 0, insalubridade_pct: 0, admissao: "", vencimento_contrato: "", ativo: true };
  const [f, setF] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const carregar = () => listar("rh_colaboradores").then(setLista).catch(() => setLista([]));
  useEffect(() => { carregar(); }, []);
  const cargosDoSetor = f.setor && org[f.setor] ? org[f.setor] : [];
  const escolherCargo = (cargo) => { const c = cargosDoSetor.find((x) => x.cargo === cargo); setF((s) => ({ ...s, cargo, salario_base: c ? c.salario : s.salario_base })); };
  const salvar = async () => {
    if (!f.nome.trim()) { alert("Informe o nome."); return; }
    setBusy(true);
    try {
      const row = { ...f, nome: f.nome.trim(), salario_base: Number(f.salario_base) || 0, horas_mensais: Number(f.horas_mensais) || 220, vt_valor: Number(f.vt_valor) || 0, va_mensal: Number(f.va_mensal) || 0, periculosidade_pct: Number(f.periculosidade_pct) || 0, insalubridade_pct: Number(f.insalubridade_pct) || 0, admissao: f.admissao || null, vencimento_contrato: f.vencimento_contrato || null };
      if (editId) await editar("rh_colaboradores", editId, row); else await criar("rh_colaboradores", row);
      setF(vazio); setEditId(null); await carregar();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const editarC = (c) => { setEditId(c.id); setF({ ...vazio, ...c, admissao: c.admissao ? String(c.admissao).slice(0, 10) : "", vencimento_contrato: c.vencimento_contrato ? String(c.vencimento_contrato).slice(0, 10) : "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const excluir = async (c) => { if (!confirm(`Excluir ${c.nome}?`)) return; try { await remover("rh_colaboradores", c.id); await carregar(); } catch (e) { alert(e.message); } };
  if (lista === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando colaboradores…</div>;
  const nb = norm(busca);
  const filtrados = nb ? lista.filter((c) => norm(c.nome).includes(nb) || norm(c.cargo).includes(nb) || norm(c.setor).includes(nb)) : lista;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title={editId ? "Editar colaborador" : "Novo colaborador"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 12 }}>
          <div><Lbl>Nome</Lbl><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>CPF</Lbl><input value={f.cpf || ""} onChange={(e) => setF({ ...f, cpf: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Setor</Lbl>
            <select value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value, cargo: "" })} style={inp({ width: "100%", boxSizing: "border-box" })}>
              <option value="">Selecione…</option>{SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Lbl>Cargo</Lbl>
            <select value={f.cargo} onChange={(e) => escolherCargo(e.target.value)} disabled={!f.setor} style={inp({ width: "100%", boxSizing: "border-box" })}>
              <option value="">{f.setor ? "Selecione…" : "Escolha o setor"}</option>
              {cargosDoSetor.map((c) => <option key={c.cargo} value={c.cargo}>{c.cargo} — {fmtR(c.salario)}</option>)}
            </select>
          </div>
          <div><Lbl>Tipo de contrato</Lbl>
            <select value={f.tipo_contrato} onChange={(e) => setF({ ...f, tipo_contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })}>{CONTRATOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div><Lbl>Salário base (R$)</Lbl><NumInput value={f.salario_base} onChange={(v) => setF({ ...f, salario_base: v })} w={130} /></div>
          <div><Lbl>Horas mensais</Lbl><NumInput value={f.horas_mensais} onChange={(v) => setF({ ...f, horas_mensais: v })} w={90} /></div>
          <div><Lbl>VT / mês (R$)</Lbl><NumInput value={f.vt_valor} onChange={(v) => setF({ ...f, vt_valor: v })} w={110} /></div>
          <div><Lbl>VA / mês (R$)</Lbl><NumInput value={f.va_mensal} onChange={(v) => setF({ ...f, va_mensal: v })} w={110} /></div>
          <div><Lbl>Periculosidade (%)</Lbl>
            <select value={f.periculosidade_pct} onChange={(e) => setF({ ...f, periculosidade_pct: Number(e.target.value) })} style={inp({ width: "100%", boxSizing: "border-box" })}><option value={0}>0%</option><option value={30}>30%</option></select>
          </div>
          <div><Lbl>Insalubridade (%)</Lbl>
            <select value={f.insalubridade_pct} onChange={(e) => setF({ ...f, insalubridade_pct: Number(e.target.value) })} style={inp({ width: "100%", boxSizing: "border-box" })}><option value={0}>0%</option><option value={10}>10%</option><option value={20}>20%</option><option value={40}>40%</option></select>
          </div>
          <div><Lbl>Admissão</Lbl><input type="date" value={f.admissao || ""} onChange={(e) => setF({ ...f, admissao: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Vencimento do contrato</Lbl><input type="date" value={f.vencimento_contrato || ""} onChange={(e) => setF({ ...f, vencimento_contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn disabled={busy} onClick={salvar}>{busy ? "Salvando…" : editId ? "Salvar" : "Cadastrar"}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setEditId(null); setF(vazio); }}>Cancelar</Btn>}
        </div>
      </Card>
      <Card title={`Colaboradores (${filtrados.length})`} right={<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, cargo, setor…" style={inp({ width: 220, fontSize: 12 })} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr style={{ background: C.preto }}>{["Nome", "Setor / Cargo", "Contrato", "Salário base", "Ativo", ""].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{filtrados.map((c) => (
              <tr key={c.id} style={{ opacity: c.ativo !== false ? 1 : 0.5 }}>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{c.nome}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.setor || "—"}{c.cargo ? ` · ${c.cargo}` : ""}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.tipo_contrato}</td>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 700 }}>{fmtR(c.salario_base)}</td>
                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}` }}><button onClick={async () => { await editar("rh_colaboradores", c.id, { ativo: !(c.ativo !== false) }); carregar(); }} style={{ cursor: "pointer", border: "none", background: (c.ativo !== false) ? C.verde : C.cinza2, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{(c.ativo !== false) ? "ativo" : "inativo"}</button></td>
                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}`, whiteSpace: "nowrap" }}><Btn small kind="ghost" onClick={() => editarC(c)}>Editar</Btn> <Btn small kind="danger" onClick={() => excluir(c)}>Excluir</Btn></td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={6} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum colaborador.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================= FOLHA DE PAGAMENTO (cadastral / roster) ================= */
function FolhaCadastral() {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("");
  useEffect(() => { listar("rh_colaboradores").then(setLista).catch(() => setLista([])); }, []);
  if (lista === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando…</div>;
  const nb = norm(busca);
  const hoje = new Date().toISOString().slice(0, 10);
  const filtrados = lista.filter((c) => (!setor || c.setor === setor) && (!nb || norm(c.nome).includes(nb) || norm(c.cargo).includes(nb)));
  return (
    <Card title={`Folha de pagamento — quadro de colaboradores (${filtrados.length})`} right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={setor} onChange={(e) => setSetor(e.target.value)} style={inp({ fontSize: 12 })}><option value="">Todos os setores</option>{SETORES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={inp({ width: 180, fontSize: 12 })} />
    </div>}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead><tr style={{ background: C.preto }}>{["Colaborador", "Setor", "Cargo", "Contrato", "Admissão", "Venc. contrato", "Salário base"].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{filtrados.map((c) => {
            const vencido = c.vencimento_contrato && String(c.vencimento_contrato).slice(0, 10) < hoje;
            return (
              <tr key={c.id} style={{ opacity: c.ativo !== false ? 1 : 0.5 }}>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{c.nome}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.setor || "—"}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.cargo || "—"}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{c.tipo_contrato}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{dBR(c.admissao)}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, color: vencido ? C.vermelho : C.texto, fontWeight: vencido ? 700 : 400 }}>{dBR(c.vencimento_contrato)}{vencido ? " ⚠" : ""}</td>
                <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 700 }}>{fmtR(c.salario_base)}</td>
              </tr>
            );
          })}
          {filtrados.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum colaborador.</td></tr>}</tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================= FECHAMENTO DE FOLHA (mensal) ================= */
function calcLinha(d) {
  const base = Number(d.salario_base) || 0;
  const valorHora = base / (Number(d.horas_mensais) || 220);
  const he = (Number(d.he50_h) || 0) * valorHora * 1.5 + (Number(d.he100_h) || 0) * valorHora * 2;
  const peric = base * ((Number(d.periculosidade_pct) || 0) / 100);
  const insal = base * ((Number(d.insalubridade_pct) || 0) / 100);
  const vt = Number(d.vt) || 0, va = Number(d.va) || 0, outrasAd = Number(d.outras_adicoes) || 0;
  const rescisaoVal = d.rescisao ? (Number(d.rescisao_valor) || 0) : 0;
  const diasFalta = Number(d.faltas_dias) || 0;
  const descFaltas = diasFalta * (base / 30);
  const adicoes = base + he + peric + insal + vt + va + outrasAd + rescisaoVal;
  const baseEncargos = base + he + peric + insal - descFaltas;
  const inss = d.inss_manual != null && d.inss_manual !== "" ? Number(d.inss_manual) : calcINSS(baseEncargos);
  const irrf = d.irrf_manual != null && d.irrf_manual !== "" ? Number(d.irrf_manual) : calcIRRF(Math.max(0, baseEncargos - inss));
  const adiant = d.pega_adiantamento ? (Number(d.adiantamento) || 0) : 0;
  const outrosDesc = Number(d.outros_descontos) || 0;
  const descontos = inss + irrf + adiant + outrosDesc + descFaltas;
  const liquido = adicoes - descontos;
  return { valorHora, he, peric, insal, descFaltas, adicoes, baseEncargos, inss, irrf, adiant, descontos, liquido, rescisaoVal };
}

function Fechamento({ usuario }) {
  const [mes, setMes] = useState(nowYM());
  const [colabs, setColabs] = useState(null);
  const [folha, setFolha] = useState({});
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState(null);

  const carregar = async () => {
    const [cs, fs] = await Promise.all([listar("rh_colaboradores"), listar("rh_folha", { mes })]);
    const clt = cs.filter((c) => c.tipo_contrato === "CLT" && c.ativo !== false);
    const map = {};
    clt.forEach((c) => {
      const ex = (fs || []).find((x) => x.colaborador_id === c.id);
      map[c.id] = ex ? { ...ex.dados, _rowId: ex.id } : {
        cargo: c.cargo || "", salario_base: c.salario_base, horas_mensais: c.horas_mensais || 220,
        periculosidade_pct: c.periculosidade_pct || 0, insalubridade_pct: c.insalubridade_pct || 0,
        vt: c.vt_valor || 0, va: c.va_mensal || 0, he50_h: 0, he100_h: 0, outras_adicoes: 0,
        pega_adiantamento: false, adiantamento: Math.round((c.salario_base || 0) * 0.4 * 100) / 100,
        outros_descontos: 0, faltas_dias: 0, inss_manual: "", irrf_manual: "", rescisao: false, rescisao_valor: 0,
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
        const row = { mes, colaborador_id: c.id, dados: { ...d, _rowId: undefined }, bruto: Math.round(r.adicoes * 100) / 100, descontos: Math.round(r.descontos * 100) / 100, liquido: Math.round(r.liquido * 100) / 100 };
        if (d._rowId) await editar("rh_folha", d._rowId, row); else await criar("rh_folha", row);
      }
      await carregar(); alert("Fechamento do mês salvo.");
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  if (colabs === null) return <div style={{ color: C.dim, padding: 20 }}>Carregando fechamento…</div>;
  const linhas = colabs.map((c) => ({ c, d: folha[c.id], r: calcLinha(folha[c.id]) }));
  const tot = (k) => sum(linhas.map((l) => l.r[k] || 0));
  const num = (cid, k, w = 90) => <NumInput value={folha[cid][k]} onChange={(v) => upd(cid, { [k]: v })} w={w} dec={2} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title="Fechamento de folha — CLT" right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div><Lbl>Mês</Lbl><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={inp({ fontSize: 13 })} /></div>
        <Btn small disabled={busy} onClick={salvar}>{busy ? "Salvando…" : "Salvar fechamento"}</Btn>
      </div>}>
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Colaboradores CLT ativos. Expanda cada um para lançar horas extras, VT, VA, adiantamento (dia 20), outras adições/descontos e rescisão. INSS/IRRF são calculados (tabelas 2025) e editáveis por linha. O <b>líquido</b> é o valor a pagar no mês.</div>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1.2fr 1.2fr 0.9fr 1.2fr", gap: 6, fontSize: 10.5, fontWeight: 800, color: "#fff", background: C.preto, padding: "8px 10px", borderRadius: "8px 8px 0 0", textTransform: "uppercase" }}>
          <span>Colaborador</span><span style={{ textAlign: "right" }}>Adições</span><span style={{ textAlign: "right" }}>Descontos</span><span style={{ textAlign: "center" }}>Adiant.</span><span style={{ textAlign: "right" }}>Líquido</span>
        </div>
        {linhas.map(({ c, d, r }) => (
          <div key={c.id} style={{ borderBottom: `1px solid ${C.linha}` }}>
            <div onClick={() => setAberto(aberto === c.id ? null : c.id)} style={{ display: "grid", gridTemplateColumns: "3fr 1.2fr 1.2fr 0.9fr 1.2fr", gap: 6, padding: "8px 10px", cursor: "pointer", alignItems: "center", background: aberto === c.id ? C.cinza : (d.rescisao ? "#fff4f2" : "#fff") }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{aberto === c.id ? "▾" : "▸"} {c.nome} <span style={{ color: C.dim, fontWeight: 400, fontSize: 11 }}>· {d.cargo || c.cargo || "—"}{d.rescisao ? " · RESCISÃO" : ""}</span></span>
              <span style={{ textAlign: "right", fontSize: 12.5 }}>{fmt(r.adicoes)}</span>
              <span style={{ textAlign: "right", fontSize: 12.5, color: C.vermelho }}>{fmt(r.descontos)}</span>
              <span style={{ textAlign: "center", fontSize: 12.5 }}>{d.pega_adiantamento ? "✓" : "—"}</span>
              <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800 }}>{fmt(r.liquido)}</span>
            </div>
            {aberto === c.id && (
              <div style={{ padding: "6px 14px 16px", background: C.cinza }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
                  <div><Lbl>Salário base</Lbl>{num(c.id, "salario_base", 120)}</div>
                  <div><Lbl>HE 50% (horas)</Lbl>{num(c.id, "he50_h", 80)}</div>
                  <div><Lbl>HE 100% (horas)</Lbl>{num(c.id, "he100_h", 80)}</div>
                  <div><Lbl>VT (R$)</Lbl>{num(c.id, "vt", 110)}</div>
                  <div><Lbl>VA (R$)</Lbl>{num(c.id, "va", 110)}</div>
                  <div><Lbl>Outras adições</Lbl>{num(c.id, "outras_adicoes")}</div>
                  <div><Lbl>Outros descontos</Lbl>{num(c.id, "outros_descontos")}</div>
                  <div><Lbl>Faltas (dias)</Lbl>{num(c.id, "faltas_dias", 70)}</div>
                  <div><Lbl>INSS (auto: {fmt(calcINSS(r.baseEncargos))})</Lbl><NumInput value={folha[c.id].inss_manual} onChange={(v) => upd(c.id, { inss_manual: v })} w={110} dec={2} /></div>
                  <div><Lbl>IRRF (auto: {fmt(r.irrf)})</Lbl><NumInput value={folha[c.id].irrf_manual} onChange={(v) => upd(c.id, { irrf_manual: v })} w={110} dec={2} /></div>
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!d.pega_adiantamento} onChange={(e) => upd(c.id, { pega_adiantamento: e.target.checked })} style={{ accentColor: C.laranja }} />
                    Recebe adiantamento (dia 20)
                  </label>
                  {d.pega_adiantamento && <div><Lbl>Valor do adiantamento</Lbl>{num(c.id, "adiantamento", 120)}</div>}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: C.vermelho }}>
                    <input type="checkbox" checked={!!d.rescisao} onChange={(e) => upd(c.id, { rescisao: e.target.checked })} style={{ accentColor: C.vermelho }} />
                    Rescisão de contrato
                  </label>
                  {d.rescisao && <div><Lbl>Valor da rescisão</Lbl>{num(c.id, "rescisao_valor", 130)}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>
                  Adicionais: periculosidade {c.periculosidade_pct || 0}% = {fmtR(r.peric)} · insalubridade {c.insalubridade_pct || 0}% = {fmtR(r.insal)} · HE = {fmtR(r.he)} · desconto faltas = {fmtR(r.descFaltas)}{d.rescisao ? ` · rescisão = ${fmtR(r.rescisaoVal)}` : ""}. Deixe INSS/IRRF em branco para o cálculo automático.
                </div>
              </div>
            )}
          </div>
        ))}
        {linhas.length === 0 && <div style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum colaborador CLT ativo. Cadastre em “Colaboradores”.</div>}
        {linhas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1.2fr 1.2fr 0.9fr 1.2fr", gap: 6, padding: "10px", background: C.laranjaClaro, borderRadius: "0 0 8px 8px", fontWeight: 800, fontSize: 13 }}>
            <span>TOTAL ({linhas.length})</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("adicoes"))}</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("descontos"))}</span>
            <span style={{ textAlign: "center" }}>{fmt(tot("adiant"))}</span>
            <span style={{ textAlign: "right" }}>{fmt(tot("liquido"))}</span>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= ORGANOGRAMA DE CARGOS ================= */
function Organograma({ usuario, org, setOrg }) {
  const podeEditar = usuario.papel === "ceo" || usuario.papel === "diretor";
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(org)));
  const [busy, setBusy] = useState(false);
  const setSal = (setor, i, v) => setDraft((d) => { const n = JSON.parse(JSON.stringify(d)); n[setor][i].salario = v; return n; });
  const salvar = async () => { setBusy(true); try { await setConfig("rh_organograma", draft); setOrg(draft); setEdit(false); alert("Organograma salvo."); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const base = edit ? draft : org;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title="Organograma de Cargos — salários base por setor" right={podeEditar ? (edit
        ? <div style={{ display: "flex", gap: 8 }}><Btn small kind="ghost" onClick={() => { setDraft(JSON.parse(JSON.stringify(org))); setEdit(false); }}>Cancelar</Btn><Btn small disabled={busy} onClick={salvar}>{busy ? "Salvando…" : "Salvar"}</Btn></div>
        : <Btn small onClick={() => { setDraft(JSON.parse(JSON.stringify(org))); setEdit(true); }}>Editar salários</Btn>)
        : <span style={{ fontSize: 11, color: C.dim }}>Somente CEO/Diretor editam</span>}>
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 12 }}>Tabela de salários praticados (base 1º semestre). {podeEditar ? "Clique em “Editar salários” para ajustar os valores." : "Edição restrita à Diretoria."}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
          {SETORES.map((setor) => (
            <div key={setor} style={{ border: `1px solid ${C.linha}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: C.preto, color: "#fff", padding: "7px 12px", fontWeight: 800, fontSize: 12.5, textTransform: "uppercase" }}>{setor}</div>
              {(base[setor] || []).map((c, i) => (
                <div key={c.cargo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", borderBottom: `1px solid ${C.linha}`, gap: 8 }}>
                  <span style={{ fontSize: 12 }}>{c.cargo}</span>
                  {edit ? <NumInput value={c.salario} onChange={(v) => setSal(setor, i, v)} w={100} /> : <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtR(c.salario)}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
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
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Consolidação por mês do fechamento da Folha CLT.</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>{["Mês", "Colaboradores", "Total adições", "Total descontos", "Total líquido"].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: h === "Mês" || h === "Colaboradores" ? "left" : "right", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{dados.map((d) => (
          <tr key={d.mes}>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 700 }}>{mesBR(d.mes)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}>{d.n}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right" }}>{fmtR(d.bruto)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right", color: C.vermelho }}>{fmtR(d.descontos)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, textAlign: "right", fontWeight: 800 }}>{fmtR(d.liquido)}</td>
          </tr>
        ))}
        {dados.length === 0 && <tr><td colSpan={5} style={{ padding: 14, color: C.dim, fontSize: 13 }}>Nenhum fechamento salvo ainda.</td></tr>}</tbody>
      </table>
    </Card>
  );
}
