import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, acaoData } from "./core.jsx";

const mondayOf = (d) => { const x = new Date(d); const dia = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dia); x.setHours(0, 0, 0, 0); return x; };
const proximaSegunda = (off = 1) => { const m = mondayOf(new Date()); m.setDate(m.getDate() + 7 * off); return m; };
const isoDate = (d) => d.toISOString().slice(0, 10);
const labelSemana = (iso) => { const a = new Date(String(iso).slice(0, 10) + "T00:00:00"); const b = new Date(a); b.setDate(b.getDate() + 6); return `${dataBR(isoDate(a))} a ${dataBR(isoDate(b))}`; };

/* avanço de uma frente do POS a partir da EAP da obra */
function avancoFrente(fr, eapItens) {
  const it = eapItens.find((e) => e.codigo === fr.eap_codigo);
  const qc = Number(it?.qtde) || 0;
  const prod = Number(fr.producao_planejada) || 0;
  const p = qc > 0 ? Math.min(prod / qc, 1) : 0;
  const valorItem = Number(it?.valor_total) || 0;   // valor contratado COM BDI
  return { pct: p, financeiro: valorItem * p, valorItem };
}
function resumoPos(po, eapItens) {
  const fr = (po.frentes || []).map((f) => ({ ...f, ...avancoFrente(f, eapItens) }));
  const financeiro = sum(fr.map((f) => f.financeiro));
  const baseValor = sum(fr.map((f) => f.valorItem));
  const fisico = baseValor > 0 ? financeiro / baseValor : 0;   // avanço físico ponderado pelo valor
  return { fr, financeiro, fisico };
}

