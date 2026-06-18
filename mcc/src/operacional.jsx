import React, { useState, useEffect, useMemo, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import * as XLSX from "xlsx";
import {
  C, fmt, fmtR, fmtK, pct, sum, uid, norm, hojeISO, dataBR, CLIMAS, ATRIBUICOES,
  Card, Btn, Kpi, Th, Td, Lbl, inp, NumInput, ChartTip,
  listar, criar, criarObraComEap, criarRdoCompleto, editar, remover, parseEapApi,
} from "./core.jsx";
import { gerarPdfRdo } from "./pdf.js";
import { observacoesPorItem, projecaoItem } from "./produtividade.js";

const OP_TABS = [["rdo", "RDO-i"], ["rso", "RSO-i · Serviços"], ["oc", "OC-i · Materiais"], ["eap", "EAP & Custos"], ["obras", "Obras"]];

export function ModuloOperacional({ usuario }) {
  const [sub, setSub] = useState("rdo");
  const [obras, setObras] = useState([]);
  const [eapPorObra, setEapPorObra] = useState({});
  const [rdos, setRdos] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [ocs, setOcs] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [restricoes, setRestricoes] = useState([]);
  const [pronto, setPronto] = useState(false);

  const carregar = async () => {
    const [ob, ct, oc, fu] = await Promise.all([listar("obras"), listar("contratos_servico"), listar("ordens_compra"), listar("funcionarios")]);
    setObras(ob); setContratos(ct); setOcs(oc); setFuncionarios(fu);
    const eaps = {}, rd = [], rt = [];
    await Promise.all(ob.map(async (o) => {
      eaps[o.id] = await listar("eap_itens", { obra_id: o.id });
      (await listar("rdos", { obra_id: o.id })).forEach((r) => rd.push(r));
      (await listar("restricoes_material", { obra_id: o.id })).forEach((x) => rt.push(x));
    }));
    setEapPorObra(eaps); setRdos(rd); setRestricoes(rt); setPronto(true);
  };
  useEffect(() => { carregar(); }, []);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando dados operacionais…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {OP_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ background: sub === id ? C.preto : C.branco, color: sub === id ? "#fff" : C.dim, border: `1px solid ${sub === id ? C.preto : C.linha}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {sub === "rdo" && <RdoI usuario={usuario} obras={obras} eapPorObra={eapPorObra} rdos={rdos} funcionarios={funcionarios} contratos={contratos} onMudou={carregar} />}
      {sub === "rso" && <RsoI obras={obras} eapPorObra={eapPorObra} contratos={contratos} funcionarios={funcionarios} onMudou={carregar} />}
      {sub === "oc" && <OcI obras={obras} eapPorObra={eapPorObra} ocs={ocs} restricoes={restricoes} onMudou={carregar} />}
      {sub === "eap" && <EapCustos obras={obras} eapPorObra={eapPorObra} ocs={ocs} rdos={rdos} onMudou={carregar} />}
      {sub === "obras" && <Obras obras={obras} eapPorObra={eapPorObra} onMudou={carregar} />}
    </div>
  );
}

/* ============================ RDO-i ============================ */
function ComboEap({ itens, valor, onSelect, placeholder }) {
  const [busca, setBusca] = useState(""); const [aberto, setAberto] = useState(false);
  const sel = itens.find((i) => i.id === valor || i.codigo === valor);
  const filtrados = useMemo(() => { const q = norm(busca); return itens.filter((i) => !q || norm(`${i.codigo} ${i.descricao} ${i.disciplina || ""}`).includes(q)).slice(0, 16); }, [busca, itens]);
  return (
    <div style={{ position: "relative" }}>
      <input value={aberto ? busca : sel ? `${sel.codigo} — ${sel.descricao}` : ""} placeholder={placeholder || "Buscar item da EAP…"}
        onFocus={() => { setAberto(true); setBusca(""); }} onBlur={() => setTimeout(() => setAberto(false), 180)} onChange={(e) => setBusca(e.target.value)}
        style={inp({ width: "100%", boxSizing: "border-box", fontWeight: sel ? 600 : 400 })} />
      {aberto && <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: C.branco, border: `1.5px solid ${C.laranja}`, borderRadius: 8, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
        {filtrados.map((i) => <div key={i.id} onMouseDown={() => { onSelect(i); setAberto(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.linha}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.laranjaClaro)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{i.codigo} — {i.descricao}</div>
          <div style={{ fontSize: 11, color: C.dim }}>{i.unidade} · contratado {fmt(i.qtde)} · {i.ambiente === "externo" ? "🌦️ externo" : "interno"}</div>
        </div>)}
        {filtrados.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.dim }}>Nenhum item encontrado.</div>}
      </div>}
    </div>
  );
}

const DRAFT = "mcc_rdo_draft_v1";
function RdoI({ usuario, obras, eapPorObra, rdos, funcionarios, contratos, onMudou }) {
  const novaAtv = () => ({ k: uid(), eapId: "", qtde: 0, comentarios: "", funcionarioIds: [] });
  const novaRestr = () => ({ k: uid(), eapId: "", material: "", dataSolicitacao: hojeISO() });
  const vazio = (obraId) => ({ obraId: obraId || obras[0]?.id || "", numero: "", data: hojeISO(), clima: CLIMAS[0], efetivo: 0, ocorrencias: "", comentarios: "", atividades: [novaAtv()], equipe: [], restricoes: [] });
  const [form, setForm] = useState(() => { try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d?.atividades) return d; } catch {} return vazio(); });
  const [salvando, setSalvando] = useState(false); const [msg, setMsg] = useState(null);

  useEffect(() => { localStorage.setItem(DRAFT, JSON.stringify(form)); }, [form]);
  const obra = obras.find((o) => o.id === form.obraId);
  const eapItens = eapPorObra[form.obraId] || [];
  const semEap = form.obraId && eapItens.length === 0;

  const execAcum = useMemo(() => { const m = {}; rdos.filter((r) => r.obra_id === form.obraId).forEach((r) => (r.atividades || []).forEach((a) => { m[a.eap] = (m[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); })); return m; }, [rdos, form.obraId]);
  const upAtv = (k, patch) => setForm((f) => ({ ...f, atividades: f.atividades.map((a) => a.k === k ? { ...a, ...patch } : a) }));
  const upRestr = (k, patch) => setForm((f) => ({ ...f, restricoes: f.restricoes.map((x) => x.k === k ? { ...x, ...patch } : x) }));

  const valorUnit = (it) => (Number(it.valor_total) || 0) / (Number(it.qtde) || 1);
  const medicaoRdo = sum(form.atividades.map((a) => { const it = eapItens.find((i) => i.id === a.eapId); return it ? (Number(a.qtde) || 0) * valorUnit(it) : 0; }));
  const efetivoCalc = new Set(form.atividades.flatMap((a) => a.funcionarioIds)).size || form.efetivo;

  const salvar = async () => {
    if (semEap) return;
    const atvs = form.atividades.filter((a) => a.eapId && Number(a.qtde) > 0);
    if (!form.obraId || atvs.length === 0) { setMsg({ tipo: "erro", txt: "Selecione a obra e informe ao menos uma atividade com avanço." }); return; }
    setSalvando(true); setMsg(null);
    try {
      const atividades = atvs.map((a) => {
        const it = eapItens.find((i) => i.id === a.eapId);
        const acum = (execAcum[it.codigo] || 0) + Number(a.qtde);
        return { eap: it.codigo, descricao: it.descricao, unidade: it.unidade, ambiente: it.ambiente,
          qtde_dia: Number(a.qtde), pct_dia: it.qtde ? Number(a.qtde) / it.qtde : null, pct_acum: it.qtde ? acum / it.qtde : null,
          medicao: Number(a.qtde) * valorUnit(it), comentarios: a.comentarios,
          funcionarios: a.funcionarioIds.map((id) => { const f = funcionarios.find((x) => x.id === id); return f ? { nome: f.nome, atribuicao: f.atribuicao } : null; }).filter(Boolean) };
      });
      const equipe = [...new Set(form.atividades.flatMap((a) => a.funcionarioIds))].map((id) => { const f = funcionarios.find((x) => x.id === id); return f ? { ocupacao: f.atribuicao, nome: f.nome } : null; }).filter(Boolean);
      const rdo = { obra_id: form.obraId, numero: form.numero || null, data: form.data, usuario_id: usuario.id, responsavel_nome: usuario.nome,
        clima: form.clima, efetivo: efetivoCalc, ocorrencias: form.ocorrencias, comentarios: form.comentarios, atividades, equipe,
        payload: { ...form, salvoEm: new Date().toISOString() } };
      const restricoes = form.restricoes.filter((x) => x.eapId && x.material).map((x) => { const it = eapItens.find((i) => i.id === x.eapId); return { eap_codigo: it?.codigo || "", material: x.material, data_solicitacao: x.dataSolicitacao || null }; });
      await criarRdoCompleto(rdo, restricoes);
      localStorage.removeItem(DRAFT); setForm(vazio(form.obraId));
      setMsg({ tipo: "ok", txt: "RDO registrado no banco." }); onMudou();
    } catch (e) { setMsg({ tipo: "erro", txt: `Falha ao salvar: ${e.message}. Rascunho preservado neste aparelho.` }); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title={`RDO-i · Relatório Diário Inteligente — ${dataBR(form.data)}`} right={msg && <span style={{ color: msg.tipo === "ok" ? C.verde : C.vermelho, fontSize: 13, fontWeight: 700 }}>{msg.txt}</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div><Lbl>Obra</Lbl><select value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value, atividades: [novaAtv()], restricoes: [] })} style={inp({ width: "100%" })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div><Lbl>Relatório nº</Lbl><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="00371" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Data</Lbl><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Clima predominante</Lbl><select value={form.clima} onChange={(e) => setForm({ ...form, clima: e.target.value })} style={inp({ width: "100%" })}>{CLIMAS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Lbl>Responsável</Lbl><input value={usuario.nome} disabled style={inp({ width: "100%", boxSizing: "border-box", background: C.cinza })} /></div>
        </div>

        {semEap && <div style={{ background: `${C.vermelho}12`, border: `1.5px solid ${C.vermelho}`, borderRadius: 8, padding: "14px 16px", color: C.vermelho, fontWeight: 700, fontSize: 14 }}>
          ⚠ Faça o upload da EAP para responder a este RDO. Vá em <b>EAP & Custos</b> ou <b>Obras</b> e carregue a planilha analítica desta obra antes de preencher.
        </div>}

        {!semEap && <>
          {form.atividades.map((a, idx) => {
            const it = eapItens.find((i) => i.id === a.eapId);
            const acum = it ? (execAcum[it.codigo] || 0) : 0;
            const pctDia = it && it.qtde ? (Number(a.qtde) || 0) / it.qtde : 0;
            const med = it ? (Number(a.qtde) || 0) * valorUnit(it) : 0;
            const estoura = it && acum + (Number(a.qtde) || 0) > (Number(it.qtde) || 0) + 1e-9;
            return (
              <div key={a.k} style={{ border: `1.5px solid ${C.linha}`, borderLeft: `5px solid ${C.laranja}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><b style={{ fontSize: 13 }}>ATIVIDADE {idx + 1}</b>
                  {form.atividades.length > 1 && <button onClick={() => setForm((f) => ({ ...f, atividades: f.atividades.filter((x) => x.k !== a.k) }))} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16 }}>✕</button>}</div>
                <Lbl>Item da EAP (busca por código ou palavra)</Lbl>
                <ComboEap itens={eapItens} valor={a.eapId} onSelect={(i) => upAtv(a.k, { eapId: i.id })} />
                {it && <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "10px 0", alignItems: "flex-end" }}>
                  <div><Lbl>Avanço do dia ({it.unidade})</Lbl><div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" min="0" step="0.01" value={a.qtde || ""} onChange={(e) => upAtv(a.k, { qtde: parseFloat(e.target.value) || 0 })} style={inp({ width: 120, textAlign: "right", fontWeight: 700, fontSize: 16 })} />
                    <span style={{ background: C.preto, color: C.laranja, fontWeight: 800, fontSize: 12, borderRadius: 6, padding: "6px 10px" }}>{it.unidade}</span>
                    <span style={{ fontSize: 13, color: C.laranja, fontWeight: 700 }}>= {pct(pctDia)}</span></div></div>
                  <div style={{ fontSize: 12, color: C.dim, paddingBottom: 6 }}>contratado <b>{fmt(it.qtde)} {it.unidade}</b> · executado <b>{fmt(acum)}</b> ({pct(it.qtde ? acum / it.qtde : 0)}) · {it.ambiente === "externo" ? "🌦️ externo" : "interno"}</div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}><Lbl>Medição gerada</Lbl><div style={{ fontSize: 18, fontWeight: 800, color: C.verde }}>{fmtR(med)}</div></div>
                </div>}
                {estoura && <div style={{ color: C.vermelho, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>⚠ Avanço acumulado ultrapassa o contratado.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><Lbl>Comentários da atividade</Lbl><textarea rows={2} value={a.comentarios} onChange={(e) => upAtv(a.k, { comentarios: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
                  <div><Lbl>Funcionários na atividade</Lbl>
                    <div style={{ maxHeight: 110, overflowY: "auto", border: `1px solid ${C.linha}`, borderRadius: 8 }}>
                      {funcionarios.length === 0 && <div style={{ padding: 8, fontSize: 12, color: C.dim }}>Cadastre funcionários no menu Cadastros.</div>}
                      {funcionarios.map((f) => <label key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", cursor: "pointer", background: a.funcionarioIds.includes(f.id) ? C.laranjaClaro : "transparent" }}>
                        <input type="checkbox" checked={a.funcionarioIds.includes(f.id)} onChange={() => upAtv(a.k, { funcionarioIds: a.funcionarioIds.includes(f.id) ? a.funcionarioIds.filter((x) => x !== f.id) : [...a.funcionarioIds, f.id] })} style={{ accentColor: C.laranja }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{f.nome}</span><span style={{ fontSize: 11, color: C.dim }}>{f.atribuicao}</span></label>)}
                    </div></div>
                </div>
              </div>
            );
          })}
          <Btn kind="ghost" small onClick={() => setForm((f) => ({ ...f, atividades: [...f.atividades, novaAtv()] }))}>+ Adicionar atividade</Btn>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div><Lbl>Comentários gerais (sai no PDF do cliente)</Lbl><textarea rows={2} value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
            <div><Lbl>Ocorrências</Lbl><textarea rows={2} value={form.ocorrencias} onChange={(e) => setForm({ ...form, ocorrencias: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
          </div>

          {/* RESTRIÇÕES — área interna, não vai ao PDF do cliente */}
          <div style={{ marginTop: 16, border: `1.5px dashed ${C.vermelho}`, borderRadius: 10, padding: 14, background: `${C.vermelho}08` }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: C.vermelho, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>🔒 Restrições de material — uso interno (NÃO sai no PDF do cliente)</div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Materiais em falta que impedem o início de atividades da EAP. Identifique o item, o material e a data em que foi solicitado ao suprimentos.</div>
            {form.restricoes.map((x) => (
              <div key={x.k} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <div><Lbl>Item da EAP impedido</Lbl><ComboEap itens={eapItens} valor={x.eapId} onSelect={(i) => upRestr(x.k, { eapId: i.id })} placeholder="EAP impedida…" /></div>
                <div><Lbl>Material em falta</Lbl><input value={x.material} onChange={(e) => upRestr(x.k, { material: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div><Lbl>Solicitado em</Lbl><input type="date" value={x.dataSolicitacao} onChange={(e) => upRestr(x.k, { dataSolicitacao: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <button onClick={() => setForm((f) => ({ ...f, restricoes: f.restricoes.filter((y) => y.k !== x.k) }))} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, paddingBottom: 6 }}>✕</button>
              </div>
            ))}
            <Btn kind="ghost" small onClick={() => setForm((f) => ({ ...f, restricoes: [...f.restricoes, novaRestr()] }))}>+ Restrição de material</Btn>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            <div style={{ fontSize: 13, color: C.dim }}>Efetivo: <b style={{ color: C.preto }}>{efetivoCalc}</b></div>
            <div style={{ fontSize: 13, color: C.dim }}>Medição do RDO: <b style={{ color: C.verde, fontSize: 17 }}>{fmtR(medicaoRdo)}</b></div>
            <div style={{ flex: 1 }} />
            <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Registrar RDO-i"}</Btn>
          </div>
        </>}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>Rascunho salvo automaticamente neste aparelho; ao registrar, o snapshot completo vai ao banco para recuperação.</div>
      </Card>

      <Card title="RDOs registrados">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Nº</Th><Th>Obra</Th><Th>Data</Th><Th>Clima</Th><Th right>Efetivo</Th><Th right>Atividades</Th><Th right>Medição</Th><Th>PDF</Th><Th /></tr></thead>
          <tbody>{rdos.slice().sort((a, b) => (a.data < b.data ? 1 : -1)).map((r) => { const o = obras.find((x) => x.id === r.obra_id); return (
            <tr key={r.id}><Td>{r.numero || "—"}</Td><Td>{o?.codigo}</Td><Td>{dataBR(r.data)}</Td><Td>{r.clima}</Td><Td right>{r.efetivo || 0}</Td><Td right>{(r.atividades || []).length}</Td>
              <Td right color={C.verde} style={{ fontWeight: 700 }}>{fmtR(sum((r.atividades || []).map((a) => a.medicao)))}</Td>
              <Td><button onClick={() => gerarPdfRdo(r, o || {}, r.responsavel_nome)} style={{ background: "none", border: `1px solid ${C.laranja}`, color: C.laranja, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>PDF timbrado</button></Td>
              <Td><button onClick={async () => { if (confirm("Excluir RDO?")) { await remover("rdos", r.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></Td></tr>
          ); })}
          {rdos.length === 0 && <tr><Td colSpan={9} color={C.dim} style={{ padding: 14 }}>Nenhum RDO registrado.</Td></tr>}</tbody>
        </table>
      </Card>
    </div>
  );
}

/* ============================ RSO-i (contratos de serviço) ============================ */
function RsoI({ obras, eapPorObra, contratos, funcionarios, onMudou }) {
  const [ct, setCt] = useState({ obra_id: "", empresa: "", cnpj: "", responsavel: "", escopo_eap: "", valor: 0 });
  const [busy, setBusy] = useState(false);
  const cnpjMask = (v) => v.replace(/\D/g, "").slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  const eaps = (id) => (eapPorObra[id] || []).map((i) => `${i.codigo} — ${i.descricao}`);
  const salvar = async () => { setBusy(true); try { await criar("contratos_servico", { ...ct, obra_id: ct.obra_id || null, valor: Number(ct.valor) || 0 }); setCt({ obra_id: "", empresa: "", cnpj: "", responsavel: "", escopo_eap: "", valor: 0 }); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="RSO-i · Cadastro de contratos de serviço (empreiteiros) — por EAP">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 150 }}><Lbl>Obra</Lbl><select value={ct.obra_id} onChange={(e) => setCt({ ...ct, obra_id: e.target.value })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 160 }}><Lbl>Empresa</Lbl><input value={ct.empresa} onChange={(e) => setCt({ ...ct, empresa: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>CNPJ</Lbl><input value={ct.cnpj} onChange={(e) => setCt({ ...ct, cnpj: cnpjMask(e.target.value) })} placeholder="00.000.000/0000-00" style={inp({ width: 165 })} /></div>
          <div style={{ minWidth: 150 }}><Lbl>Responsável em obra</Lbl><input value={ct.responsavel} onChange={(e) => setCt({ ...ct, responsavel: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ flex: 1, minWidth: 180 }}><Lbl>Escopo (EAP)</Lbl><input list="eaps-rso" value={ct.escopo_eap} onChange={(e) => setCt({ ...ct, escopo_eap: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /><datalist id="eaps-rso">{eaps(ct.obra_id).map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><Lbl>Valor contrato</Lbl><NumInput value={ct.valor} onChange={(v) => setCt({ ...ct, valor: v })} /></div>
          <Btn small disabled={busy || !ct.cnpj || !ct.responsavel} onClick={salvar}>+ Cadastrar</Btn>
        </div>
      </Card>
      <Card title={`Contratos de serviço (${contratos.length})`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Obra</Th><Th>Empresa</Th><Th>CNPJ</Th><Th>Responsável</Th><Th>Escopo EAP</Th><Th right>Valor</Th><Th /></tr></thead>
          <tbody>{contratos.map((x) => { const o = obras.find((y) => y.id === x.obra_id); return <tr key={x.id}><Td>{o?.codigo || "—"}</Td><Td style={{ fontWeight: 600 }}>{x.empresa || "—"}</Td><Td>{x.cnpj}</Td><Td>{x.responsavel}</Td><Td style={{ fontSize: 12 }}>{x.escopo_eap || "—"}</Td><Td right>{fmtR(x.valor)}</Td><Td><button onClick={async () => { if (confirm("Excluir?")) { await remover("contratos_servico", x.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></Td></tr>; })}
            {contratos.length === 0 && <tr><Td colSpan={7} color={C.dim} style={{ padding: 14 }}>Nenhum contrato de serviço.</Td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

/* ============================ OC-i (materiais) ============================ */
function OcI({ obras, eapPorObra, ocs, restricoes, onMudou }) {
  const [oc, setOc] = useState({ obra_id: "", numero: "", fornecedor: "", data: hojeISO(), eap_codigo: "", material: "", valor: 0 });
  const [busy, setBusy] = useState(false);
  const eaps = (id) => (eapPorObra[id] || []).map((i) => `${i.codigo} — ${i.descricao}`);
  const salvar = async () => { setBusy(true); try { await criar("ordens_compra", { ...oc, obra_id: oc.obra_id || null, valor: Number(oc.valor) || 0 }); setOc({ obra_id: oc.obra_id, numero: "", fornecedor: "", data: hojeISO(), eap_codigo: "", material: "", valor: 0 }); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const restAbertas = restricoes.filter((r) => !r.resolvida);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="OC-i · Ordens de compra de materiais — por EAP">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 140 }}><Lbl>Obra</Lbl><select value={oc.obra_id} onChange={(e) => setOc({ ...oc, obra_id: e.target.value })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div><Lbl>OC nº</Lbl><input value={oc.numero} onChange={(e) => setOc({ ...oc, numero: e.target.value })} style={inp({ width: 100 })} /></div>
          <div style={{ minWidth: 150 }}><Lbl>Fornecedor</Lbl><input value={oc.fornecedor} onChange={(e) => setOc({ ...oc, fornecedor: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Data</Lbl><input type="date" value={oc.data} onChange={(e) => setOc({ ...oc, data: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
          <div style={{ minWidth: 150 }}><Lbl>EAP</Lbl><input list="eaps-oc" value={oc.eap_codigo} onChange={(e) => setOc({ ...oc, eap_codigo: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /><datalist id="eaps-oc">{eaps(oc.obra_id).map((x) => <option key={x} value={x} />)}</datalist></div>
          <div style={{ flex: 1, minWidth: 160 }}><Lbl>Material</Lbl><input value={oc.material} onChange={(e) => setOc({ ...oc, material: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Valor</Lbl><NumInput value={oc.valor} onChange={(v) => setOc({ ...oc, valor: v })} /></div>
          <Btn small disabled={busy || !oc.material} onClick={salvar}>+ Lançar OC</Btn>
        </div>
      </Card>

      {restAbertas.length > 0 && (
        <Card title={`Restrições de material em aberto (${restAbertas.length}) — vindas dos RDOs`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Obra</Th><Th>EAP impedida</Th><Th>Material</Th><Th>Solicitado em</Th><Th>Registrado</Th><Th /></tr></thead>
            <tbody>{restAbertas.map((r) => { const o = obras.find((x) => x.id === r.obra_id); return <tr key={r.id}><Td>{o?.codigo}</Td><Td>{r.eap_codigo}</Td><Td style={{ fontWeight: 600 }}>{r.material}</Td><Td>{dataBR(r.data_solicitacao)}</Td><Td>{dataBR(r.data_registro)}</Td>
              <Td><button onClick={async () => { await editar("restricoes_material", r.id, { resolvida: true }); onMudou(); }} style={{ background: "none", border: `1px solid ${C.verde}`, color: C.verde, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Marcar resolvida</button></Td></tr>; })}</tbody></table>
        </Card>
      )}

      <Card title={`Ordens de compra (${ocs.length})`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>OC</Th><Th>Obra</Th><Th>Data</Th><Th>Fornecedor</Th><Th>EAP</Th><Th>Material</Th><Th right>Valor</Th><Th /></tr></thead>
          <tbody>{ocs.map((x) => { const o = obras.find((y) => y.id === x.obra_id); return <tr key={x.id}><Td>{x.numero || "—"}</Td><Td>{o?.codigo || "—"}</Td><Td>{dataBR(x.data)}</Td><Td>{x.fornecedor || "—"}</Td><Td>{x.eap_codigo || "—"}</Td><Td style={{ fontSize: 12 }}>{x.material}</Td><Td right color={C.laranja}>{fmtR(x.valor)}</Td><Td><button onClick={async () => { if (confirm("Excluir OC?")) { await remover("ordens_compra", x.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></Td></tr>; })}
            {ocs.length === 0 && <tr><Td colSpan={8} color={C.dim} style={{ padding: 14 }}>Nenhuma OC lançada.</Td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

/* ============================ EAP & Custos ============================ */
function EapCustos({ obras, eapPorObra, ocs, rdos, onMudou }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [busca, setBusca] = useState("");
  useEffect(() => { if (!obraId && obras[0]) setObraId(obras[0].id); }, [obras]);
  const itens = eapPorObra[obraId] || [];
  const obra = obras.find((o) => o.id === obraId);
  const realizado = useMemo(() => { const m = {}; ocs.filter((o) => o.obra_id === obraId).forEach((o) => { const c = (o.eap_codigo || "").split(" ")[0]; m[c] = (m[c] || 0) + (Number(o.valor) || 0); }); return m; }, [ocs, obraId]);
  const exec = useMemo(() => { const m = {}; rdos.filter((r) => r.obra_id === obraId).forEach((r) => (r.atividades || []).forEach((a) => { m[a.eap] = (m[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); })); return m; }, [rdos, obraId]);
  const rows = itens.filter((e) => !busca || norm(`${e.codigo} ${e.descricao}`).includes(norm(busca))).map((e) => {
    const real = realizado[e.codigo] || 0; const meta = (Number(e.valor_total) || 0); const ex = exec[e.codigo] || 0;
    const avFis = e.qtde ? Math.min(ex / e.qtde, 1) : 0; const idc = meta ? real / meta : 0;
    const cpi = real > 0 ? (avFis * meta) / real : null;
    return { ...e, real, meta, avFis, idc, cpi };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="EAP & Custos — índice de custo por atividade (OCs × meta)" right={<div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} style={inp({ fontSize: 12, padding: "5px 10px", width: 160 })} />
        <select value={obraId} onChange={(e) => setObraId(e.target.value)} style={inp({ fontSize: 12, padding: "5px 10px" })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Realizado vem das OCs (OC-i); avanço físico vem dos RDOs. CPI = (avanço × meta) ÷ realizado.{obra?.desconto ? ` Desconto da licitação: ${pct(obra.desconto, 0)}.` : ""}</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>EAP</Th><Th>Atividade</Th><Th>Unid.</Th><Th right>Meta (c/BDI)</Th><Th right>Realizado OCs</Th><Th right>%gasto</Th><Th right>Avanço físico</Th><Th right>CPI</Th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><Td>{r.codigo}</Td><Td style={{ fontSize: 12 }}>{r.descricao.length > 50 ? r.descricao.slice(0, 50) + "…" : r.descricao}</Td><Td><b style={{ color: C.laranja }}>{r.unidade}</b></Td><Td right>{fmt(r.meta)}</Td><Td right>{fmt(r.real)}</Td><Td right color={r.idc > 1 ? C.vermelho : C.texto}>{pct(r.idc)}</Td><Td right color={C.azul}>{pct(r.avFis)}</Td><Td right color={r.cpi === null ? C.dim : r.cpi >= 1 ? C.verde : C.vermelho}>{r.cpi === null ? "—" : r.cpi.toFixed(2)}</Td></tr>)}
            {rows.length === 0 && <tr><Td colSpan={8} color={C.dim} style={{ padding: 14 }}>{itens.length === 0 ? "Faça o upload da EAP desta obra (aba Obras)." : "Nenhum item encontrado."}</Td></tr>}</tbody>
        </table></div>
      </Card>
    </div>
  );
}

/* ============================ Obras (upload EAP) ============================ */
function Obras({ obras, eapPorObra, onMudou }) {
  const fileRef = useRef(null);
  const [lendo, setLendo] = useState(false); const [erro, setErro] = useState(null); const [preview, setPreview] = useState(null);
  const lerPlanilha = async (file) => {
    setLendo(true); setErro(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); const linhas = [];
      wb.SheetNames.forEach((sn) => { linhas.push(`### ABA: ${sn}`); XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" }).slice(0, 800).forEach((r) => { const l = r.map((c) => String(c ?? "").trim()).join(" | ").trim(); if (l.replace(/\|/g, "").trim()) linhas.push(l); }); });
      const nomeBase = file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " ");
      const eap = await parseEapApi(linhas.join("\n").slice(0, 150000), nomeBase);
      setPreview({ nome: eap.nomeObra || nomeBase, codigo: eap.codigoSugerido || nomeBase.slice(0, 12).toUpperCase(), desconto: 0, contratante: "", contrato: "", local: "", prazo_dias: 0, itens: (eap.itens || []).map((it, i) => ({ ...it, ordem: i + 1 })) });
    } catch (e) { setErro(`Não foi possível interpretar: ${e.message}`); } finally { setLendo(false); }
  };
  const confirmar = async () => {
    setLendo(true);
    try {
      await criarObraComEap(
        { codigo: preview.codigo, nome: preview.nome, contratante: preview.contratante, contrato: preview.contrato, local: preview.local, prazo_dias: Number(preview.prazo_dias) || null, desconto: Number(preview.desconto) || 0, data_inicio: hojeISO() },
        preview.itens.map((it) => ({ codigo: String(it.codigo || ""), descricao: String(it.descricao || ""), unidade: String(it.unidade || "un"), qtde: Number(it.qtde) || 1, valor_unit: Number(it.valorUnit) || (Number(it.valorTotal) || 0) / (Number(it.qtde) || 1), valor_total: Number(it.valorTotal) || 0, disciplina: it.disciplina || "", ambiente: it.ambiente === "externo" ? "externo" : "interno", ordem: it.ordem }))
      );
      setPreview(null); onMudou();
    } catch (e) { setErro(`Falha ao salvar: ${e.message}`); } finally { setLendo(false); }
  };
  const toggleAmb = (i) => setPreview((p) => ({ ...p, itens: p.itens.map((it, j) => j === i ? { ...it, ambiente: it.ambiente === "externo" ? "interno" : "externo" } : it) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Obras — upload da EAP analítica (obrigatória antes do RDO)" right={<Btn small onClick={() => fileRef.current?.click()} disabled={lendo}>{lendo ? "Interpretando…" : "⇪ Upload planilha orçamentária"}</Btn>}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) lerPlanilha(f); e.target.value = ""; }} />
        <div style={{ fontSize: 13, color: C.dim }}>A IA identifica os itens da EAP (código, descrição, unidade, quantidade, valores) e classifica cada um como interno/externo para a projeção de término por clima. Revise antes de salvar.</div>
        {erro && <div style={{ color: C.vermelho, fontSize: 13, marginTop: 10 }}>{erro}</div>}
        {preview && (
          <div style={{ marginTop: 14, border: `2px solid ${C.laranja}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div><Lbl>Código</Lbl><input value={preview.codigo} onChange={(e) => setPreview({ ...preview, codigo: e.target.value })} style={inp({ width: 150 })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Nome da obra</Lbl><input value={preview.nome} onChange={(e) => setPreview({ ...preview, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div><Lbl>Desconto licitação</Lbl><input type="number" step="0.001" value={preview.desconto} onChange={(e) => setPreview({ ...preview, desconto: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /><span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>(0,11=11%)</span></div>
              <div><Lbl>Prazo (dias)</Lbl><input type="number" value={preview.prazo_dias} onChange={(e) => setPreview({ ...preview, prazo_dias: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /></div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Contratante</Lbl><input value={preview.contratante} onChange={(e) => setPreview({ ...preview, contratante: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Local</Lbl><input value={preview.local} onChange={(e) => setPreview({ ...preview, local: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Contrato</Lbl><input value={preview.contrato} onChange={(e) => setPreview({ ...preview, contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${C.linha}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th right>Qtde</Th><Th right>Valor c/BDI</Th><Th>Ambiente</Th></tr></thead>
                <tbody>{preview.itens.map((it, i) => <tr key={i}><Td>{it.codigo}</Td><Td style={{ fontSize: 12 }}>{it.descricao}</Td><Td><b style={{ color: C.laranja }}>{it.unidade}</b></Td><Td right>{fmt(it.qtde)}</Td><Td right>{fmt(it.valorTotal)}</Td>
                  <Td><button onClick={() => toggleAmb(i)} style={{ background: it.ambiente === "externo" ? C.amareloAlerta : C.cinza2, color: it.ambiente === "externo" ? "#fff" : C.dim, border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{it.ambiente === "externo" ? "🌦️ externo" : "interno"}</button></Td></tr>)}</tbody></table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.dim }}>{preview.itens.length} itens · referência {fmtR(sum(preview.itens.map((i) => i.valorTotal)))}</span>
              <div style={{ flex: 1 }} /><Btn kind="ghost" small onClick={() => setPreview(null)}>Descartar</Btn><Btn small onClick={confirmar} disabled={lendo}>Salvar obra e EAP</Btn>
            </div>
          </div>
        )}
      </Card>
      {obras.map((o) => (
        <Card key={o.id} title={`${o.codigo} · ${o.nome}`} right={<Btn kind="danger" small onClick={async () => { if (confirm(`Excluir ${o.codigo} e todos os dados?`)) { await remover("obras", o.id); onMudou(); } }}>Excluir</Btn>}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>{(eapPorObra[o.id] || []).length} itens de EAP · {o.contratante || "sem contratante"} · prazo {o.prazo_dias || "—"} dias</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th right>Qtde</Th><Th right>Valor c/BDI</Th><Th>Ambiente</Th></tr></thead>
            <tbody>{(eapPorObra[o.id] || []).slice(0, 200).map((it) => <tr key={it.id}><Td>{it.codigo}</Td><Td style={{ fontSize: 12 }}>{it.descricao}</Td><Td><b style={{ color: C.laranja }}>{it.unidade}</b></Td><Td right>{fmt(it.qtde)}</Td><Td right>{fmt(it.valor_total)}</Td><Td>{it.ambiente === "externo" ? "🌦️ externo" : "interno"}</Td></tr>)}</tbody></table>
        </Card>
      ))}
    </div>
  );
}
