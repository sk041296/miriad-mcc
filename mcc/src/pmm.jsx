import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, acaoData } from "./core.jsx";

const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const primeiroDiaMes = (off = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + off, 1); };
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const labelMes = (iso) => { const [y, m] = String(iso).slice(0, 10).split("-"); return `${MES_ABBR[Number(m) - 1]}/${y}`; };

/* medição prevista de um item do PMM a partir da EAP */
function medItem(it, eapItens) {
  const e = eapItens.find((x) => x.codigo === it.eap_codigo);
  const qc = Number(e?.qtde) || 0;
  const prev = Number(it.producao_prevista) || 0;
  const p = qc > 0 ? Math.min(prev / qc, 1) : 0;
  const valorItem = Number(e?.valor_total) || 0;   // valor contratado COM BDI
  return { pct: p, financeiro: valorItem * p, valorItem };
}
function resumoPmm(pm, eapItens) {
  const it = (pm.itens || []).map((x) => ({ ...x, ...medItem(x, eapItens) }));
  const financeiro = sum(it.map((x) => x.financeiro));
  const baseValor = sum(it.map((x) => x.valorItem));
  const fisico = baseValor > 0 ? financeiro / baseValor : 0;
  return { it, financeiro, fisico };
}

/* ============================ Formulário do PMM (Supervisor) ============================ */
function FormPmm({ obras, eapPorObra, usuario, meusPmm, onSalvou }) {
  const [obra_id, setObra] = useState(obras[0]?.id || "");
  const [mes, setMes] = useState(isoDate(primeiroDiaMes(1)));
  const [itens, setItens] = useState([]);
  const [observacao, setObs] = useState("");
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null); const [msg, setMsg] = useState(null);
  const eapItens = eapPorObra[obra_id] || [];
  const opcoesMes = [0, 1, 2].map((o) => isoDate(primeiroDiaMes(o)));
  const existente = meusPmm.find((p) => p.obra_id === obra_id && String(p.mes).slice(0, 10) === mes);

  useEffect(() => { if (existente) { setItens(existente.itens || []); setObs(existente.observacao || ""); } else { setItens([]); setObs(""); } }, [obra_id, mes]); // eslint-disable-line

  const add = () => setItens((f) => [...f, { eap_codigo: "", descricao: "", producao_prevista: 0, unidade: "" }]);
  const up = (i, patch) => setItens((f) => f.map((x, j) => j === i ? { ...x, ...patch } : x));
  const del = (i) => setItens((f) => f.filter((_, j) => j !== i));
  const escolherEap = (i, codigo) => { const it = eapItens.find((e) => e.codigo === codigo); up(i, { eap_codigo: codigo, descricao: it?.descricao || "", unidade: it?.unidade || "" }); };

  const salvar = async () => {
    setBusy(true); setErro(null); setMsg(null);
    try {
      if (existente) await editar("pmm", existente.id, { itens, observacao, atualizado_em: new Date().toISOString() });
      else await criar("pmm", { obra_id, supervisor_id: usuario.id, mes, itens, observacao });
      setMsg("PMM salvo."); onSalvou();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const podeSalvar = obra_id && mes && itens.length > 0 && itens.every((x) => x.eap_codigo && Number(x.producao_prevista) > 0);
  const res = resumoPmm({ itens }, eapItens);

  return (
    <Card title={`PMM · Plano de Medição Mensal${existente ? " (editando)" : ""}`}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 160 }}><Lbl>Obra</Lbl><select value={obra_id} onChange={(e) => setObra(e.target.value)} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
        <div style={{ minWidth: 150 }}><Lbl>Mês de medição</Lbl><select value={mes} onChange={(e) => setMes(e.target.value)} style={inp({ width: "100%" })}>{opcoesMes.map((s) => <option key={s} value={s}>{labelMes(s)}</option>)}</select></div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Lbl>Itens da EAP com medição prevista para o mês</Lbl>
        {!obra_id ? <div style={{ fontSize: 12, color: C.dim }}>Selecione a obra.</div> : <>
          {itens.map((f, i) => {
            const av = medItem(f, eapItens);
            const it = eapItens.find((e) => e.codigo === f.eap_codigo);
            return (
              <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 8, padding: 10, marginBottom: 8, background: "#fafafa" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 220 }}><Lbl>Item da EAP</Lbl>
                    <select value={f.eap_codigo} onChange={(e) => escolherEap(i, e.target.value)} style={inp({ width: "100%" })}>
                      <option value="">— selecione —</option>
                      {eapItens.map((e) => <option key={e.id} value={e.codigo}>{e.codigo} — {String(e.descricao || "").slice(0, 45)}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 120 }}><Lbl>Medição prevista</Lbl><input type="number" min="0" step="0.01" value={f.producao_prevista} onChange={(e) => up(i, { producao_prevista: parseFloat(e.target.value) || 0 })} style={inp({ width: "100%", textAlign: "right", boxSizing: "border-box" })} /></div>
                  <div style={{ width: 60 }}><Lbl>Unid.</Lbl><input value={f.unidade} onChange={(e) => up(i, { unidade: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <button onClick={() => del(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, paddingBottom: 6 }}>✕</button>
                </div>
                {f.eap_codigo && <div style={{ fontSize: 11, marginTop: 6, color: C.dim }}>Contratado: <b>{fmt(it?.qtde)} {it?.unidade}</b> · avanço do mês: <b style={{ color: C.laranja }}>{pct(av.pct)}</b> · medição c/BDI: <b style={{ color: C.laranja }}>{fmtR(av.financeiro)}</b></div>}
              </div>
            );
          })}
          <Btn small kind="ghost" onClick={add}>+ Adicionar item</Btn>
        </>}
      </div>

      {itens.length > 0 && <div style={{ display: "flex", gap: 16, margin: "10px 0", fontSize: 13 }}>
        <div>Avanço físico previsto no mês: <b style={{ color: C.laranja }}>{pct(res.fisico)}</b></div>
        <div>Medição prevista (c/ BDI): <b style={{ color: C.laranja }}>{fmtR(res.financeiro)}</b></div>
      </div>}
      <div style={{ marginBottom: 12 }}><Lbl>Observações</Lbl><textarea value={observacao} onChange={(e) => setObs(e.target.value)} rows={2} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      {msg && <div style={{ color: C.verde, fontSize: 12, marginBottom: 8, fontWeight: 700 }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small disabled={busy || !podeSalvar} onClick={salvar}>{existente ? "Atualizar PMM" : "Salvar PMM"}</Btn></div>
    </Card>
  );
}

/* aviso de prazo + travamento (dia 25 + 24h) */
function AvisoPmm({ onState }) {
  const [c, setC] = useState(null);
  useEffect(() => { acaoData({ t: "pmm_compliance" }).then((d) => { setC(d); onState && onState(d); }).catch(() => {}); }, []);
  if (!c) return null;
  if (c.travado) return (
    <div style={{ background: C.vermelho, color: "#fff", borderRadius: 10, padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🔒 Acesso bloqueado por falta do PMM</div>
      <div style={{ fontSize: 13, opacity: 0.95 }}>O PMM de {labelMes(c.mes)} não foi preenchido até o dia 25 + 24h. Procure seu Coordenador de Obras para alinhar e liberar o acesso.</div>
    </div>
  );
  if (c.preenchido) return <div style={{ background: `${C.verde}12`, border: `1px solid ${C.verde}55`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: C.verde, fontWeight: 700 }}>✓ PMM de {labelMes(c.mes)} preenchido.</div>;
  return <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}66`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.texto }}><b style={{ color: C.vermelho }}>⚠ {c.atrasado ? "PMM em atraso!" : "Prazo do PMM"}</b> — preencha o PMM de <b>{labelMes(c.mes)}</b> até o <b>dia 25</b>. O atraso por mais de 24h bloqueia seu acesso e aciona o Coordenador de Obras.</div>;
}

/* ============================ Gestão do PMM (Coord. de Obras / Diretoria) ============================ */
function GestaoPmm({ pmmLista, obras, eapPorObra, colaboradores }) {
  const [mesSel, setMesSel] = useState("todos");
  const meses = [...new Set(pmmLista.map((p) => String(p.mes).slice(0, 10)))].sort().reverse();
  const lista = (mesSel === "todos" ? pmmLista : pmmLista.filter((p) => String(p.mes).slice(0, 10) === mesSel))
    .map((p) => ({ ...p, ...resumoPmm(p, eapPorObra[p.obra_id] || []) }));
  const totFin = sum(lista.map((p) => p.financeiro));
  const nome = (id) => colaboradores.find((c) => c.id === id)?.nome || "—";
  const codObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const [aberto, setAberto] = useState(null);

  return (
    <Card title="Gestão dos PMM — medição mensal prevista" right={<span style={{ fontSize: 12, color: C.dim }}>{lista.length} PMM · {fmtR(totFin)}</span>}>
      <div style={{ marginBottom: 10 }}>
        <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} style={inp({ width: 220 })}>
          <option value="todos">Todos os meses</option>
          {meses.map((s) => <option key={s} value={s}>{labelMes(s)}</option>)}
        </select>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>{["Obra", "Mês", "Supervisor", "Itens", "Avanço físico", "Medição prevista (c/BDI)", ""].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{lista.map((p) => <React.Fragment key={p.id}>
          <tr>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{codObra(p.obra_id)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{labelMes(p.mes)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{nome(p.supervisor_id)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{(p.itens || []).length}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, color: C.laranja, fontWeight: 700 }}>{pct(p.fisico)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, color: C.laranja, fontWeight: 700 }}>{fmtR(p.financeiro)}</td>
            <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}` }}><button onClick={() => setAberto(aberto === p.id ? null : p.id)} style={{ background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.dim }}>{aberto === p.id ? "▲" : "▼"}</button></td>
          </tr>
          {aberto === p.id && <tr><td colSpan={7} style={{ padding: "8px 12px", background: "#fafafa", borderBottom: `1px solid ${C.linha}` }}>
            {p.observacao && <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic", marginBottom: 6 }}>{p.observacao}</div>}
            <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={hsub}>Item EAP</th><th style={hsub}>Medição prevista</th><th style={hsub}>Avanço</th><th style={hsub}>Medição c/BDI</th></tr></thead>
              <tbody>{p.it.map((f, i) => <tr key={i}><td style={tsub}><b>{f.eap_codigo}</b> {String(f.descricao || "").slice(0, 36)}</td><td style={tsub}>{fmt(f.producao_prevista)} {f.unidade}</td><td style={tsub}>{pct(f.pct)}</td><td style={tsub}>{fmtR(f.financeiro)}</td></tr>)}</tbody>
            </table>
          </td></tr>}
        </React.Fragment>)}
        {lista.length === 0 && <tr><td colSpan={7} style={{ padding: 12, color: C.dim, fontSize: 13 }}>Nenhum PMM no período.</td></tr>}</tbody>
      </table></div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>Medição prevista = valor contratado com BDI × % de avanço previsto de cada item da EAP no mês. Esses dados alimentam a Medição projetada do Financeiro (v8.2).</div>
    </Card>
  );
}
const hsub = { padding: "5px 8px", fontSize: 10.5, color: C.dim, textAlign: "left", textTransform: "uppercase", borderBottom: `1px solid ${C.linha}` };
const tsub = { padding: "5px 8px", fontSize: 12, borderBottom: `1px solid ${C.linha}` };

/* ============================ Módulo PMM ============================ */
export function Pmm({ usuario, obras, eapPorObra, colaboradores = [], onMudou }) {
  const [lista, setLista] = useState([]); const [pronto, setPronto] = useState(false);
  const [comp, setComp] = useState(null);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const gestao = p === "coord_obras" || p === "ceo" || p === "diretor";

  const carregar = () => listar("pmm").then((r) => { setLista(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando PMM…</div>;

  const meusPmm = lista.filter((x) => x.supervisor_id === usuario.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ehSup && <AvisoPmm onState={setComp} />}
      {ehSup && !comp?.travado && <FormPmm obras={obras} eapPorObra={eapPorObra} usuario={usuario} meusPmm={meusPmm} onSalvou={carregar} />}
      {gestao && <GestaoPmm pmmLista={lista} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} />}
      {!ehSup && !gestao && <Card title="PMM"><div style={{ fontSize: 13, color: C.dim }}>O PMM é preenchido pelo Supervisor de Obras e acompanhado pelo Coordenador de Obras e Diretoria.</div></Card>}
    </div>
  );
}
