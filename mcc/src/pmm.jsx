import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, remover, acaoData } from "./core.jsx";

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
export function resumoPmm(pm, eapItens) {
  const it = (pm.itens || []).map((x) => ({ ...x, ...medItem(x, eapItens) }));
  const financeiro = sum(it.map((x) => x.financeiro));
  const baseValor = sum(it.map((x) => x.valorItem));
  const fisico = baseValor > 0 ? financeiro / baseValor : 0;
  return { it, financeiro, fisico };
}

/* ============================ Formulário do PMM (Supervisor) ============================
   v10.7 — fluxo "obra primeiro": o supervisor escolhe a obra (entre as que tem acesso) e o mês;
   só então a EAP daquela obra é carregada sob demanda (evita puxar a EAP de todas as obras de
   uma vez para quem tem várias alocadas). A EAP inteira aparece numa tabela e o avanço previsto
   pode ser lançado por QUANTIDADE (na unidade da EAP) OU por PORCENTAGEM do contratado — os dois
   campos se convertem entre si. O que já foi declarado "à medir" vem carregado e é editável. */
function FormPmm({ obras, eapPorObra, usuario, meusPmm, onSalvou }) {
  const [obra_id, setObra] = useState("");
  const [mes, setMes] = useState(isoDate(primeiroDiaMes(1)));
  const [med, setMed] = useState({});          // { [eap_codigo]: quantidade prevista a medir }
  const [observacao, setObs] = useState("");
  const [eapItens, setEapItens] = useState([]);
  const [carregandoEap, setCarregandoEap] = useState(false);
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null); const [msg, setMsg] = useState(null);
  const opcoesMes = [0, 1, 2].map((o) => isoDate(primeiroDiaMes(o)));
  const existente = meusPmm.find((p) => p.obra_id === obra_id && String(p.mes).slice(0, 10) === mes);

  // carrega a EAP da obra escolhida sob demanda (usa o cache do módulo se já estiver presente)
  useEffect(() => {
    setMsg(null); setErro(null);
    if (!obra_id) { setEapItens([]); return; }
    const cache = eapPorObra[obra_id];
    if (cache && cache.length) { setEapItens(cache); return; }
    let vivo = true; setCarregandoEap(true);
    listar("eap_itens", { obra_id }).then((r) => { if (vivo) setEapItens(r); }).catch(() => { if (vivo) setEapItens([]); }).finally(() => { if (vivo) setCarregandoEap(false); });
    return () => { vivo = false; };
  }, [obra_id]); // eslint-disable-line

  // pré-carrega o que já foi declarado para a obra+mês (editável)
  useEffect(() => {
    if (existente) { const m = {}; (existente.itens || []).forEach((x) => { if (x.eap_codigo) m[x.eap_codigo] = Number(x.producao_prevista) || 0; }); setMed(m); setObs(existente.observacao || ""); }
    else { setMed({}); setObs(""); }
  }, [obra_id, mes]); // eslint-disable-line

  const setQtd = (codigo, v) => setMed((m) => { const n = { ...m }; const q = parseFloat(v); if (!q || q <= 0) delete n[codigo]; else n[codigo] = q; return n; });
  const setPctItem = (codigo, qc, v) => setMed((m) => { const n = { ...m }; const p = parseFloat(v); if (!p || p <= 0 || !(qc > 0)) delete n[codigo]; else n[codigo] = (p / 100) * qc; return n; });

  // itens efetivamente preenchidos, no formato persistido (compatível com resumoPmm/Gestão)
  const itensPreenchidos = Object.keys(med).map((codigo) => { const e = eapItens.find((x) => x.codigo === codigo); return { eap_codigo: codigo, descricao: e?.descricao || "", unidade: e?.unidade || "", producao_prevista: med[codigo] }; });
  const res = resumoPmm({ itens: itensPreenchidos }, eapItens);
  const nPreenchidos = itensPreenchidos.length;

  const salvar = async () => {
    setBusy(true); setErro(null); setMsg(null);
    try {
      if (existente) await editar("pmm", existente.id, { itens: itensPreenchidos, observacao, atualizado_em: new Date().toISOString() });
      else await criar("pmm", { obra_id, supervisor_id: usuario.id, mes, itens: itensPreenchidos, observacao });
      setMsg("PMM salvo."); onSalvou();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const podeSalvar = obra_id && mes && nPreenchidos > 0;

  const termo = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const eapFiltrada = !termo ? eapItens : eapItens.filter((e) => `${e.codigo} ${e.descricao}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(termo));

  return (
    <Card title={`PMM · Plano de Medição Mensal${existente ? " (editando)" : ""}`}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 200 }}><Lbl>Obra</Lbl>
          <select value={obra_id} onChange={(e) => { setObra(e.target.value); setBusca(""); }} style={inp({ width: "100%" })}>
            <option value="">— selecione a obra —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}{o.nome ? ` — ${o.nome}` : ""}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 150 }}><Lbl>Mês de medição</Lbl><select value={mes} onChange={(e) => setMes(e.target.value)} style={inp({ width: "100%" })}>{opcoesMes.map((s) => <option key={s} value={s}>{labelMes(s)}</option>)}</select></div>
      </div>

      {!obra_id ? (
        <div style={{ fontSize: 13, color: C.dim, background: C.cinza, border: `1px solid ${C.linha}`, borderRadius: 8, padding: "12px 14px" }}>
          Selecione uma das suas obras acima para abrir a EAP e lançar a medição prevista do mês. A EAP é carregada apenas para a obra escolhida.
          {obras.length > 1 && <div style={{ marginTop: 6, fontSize: 12 }}>Você tem acesso a <b>{obras.length}</b> obras.</div>}
        </div>
      ) : carregandoEap ? (
        <div style={{ fontSize: 13, color: C.dim, padding: 12 }}>Carregando a EAP da obra…</div>
      ) : eapItens.length === 0 ? (
        <div style={{ fontSize: 13, color: C.dim, padding: 12 }}>Esta obra não tem itens de EAP cadastrados.</div>
      ) : (<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <Lbl>EAP da obra — lance o avanço previsto por quantidade ou por %</Lbl>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 filtrar item da EAP…" style={inp({ width: 240 })} />
        </div>
        <div style={{ border: `1px solid ${C.linha}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: C.preto, position: "sticky", top: 0, zIndex: 1 }}>
                {["Item da EAP", "Contratado", "À medir (qtde)", "% do contrato", "Medição c/BDI"].map((h, k) => <th key={h} style={{ padding: "7px 9px", fontSize: 10.5, color: "#fff", textAlign: k === 0 ? "left" : "right", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr></thead>
              <tbody>{eapFiltrada.map((e) => {
                const qc = Number(e.qtde) || 0;
                const q = med[e.codigo];
                const temValor = q > 0;
                const pctItem = temValor && qc > 0 ? (q / qc) * 100 : "";
                const fin = temValor ? (Number(e.valor_total) || 0) * (qc > 0 ? Math.min(q / qc, 1) : 0) : 0;
                return (
                  <tr key={e.id} style={{ background: temValor ? C.laranjaClaro : "#fff" }}>
                    <td style={{ padding: "5px 9px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>
                      <b style={{ color: C.preto }}>{e.codigo}</b> <span style={{ color: C.texto }}>{String(e.descricao || "").slice(0, 60)}</span>
                      {e.nao_descrito ? <span style={{ marginLeft: 5, background: C.amareloAlerta, color: "#fff", fontSize: 8.5, fontWeight: 800, borderRadius: 4, padding: "1px 4px" }}>ND</span> : null}
                    </td>
                    <td style={{ padding: "5px 9px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, textAlign: "right", whiteSpace: "nowrap", color: C.dim }}>{fmt(qc)} {e.unidade}</td>
                    <td style={{ padding: "5px 9px", borderBottom: `1px solid ${C.linha}`, textAlign: "right", whiteSpace: "nowrap" }}>
                      <input type="number" min="0" step="0.01" value={temValor ? q : ""} onChange={(ev) => setQtd(e.codigo, ev.target.value)} placeholder="0" style={inp({ width: 92, textAlign: "right", boxSizing: "border-box", ...(temValor ? { borderColor: C.laranja, background: "#fff" } : {}) })} /> <span style={{ fontSize: 11, color: C.dim }}>{e.unidade}</span>
                    </td>
                    <td style={{ padding: "5px 9px", borderBottom: `1px solid ${C.linha}`, textAlign: "right", whiteSpace: "nowrap" }}>
                      <input type="number" min="0" max="100" step="0.1" value={pctItem === "" ? "" : Math.round(pctItem * 100) / 100} onChange={(ev) => setPctItem(e.codigo, qc, ev.target.value)} disabled={!(qc > 0)} placeholder={qc > 0 ? "0" : "—"} style={inp({ width: 74, textAlign: "right", boxSizing: "border-box", ...(temValor ? { borderColor: C.laranja, background: "#fff" } : {}) })} /> <span style={{ fontSize: 11, color: C.dim }}>%</span>
                    </td>
                    <td style={{ padding: "5px 9px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, textAlign: "right", whiteSpace: "nowrap", color: temValor ? C.laranja : C.dim, fontWeight: temValor ? 700 : 400 }}>{temValor ? fmtR(fin) : "—"}</td>
                  </tr>
                );
              })}
              {eapFiltrada.length === 0 && <tr><td colSpan={5} style={{ padding: 12, fontSize: 12, color: C.dim }}>Nenhum item da EAP corresponde ao filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, margin: "10px 0", fontSize: 13, flexWrap: "wrap" }}>
          <div><b>{nPreenchidos}</b> de {eapItens.length} itens com medição prevista</div>
          <div>Avanço físico previsto no mês: <b style={{ color: C.laranja }}>{pct(res.fisico)}</b></div>
          <div>Medição prevista (c/ BDI): <b style={{ color: C.laranja }}>{fmtR(res.financeiro)}</b></div>
        </div>
      </>)}

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
function GestaoPmm({ pmmLista, obras, eapPorObra, colaboradores, podeGerir, onMudou }) {
  const [mesSel, setMesSel] = useState("todos");
  const [edit, setEdit] = useState(null);
  const excluir = async (p) => { if (!confirm("Excluir este PMM? O prazo de envio volta a contar para o supervisor deste mês.")) return; try { await remover("pmm", p.id); onMudou && onMudou(); } catch (e) { alert(e.message); } };
  const abrirEdit = (p) => { setEdit({ id: p.id, observacao: p.observacao || "", itens: (p.itens || []).map((f) => ({ ...f })) }); };
  const salvarEdit = async () => { try { await editar("pmm", edit.id, { observacao: edit.observacao, itens: edit.itens }); setEdit(null); onMudou && onMudou(); } catch (e) { alert(e.message); } };
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
            <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}`, whiteSpace: "nowrap" }}>
              <button onClick={() => setAberto(aberto === p.id ? null : p.id)} style={{ background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.dim }}>{aberto === p.id ? "▲" : "▼"}</button>
              {podeGerir && <>
                <button onClick={() => abrirEdit(p)} style={{ marginLeft: 6, background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.azul }}>Editar</button>
                <button onClick={() => excluir(p)} style={{ marginLeft: 6, background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.vermelho }}>Excluir</button>
              </>}
            </td>
          </tr>
          {(aberto === p.id || edit?.id === p.id) && <tr><td colSpan={7} style={{ padding: "8px 12px", background: "#fafafa", borderBottom: `1px solid ${C.linha}` }}>
            {edit?.id === p.id ? (
              <div>
                <Lbl>Observação</Lbl><textarea rows={2} value={edit.observacao} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical", marginBottom: 8 })} />
                <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={hsub}>Item EAP</th><th style={hsub}>Medição prevista</th></tr></thead>
                  <tbody>{edit.itens.map((f, i) => <tr key={i}><td style={tsub}><b>{f.eap_codigo}</b> {String(f.descricao || "").slice(0, 32)}</td>
                    <td style={tsub}><input type="number" step="0.01" value={f.producao_prevista || ""} onChange={(e) => setEdit({ ...edit, itens: edit.itens.map((x, j) => j === i ? { ...x, producao_prevista: parseFloat(e.target.value) || 0 } : x) })} style={inp({ width: 110, boxSizing: "border-box", textAlign: "right" })} /> {f.unidade}</td></tr>)}</tbody>
                </table>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}><Btn small onClick={salvarEdit}>Salvar alterações</Btn><Btn small kind="ghost" onClick={() => setEdit(null)}>Cancelar</Btn></div>
              </div>
            ) : (<>
              {p.observacao && <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic", marginBottom: 6 }}>{p.observacao}</div>}
              <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={hsub}>Item EAP</th><th style={hsub}>Medição prevista</th><th style={hsub}>Avanço</th><th style={hsub}>Medição c/BDI</th></tr></thead>
                <tbody>{p.it.map((f, i) => <tr key={i}><td style={tsub}><b>{f.eap_codigo}</b> {String(f.descricao || "").slice(0, 36)}</td><td style={tsub}>{fmt(f.producao_prevista)} {f.unidade}</td><td style={tsub}>{pct(f.pct)}</td><td style={tsub}>{fmtR(f.financeiro)}</td></tr>)}</tbody>
              </table>
            </>)}
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
export function Pmm({ usuario, obras, eapPorObra, colaboradores = [], acesso, onMudou }) {
  const [lista, setLista] = useState([]); const [pronto, setPronto] = useState(false);
  const [comp, setComp] = useState(null);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const podeCriar = acesso?.pmm_criar ?? ehSup;
  const gestao = acesso?.pmm_gestao ?? (p === "coord_obras" || p === "coord_planejamento" || p === "ceo" || p === "diretor");

  const carregar = () => listar("pmm").then((r) => { setLista(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando PMM…</div>;

  const meusPmm = lista.filter((x) => x.supervisor_id === usuario.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ehSup && <AvisoPmm onState={setComp} />}
      {podeCriar && !(ehSup && comp?.travado) && <FormPmm obras={obras} eapPorObra={eapPorObra} usuario={usuario} meusPmm={meusPmm} onSalvou={carregar} />}
      {gestao && <GestaoPmm pmmLista={lista} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} podeGerir={p === "coord_planejamento" || p === "ceo" || p === "diretor"} onMudou={carregar} />}
      {!podeCriar && !gestao && <Card title="PMM"><div style={{ fontSize: 13, color: C.dim }}>O PMM é preenchido pelo Supervisor de Obras e acompanhado pelo Coordenador de Obras e Diretoria.</div></Card>}
    </div>
  );
}