/* ============================ Formulário do POS (Supervisor) ============================ */
function FormPos({ obras, eapPorObra, usuario, meusPos, onSalvou }) {
  const [obra_id, setObra] = useState(obras[0]?.id || "");
  const [semana, setSemana] = useState(isoDate(proximaSegunda(1)));
  const [frentes, setFrentes] = useState([]);
  const [observacao, setObs] = useState("");
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null); const [msg, setMsg] = useState(null);
  const eapItens = eapPorObra[obra_id] || [];
  const opcoesSemana = [1, 2, 3].map((o) => isoDate(proximaSegunda(o)));
  const existente = meusPos.find((p) => p.obra_id === obra_id && String(p.semana).slice(0, 10) === semana);

  useEffect(() => { if (existente) { setFrentes(existente.frentes || []); setObs(existente.observacao || ""); } else { setFrentes([]); setObs(""); } }, [obra_id, semana]); // eslint-disable-line

  const addFrente = () => setFrentes((f) => [...f, { eap_codigo: "", descricao: "", equipe: "", producao_planejada: 0, unidade: "" }]);
  const upFrente = (i, patch) => setFrentes((f) => f.map((x, j) => j === i ? { ...x, ...patch } : x));
  const delFrente = (i) => setFrentes((f) => f.filter((_, j) => j !== i));
  const escolherEap = (i, codigo) => { const it = eapItens.find((e) => e.codigo === codigo); upFrente(i, { eap_codigo: codigo, descricao: it?.descricao || "", unidade: it?.unidade || "" }); };

  const salvar = async () => {
    setBusy(true); setErro(null); setMsg(null);
    try {
      if (existente) await editar("pos", existente.id, { frentes, observacao, atualizado_em: new Date().toISOString() });
      else await criar("pos", { obra_id, supervisor_id: usuario.id, semana, frentes, observacao });
      setMsg("POS salvo."); onSalvou();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const podeSalvar = obra_id && semana && frentes.length > 0 && frentes.every((f) => f.eap_codigo && f.equipe && Number(f.producao_planejada) > 0);
  const res = resumoPos({ frentes }, eapItens);

  return (
    <Card title={`POS · Plano Operacional Semanal${existente ? " (editando)" : ""}`}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 160 }}><Lbl>Obra</Lbl><select value={obra_id} onChange={(e) => setObra(e.target.value)} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
        <div style={{ minWidth: 230 }}><Lbl>Semana de planejamento</Lbl><select value={semana} onChange={(e) => setSemana(e.target.value)} style={inp({ width: "100%" })}>{opcoesSemana.map((s) => <option key={s} value={s}>{labelSemana(s)}</option>)}</select></div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Lbl>Frentes de trabalho (itens da EAP) planejadas para a semana</Lbl>
        {!obra_id ? <div style={{ fontSize: 12, color: C.dim }}>Selecione a obra.</div> : <>
          {frentes.map((f, i) => {
            const av = avancoFrente(f, eapItens);
            const it = eapItens.find((e) => e.codigo === f.eap_codigo);
            return (
              <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 8, padding: 10, marginBottom: 8, background: "#fafafa" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 200 }}><Lbl>Item da EAP (frente)</Lbl>
                    <select value={f.eap_codigo} onChange={(e) => escolherEap(i, e.target.value)} style={inp({ width: "100%" })}>
                      <option value="">— selecione —</option>
                      {eapItens.map((e) => <option key={e.id} value={e.codigo}>{e.codigo} — {String(e.descricao || "").slice(0, 45)}</option>)}
                    </select>
                  </div>
                  <div style={{ minWidth: 130 }}><Lbl>Equipe</Lbl><input value={f.equipe} onChange={(e) => upFrente(i, { equipe: e.target.value })} placeholder="ex.: Equipe A / 5 oper." style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <div style={{ width: 110 }}><Lbl>Produção planej.</Lbl><input type="number" min="0" step="0.01" value={f.producao_planejada} onChange={(e) => upFrente(i, { producao_planejada: parseFloat(e.target.value) || 0 })} style={inp({ width: "100%", textAlign: "right", boxSizing: "border-box" })} /></div>
                  <div style={{ width: 60 }}><Lbl>Unid.</Lbl><input value={f.unidade} onChange={(e) => upFrente(i, { unidade: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <button onClick={() => delFrente(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, paddingBottom: 6 }}>✕</button>
                </div>
                {f.eap_codigo && <div style={{ fontSize: 11, marginTop: 6, color: C.dim }}>Contratado: <b>{fmt(it?.qtde)} {it?.unidade}</b> · avanço planejado da semana: <b style={{ color: C.laranja }}>{pct(av.pct)}</b> · financeiro c/BDI: <b style={{ color: C.laranja }}>{fmtR(av.financeiro)}</b></div>}
              </div>
            );
          })}
          <Btn small kind="ghost" onClick={addFrente}>+ Adicionar frente</Btn>
        </>}
      </div>

      {frentes.length > 0 && <div style={{ display: "flex", gap: 16, margin: "10px 0", fontSize: 13 }}>
        <div>Avanço físico planejado da semana: <b style={{ color: C.laranja }}>{pct(res.fisico)}</b></div>
        <div>Avanço financeiro (c/ BDI): <b style={{ color: C.laranja }}>{fmtR(res.financeiro)}</b></div>
      </div>}
      <div style={{ marginBottom: 12 }}><Lbl>Observações</Lbl><textarea value={observacao} onChange={(e) => setObs(e.target.value)} rows={2} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      {msg && <div style={{ color: C.verde, fontSize: 12, marginBottom: 8, fontWeight: 700 }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small disabled={busy || !podeSalvar} onClick={salvar}>{existente ? "Atualizar POS" : "Salvar POS"}</Btn></div>
    </Card>
  );
}

/* aviso de prazo + travamento (sexta-feira + 24h) */
function AvisoPos({ onState }) {
  const [c, setC] = useState(null);
  useEffect(() => { acaoData({ t: "pos_compliance" }).then((d) => { setC(d); onState && onState(d); }).catch(() => {}); }, []);
  if (!c) return null;
  if (c.travado) return (
    <div style={{ background: C.vermelho, color: "#fff", borderRadius: 10, padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🔒 Acesso bloqueado por falta do POS</div>
      <div style={{ fontSize: 13, opacity: 0.95 }}>O POS da semana {labelSemana(c.semana)} não foi preenchido até sexta-feira + 24h. Procure seu Coordenador de Planejamento para alinhar e liberar o acesso.</div>
    </div>
  );
  if (c.preenchido) return <div style={{ background: `${C.verde}12`, border: `1px solid ${C.verde}55`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: C.verde, fontWeight: 700 }}>✓ POS da semana {labelSemana(c.semana)} preenchido.</div>;
  return <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}66`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.texto }}><b style={{ color: C.vermelho }}>⚠ {c.atrasado ? "POS em atraso!" : "Prazo do POS"}</b> — preencha o POS da semana <b>{labelSemana(c.semana)}</b> até <b>sexta-feira</b>. O atraso por mais de 24h bloqueia seu acesso e aciona o Coordenador de Planejamento.</div>;
}

/* ============================ Gestão do POS (Coord. Planejamento / Diretoria) ============================ */
function GestaoPos({ posLista, obras, eapPorObra, colaboradores }) {
  const [semanaSel, setSemanaSel] = useState("todas");
  const semanas = [...new Set(posLista.map((p) => String(p.semana).slice(0, 10)))].sort().reverse();
  const lista = (semanaSel === "todas" ? posLista : posLista.filter((p) => String(p.semana).slice(0, 10) === semanaSel))
    .map((p) => ({ ...p, ...resumoPos(p, eapPorObra[p.obra_id] || []) }));
  const totFin = sum(lista.map((p) => p.financeiro));
  const nome = (id) => colaboradores.find((c) => c.id === id)?.nome || "—";
  const codObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const [aberto, setAberto] = useState(null);

  return (
    <Card title="Gestão dos POS — avanço físico e financeiro planejado" right={<span style={{ fontSize: 12, color: C.dim }}>{lista.length} POS · {fmtR(totFin)}</span>}>
      <div style={{ marginBottom: 10 }}>
        <select value={semanaSel} onChange={(e) => setSemanaSel(e.target.value)} style={inp({ width: 280 })}>
          <option value="todas">Todas as semanas</option>
          {semanas.map((s) => <option key={s} value={s}>{labelSemana(s)}</option>)}
        </select>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.preto }}>{["Obra", "Semana", "Supervisor", "Frentes", "Avanço físico", "Avanço financeiro (c/BDI)", ""].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{lista.map((p) => <React.Fragment key={p.id}>
          <tr>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{codObra(p.obra_id)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{labelSemana(p.semana)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{nome(p.supervisor_id)}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>{(p.frentes || []).length}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, color: C.laranja, fontWeight: 700 }}>{pct(p.fisico)}</td>
            <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, color: C.laranja, fontWeight: 700 }}>{fmtR(p.financeiro)}</td>
            <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}` }}><button onClick={() => setAberto(aberto === p.id ? null : p.id)} style={{ background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.dim }}>{aberto === p.id ? "▲" : "▼"}</button></td>
          </tr>
          {aberto === p.id && <tr><td colSpan={7} style={{ padding: "8px 12px", background: "#fafafa", borderBottom: `1px solid ${C.linha}` }}>
            {p.observacao && <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic", marginBottom: 6 }}>{p.observacao}</div>}
            <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={hsub}>Item EAP</th><th style={hsub}>Equipe</th><th style={hsub}>Produção planej.</th><th style={hsub}>Avanço</th><th style={hsub}>Financeiro</th></tr></thead>
              <tbody>{p.fr.map((f, i) => <tr key={i}><td style={tsub}><b>{f.eap_codigo}</b> {String(f.descricao || "").slice(0, 32)}</td><td style={tsub}>{f.equipe}</td><td style={tsub}>{fmt(f.producao_planejada)} {f.unidade}</td><td style={tsub}>{pct(f.pct)}</td><td style={tsub}>{fmtR(f.financeiro)}</td></tr>)}</tbody>
            </table>
          </td></tr>}
        </React.Fragment>)}
        {lista.length === 0 && <tr><td colSpan={7} style={{ padding: 12, color: C.dim, fontSize: 13 }}>Nenhum POS no período.</td></tr>}</tbody>
      </table></div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>Avanço físico = avanço planejado ponderado pelo valor dos itens. Financeiro = valor contratado com BDI × % de avanço planejado de cada item.</div>
    </Card>
  );
}
const hsub = { padding: "5px 8px", fontSize: 10.5, color: C.dim, textAlign: "left", textTransform: "uppercase", borderBottom: `1px solid ${C.linha}` };
const tsub = { padding: "5px 8px", fontSize: 12, borderBottom: `1px solid ${C.linha}` };

/* ============================ Módulo POS ============================ */
export function Pos({ usuario, obras, eapPorObra, colaboradores = [], onMudou }) {
  const [posLista, setPosLista] = useState([]); const [pronto, setPronto] = useState(false);
  const [comp, setComp] = useState(null);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const gestao = p === "coord_planejamento" || p === "ceo" || p === "diretor";

  const carregar = () => listar("pos").then((r) => { setPosLista(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando POS…</div>;

  const meusPos = posLista.filter((x) => x.supervisor_id === usuario.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ehSup && <AvisoPos onState={setComp} />}
      {ehSup && !comp?.travado && <FormPos obras={obras} eapPorObra={eapPorObra} usuario={usuario} meusPos={meusPos} onSalvou={carregar} />}
      {gestao && <GestaoPos posLista={posLista} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} />}
      {!ehSup && !gestao && <Card title="POS"><div style={{ fontSize: 13, color: C.dim }}>O POS é preenchido pelo Supervisor de Obras e acompanhado pelo Coordenador de Planejamento e Diretoria.</div></Card>}
    </div>
  );
}
