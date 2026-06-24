import React, { useState, useEffect, useMemo, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PieChart, Pie } from "recharts";
import * as XLSX from "xlsx";
import {
  C, fmt, fmtR, fmtK, pct, sum, uid, norm, hojeISO, dataBR, addDiasISO, CLIMAS, ATRIBUICOES, VINCULOS, SETOR_DE_PAPEL,
  Card, Btn, Kpi, Th, Td, Lbl, inp, NumInput, ChartTip,
  listar, criar, criarObraComEap, criarRdoCompleto, editar, remover, parseEapApi, parseEapLote, diagnosticarEap,
  aplicarDesconto, definirMeta, uploadFoto,
} from "./core.jsx";
import { gerarPdfRdo, gerarPdfMedicao, gerarPdfOC } from "./pdf.js";
import { observacoesPorItem, projecaoItem } from "./produtividade.js";
import { SmI } from "./smi.jsx";
import { SsI } from "./ssi.jsx";
import { Pos } from "./pos.jsx";
import { Pmm } from "./pmm.jsx";

const OP_TABS = [["rdo", "RDO-i"], ["os", "OS-i · Serviços"], ["oc", "OC-i · Materiais"], ["prestadores", "Prestadores"], ["eap", "EAP & Custos"], ["obras", "Obras"]];

export function ModuloOperacional({ usuario, sub: subProp, setSub: setSubProp, acesso }) {
  const [subLocal, setSubLocal] = useState("rdo");
  const sub = subProp ?? subLocal;
  const setSub = setSubProp ?? setSubLocal;
  const controlado = subProp != null;
  const [obras, setObras] = useState([]);
  const [eapPorObra, setEapPorObra] = useState({});
  const [rdos, setRdos] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [ocs, setOcs] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [restricoes, setRestricoes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [draftOc, setDraftOc] = useState(null);
  const [draftOs, setDraftOs] = useState(null);
  const gerarOcDeSm = (sm) => {
    setDraftOc({
      obra_id: sm.obra_id,
      solicitante: (colaboradores.find((c) => c.id === sm.solicitante_id) || {}).nome || "",
      solicitacaoNum: String(sm.id).slice(0, 8).toUpperCase(),
      observacao: "Gerada a partir da SM-i" + (sm.descricao ? ` — ${sm.descricao}` : ""),
      itens_eap: (sm.itens || []).map((i) => ({ eap_codigo: i.eap_codigo, descricao: i.descricao || "", material: i.material || "", quantidade: Number(i.quantidade) || 1, unidade: i.unidade || "un", valorUnit: 0, valor: 0 })),
    });
    setSub("oc");
  };
  const gerarOsDeSs = (ss) => {
    setDraftOs({
      obra_id: ss.obra_id,
      responsavel: (colaboradores.find((c) => c.id === ss.solicitante_id) || {}).nome || "",
      itens_eap: (ss.itens || []).map((i) => ({ eap_codigo: i.eap_codigo, descricao: i.servico || i.descricao || "", valor: 0 })),
    });
    setSub("os");
  };

  const carregar = async () => {
    const [ob, ct, oc, fu] = await Promise.all([listar("obras"), listar("contratos_servico"), listar("ordens_compra"), listar("funcionarios")]);
    setObras(ob); setContratos(ct); setOcs(oc); setFuncionarios(fu);
    listar("colaboradores").then(setColaboradores).catch(() => {});
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

  const emBreve = (titulo, versao) => (
    <Card title={titulo}>
      <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>Este módulo entra na <b>{versao}</b>. A estrutura de dados já está pronta no banco; a interface (formulário e kanban de prazos) será habilitada na próxima etapa.</div>
    </Card>
  );

  return (
    <div>
      {!controlado && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {OP_TABS.map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)} style={{ background: sub === id ? C.preto : C.branco, color: sub === id ? "#fff" : C.dim, border: `1px solid ${sub === id ? C.preto : C.linha}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      )}
      {sub === "rdo" && <RdoI usuario={usuario} colaboradores={colaboradores} obras={obras} eapPorObra={eapPorObra} rdos={rdos} funcionarios={funcionarios} contratos={contratos} restricoes={restricoes} onMudou={carregar} />}
      {sub === "smi" && <SmI usuario={usuario} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} acesso={acesso} onGerarOc={gerarOcDeSm} onMudou={carregar} />}
      {sub === "ssi" && <SsI usuario={usuario} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} acesso={acesso} onGerarOs={gerarOsDeSs} onMudou={carregar} />}
      {sub === "pos" && <Pos usuario={usuario} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} acesso={acesso} onMudou={carregar} />}
      {sub === "pmm" && <Pmm usuario={usuario} obras={obras} eapPorObra={eapPorObra} colaboradores={colaboradores} acesso={acesso} onMudou={carregar} />}
      {sub === "os" && <OsI obras={obras} eapPorObra={eapPorObra} contratos={contratos} draft={draftOs} onConsumeDraft={() => setDraftOs(null)} usuario={usuario} onMudou={carregar} />}
      {sub === "oc" && <OcI obras={obras} eapPorObra={eapPorObra} ocs={ocs} restricoes={restricoes} colaboradores={colaboradores} usuario={usuario} draft={draftOc} onConsumeDraft={() => setDraftOc(null)} onMudou={carregar} />}
      {sub === "prestadores" && <Prestadores obras={obras} funcionarios={funcionarios} contratos={contratos} onMudou={carregar} />}
      {sub === "eap" && <EapCustos obras={obras} eapPorObra={eapPorObra} ocs={ocs} contratos={contratos} rdos={rdos} onMudou={carregar} />}
      {sub === "obras" && <Obras obras={obras} eapPorObra={eapPorObra} onMudou={carregar} />}
    </div>
  );
}

/* Dropdown de responsável filtrado por setor; gestor (CEO/Diretor) vê todos.
   Mantém a opção de digitar livremente para nomes fora do cadastro. */
function PessoaSelect({ colaboradores = [], setores, usuario, value, onChange, placeholder = "selecione…", width }) {
  const gestor = usuario && (usuario.papel === "ceo" || usuario.papel === "diretor");
  const opcoes = (colaboradores || []).filter((c) => gestor || !setores || setores.includes(SETOR_DE_PAPEL[c.papel]));
  const nomes = opcoes.map((c) => c.nome);
  const outro = value && !nomes.includes(value);
  return (
    <select value={outro ? "__outro" : (value || "")} onChange={(e) => { const v = e.target.value; if (v === "__outro") onChange(value || ""); else onChange(v); }} style={inp({ width: width || "100%", boxSizing: "border-box" })}>
      <option value="">{placeholder}</option>
      {opcoes.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
      {outro && <option value="__outro">{value} (manual)</option>}
    </select>
  );
}

/* ============================ RDO-i ============================ */
function ComboEap({ itens, valor, onSelect, placeholder }) {
  const [busca, setBusca] = useState(""); const [aberto, setAberto] = useState(false);
  const sel = itens.find((i) => i.id === valor || i.codigo === valor);
  const todos = useMemo(() => { const q = norm(busca); return itens.filter((i) => !q || norm(`${i.codigo} ${i.descricao} ${i.disciplina || ""}`).includes(q)); }, [busca, itens]);
  const filtrados = todos.slice(0, 300);
  return (
    <div style={{ position: "relative" }}>
      <input value={aberto ? busca : sel ? `${sel.codigo} — ${sel.descricao}` : ""} placeholder={placeholder || "Buscar item da EAP…"}
        onFocus={() => { setAberto(true); setBusca(""); }} onBlur={() => setTimeout(() => setAberto(false), 180)} onChange={(e) => setBusca(e.target.value)}
        style={inp({ width: "100%", boxSizing: "border-box", fontWeight: sel ? 600 : 400 })} />
      {aberto && <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: C.branco, border: `1.5px solid ${C.laranja}`, borderRadius: 8, maxHeight: 320, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
        <div style={{ padding: "5px 12px", fontSize: 10.5, color: C.dim, borderBottom: `1px solid ${C.linha}`, position: "sticky", top: 0, background: C.branco }}>{todos.length} item(ns){todos.length > 300 ? " · mostrando 300 — digite para filtrar" : ""}</div>
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

/* Seleção de MÚLTIPLOS itens da EAP com valor por item — usado em OC-i e OS-i */
function MultiEapPicker({ itens, valor = [], onChange, comValor = true, labelValor = "Valor (R$)" }) {
  const add = (it) => { if (valor.some((x) => x.eap_codigo === it.codigo)) return; onChange([...valor, { eap_codigo: it.codigo, descricao: it.descricao, valor: 0 }]); };
  const upd = (i, patch) => onChange(valor.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const del = (i) => onChange(valor.filter((_, j) => j !== i));
  return (
    <div>
      <ComboEap itens={itens.filter((i) => !valor.some((x) => x.eap_codigo === i.codigo))} valor="" onSelect={add} placeholder="+ Adicionar item da EAP…" />
      {valor.length > 0 && (
        <div style={{ marginTop: 8, border: `1px solid ${C.linha}`, borderRadius: 8, overflow: "hidden" }}>
          {valor.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: i < valor.length - 1 ? `1px solid ${C.linha}` : "none", background: i % 2 ? "#fafafa" : "#fff" }}>
              <span style={{ background: C.preto, color: C.laranja, fontWeight: 800, fontSize: 11, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{x.eap_codigo}</span>
              <span style={{ fontSize: 12, color: C.texto, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.descricao}</span>
              {comValor && <NumInput w={130} value={x.valor} onChange={(v) => upd(i, { valor: v })} />}
              <button onClick={() => del(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
          ))}
          {comValor && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: C.preto, color: "#fff", fontSize: 12, fontWeight: 700 }}>
            <span>{valor.length} {valor.length === 1 ? "item" : "itens"}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtR(sum(valor.map((x) => x.valor)))}</span></div>}
        </div>
      )}
    </div>
  );
}

const DRAFT = "mcc_rdo_draft_v1";
function RdoI({ usuario, obras, eapPorObra, rdos, funcionarios, contratos, restricoes = [], onMudou }) {
  const novaAtv = () => ({ k: uid(), eapId: "", qtde: 0, comentarios: "", funcionarioIds: [] });
  const novaRestr = () => ({ k: uid(), eapId: "", material: "", dataSolicitacao: hojeISO() });
  const vazio = (obraId) => ({ obraId: obraId || obras[0]?.id || "", numero: "", data: hojeISO(), clima: CLIMAS[0], efetivo: 0, ocorrencias: "", comentarios: "", atividades: [novaAtv()], equipe: [], restricoes: [], fotos: [] });
  const [form, setForm] = useState(() => { try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d?.atividades) return { fotos: [], ...d }; } catch {} return vazio(); });
  const [salvando, setSalvando] = useState(false); const [msg, setMsg] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [ndForm, setNdForm] = useState(null); // atividade não descrita: { k, descricao, qtde, unidade }
  const proxNumero = (obraId) => { const ns = rdos.filter((r) => r.obra_id === obraId).map((r) => parseInt(String(r.numero || "").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n)); return ns.length ? String(Math.max(...ns) + 1) : "1"; };
  const fotoRef = useRef(null);
  const topoRef = useRef(null);

  // carrega um RDO existente no formulário para edição (reconstrói a partir do payload + atividades salvas)
  const editarRdo = (r) => {
    const itensObra = eapPorObra[r.obra_id] || [];
    const acharId = (cod) => itensObra.find((i) => i.codigo === cod)?.id || "";
    const atividades = (r.atividades || []).map((a) => ({
      k: uid(), eapId: acharId(a.eap), qtde: Number(a.qtde_dia ?? a.avanco) || 0, comentarios: a.comentarios || "",
      funcionarioIds: (a.funcionarios || []).map((fn) => funcionarios.find((f) => f.nome === fn.nome)?.id).filter(Boolean),
    }));
    const restrDoRdo = restricoes.filter((x) => x.rdo_id === r.id);
    const restricoesForm = restrDoRdo.map((x) => ({ k: uid(), eapId: acharId(x.eap_codigo), material: x.material, dataSolicitacao: x.data_solicitacao || hojeISO() }));
    setForm({ obraId: r.obra_id, numero: r.numero || "", data: (r.data || "").slice(0, 10), clima: r.clima || CLIMAS[0],
      efetivo: r.efetivo || 0, ocorrencias: r.ocorrencias || "", comentarios: r.comentarios || "",
      atividades: atividades.length ? atividades : [novaAtv()], equipe: r.equipe || [], restricoes: restricoesForm, fotos: r.fotos || [] });
    setEditandoId(r.id); setMsg(null);
    topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const cancelarEdicao = () => { setEditandoId(null); setForm(vazio(form.obraId)); localStorage.removeItem(DRAFT); };

  useEffect(() => { if (!editandoId) localStorage.setItem(DRAFT, JSON.stringify(form)); }, [form, editandoId]);
  const obra = obras.find((o) => o.id === form.obraId);
  const eapItens = eapPorObra[form.obraId] || [];
  const semEap = form.obraId && eapItens.length === 0;

  const adicionarFotos = async (files) => {
    setEnviandoFoto(true);
    try {
      for (const file of files) {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        const { url, path } = await uploadFoto(dataUrl, file.name, obra?.codigo);
        setForm((f) => ({ ...f, fotos: [...(f.fotos || []), { url, path, eap_codigo: "", legenda: "" }] }));
      }
    } catch (e) { setMsg({ tipo: "erro", txt: `Falha ao enviar foto: ${e.message}` }); }
    finally { setEnviandoFoto(false); }
  };
  const upFoto = (i, patch) => setForm((f) => ({ ...f, fotos: f.fotos.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const delFoto = (i) => setForm((f) => ({ ...f, fotos: f.fotos.filter((_, j) => j !== i) }));

  const execAcum = useMemo(() => { const m = {}; rdos.filter((r) => r.obra_id === form.obraId).forEach((r) => (r.atividades || []).forEach((a) => { m[a.eap] = (m[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); })); return m; }, [rdos, form.obraId]);
  const upAtv = (k, patch) => setForm((f) => ({ ...f, atividades: f.atividades.map((a) => a.k === k ? { ...a, ...patch } : a) }));
  const upRestr = (k, patch) => setForm((f) => ({ ...f, restricoes: f.restricoes.map((x) => x.k === k ? { ...x, ...patch } : x) }));

  const valorUnit = (it) => (Number(it.valor_total) || 0) / (Number(it.qtde) || 1);
  const medicaoRdo = sum(form.atividades.map((a) => { const it = eapItens.find((i) => i.id === a.eapId); return it ? (Number(a.qtde) || 0) * valorUnit(it) : 0; }));
  // auto-numeração: sugere o próximo nº quando a obra muda e o campo está vazio (não em edição)
  useEffect(() => { if (!editandoId && form.obraId && !String(form.numero || "").trim()) setForm((f) => ({ ...f, numero: proxNumero(form.obraId) })); }, [form.obraId, editandoId]); // eslint-disable-line
  const criarNaoDescrito = async () => {
    const f = ndForm; if (!f || !f.descricao.trim()) { alert("Descreva a atividade."); return; }
    const codigo = `ND-${eapItens.filter((i) => i.nao_descrito).length + 1}`;
    try {
      const row = await criar("eap_itens", { obra_id: form.obraId, codigo, descricao: f.descricao.trim(), unidade: f.unidade || "un", qtde: Number(f.qtde) || 0, valor_total: 0, nao_descrito: true });
      await onMudou();
      if (row && row.id) upAtv(f.k, { eapId: row.id });
      setNdForm(null);
      setMsg({ tipo: "ok", txt: `Atividade não descrita "${codigo}" criada e marcada na EAP para consulta posterior.` });
    } catch (e) { alert(e.message); }
  };
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
        fotos: (form.fotos || []).map((f) => ({ url: f.url, path: f.path, eap_codigo: f.eap_codigo, legenda: f.legenda })),
        payload: { ...form, salvoEm: new Date().toISOString() } };
      const restricoes = form.restricoes.filter((x) => x.eapId && x.material).map((x) => { const it = eapItens.find((i) => i.id === x.eapId); return { eap_codigo: it?.codigo || "", material: x.material, data_solicitacao: x.dataSolicitacao || null }; });
      await criarRdoCompleto(rdo, restricoes, editandoId || undefined);
      localStorage.removeItem(DRAFT); setForm(vazio(form.obraId));
      setMsg({ tipo: "ok", txt: editandoId ? "RDO atualizado." : "RDO registrado no banco." }); setEditandoId(null); onMudou();
    } catch (e) { setMsg({ tipo: "erro", txt: `Falha ao salvar: ${e.message}. Rascunho preservado neste aparelho.` }); }
    finally { setSalvando(false); }
  };

  return (
    <div ref={topoRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(() => {
        const hoje = hojeISO();
        const pend = obras.filter((o) => !rdos.some((r) => r.obra_id === o.id && String(r.data).slice(0, 10) === hoje));
        if (obras.length === 0) return null;
        if (pend.length === 0) return (
          <div style={{ background: `${C.verde}12`, border: `1px solid ${C.verde}55`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.verde, fontWeight: 700 }}>✓ Todas as {obras.length} obras já têm RDO respondido hoje ({dataBR(hoje)}).</div>
        );
        return (
          <div style={{ background: `${C.amareloAlerta}1a`, border: `1px solid ${C.amareloAlerta}66`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.texto }}>
            <b style={{ color: C.amareloAlerta }}>⚠ {pend.length} obra(s) sem RDO hoje ({dataBR(hoje)}):</b> {pend.map((o) => o.codigo).join(" · ")}
          </div>
        );
      })()}
      <Card title={`${editandoId ? "✎ Editando RDO" : "RDO-i · Relatório Diário Inteligente"} — ${dataBR(form.data)}`} right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {editandoId && <Btn small kind="ghost" onClick={cancelarEdicao}>Cancelar edição</Btn>}
        {msg && <span style={{ color: msg.tipo === "ok" ? C.verde : C.vermelho, fontSize: 13, fontWeight: 700 }}>{msg.txt}</span>}
      </div>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div><Lbl>Obra</Lbl><select value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value, numero: proxNumero(e.target.value), atividades: [novaAtv()], restricoes: [] })} style={inp({ width: "100%" })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div><Lbl>Relatório nº (automático)</Lbl><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="00371" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
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
                {it && it.nao_descrito && <div style={{ display: "inline-block", marginTop: 6, background: C.amareloAlerta, color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 5, padding: "2px 8px" }}>ATIVIDADE NÃO DESCRITA NA EAP</div>}
                {ndForm && ndForm.k === a.k ? (
                  <div style={{ marginTop: 8, border: `1.5px dashed ${C.amareloAlerta}`, borderRadius: 8, padding: 12, background: "#fffdf5" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.amareloAlerta, marginBottom: 8 }}>Atividade não descrita na EAP</div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                      <div><Lbl>Descrição da atividade</Lbl><input value={ndForm.descricao} onChange={(e) => setNdForm({ ...ndForm, descricao: e.target.value })} placeholder="Ex.: Reforço de viga não prevista" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                      <div><Lbl>Qtde estimada</Lbl><input type="number" min="0" step="0.01" value={ndForm.qtde || ""} onChange={(e) => setNdForm({ ...ndForm, qtde: parseFloat(e.target.value) || 0 })} style={inp({ width: "100%", boxSizing: "border-box", textAlign: "right" })} /></div>
                      <div><Lbl>Unidade</Lbl><input value={ndForm.unidade} onChange={(e) => setNdForm({ ...ndForm, unidade: e.target.value })} placeholder="un, m², m³…" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}><Btn small onClick={criarNaoDescrito}>Salvar e selecionar</Btn><Btn small kind="ghost" onClick={() => setNdForm(null)}>Cancelar</Btn></div>
                    <div style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>O item será criado na EAP marcado como “não descrito”, com valor zero, para consulta posterior do que foi executado fora do escopo.</div>
                  </div>
                ) : (
                  !a.eapId && form.obraId && <button onClick={() => setNdForm({ k: a.k, descricao: "", qtde: 0, unidade: "un" })} style={{ marginTop: 6, background: "none", border: "none", color: C.amareloAlerta, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>+ Atividade não descrita na EAP</button>
                )}
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

          {/* FOTOS — anexadas ao RDO, cada uma vinculada a um item da EAP */}
          <div style={{ marginTop: 16, border: `1.5px solid ${C.linha}`, borderLeft: `5px solid ${C.laranja}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em" }}>📷 Fotos do dia</div>
              <Btn small kind="ghost" disabled={enviandoFoto} onClick={() => fotoRef.current?.click()}>{enviandoFoto ? "Enviando…" : "+ Adicionar fotos"}</Btn>
              <input ref={fotoRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) adicionarFotos([...e.target.files]); e.target.value = ""; }} />
            </div>
            {(form.fotos || []).length === 0 && <div style={{ fontSize: 12, color: C.dim }}>Anexe fotos da obra e selecione a qual item da EAP cada uma se refere.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {(form.fotos || []).map((ft, i) => (
                <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 8, overflow: "hidden", background: "#fafafa" }}>
                  <div style={{ position: "relative" }}>
                    <img src={ft.url} alt="" style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                    <button onClick={() => delFoto(i)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 13 }}>✕</button>
                  </div>
                  <div style={{ padding: 8 }}>
                    <select value={ft.eap_codigo} onChange={(e) => upFoto(i, { eap_codigo: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", marginBottom: 6 })}>
                      <option value="">— item da EAP —</option>
                      {eapItens.map((it) => <option key={it.id} value={it.codigo}>{it.codigo} — {it.descricao.slice(0, 40)}</option>)}
                    </select>
                    <input value={ft.legenda} onChange={(e) => upFoto(i, { legenda: e.target.value })} placeholder="Legenda (opcional)" style={inp({ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px" })} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            <div style={{ fontSize: 13, color: C.dim }}>Efetivo: <b style={{ color: C.preto }}>{efetivoCalc}</b></div>
            <div style={{ fontSize: 13, color: C.dim }}>Medição do RDO: <b style={{ color: C.verde, fontSize: 17 }}>{fmtR(medicaoRdo)}</b></div>
            <div style={{ flex: 1 }} />
            <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Registrar RDO-i"}</Btn>
          </div>
        </>}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>Rascunho salvo automaticamente neste aparelho; ao registrar, o snapshot completo vai ao banco para recuperação.</div>
      </Card>

      <Card title="RDOs registrados">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Nº</Th><Th>Obra</Th><Th>Data</Th><Th>Clima</Th><Th right>Efetivo</Th><Th right>Atividades</Th><Th right>Medição</Th><Th>Ações</Th><Th /></tr></thead>
          <tbody>{rdos.slice().sort((a, b) => (a.data < b.data ? 1 : -1)).map((r) => { const o = obras.find((x) => x.id === r.obra_id); return (
            <tr key={r.id} style={editandoId === r.id ? { background: C.laranjaClaro } : {}}><Td>{r.numero || "—"}</Td><Td>{o?.codigo}</Td><Td>{dataBR(r.data)}</Td><Td>{r.clima}</Td><Td right>{r.efetivo || 0}</Td><Td right>{(r.atividades || []).length}</Td>
              <Td right color={C.verde} style={{ fontWeight: 700 }}>{fmtR(sum((r.atividades || []).map((a) => a.medicao)))}</Td>
              <Td><div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => editarRdo(r)} style={{ background: "none", border: `1px solid ${C.preto}`, color: C.preto, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Editar</button>
                <button onClick={() => gerarPdfRdo(r, o || {}, r.responsavel_nome)} style={{ background: "none", border: `1px solid ${C.laranja}`, color: C.laranja, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>PDF</button>
              </div></Td>
              <Td><button onClick={async () => { if (confirm("Excluir RDO?")) { await remover("rdos", r.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></Td></tr>
          ); })}
          {rdos.length === 0 && <tr><Td colSpan={9} color={C.dim} style={{ padding: 14 }}>Nenhum RDO registrado.</Td></tr>}</tbody>
        </table>
      </Card>

      <MedicaoGerador obras={obras} eapPorObra={eapPorObra} rdos={rdos} usuarioNome={usuario.nome} />
    </div>
  );
}

/* ============================ Gerar Medição (boletim em PDF) ============================ */
function MedicaoGerador({ obras, eapPorObra, rdos, usuarioNome }) {
  const [obraId, setObraId] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState(hojeISO());
  const [modo, setModo] = useState("acumulada"); // 'periodo' (incremental) | 'acumulada'
  useEffect(() => { if (!obraId && obras[0]) setObraId(obras[0].id); }, [obras]);
  const obra = obras.find((o) => o.id === obraId);
  const itens = eapPorObra[obraId] || [];

  // quantidade executada por código de EAP no critério escolhido
  const execPorCodigo = useMemo(() => {
    const m = {};
    rdos.filter((r) => r.obra_id === obraId).forEach((r) => {
      const d = String(r.data || "").slice(0, 10);
      if (!d) return;
      if (modo === "acumulada") { if (fim && d > fim) return; }
      else { if (ini && d < ini) return; if (fim && d > fim) return; }
      (r.atividades || []).forEach((a) => { m[a.eap] = (m[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); });
    });
    return m;
  }, [rdos, obraId, ini, fim, modo]);

  const linhas = useMemo(() => itens.map((e) => {
    const qtde = Number(e.qtde) || 0;
    const valorTotal = Number(e.valor_total) || 0;            // c/BDI, líquido de desconto
    const bdi = Number(e.bdi) || 0;
    const valorTotalSemBdi = valorTotal / (1 + bdi);
    const execQtde = Math.max(0, execPorCodigo[e.codigo] || 0);
    const pctExec = qtde ? Math.min(execQtde / qtde, 1) : 0;
    return {
      codigo: e.codigo, descricao: e.descricao, unidade: e.unidade, qtde,
      valor_total: valorTotal, valorUnit: qtde ? valorTotal / qtde : 0, bdi,
      execQtde, pctExec, valorComBdi: pctExec * valorTotal, valorSemBdi: pctExec * valorTotalSemBdi,
    };
  }), [itens, execPorCodigo]);

  const totalComBdi = sum(linhas.map((l) => l.valorComBdi));
  const totalSemBdi = sum(linhas.map((l) => l.valorSemBdi));
  const semItens = obraId && itens.length === 0;

  return (
    <Card title="Gerar medição — boletim no papel timbrado (PDF)">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 150 }}><Lbl>Obra</Lbl><select value={obraId} onChange={(e) => setObraId(e.target.value)} style={inp({ width: "100%" })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
        <div><Lbl>Data inicial</Lbl><input type="date" value={ini} onChange={(e) => setIni(e.target.value)} disabled={modo === "acumulada"} style={inp({ boxSizing: "border-box", opacity: modo === "acumulada" ? 0.5 : 1 })} /></div>
        <div><Lbl>Data final</Lbl><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} style={inp({ boxSizing: "border-box" })} /></div>
        <div><Lbl>Critério</Lbl><select value={modo} onChange={(e) => setModo(e.target.value)} style={inp()}>
          <option value="periodo">Avanço no período (incremental)</option>
          <option value="acumulada">Acumulada até a data final</option>
        </select></div>
        <Btn small disabled={semItens || !obraId} onClick={() => gerarPdfMedicao(obra || {}, linhas, { ini, fim, modo }, usuarioNome)}>⇩ Gerar PDF da medição</Btn>
      </div>
      {semItens && <div style={{ fontSize: 12, color: C.vermelho }}>Esta obra não tem EAP carregada. Faça o upload na aba Obras.</div>}
      {!semItens && obraId && <div style={{ fontSize: 13, color: C.dim }}>
        Prévia: <b style={{ color: C.verde }}>{fmtR(totalComBdi)}</b> c/BDI · <b style={{ color: C.preto }}>{fmtR(totalSemBdi)}</b> s/BDI ·
        {" "}{linhas.filter((l) => l.pctExec > 0).length} de {linhas.length} itens com avanço no critério selecionado.
        {modo === "periodo" ? " O PDF traz a planilha analítica completa com o avanço registrado entre as datas." : " O PDF traz a planilha analítica completa com o avanço acumulado até a data final."}
      </div>}
    </Card>
  );
}

/* ============================ OS-i (Ordem de Serviço Inteligente) ============================ */
function OsI({ obras, eapPorObra, contratos, draft, onConsumeDraft, onMudou }) {
  const vazio = { obra_id: "", empresa: "", cnpj: "", responsavel: "", tipo: "indireto", custo_mensal: 0, meses: 1, itens_eap: [], valor: 0, cond: { modo: "valor", parcelas: [] } };
  const [ct, setCt] = useState(vazio);
  useEffect(() => {
    if (draft) {
      setCt({ ...vazio, obra_id: draft.obra_id || "", tipo: "indireto", responsavel: draft.responsavel || "", itens_eap: draft.itens_eap || [] });
      onConsumeDraft && onConsumeDraft();
    }
  }, [draft]); // eslint-disable-line
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const cnpjMask = (v) => v.replace(/\D/g, "").slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  const eapItens = eapPorObra[ct.obra_id] || [];
  const valorTotal = ct.tipo === "direto" ? (Number(ct.custo_mensal) || 0) * (Number(ct.meses) || 0) : sum(ct.itens_eap.map((x) => x.valor));
  const salvar = async () => {
    setBusy(true);
    try {
      const payload = { obra_id: ct.obra_id || null, empresa: ct.empresa, cnpj: ct.cnpj, responsavel: ct.responsavel,
        tipo: ct.tipo, custo_mensal: ct.tipo === "direto" ? Number(ct.custo_mensal) || 0 : null, meses: ct.tipo === "direto" ? Number(ct.meses) || 0 : null,
        itens_eap: ct.itens_eap, escopo_eap: ct.itens_eap.map((x) => x.eap_codigo).join(", "), valor: valorTotal, condicao_pagamento: ct.cond };
      if (editId) await editar("contratos_servico", editId, payload); else await criar("contratos_servico", payload);
      setCt({ ...vazio, obra_id: ct.obra_id }); setEditId(null); onMudou();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const carregarOs = (x) => {
    setCt({ obra_id: x.obra_id || "", empresa: x.empresa || "", cnpj: x.cnpj || "", responsavel: x.responsavel || "", tipo: x.tipo || "indireto", custo_mensal: x.custo_mensal || 0, meses: x.meses || 1, itens_eap: x.itens_eap || [], valor: x.valor || 0, cond: x.condicao_pagamento || { modo: "valor", parcelas: [] } });
    setEditId(x.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addParcela = () => setCt((c) => ({ ...c, cond: { ...c.cond, parcelas: [...(c.cond?.parcelas || []), { descricao: `Parcela ${(c.cond?.parcelas?.length || 0) + 1}`, valor: 0, pct: 0 }] } }));
  const upParcela = (i, patch) => setCt((c) => ({ ...c, cond: { ...c.cond, parcelas: c.cond.parcelas.map((p, j) => j === i ? { ...p, ...patch } : p) } }));
  const delParcela = (i) => setCt((c) => ({ ...c, cond: { ...c.cond, parcelas: c.cond.parcelas.filter((_, j) => j !== i) } }));
  const condModo = ct.cond?.modo || "valor";
  const somaParcelas = condModo === "valor" ? sum((ct.cond?.parcelas || []).map((p) => Number(p.valor) || 0)) : sum((ct.cond?.parcelas || []).map((p) => Number(p.pct) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title={editId ? "OS-i · editando ordem de serviço" : "OS-i · Ordem de Serviço Inteligente — contratos diretos e indiretos"}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ minWidth: 140 }}><Lbl>Obra</Lbl><select value={ct.obra_id} onChange={(e) => setCt({ ...ct, obra_id: e.target.value, itens_eap: [] })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 160 }}><Lbl>Empresa</Lbl><input value={ct.empresa} onChange={(e) => setCt({ ...ct, empresa: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>CNPJ</Lbl><input value={ct.cnpj} onChange={(e) => setCt({ ...ct, cnpj: cnpjMask(e.target.value) })} placeholder="00.000.000/0000-00" style={inp({ width: 165 })} /></div>
          <div style={{ minWidth: 150 }}><Lbl>Responsável em obra</Lbl><input value={ct.responsavel} onChange={(e) => setCt({ ...ct, responsavel: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Tipo de contrato</Lbl><select value={ct.tipo} onChange={(e) => setCt({ ...ct, tipo: e.target.value })} style={inp()}><option value="indireto">Indireto (por escopo)</option><option value="direto">Direto (custo mensal)</option></select></div>
        </div>
        {ct.tipo === "direto" && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, background: C.laranjaClaro, borderRadius: 8, padding: "10px 12px" }}>
            <div><Lbl>Custo mensal</Lbl><NumInput value={ct.custo_mensal} onChange={(v) => setCt({ ...ct, custo_mensal: v })} /></div>
            <div><Lbl>Por quantos meses</Lbl><input type="number" min="1" value={ct.meses} onChange={(e) => setCt({ ...ct, meses: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /></div>
            <div style={{ fontSize: 13, color: C.dim, paddingBottom: 4 }}>Valor total: <b style={{ color: C.verde, fontSize: 16 }}>{fmtR(valorTotal)}</b></div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <Lbl>Itens da EAP cobertos por este contrato (um ou mais)</Lbl>
          {ct.obra_id ? <MultiEapPicker itens={eapItens} valor={ct.itens_eap} onChange={(v) => setCt({ ...ct, itens_eap: v })} comValor={ct.tipo === "indireto"} labelValor="Valor do item" />
            : <div style={{ fontSize: 12, color: C.dim }}>Selecione uma obra para listar a EAP.</div>}
        </div>
        <div style={{ marginBottom: 12, borderTop: `1px solid ${C.linha}`, paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <Lbl>Condição de pagamento (parcelas)</Lbl>
            <select value={condModo} onChange={(e) => setCt({ ...ct, cond: { ...ct.cond, modo: e.target.value } })} style={inp({ width: 200 })}>
              <option value="valor">Por valor (R$)</option>
              <option value="pct">Por % de avanço</option>
            </select>
            <Btn small kind="ghost" onClick={addParcela}>+ Adicionar parcela</Btn>
          </div>
          {(ct.cond?.parcelas || []).length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
              <thead><tr><Th>Descrição / marco</Th><Th right>{condModo === "valor" ? "Valor (R$)" : "% de avanço"}</Th><Th right>{condModo === "pct" ? "Valor estimado" : ""}</Th><Th /></tr></thead>
              <tbody>{ct.cond.parcelas.map((p, i) => (
                <tr key={i}>
                  <Td><input value={p.descricao || ""} onChange={(e) => upParcela(i, { descricao: e.target.value })} placeholder="Ex.: 1ª medição / entrada / 30 dias" style={inp({ width: "100%", boxSizing: "border-box" })} /></Td>
                  <Td right>{condModo === "valor"
                    ? <NumInput value={p.valor || 0} onChange={(v) => upParcela(i, { valor: v })} />
                    : <input type="number" min="0" step="0.01" value={p.pct || ""} onChange={(e) => upParcela(i, { pct: parseFloat(e.target.value) || 0 })} style={inp({ width: 90, textAlign: "right" })} />}</Td>
                  <Td right color={C.dim}>{condModo === "pct" ? fmtR((Number(p.pct) || 0) / 100 * valorTotal) : ""}</Td>
                  <Td><button onClick={() => delParcela(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 15 }}>✕</button></Td>
                </tr>))}</tbody>
            </table>
          )}
          {(ct.cond?.parcelas || []).length > 0 && (
            <div style={{ fontSize: 12, color: condModo === "valor" ? (Math.abs(somaParcelas - valorTotal) < 0.01 ? C.verde : C.amareloAlerta) : (Math.abs(somaParcelas - 100) < 0.01 ? C.verde : C.amareloAlerta), fontWeight: 700 }}>
              {condModo === "valor" ? `Soma das parcelas: ${fmtR(somaParcelas)} de ${fmtR(valorTotal)}${Math.abs(somaParcelas - valorTotal) < 0.01 ? " ✓" : " (difere do valor do contrato)"}` : `Soma dos percentuais: ${somaParcelas.toFixed(1)}%${Math.abs(somaParcelas - 100) < 0.01 ? " ✓" : " (deveria somar 100%)"}`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: C.dim }}>Valor do contrato: <b style={{ color: C.verde, fontSize: 16 }}>{fmtR(valorTotal)}</b></div>
          <div style={{ flex: 1 }} />
          <Btn small disabled={busy || !ct.cnpj || !ct.responsavel || ct.itens_eap.length === 0} onClick={salvar}>{busy ? "Salvando…" : editId ? "Salvar alterações" : "+ Cadastrar OS"}</Btn>
          {editId && <Btn small kind="ghost" onClick={() => { setCt({ ...vazio }); setEditId(null); }}>Cancelar edição</Btn>}
        </div>
      </Card>
      <Card title={`Ordens de serviço (${contratos.length})`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Obra</Th><Th>Empresa</Th><Th>CNPJ</Th><Th>Tipo</Th><Th>Itens EAP</Th><Th right>Mensal × meses</Th><Th right>Valor</Th><Th /></tr></thead>
          <tbody>{contratos.map((x) => { const o = obras.find((y) => y.id === x.obra_id); const itens = (x.itens_eap && x.itens_eap.length) ? x.itens_eap : (x.escopo_eap ? [{ eap_codigo: x.escopo_eap }] : []); return (
            <tr key={x.id}><Td>{o?.codigo || "—"}</Td><Td style={{ fontWeight: 600 }}>{x.empresa || "—"}</Td><Td>{x.cnpj}</Td>
              <Td><span style={{ background: x.tipo === "direto" ? C.laranja : C.cinza2, color: x.tipo === "direto" ? "#fff" : C.dim, borderRadius: 5, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{x.tipo || "indireto"}</span></Td>
              <Td style={{ fontSize: 12 }}>{itens.map((i) => i.eap_codigo).join(", ") || "—"}</Td>
              <Td right>{x.tipo === "direto" ? `${fmtR(x.custo_mensal)} × ${x.meses}` : "—"}</Td>
              <Td right color={C.verde} style={{ fontWeight: 700 }}>{fmtR(x.valor)}</Td>
              <Td><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><button onClick={() => carregarOs(x)} style={{ background: "none", border: `1px solid ${C.linha}`, color: C.azul, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Editar</button><button onClick={async () => { if (confirm("Excluir OS?")) { await remover("contratos_servico", x.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></div></Td></tr>
          ); })}
            {contratos.length === 0 && <tr><Td colSpan={8} color={C.dim} style={{ padding: 14 }}>Nenhuma ordem de serviço.</Td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

/* ============================ OC-i (materiais) — múltiplos itens de EAP ============================ */
/* Gera as parcelas de uma condição de pagamento, identificadas por DIAS após o faturamento.
   tipo: 'avista' | 'entrada_parcelas' | 'parcelado'. O texto de dias (ex.: "30/60/90") tem
   prioridade; na ausência, usa nº de parcelas + 1º vencimento + intervalo. */
function gerarParcelas(cond, total) {
  const t = Number(total) || 0;
  if (!cond || cond.tipo === "avista") return [{ dias: 0, valor: t }];
  const entrada = cond.tipo === "entrada_parcelas" ? Math.min(Number(cond.entrada) || 0, t) : 0;
  let dias = [];
  const txt = String(cond.diasTexto || "").trim();
  if (txt) dias = txt.split(/[^\d]+/).map((x) => parseInt(x, 10)).filter((x) => x > 0);
  if (!dias.length) {
    const n = Math.max(1, parseInt(cond.nParcelas, 10) || 1);
    const p1 = Number(cond.primeiroDias) || 30, iv = Number(cond.intervaloDias) || 30;
    dias = Array.from({ length: n }, (_, i) => p1 + i * iv);
  }
  const n = dias.length, base = Math.round(((t - entrada) / n) * 100) / 100;
  const parcelas = []; let acum = 0;
  if (entrada > 0) parcelas.push({ dias: 0, valor: Math.round(entrada * 100) / 100, entrada: true });
  dias.forEach((d, i) => { let v = base; if (i === n - 1) v = Math.round((t - entrada - acum) * 100) / 100; acum += v; parcelas.push({ dias: d, valor: v }); });
  return parcelas;
}
/* resumo textual da condição p/ a tabela */
function resumoCond(oc) {
  const c = oc.condicao_pagamento;
  if (!c || c.tipo === "avista") return "À vista";
  const ps = (c.parcelas || []).filter((p) => !p.entrada);
  const dias = ps.map((p) => p.dias).join("/");
  const ent = c.tipo === "entrada_parcelas" && (Number(c.entrada) || 0) > 0 ? `entrada ${fmtR(c.entrada)} + ` : "";
  return `${ent}${ps.length}x (${dias} dias)`;
}

/* Editor de linhas da OC-i: cada material vinculado a uma atividade da EAP, com qtde, unidade e valor unitário. */
function OcLinhas({ itens, valor = [], onChange }) {
  const addEap = (it) => onChange([...valor, { eap_codigo: it.codigo, descricao: it.descricao, material: "", quantidade: 1, unidade: it.unidade || "un", valorUnit: 0, valor: 0 }]);
  const upd = (i, patch) => onChange(valor.map((x, j) => { if (j !== i) return x; const n = { ...x, ...patch }; n.valor = (Number(n.quantidade) || 0) * (Number(n.valorUnit) || 0); return n; }));
  const del = (i) => onChange(valor.filter((_, j) => j !== i));
  return (
    <div>
      <ComboEap itens={itens} valor="" onSelect={addEap} placeholder="+ Adicionar item da EAP a esta compra…" />
      {valor.length > 0 && (
        <div style={{ marginTop: 8, border: `1px solid ${C.linha}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.4fr) minmax(120px,1.6fr) 70px 64px 110px 110px 30px", gap: 6, padding: "6px 8px", background: C.preto, color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
            <div>Item da EAP</div><div>Material</div><div style={{ textAlign: "right" }}>Qtde</div><div>Unid.</div><div style={{ textAlign: "right" }}>Vlr unit.</div><div style={{ textAlign: "right" }}>Total</div><div />
          </div>
          {valor.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.4fr) minmax(120px,1.6fr) 70px 64px 110px 110px 30px", gap: 6, padding: "6px 8px", alignItems: "center", borderTop: `1px solid ${C.linha}`, background: i % 2 ? "#fafafa" : "#fff" }}>
              <div><span style={{ background: C.preto, color: C.laranja, fontWeight: 800, fontSize: 11, borderRadius: 5, padding: "2px 7px" }}>{x.eap_codigo}</span><div style={{ fontSize: 10, color: C.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.descricao}</div></div>
              <input value={x.material} onChange={(e) => upd(i, { material: e.target.value })} placeholder="descrição do material" style={inp({ fontSize: 12, padding: "5px 8px", width: "100%", boxSizing: "border-box" })} />
              <input type="number" min="0" step="0.01" value={x.quantidade} onChange={(e) => upd(i, { quantidade: parseFloat(e.target.value) || 0 })} style={inp({ fontSize: 12, padding: "5px 6px", textAlign: "right", width: "100%", boxSizing: "border-box" })} />
              <input value={x.unidade} onChange={(e) => upd(i, { unidade: e.target.value })} style={inp({ fontSize: 12, padding: "5px 6px", width: "100%", boxSizing: "border-box" })} />
              <NumInput w={104} value={x.valorUnit} onChange={(v) => upd(i, { valorUnit: v })} />
              <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: C.laranja, fontVariantNumeric: "tabular-nums" }}>{fmt(x.valor)}</div>
              <button onClick={() => del(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: C.preto, color: "#fff", fontSize: 12, fontWeight: 700 }}>
            <span>{valor.length} {valor.length === 1 ? "material" : "materiais"}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtR(sum(valor.map((x) => x.valor)))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OcI({ obras, eapPorObra, ocs, restricoes, colaboradores = [], usuario, draft, onConsumeDraft, onMudou }) {
  const vazio = { obra_id: "", numero: "", fornecedor: "", data: hojeISO(), itens_eap: [],
    data_faturamento: hojeISO(), cond: { tipo: "avista", entrada: 0, nParcelas: 3, primeiroDias: 30, intervaloDias: 30, diasTexto: "" },
    solicitante: "", comprador: "", cliente: "", solicitacaoNum: "", cnoOverride: "", observacao: "",
    forn: { razao: "", cnpj: "", vendedor: "", contatoVendedor: "", endereco: "", contatoLoja: "" },
    entrega: { data: "", endereco: "", responsavel: "", contato: "" } };
  const [oc, setOc] = useState(vazio);
  useEffect(() => {
    if (draft) {
      setOc({ ...vazio, obra_id: draft.obra_id || "", itens_eap: draft.itens_eap || [], solicitante: draft.solicitante || "", solicitacaoNum: draft.solicitacaoNum || "", observacao: draft.observacao || "" });
      onConsumeDraft && onConsumeDraft();
    }
  }, [draft]); // eslint-disable-line
  const [busy, setBusy] = useState(false);
  const [abrirForn, setAbrirForn] = useState(false);
  const [editId, setEditId] = useState(null);
  const carregarOc = (x) => {
    const d = x.dados_oc || {};
    const cp = x.condicao_pagamento || {};
    setOc({
      obra_id: x.obra_id || "", numero: x.numero || "", fornecedor: x.fornecedor || "",
      data: String(x.data || hojeISO()).slice(0, 10), data_faturamento: String(x.data_faturamento || x.data || hojeISO()).slice(0, 10),
      cond: { tipo: cp.tipo || "avista", entrada: cp.entrada || 0, nParcelas: cp.nParcelas || 3, primeiroDias: cp.primeiroDias || 30, intervaloDias: cp.intervaloDias || 30, diasTexto: cp.diasTexto || "" },
      itens_eap: x.itens_eap || [], solicitante: d.solicitante || "", comprador: d.comprador || "", cliente: d.cliente || "",
      solicitacaoNum: d.solicitacaoNum || "", cnoOverride: d.cno || "", observacao: d.observacao || "",
      forn: d.fornecedor || { razao: "", cnpj: "", vendedor: "", contatoVendedor: "", endereco: "", contatoLoja: "" },
      entrega: d.entrega || { data: "", endereco: "", responsavel: "", contato: "" },
    });
    setEditId(x.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const obra = obras.find((o) => o.id === oc.obra_id);
  const eapItens = eapPorObra[oc.obra_id] || [];
  const valorTotal = sum(oc.itens_eap.map((x) => x.valor));
  const parcelas = useMemo(() => gerarParcelas(oc.cond, valorTotal), [oc.cond, valorTotal]);
  const upCond = (patch) => setOc((o) => ({ ...o, cond: { ...o.cond, ...patch } }));
  const upForn = (patch) => setOc((o) => ({ ...o, forn: { ...o.forn, ...patch } }));
  const upEntrega = (patch) => setOc((o) => ({ ...o, entrega: { ...o.entrega, ...patch } }));
  const cnoEfetivo = oc.cnoOverride || obra?.cno || "";
  const cnpjMask = (v) => v.replace(/\D/g, "").slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  const salvar = async () => {
    setBusy(true);
    try {
      const condicao_pagamento = { ...oc.cond, parcelas };
      const dados_oc = { solicitante: oc.solicitante, comprador: oc.comprador, cliente: oc.cliente, solicitacaoNum: oc.solicitacaoNum,
        cno: cnoEfetivo, observacao: oc.observacao, fornecedor: oc.forn, entrega: oc.entrega };
      const payload = { obra_id: oc.obra_id || null, numero: oc.numero, fornecedor: oc.fornecedor, data: oc.data,
        data_faturamento: oc.data_faturamento || oc.data, condicao_pagamento, dados_oc,
        itens_eap: oc.itens_eap, eap_codigo: oc.itens_eap.map((x) => x.eap_codigo).join(", "),
        material: oc.itens_eap.map((x) => x.material || x.descricao).filter(Boolean).join("; "), valor: valorTotal };
      if (editId) await editar("ordens_compra", editId, payload); else await criar("ordens_compra", payload);
      setOc({ ...vazio, obra_id: oc.obra_id }); setEditId(null); onMudou();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const restAbertas = restricoes.filter((r) => !r.resolvida);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title={editId ? "OC-i · editando ordem de compra" : "OC-i · Ordem de compra de materiais — gera PDF para o fornecedor"}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ minWidth: 140 }}><Lbl>Obra</Lbl><select value={oc.obra_id} onChange={(e) => setOc({ ...oc, obra_id: e.target.value, itens_eap: [] })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          <div><Lbl>OC nº</Lbl><input value={oc.numero} onChange={(e) => setOc({ ...oc, numero: e.target.value })} style={inp({ width: 100 })} /></div>
          <div><Lbl>Solicitação nº</Lbl><input value={oc.solicitacaoNum} onChange={(e) => setOc({ ...oc, solicitacaoNum: e.target.value })} style={inp({ width: 110 })} /></div>
          <div><Lbl>Emissão</Lbl><input type="date" value={oc.data} onChange={(e) => setOc({ ...oc, data: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
          <div style={{ minWidth: 130 }}><Lbl>Cliente</Lbl><input value={oc.cliente} onChange={(e) => setOc({ ...oc, cliente: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 170 }}><Lbl>Solicitante (quem pediu)</Lbl><PessoaSelect colaboradores={colaboradores} usuario={usuario} setores={["obras", "suprimentos"]} value={oc.solicitante} onChange={(v) => setOc({ ...oc, solicitante: v })} placeholder="selecione o solicitante…" /></div>
          <div style={{ flex: 1, minWidth: 170 }}><Lbl>Comprador (responsável pela emissão da OC-i)</Lbl><PessoaSelect colaboradores={colaboradores} usuario={usuario} setores={["suprimentos"]} value={oc.comprador} onChange={(v) => setOc({ ...oc, comprador: v })} placeholder="selecione o comprador…" /></div>
          <div style={{ minWidth: 150 }}><Lbl>CNO da obra {obra?.cno ? "" : "(defina na aba Obras)"}</Lbl><input value={cnoEfetivo} onChange={(e) => setOc({ ...oc, cnoOverride: e.target.value })} placeholder="00.000.00000/00" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        </div>

        {/* FORNECEDOR */}
        <div style={{ border: `1.5px solid ${C.linha}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: abrirForn ? 10 : 0 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em" }}>🏷️ Dados do fornecedor (saem no PDF)</div>
            <Btn small kind="ghost" onClick={() => setAbrirForn((v) => !v)}>{abrirForn ? "ocultar" : "preencher"}</Btn>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 180 }}><Lbl>Nome fantasia</Lbl><input value={oc.fornecedor} onChange={(e) => setOc({ ...oc, fornecedor: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            {abrirForn && <>
              <div style={{ flex: 1, minWidth: 180 }}><Lbl>Razão social</Lbl><input value={oc.forn.razao} onChange={(e) => upForn({ razao: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div><Lbl>CNPJ</Lbl><input value={oc.forn.cnpj} onChange={(e) => upForn({ cnpj: cnpjMask(e.target.value) })} placeholder="00.000.000/0000-00" style={inp({ width: 165 })} /></div>
              <div style={{ minWidth: 150 }}><Lbl>Vendedor</Lbl><input value={oc.forn.vendedor} onChange={(e) => upForn({ vendedor: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ minWidth: 150 }}><Lbl>Contato do vendedor</Lbl><input value={oc.forn.contatoVendedor} onChange={(e) => upForn({ contatoVendedor: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Endereço</Lbl><input value={oc.forn.endereco} onChange={(e) => upForn({ endereco: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ minWidth: 140 }}><Lbl>Contato da loja</Lbl><input value={oc.forn.contatoLoja} onChange={(e) => upForn({ contatoLoja: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            </>}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Lbl>Pedido — relacione cada material a uma atividade da EAP</Lbl>
          {oc.obra_id ? <OcLinhas itens={eapItens} valor={oc.itens_eap} onChange={(v) => setOc({ ...oc, itens_eap: v })} />
            : <div style={{ fontSize: 12, color: C.dim }}>Selecione uma obra para listar a EAP.</div>}
        </div>

        {/* CONDIÇÃO DE PAGAMENTO — parcelas identificadas por dias após o faturamento */}
        <div style={{ border: `1.5px solid ${C.linha}`, borderLeft: `5px solid ${C.laranja}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "#fafafa" }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>💳 Condição de pagamento</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><Lbl>Forma</Lbl><select value={oc.cond.tipo} onChange={(e) => upCond({ tipo: e.target.value })} style={inp()}>
              <option value="avista">À vista</option>
              <option value="entrada_parcelas">Entrada + parcelamento</option>
              <option value="parcelado">Parcelamento puro (sem entrada)</option>
            </select></div>
            <div><Lbl>Data do faturamento</Lbl><input type="date" value={oc.data_faturamento} onChange={(e) => setOc({ ...oc, data_faturamento: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
            {oc.cond.tipo === "entrada_parcelas" && <div><Lbl>Entrada (R$)</Lbl><NumInput value={oc.cond.entrada} onChange={(v) => upCond({ entrada: v })} /></div>}
            {oc.cond.tipo !== "avista" && <>
              <div><Lbl>Vencimentos (dias após fat.)</Lbl><input value={oc.cond.diasTexto} onChange={(e) => upCond({ diasTexto: e.target.value })} placeholder="ex.: 30/60/90" style={inp({ width: 130 })} /></div>
              <div style={{ fontSize: 11, color: C.dim, paddingBottom: 6 }}>ou gere automaticamente:</div>
              <div><Lbl>Nº parcelas</Lbl><input type="number" min="1" value={oc.cond.nParcelas} onChange={(e) => upCond({ nParcelas: e.target.value })} disabled={!!oc.cond.diasTexto.trim()} style={inp({ width: 70, textAlign: "right", opacity: oc.cond.diasTexto.trim() ? 0.5 : 1 })} /></div>
              <div><Lbl>1º venc. (dias)</Lbl><input type="number" min="1" value={oc.cond.primeiroDias} onChange={(e) => upCond({ primeiroDias: e.target.value })} disabled={!!oc.cond.diasTexto.trim()} style={inp({ width: 70, textAlign: "right", opacity: oc.cond.diasTexto.trim() ? 0.5 : 1 })} /></div>
              <div><Lbl>Intervalo (dias)</Lbl><input type="number" min="1" value={oc.cond.intervaloDias} onChange={(e) => upCond({ intervaloDias: e.target.value })} disabled={!!oc.cond.diasTexto.trim()} style={inp({ width: 70, textAlign: "right", opacity: oc.cond.diasTexto.trim() ? 0.5 : 1 })} /></div>
            </>}
          </div>
          {valorTotal > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {parcelas.map((p, i) => (
                <div key={i} style={{ border: `1px solid ${p.entrada ? C.laranja : C.linha}`, background: p.entrada ? C.laranjaClaro : "#fff", borderRadius: 8, padding: "6px 12px", minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontWeight: 700 }}>{p.entrada ? "Entrada" : `${p.dias} dias`}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.preto }}>{fmtR(p.valor)}</div>
                  <div style={{ fontSize: 10, color: C.dim }}>{dataBR(addDiasISO(oc.data_faturamento || oc.data, p.dias))}</div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: C.dim, paddingLeft: 6 }}>Σ {fmtR(sum(parcelas.map((p) => p.valor)))}</div>
            </div>
          )}
        </div>

        {/* ENTREGA */}
        <div style={{ border: `1.5px solid ${C.linha}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🚚 Dados de entrega</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><Lbl>Data de entrega</Lbl><input type="date" value={oc.entrega.data} onChange={(e) => upEntrega({ data: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
            <div style={{ flex: 1, minWidth: 220 }}><Lbl>Endereço de entrega</Lbl><input value={oc.entrega.endereco} onChange={(e) => upEntrega({ endereco: e.target.value })} placeholder={obra?.local || ""} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            <div style={{ minWidth: 150 }}><Lbl>Responsável</Lbl><input value={oc.entrega.responsavel} onChange={(e) => upEntrega({ responsavel: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            <div style={{ minWidth: 130 }}><Lbl>Contato</Lbl><input value={oc.entrega.contato} onChange={(e) => upEntrega({ contato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          </div>
          <div style={{ marginTop: 10 }}><Lbl>Observação para a NF</Lbl><input value={oc.observacao} onChange={(e) => setOc({ ...oc, observacao: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: C.dim }}>Total da OC: <b style={{ color: C.laranja, fontSize: 16 }}>{fmtR(valorTotal)}</b></div>
          <div style={{ flex: 1 }} />
          <Btn small disabled={busy || oc.itens_eap.length === 0} onClick={salvar}>{busy ? "Salvando…" : editId ? "Salvar alterações" : "+ Lançar OC"}</Btn>
          {editId && <Btn small kind="ghost" onClick={() => { setOc({ ...vazio }); setEditId(null); }}>Cancelar edição</Btn>}
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>OC</Th><Th>Obra</Th><Th>Faturamento</Th><Th>Fornecedor</Th><Th>Itens EAP</Th><Th>Pagamento</Th><Th right>Valor</Th><Th>PDF</Th><Th /></tr></thead>
          <tbody>{ocs.map((x) => { const o = obras.find((y) => y.id === x.obra_id); const itens = (x.itens_eap && x.itens_eap.length) ? x.itens_eap.map((i) => i.eap_codigo).join(", ") : (x.eap_codigo || "—"); return <tr key={x.id}><Td>{x.numero || "—"}</Td><Td>{o?.codigo || "—"}</Td><Td>{dataBR(x.data_faturamento || x.data)}</Td><Td>{x.fornecedor || "—"}</Td><Td style={{ fontSize: 12 }}>{itens}</Td><Td style={{ fontSize: 12 }}>{resumoCond(x)}</Td><Td right color={C.laranja}>{fmtR(x.valor)}</Td>
            <Td><button onClick={() => gerarPdfOC(x, o || {})} style={{ background: "none", border: `1px solid ${C.laranja}`, color: C.laranja, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>PDF</button></Td>
            <Td><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><button onClick={() => carregarOc(x)} style={{ background: "none", border: `1px solid ${C.linha}`, color: C.azul, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Editar</button><button onClick={async () => { if (confirm("Excluir OC?")) { await remover("ordens_compra", x.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></div></Td></tr>; })}
            {ocs.length === 0 && <tr><Td colSpan={9} color={C.dim} style={{ padding: 14 }}>Nenhuma OC lançada.</Td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

/* ============================ Prestadores em obra (diretos × indiretos) ============================ */
function Prestadores({ obras, funcionarios, contratos, onMudou }) {
  const vazio = { nome: "", atribuicao: ATRIBUICOES[0], vinculo: "direto", obra_id: "", custo_mensal: 0, contrato_id: "" };
  const [f, setF] = useState(vazio);
  const [filtro, setFiltro] = useState("todos");
  const [busy, setBusy] = useState(false);
  const salvar = async () => { setBusy(true); try { await criar("funcionarios", { ...f, obra_id: f.obra_id || null, contrato_id: f.contrato_id || null, custo_mensal: Number(f.custo_mensal) || null }); setF({ ...vazio, vinculo: f.vinculo, obra_id: f.obra_id }); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const lista = funcionarios.filter((x) => filtro === "todos" || (x.vinculo || "direto") === filtro);
  const diretos = funcionarios.filter((x) => (x.vinculo || "direto") === "direto");
  const indiretos = funcionarios.filter((x) => x.vinculo === "indireto");
  const custoDiretos = sum(diretos.map((x) => x.custo_mensal));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi label="Prestadores diretos" value={diretos.length} sub={`custo mensal ${fmtR(custoDiretos)}`} accent={C.laranja} />
        <Kpi label="Prestadores indiretos" value={indiretos.length} />
        <Kpi label="Total cadastrado" value={funcionarios.length} dark />
      </div>
      <Card title="Cadastro de prestadores em obra">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 170 }}><Lbl>Nome completo</Lbl><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div><Lbl>Atribuição</Lbl><select value={f.atribuicao} onChange={(e) => setF({ ...f, atribuicao: e.target.value })} style={inp({ maxWidth: 230 })}>{ATRIBUICOES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><Lbl>Vínculo</Lbl><select value={f.vinculo} onChange={(e) => setF({ ...f, vinculo: e.target.value })} style={inp()}><option value="direto">Direto</option><option value="indireto">Indireto</option></select></div>
          <div style={{ minWidth: 130 }}><Lbl>Obra</Lbl><select value={f.obra_id} onChange={(e) => setF({ ...f, obra_id: e.target.value })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
          {f.vinculo === "direto" && <div><Lbl>Custo mensal</Lbl><NumInput value={f.custo_mensal} onChange={(v) => setF({ ...f, custo_mensal: v })} /></div>}
          {f.vinculo === "indireto" && <div style={{ minWidth: 180 }}><Lbl>Contrato (OS-i)</Lbl><select value={f.contrato_id} onChange={(e) => setF({ ...f, contrato_id: e.target.value })} style={inp({ width: "100%" })}><option value="">—</option>{contratos.map((c) => <option key={c.id} value={c.id}>{c.empresa || c.responsavel}</option>)}</select></div>}
          <Btn small disabled={busy || !f.nome.trim()} onClick={salvar}>+ Cadastrar</Btn>
        </div>
      </Card>
      <Card title={`Prestadores (${lista.length})`} right={
        <div style={{ display: "flex", gap: 4 }}>{["todos", "direto", "indireto"].map((v) => <button key={v} onClick={() => setFiltro(v)} style={{ background: filtro === v ? C.preto : C.branco, color: filtro === v ? "#fff" : C.dim, border: `1px solid ${filtro === v ? C.preto : C.linha}`, borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{v}</button>)}</div>}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Nome</Th><Th>Atribuição</Th><Th>Vínculo</Th><Th>Obra</Th><Th>Contrato</Th><Th right>Custo mensal</Th><Th /></tr></thead>
          <tbody>{lista.map((x) => { const o = obras.find((y) => y.id === x.obra_id); const c = contratos.find((y) => y.id === x.contrato_id); return (
            <tr key={x.id}><Td style={{ fontWeight: 600 }}>{x.nome}</Td><Td>{x.atribuicao}</Td>
              <Td><span style={{ background: (x.vinculo || "direto") === "direto" ? C.laranja : C.cinza2, color: (x.vinculo || "direto") === "direto" ? "#fff" : C.dim, borderRadius: 5, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{x.vinculo || "direto"}</span></Td>
              <Td>{o?.codigo || "—"}</Td><Td style={{ fontSize: 12 }}>{c ? (c.empresa || c.responsavel) : "—"}</Td><Td right>{x.custo_mensal ? fmtR(x.custo_mensal) : "—"}</Td>
              <Td><button onClick={async () => { if (confirm("Excluir prestador?")) { await remover("funcionarios", x.id); onMudou(); } }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer" }}>✕</button></Td></tr>
          ); })}
            {lista.length === 0 && <tr><Td colSpan={7} color={C.dim} style={{ padding: 14 }}>Nenhum prestador cadastrado.</Td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

/* ============================ EAP & Custos ============================ */
// realizado por item: soma OCs + OS, considerando os arrays itens_eap (múltiplas EAPs) e legado eap_codigo
function realizadoPorItem(ocs, contratos, obraId) {
  const m = {};
  const add = (cod, val) => { const c = String(cod || "").split(" ")[0].trim(); if (!c) return; m[c] = (m[c] || 0) + (Number(val) || 0); };
  ocs.filter((o) => o.obra_id === obraId).forEach((o) => {
    if (Array.isArray(o.itens_eap) && o.itens_eap.length) o.itens_eap.forEach((x) => add(x.eap_codigo, x.valor));
    else add(o.eap_codigo, o.valor);
  });
  contratos.filter((c) => c.obra_id === obraId).forEach((c) => {
    if (Array.isArray(c.itens_eap) && c.itens_eap.length) {
      if (c.tipo === "direto") { const v = (Number(c.custo_mensal) || 0) * (Number(c.meses) || 0); const n = c.itens_eap.length || 1; c.itens_eap.forEach((x) => add(x.eap_codigo, v / n)); }
      else c.itens_eap.forEach((x) => add(x.eap_codigo, x.valor));
    } else add(c.escopo_eap, c.valor);
  });
  return m;
}
// meta de custo do item: meta_valor × qtde, com fallback (custo s/BDI × desconto × meta%)
function metaItem(e) {
  const csb = Number(e.custo_sem_bdi);
  if (e.meta_valor != null) return Number(e.meta_valor) * (Number(e.qtde) || 0);
  if (csb && e.meta_pct != null) return csb * (1 - (Number(e.desconto) || 0)) * (Number(e.meta_pct) || 0) * (Number(e.qtde) || 0);
  return Number(e.valor_total) || 0; // sem meta definida → usa o contratado c/ desconto
}

function EapCustos({ obras, eapPorObra, ocs, contratos, rdos, onMudou }) {
  const [obraId, setObraId] = useState("");
  const [busca, setBusca] = useState("");
  const [descModal, setDescModal] = useState(false);
  const [metaModal, setMetaModal] = useState(false);
  const [descVal, setDescVal] = useState(0);
  const [metaVal, setMetaVal] = useState(0.85);
  const [metaItemId, setMetaItemId] = useState(null);
  const [metaItemPct, setMetaItemPct] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const [verDash, setVerDash] = useState(true);
  useEffect(() => { if (!obraId && obras[0]) setObraId(obras[0].id); }, [obras]);
  const itens = eapPorObra[obraId] || [];
  const obra = obras.find((o) => o.id === obraId);

  const realizado = useMemo(() => realizadoPorItem(ocs, contratos, obraId), [ocs, contratos, obraId]);
  const exec = useMemo(() => { const m = {}; rdos.filter((r) => r.obra_id === obraId).forEach((r) => (r.atividades || []).forEach((a) => { m[a.eap] = (m[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); })); return m; }, [rdos, obraId]);

  const linhas = itens.map((e) => {
    const real = realizado[e.codigo] || 0;
    const meta = metaItem(e);
    const ex = exec[e.codigo] || 0;
    const avFis = e.qtde ? Math.min(ex / e.qtde, 1) : 0;
    const custoUnitDesc = (Number(e.custo_sem_bdi) || 0) * (1 - (Number(e.desconto) || 0)); // unitário s/BDI já com desconto
    const custoTotalDesc = custoUnitDesc * (Number(e.qtde) || 0);                            // base total p/ comparar com a meta
    const metaUnit = e.qtde ? meta / Number(e.qtde) : (e.meta_valor != null ? Number(e.meta_valor) : (custoUnitDesc * (Number(e.meta_pct) || 0))); // meta por unidade
    const metaProporcional = meta * avFis;        // meta esperada para o que já foi executado
    const desvio = metaProporcional - real;        // > 0 = abaixo da meta (bom)
    const idc = meta ? real / meta : 0;            // % da meta total já gasto
    const cpi = real > 0 ? metaProporcional / real : null; // >=1 dentro da meta
    return { ...e, real, meta, ex, avFis, custoUnitDesc, custoTotalDesc, metaUnit, metaProporcional, desvio, idc, cpi };
  });
  const rows = linhas.filter((e) => !busca || norm(`${e.codigo} ${e.descricao}`).includes(norm(busca)));

  const totMeta = sum(linhas.map((l) => l.meta));
  const totReal = sum(linhas.map((l) => l.real));
  const totMetaProp = sum(linhas.map((l) => l.metaProporcional));
  const cpiGlobal = totReal > 0 ? totMetaProp / totReal : null;
  // totais por coluna (linha de soma da tabela) — só faz sentido somar valores totais, não unitários
  const totCustoTotal = sum(rows.map((l) => l.custoTotalDesc));
  const totMetaCol = sum(rows.map((l) => l.meta));
  const totRealCol = sum(rows.map((l) => l.real));
  const comMeta = linhas.filter((l) => l.meta_pct != null).length;

  const aplicarDesc = async () => { setBusy(true); try { await aplicarDesconto(obraId, Number(descVal) || 0); setDescModal(false); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const aplicarMetaGlobal = async () => { setBusy(true); try { await definirMeta(obraId, Number(metaVal) || 0); setMetaModal(false); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const aplicarMetaItem = async () => { setBusy(true); try { await definirMeta(obraId, Number(metaItemPct) || 0, [metaItemId]); setMetaItemId(null); onMudou(); } catch (e) { alert(e.message); } finally { setBusy(false); } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="EAP & Custos — metas e desempenho das contratações" right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} style={inp({ fontSize: 12, padding: "5px 10px", width: 150 })} />
        <select value={obraId} onChange={(e) => setObraId(e.target.value)} style={inp({ fontSize: 12, padding: "5px 10px" })}>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select>
      </div>}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Btn small kind="ghost" onClick={() => { setDescVal(obra?.desconto || 0); setDescModal(true); }} disabled={!itens.length}>% Aplicar desconto da licitação</Btn>
          <Btn small onClick={() => { setMetaVal(obra?.meta_pct_padrao && obra.meta_pct_padrao !== 1 ? obra.meta_pct_padrao : 0.85); setMetaModal(true); }} disabled={!itens.length}>◎ Definir meta de custo (global)</Btn>
          <div style={{ flex: 1 }} />
          <Btn small kind={verDash ? "dark" : "ghost"} onClick={() => setVerDash((v) => !v)}>{verDash ? "Ver tabela" : "Ver dashboard"}</Btn>
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
          Meta = % sobre o custo SEM BDI (já com desconto da licitação). Realizado vem das OC-i e OS-i. CPI = meta proporcional ao avanço ÷ realizado (≥ 1 = dentro da meta).
          {obra?.desconto ? ` Desconto aplicado: ${pct(obra.desconto, 1)}.` : " Nenhum desconto aplicado ainda."} {comMeta > 0 ? `${comMeta}/${itens.length} itens com meta.` : "Nenhuma meta definida."}
        </div>

        {/* modais simples */}
        {descModal && <ModalMini titulo="Aplicar desconto da licitação a TODA a EAP" onFechar={() => setDescModal(false)}>
          <p style={{ fontSize: 13, color: C.dim }}>Aplica o desconto sobre o custo de cada item (recalcula valor com BDI). Útil quando a planilha veio só com preço de referência, sem o desconto do pregão.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div><Lbl>Desconto</Lbl><input type="number" step="0.001" value={descVal} onChange={(e) => setDescVal(e.target.value)} style={inp({ width: 110, textAlign: "right" })} /><span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>(0,11 = 11%)</span></div>
            <Btn small onClick={aplicarDesc} disabled={busy}>{busy ? "Aplicando…" : "Aplicar a todos os itens"}</Btn>
          </div>
        </ModalMini>}
        {metaModal && <ModalMini titulo="Definir meta de custo (global)" onFechar={() => setMetaModal(false)}>
          <p style={{ fontSize: 13, color: C.dim }}>Percentual sobre o custo SEM BDI (com desconto) pelo qual cada item deve ser fechado. Ex.: 0,85 = meta de fechar por 85% do custo. Aplica a todos; depois você pode ajustar item a item na tabela.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div><Lbl>Meta %</Lbl><input type="number" step="0.01" value={metaVal} onChange={(e) => setMetaVal(e.target.value)} style={inp({ width: 110, textAlign: "right" })} /><span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>(0,85 = 85%)</span></div>
            <Btn small onClick={aplicarMetaGlobal} disabled={busy}>{busy ? "Aplicando…" : "Aplicar a todos os itens"}</Btn>
          </div>
        </ModalMini>}
        {metaItemId && <ModalMini titulo="Meta específica do item" onFechar={() => setMetaItemId(null)}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div><Lbl>Meta % deste item</Lbl><input type="number" step="0.01" value={metaItemPct} onChange={(e) => setMetaItemPct(e.target.value)} style={inp({ width: 110, textAlign: "right" })} /></div>
            <Btn small onClick={aplicarMetaItem} disabled={busy}>Salvar meta do item</Btn>
          </div>
        </ModalMini>}

        {!verDash && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>EAP</Th><Th>Atividade</Th><Th>Unid.</Th><Th right>Qtde</Th><Th right>Custo unit.</Th><Th right>Meta unit.</Th><Th right>Custo total</Th><Th right>Meta %</Th><Th right>Meta total</Th><Th right>Realizado</Th><Th right>Avanço</Th><Th right>CPI</Th><Th /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}>
            <Td>{r.codigo}</Td><Td style={{ fontSize: 12 }}>{r.descricao.length > 36 ? r.descricao.slice(0, 36) + "…" : r.descricao}{r.nao_descrito ? <span style={{ marginLeft: 6, background: C.amareloAlerta, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }}>NÃO DESCR.</span> : null}</Td>
            <Td><b style={{ color: C.laranja }}>{r.unidade}</b></Td>
            <Td right>{fmt(r.qtde)}</Td>
            <Td right>{r.custoUnitDesc ? fmt(r.custoUnitDesc) : "—"}</Td>
            <Td right color={C.verde} style={{ fontWeight: 600 }}>{r.metaUnit ? fmt(r.metaUnit) : "—"}</Td>
            <Td right style={{ fontWeight: 600 }}>{r.custoTotalDesc ? fmt(r.custoTotalDesc) : "—"}</Td>
            <Td right color={r.meta_pct != null ? C.preto : C.dim}>{r.meta_pct != null ? pct(r.meta_pct, 0) : "—"}</Td>
            <Td right color={r.meta > r.custoTotalDesc ? C.vermelho : C.preto}>{fmt(r.meta)}</Td><Td right color={r.real > r.meta ? C.vermelho : C.texto}>{fmt(r.real)}</Td>
            <Td right color={C.azul}>{pct(r.avFis, 0)}</Td>
            <Td right color={r.cpi === null ? C.dim : r.cpi >= 1 ? C.verde : C.vermelho} style={{ fontWeight: 700 }}>{r.cpi === null ? "—" : r.cpi.toFixed(2)}</Td>
            <Td><button onClick={() => { setMetaItemId(r.id); setMetaItemPct(r.meta_pct || 0.85); }} title="Meta específica" style={{ background: "none", border: `1px solid ${C.linha}`, borderRadius: 5, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: C.dim }}>◎</button></Td>
          </tr>)}
            {rows.length === 0 && <tr><Td colSpan={13} color={C.dim} style={{ padding: 14 }}>{itens.length === 0 ? "Faça o upload da EAP desta obra (aba Obras)." : "Nenhum item encontrado."}</Td></tr>}
            {rows.length > 0 && <tr style={{ background: C.preto }}>
              <Td colSpan={3} style={{ color: "#fff", fontWeight: 800 }}>TOTAL ({rows.length} itens)</Td>
              <Td /><Td /><Td />
              <Td right style={{ color: "#fff", fontWeight: 800 }}>{fmt(totCustoTotal)}</Td>
              <Td />
              <Td right style={{ color: C.laranja, fontWeight: 800 }}>{fmt(totMetaCol)}</Td>
              <Td right style={{ color: "#fff", fontWeight: 800 }}>{fmt(totRealCol)}</Td>
              <Td /><Td />
            </tr>}</tbody>
        </table></div>}

        {verDash && <DashboardMeta linhas={linhas} obra={obra} totMeta={totMeta} totReal={totReal} totMetaProp={totMetaProp} cpiGlobal={cpiGlobal} />}
      </Card>

      <DashboardConsolidado obras={obras} eapPorObra={eapPorObra} ocs={ocs} contratos={contratos} rdos={rdos} />
    </div>
  );
}

function ModalMini({ titulo, children, onFechar }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 22, width: 460, maxWidth: "90vw", borderTop: `5px solid ${C.laranja}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>{titulo}</b><button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.dim }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DashboardMeta({ linhas, obra, totMeta, totReal, totMetaProp, cpiGlobal }) {
  const comReal = linhas.filter((l) => l.real > 0);
  const dentro = comReal.filter((l) => l.cpi != null && l.cpi >= 1).length;
  const fora = comReal.filter((l) => l.cpi != null && l.cpi < 1).length;
  const top = comReal.slice().sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)).slice(0, 10)
    .map((l) => ({ nome: l.codigo, "Meta (proporcional)": l.metaProporcional, "Realizado": l.real }));
  const pie = [{ name: "Dentro da meta", value: dentro, fill: C.verde }, { name: "Acima da meta", value: fora, fill: C.vermelho }];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Kpi label="Meta de custo total" value={fmtR(totMeta)} sub={obra ? obra.codigo : ""} />
        <Kpi label="Realizado (OC + OS)" value={fmtR(totReal)} accent={totReal > totMetaProp ? C.vermelho : C.verde} />
        <Kpi label="CPI global" value={cpiGlobal == null ? "—" : cpiGlobal.toFixed(2)} accent={cpiGlobal == null ? C.dim : cpiGlobal >= 1 ? C.verde : C.vermelho} sub="≥ 1 = dentro da meta" dark />
        <Kpi label="Itens dentro / acima" value={`${dentro} / ${fora}`} sub={`${comReal.length} itens com gasto`} />
      </div>
      {top.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 700 }}>Meta × Realizado — itens com maior desvio</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={C.linha} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: C.dim, fontSize: 10 }} /><YAxis tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} width={66} />
                <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Meta (proporcional)" fill={C.cinza2} radius={[3, 3, 0, 0]} /><Bar dataKey="Realizado" fill={C.laranja} radius={[3, 3, 0, 0]}>
                  {top.map((d, i) => <Cell key={i} fill={d["Realizado"] > d["Meta (proporcional)"] ? C.vermelho : C.verde} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 700 }}>Aderência à meta</div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart><Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={85} label={(e) => `${e.value}`}>{pie.map((p, i) => <Cell key={i} fill={p.fill} />)}</Pie>
                <Tooltip content={<ChartTip money={false} />} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : <div style={{ fontSize: 13, color: C.dim, padding: 12 }}>Ainda não há OCs/OS lançadas nesta obra para comparar com a meta.</div>}
    </div>
  );
}

function DashboardConsolidado({ obras, eapPorObra, ocs, contratos, rdos }) {
  const dados = obras.map((o) => {
    const itens = eapPorObra[o.id] || [];
    const real = realizadoPorItem(ocs, contratos, o.id);
    const exec = {}; rdos.filter((r) => r.obra_id === o.id).forEach((r) => (r.atividades || []).forEach((a) => { exec[a.eap] = (exec[a.eap] || 0) + (Number(a.qtde_dia ?? a.avanco) || 0); }));
    let meta = 0, realizado = 0, metaProp = 0;
    itens.forEach((e) => { const m = metaItem(e); const rl = real[e.codigo] || 0; const av = e.qtde ? Math.min((exec[e.codigo] || 0) / e.qtde, 1) : 0; meta += m; realizado += rl; metaProp += m * av; });
    return { codigo: o.codigo, meta, realizado, metaProp, cpi: realizado > 0 ? metaProp / realizado : null };
  }).filter((d) => d.meta > 0 || d.realizado > 0);
  const totMeta = sum(dados.map((d) => d.meta)), totReal = sum(dados.map((d) => d.realizado)), totProp = sum(dados.map((d) => d.metaProp));
  const cpiEmpresa = totReal > 0 ? totProp / totReal : null;
  const chart = dados.map((d) => ({ nome: d.codigo, "Meta proporcional": d.metaProp, "Realizado": d.realizado }));
  return (
    <Card title="Desempenho consolidado — empresa (todas as obras)">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Kpi dark label="Meta de custo — empresa" value={fmtR(totMeta)} sub={`${dados.length} obras`} />
        <Kpi label="Realizado total (OC + OS)" value={fmtR(totReal)} accent={totReal > totProp ? C.vermelho : C.verde} />
        <Kpi label="CPI consolidado" value={cpiEmpresa == null ? "—" : cpiEmpresa.toFixed(2)} accent={cpiEmpresa == null ? C.dim : cpiEmpresa >= 1 ? C.verde : C.vermelho} sub="≥ 1 = dentro da meta" />
      </div>
      {chart.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(180, dados.length * 48)}>
          <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke={C.linha} strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} /><YAxis type="category" dataKey="nome" width={130} tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Meta proporcional" fill={C.cinza2} radius={[0, 3, 3, 0]} /><Bar dataKey="Realizado" radius={[0, 3, 3, 0]}>{chart.map((d, i) => <Cell key={i} fill={d["Realizado"] > d["Meta proporcional"] ? C.vermelho : C.verde} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <div style={{ fontSize: 13, color: C.dim }}>Sem dados de meta/realizado para consolidar.</div>}
    </Card>
  );
}


/* ============================ Obras (upload EAP) ============================ */
function Obras({ obras, eapPorObra, onMudou }) {
  const fileRef = useRef(null);
  const [lendo, setLendo] = useState(false); const [erro, setErro] = useState(null); const [preview, setPreview] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [diag, setDiag] = useState(null); const [diagLoad, setDiagLoad] = useState(false);
  const rodarDiagnostico = async () => {
    setDiagLoad(true); setDiag(null);
    try { setDiag(await diagnosticarEap()); } catch (e) { setDiag({ erro: e.message }); } finally { setDiagLoad(false); }
  };
  const lerPlanilha = async (file) => {
    setLendo(true); setErro(null); setProgresso(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const norm = (s) => String(s ?? "").trim().toUpperCase();
      const ehCod = (c0) => /^\d+(\.\d+)+\.?$/.test(String(c0).replace(",", ".").trim());
      const numBR = (v) => { if (v === null || v === undefined || v === "" || v === "-") return 0; const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };

      // ===== MODO 1: MODELO PADRÃO MCC (posição fixa de colunas + BDI na célula J2) =====
      // Reconhecido por "SUBTOTAL S/BDI" (col L) e "CUSTO TOTAL C/BDI" (col M) no cabeçalho.
      const tentarModelo = () => {
        for (const sn of wb.SheetNames) {
          const g = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
          // achar a linha de cabeçalho que tem SUBTOTAL S/BDI e CUSTO TOTAL C/BDI
          let hdr = -1;
          for (let i = 0; i < Math.min(g.length, 15); i++) {
            const linha = g[i].map(norm).join("|");
            if (linha.includes("SUBTOTAL S/BDI") && linha.includes("CUSTO TOTAL C/BDI")) { hdr = i; break; }
          }
          if (hdr < 0) continue;
          // BDI: procurar célula contendo "BDI" e pegar o número à direita (modelo usa J2)
          let bdi = 0;
          for (let i = 0; i < Math.min(g.length, hdr); i++) {
            for (let j = 0; j < g[i].length; j++) {
              if (norm(g[i][j]).includes("BDI")) {
                for (let k = j + 1; k < g[i].length; k++) { const v = numBR(g[i][k]); if (v > 0) { bdi = v > 1 ? v / 100 : v; break; } }
              }
            }
            if (bdi) break;
          }
          // colunas FIXAS do modelo: A0=item B1=código C2=descr D3=unid E4=qtde ... K10=custo total s/BDI L11=subtotal s/BDI M12=custo total c/BDI
          const COL = { item: 0, cod: 1, desc: 2, unid: 3, qtde: 4, custoTotSemBdi: 10, subSemBdi: 11, totComBdi: 12 };
          const itens = []; const topoLinhas = [];
          g.slice(0, hdr + 2).forEach((r) => { const l = r.map((c) => String(c ?? "").trim()).join(" | ").trim(); if (l.replace(/\|/g, "").trim()) topoLinhas.push(l); });
          for (let i = hdr + 2; i < g.length; i++) {
            const r = g[i]; const c0 = String(r[COL.item] ?? "").trim();
            if (!ehCod(c0)) continue;
            const qt = numBR(r[COL.qtde]); const unid = String(r[COL.unid] ?? "").trim();
            const desc = String(r[COL.desc] ?? "").trim();
            const custoSemBdiTot = numBR(r[COL.subSemBdi]) || numBR(r[COL.custoTotSemBdi]);
            let valorComBdi = numBR(r[COL.totComBdi]);
            if (!valorComBdi && custoSemBdiTot) valorComBdi = custoSemBdiTot * (1 + bdi); // se a coluna M vier vazia, deriva do BDI
            // item analítico = código + unidade + qtde>0 + custo>0
            if (!desc || !unid || qt <= 0 || custoSemBdiTot <= 0) continue;
            itens.push({ codigo: c0, descricao: desc, unidade: unid, qtde: qt,
              valorTotalVenda: valorComBdi,                 // à faturar = coluna M (c/BDI)
              valorUnitVenda: valorComBdi / qt,
              custoSemBdi: custoSemBdiTot / qt,             // meta usa custo s/BDI (coluna L)
              bdi });
          }
          if (itens.length > 0) return { itens, topo: topoLinhas, bdi };
        }
        return null;
      };

      const modelo = tentarModelo();
      if (modelo) {
        const nomeBase = file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " ");
        let nomeObra = nomeBase, codigoSugerido = nomeBase.slice(0, 12).toUpperCase();
        try { const meta = await parseEapApi(modelo.topo.join("\n"), nomeBase); if (meta?.nomeObra) nomeObra = meta.nomeObra; if (meta?.codigoSugerido) codigoSugerido = meta.codigoSugerido; } catch {}
        // classificar ambiente em lotes
        const TAM = 40;
        for (let i = 0; i < modelo.itens.length; i += TAM) {
          setProgresso({ atual: Math.floor(i / TAM) + 1, total: Math.ceil(modelo.itens.length / TAM), itens: i });
          const bloco = modelo.itens.slice(i, i + TAM);
          try { const cl = await parseEapLote(bloco.map((it) => `${it.codigo} | ${it.descricao}`).join("\n")); bloco.forEach((it) => { const m = (cl || []).find((c) => String(c.codigo) === it.codigo); it.ambiente = m?.ambiente === "externo" ? "externo" : "interno"; }); }
          catch { bloco.forEach((it) => { it.ambiente = "interno"; }); }
        }
        setProgresso(null);
        setPreview({ nome: nomeObra, codigo: codigoSugerido, desconto: 0, contratante: "", contrato: "", local: "", prazo_dias: 0, bdiInformado: modelo.bdi,
          totalPlanilha: sum(modelo.itens.map((i) => i.valorTotalVenda)),
          itens: modelo.itens.map((it, i) => ({ ...it, ordem: i + 1 })) });
        setLendo(false);
        return;
      }
      // ===== MODO 2: DETECÇÃO AUTOMÁTICA (reserva, para planilhas fora do modelo) =====

      let itensBrutos = []; const topo = [];
      let achouCabecalho = false;
      for (const sn of wb.SheetNames) {
        const grade = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
        // localizar cabeçalho (ITEM/ÍTEM + DESCRIÇÃO/ESPECIFICAÇÃO). Pode ocupar 2 linhas.
        let hdr = -1, col = {};
        for (let i = 0; i < Math.min(grade.length, 30); i++) {
          const cs = grade[i].map(norm);
          const temItem = cs.some((c) => c === "ITEM" || c === "ÍTEM");
          const temDesc = cs.some((c) => c.includes("DESCRI") || c.includes("ESPECIFICA"));
          if (temItem && temDesc) {
            hdr = i;
            cs.forEach((c, j) => {
              if ((c === "ITEM" || c === "ÍTEM") && col.item == null) col.item = j;
              else if ((c.includes("DESCRI") || c.includes("ESPECIFICA")) && col.desc == null) col.desc = j;
              else if (c.includes("UNID") && col.unid == null) col.unid = j;
              else if ((c.includes("QUANT") || c === "QTD") && col.qtde == null) col.qtde = j;
            });
            // mapear colunas de valor TOTAL nas 2 linhas do cabeçalho, distinguindo COM BDI × custo
            [grade[i], grade[i + 1] || []].forEach((linha) => {
              linha.map(norm).forEach((c, j) => {
                if (/(VALOR|PRE[ÇC]O)\s*TOTAL/.test(c) && c.includes("BDI")) col.vtVenda = j;        // valor de venda c/ BDI
                else if (/(VALOR|CUSTO|PRE[ÇC]O)\s*TOTAL/.test(c)) col.vtGeral = j;                   // "VALOR TOTAL" / "CUSTO TOTAL" (consolidado)
                if (/CUSTO\s*UNIT/.test(c) && c.includes("BDI")) col.cuVenda = j;                     // custo unit c/ BDI
                else if (/CUSTO\s*UNIT/.test(c)) col.cuCusto = j;                                      // custo unit referência (s/BDI)
              });
            });
            // valor à faturar: prioriza a coluna "VALOR TOTAL" consolidada; se só houver "COM BDI" desmembrada, usa-a
            col.vt = col.vtGeral != null ? col.vtGeral : col.vtVenda;
            break;
          }
        }
        grade.slice(0, hdr >= 0 ? hdr + 1 : 10).forEach((r) => { const l = r.map((c) => String(c ?? "").trim()).join(" | ").trim(); if (l.replace(/\|/g, "").trim()) topo.push(l); });

        if (hdr >= 0 && col.item != null && col.qtde != null && col.unid != null && col.vt != null) {
          achouCabecalho = true;
          for (let i = hdr + 1; i < grade.length; i++) {
            const r = grade[i]; const c0 = String(r[col.item] ?? "").trim();
            if (!ehCod(c0)) continue;
            const qt = numBR(r[col.qtde]);
            const unid = String(r[col.unid] ?? "").trim();
            const vtVenda = numBR(r[col.vt]);              // valor total à faturar (como está na planilha)
            const desc = String(r[col.desc] ?? "").trim();
            // REGRA validada: item analítico = código numérico + unidade + qtde>0 + valor>0
            if (!desc || !unid || qt <= 0 || vtVenda <= 0) continue;
            // custo de referência (sem BDI) p/ metas: usa coluna de custo se existir; senão estima a venda como base
            const cuCusto = col.cuCusto != null ? numBR(r[col.cuCusto]) : 0;
            const custoUnit = cuCusto > 0 ? cuCusto : vtVenda / qt;
            itensBrutos.push({ codigo: c0, descricao: desc, unidade: unid, qtde: qt,
              valorTotalVenda: vtVenda,                    // à faturar (com BDI/desconto já na planilha)
              valorUnitVenda: vtVenda / qt,
              custoSemBdi: custoUnit, bdi: 0 });
          }
        }
      }

      const nomeBase = file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " ");
      let nomeObra = nomeBase, codigoSugerido = nomeBase.slice(0, 12).toUpperCase();
      try { const meta = await parseEapApi(topo.join("\n"), nomeBase); if (meta?.nomeObra) nomeObra = meta.nomeObra; if (meta?.codigoSugerido) codigoSugerido = meta.codigoSugerido; } catch {}

      if (achouCabecalho && itensBrutos.length > 0) {
        const totalPlan = sum(itensBrutos.map((i) => i.valorTotalVenda));
        const TAM = 40;
        for (let i = 0; i < itensBrutos.length; i += TAM) {
          setProgresso({ atual: Math.floor(i / TAM) + 1, total: Math.ceil(itensBrutos.length / TAM), itens: i });
          const bloco = itensBrutos.slice(i, i + TAM);
          try {
            const classif = await parseEapLote(bloco.map((it) => `${it.codigo} | ${it.descricao}`).join("\n"));
            bloco.forEach((it) => { const m = (classif || []).find((c) => String(c.codigo) === it.codigo); it.ambiente = m?.ambiente === "externo" ? "externo" : "interno"; });
          } catch { bloco.forEach((it) => { it.ambiente = "interno"; }); }
        }
        setProgresso(null);
        setPreview({ nome: nomeObra, codigo: codigoSugerido, desconto: 0, contratante: "", contrato: "", local: "", prazo_dias: 0, totalPlanilha: totalPlan,
          itens: itensBrutos.map((it, i) => ({ ...it, valorTotal: it.custoTotal, ordem: i + 1 })) });
        return;
      }

      // fallback: planilha sem cabeçalho padrão → IA por lote
      const linhasItem = [];
      wb.SheetNames.forEach((sn) => { XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" }).forEach((r) => { const cels = r.map((c) => String(c ?? "").trim()); if (ehCod(cels[0])) linhasItem.push(cels.join(" | ")); }); });
      if (linhasItem.length === 0) { setErro("Não encontrei itens com numeração (1.1, 2.3…) nem o cabeçalho padrão (ITEM/DESCRIÇÃO/QUANTIDADE/VALOR). Confirme que é a planilha analítica/sintética."); setLendo(false); return; }
      const TAM = 20; const todos = [];
      for (let i = 0; i < linhasItem.length; i += TAM) { setProgresso({ atual: Math.floor(i / TAM) + 1, total: Math.ceil(linhasItem.length / TAM), itens: todos.length }); todos.push(...await parseEapLote(linhasItem.slice(i, i + TAM).join("\n"))); }
      setProgresso(null);
      if (!todos.length) { setErro("Os lotes não retornaram itens."); setLendo(false); return; }
      setPreview({ nome: nomeObra, codigo: codigoSugerido, desconto: 0, contratante: "", contrato: "", local: "", prazo_dias: 0, itens: todos.map((it, i) => ({ ...it, ordem: i + 1 })) });
    } catch (e) { setErro(e.message); setProgresso(null); } finally { setLendo(false); }
  };
  const confirmar = async () => {
    setLendo(true);
    try {
      const desc = Number(preview.desconto) || 0;
      await criarObraComEap(
        { codigo: preview.codigo, nome: preview.nome, contratante: preview.contratante, contrato: preview.contrato, local: preview.local, cno: preview.cno || null, centro_custo: preview.centro_custo || null, prazo_dias: Number(preview.prazo_dias) || null, desconto: desc, data_inicio: preview.data_inicio || hojeISO() },
        preview.itens.map((it) => {
          const qtde = Number(it.qtde) || 1;
          // valor de venda (à faturar) = como veio na planilha; se o usuário aplicar desconto extra, multiplica
          const valorUnitVenda = Number(it.valorUnitVenda) != null && it.valorUnitVenda ? Number(it.valorUnitVenda) : (Number(it.valorTotalVenda) || Number(it.valorTotal) || 0) / qtde;
          const vendaUnit = valorUnitVenda * (1 - desc);
          const custoSemBdi = Number(it.custoSemBdi) || valorUnitVenda; // base p/ metas
          return { codigo: String(it.codigo || ""), descricao: String(it.descricao || ""), unidade: String(it.unidade || "un"),
            qtde, custo_sem_bdi: custoSemBdi, bdi: Number(it.bdi) || 0, desconto: desc,
            valor_unit: vendaUnit, valor_total: vendaUnit * qtde,   // valor à faturar (contrato)
            disciplina: it.disciplina || "", ambiente: it.ambiente === "externo" ? "externo" : "interno", ordem: it.ordem };
        })
      );
      setPreview(null); onMudou();
    } catch (e) { setErro(`Falha ao salvar: ${e.message}`); } finally { setLendo(false); }
  };
  const toggleAmb = (i) => setPreview((p) => ({ ...p, itens: p.itens.map((it, j) => j === i ? { ...it, ambiente: it.ambiente === "externo" ? "interno" : "externo" } : it) }));
  const [editObra, setEditObra] = useState(null); // {id, codigo, nome, contratante, contrato, local, prazo_dias}
  const [eapAberta, setEapAberta] = useState({});
  const prazoObra = (o) => { if (!o.data_inicio || !o.prazo_dias) return null; const fim = new Date(new Date(String(o.data_inicio).slice(0, 10) + "T00:00:00").getTime() + o.prazo_dias * 86400000); const rest = Math.ceil((fim - Date.now()) / 86400000); return { fim, rest }; };
  const salvarEditObra = async () => {
    try {
      await editar("obras", editObra.id, { codigo: editObra.codigo, nome: editObra.nome, contratante: editObra.contratante, contrato: editObra.contrato, local: editObra.local, cno: editObra.cno || null, centro_custo: editObra.centro_custo || null, prazo_dias: Number(editObra.prazo_dias) || null, data_inicio: editObra.data_inicio || null });
      setEditObra(null); onMudou();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Obras — upload da EAP analítica (obrigatória antes do RDO)" right={<Btn small onClick={() => fileRef.current?.click()} disabled={lendo}>{lendo ? (progresso ? `Lote ${progresso.atual}/${progresso.total}…` : "Lendo…") : "⇪ Upload planilha orçamentária"}</Btn>}>
        {progresso && <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>Interpretando a planilha em lotes — {progresso.itens} itens até agora ({progresso.atual} de {progresso.total} lotes)</div>
          <div style={{ height: 8, background: C.cinza2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(progresso.atual / progresso.total) * 100}%`, height: "100%", background: C.laranja, transition: "width .2s" }} /></div>
        </div>}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) lerPlanilha(f); e.target.value = ""; }} />
        <div style={{ fontSize: 13, color: C.dim }}>A IA identifica os itens da EAP (código, descrição, unidade, quantidade, valores) e classifica cada um como interno/externo para a projeção de término por clima. Revise antes de salvar.</div>
        {erro && <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: "10px 12px", color: C.vermelho, fontSize: 13, marginTop: 10 }}>
          <b>Falha no upload:</b> {erro}
          <div style={{ marginTop: 8 }}><Btn small kind="ghost" onClick={rodarDiagnostico} disabled={diagLoad}>{diagLoad ? "Verificando…" : "Executar diagnóstico"}</Btn></div>
        </div>}
        {diag && <div style={{ background: C.cinza, border: `1px solid ${C.linha}`, borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 12 }}>
          <b style={{ fontSize: 12 }}>Diagnóstico do serviço de IA</b>
          {diag.erro ? <div style={{ color: C.vermelho, marginTop: 4 }}>Erro ao diagnosticar: {diag.erro}</div> : <div style={{ marginTop: 6, lineHeight: 1.7 }}>
            <div>Chave da Anthropic configurada: <b style={{ color: diag.temChave ? C.verde : C.vermelho }}>{diag.temChave ? "sim" : "NÃO — configure ANTHROPIC_API_KEY no Vercel"}</b></div>
            <div>Modelo configurado (ANTHROPIC_MODEL): <b>{diag.modeloConfigurado}</b></div>
            {diag.erroLista && <div style={{ color: C.vermelho }}>Erro ao listar modelos: {diag.erroLista}</div>}
            {diag.modelosDisponiveis && <div>Modelos disponíveis na sua conta: <b style={{ color: C.preto }}>{diag.modelosDisponiveis.join(", ")}</b>
              <div style={{ color: C.dim, marginTop: 4 }}>Defina <code>ANTHROPIC_MODEL</code> no Vercel com um destes nomes (recomendado: o sonnet mais recente da lista) e refaça o deploy.</div></div>}
          </div>}
        </div>}
        {preview && (
          <div style={{ marginTop: 14, border: `2px solid ${C.laranja}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div><Lbl>Código</Lbl><input value={preview.codigo} onChange={(e) => setPreview({ ...preview, codigo: e.target.value })} style={inp({ width: 150 })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Nome da obra</Lbl><input value={preview.nome} onChange={(e) => setPreview({ ...preview, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div><Lbl>Desconto licitação</Lbl><input type="number" step="0.001" value={preview.desconto} onChange={(e) => setPreview({ ...preview, desconto: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /><span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>(0,11=11%)</span></div>
              <div><Lbl>Prazo (dias)</Lbl><input type="number" value={preview.prazo_dias} onChange={(e) => setPreview({ ...preview, prazo_dias: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /></div>
              <div><Lbl>Data de início</Lbl><input type="date" value={preview.data_inicio || hojeISO()} onChange={(e) => setPreview({ ...preview, data_inicio: e.target.value })} style={inp({ width: 150 })} /></div>
              <div><Lbl>Centro de custo</Lbl><input value={preview.centro_custo || ""} onChange={(e) => setPreview({ ...preview, centro_custo: e.target.value })} placeholder="ex.: CC-IFSC" style={inp({ width: 150 })} /></div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Contratante</Lbl><input value={preview.contratante} onChange={(e) => setPreview({ ...preview, contratante: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Local</Lbl><input value={preview.local} onChange={(e) => setPreview({ ...preview, local: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><Lbl>Contrato</Lbl><input value={preview.contrato} onChange={(e) => setPreview({ ...preview, contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              <div style={{ minWidth: 160 }}><Lbl>CNO (Cadastro Nacional de Obra)</Lbl><input value={preview.cno || ""} onChange={(e) => setPreview({ ...preview, cno: e.target.value })} placeholder="00.000.00000/00" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${C.linha}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th right>Qtde</Th><Th right>Valor c/BDI</Th><Th>Ambiente</Th></tr></thead>
                <tbody>{preview.itens.map((it, i) => <tr key={i}><Td>{it.codigo}</Td><Td style={{ fontSize: 12 }}>{it.descricao}</Td><Td><b style={{ color: C.laranja }}>{it.unidade}</b></Td><Td right>{fmt(it.qtde)}</Td><Td right>{fmt(it.valorTotal)}</Td>
                  <Td><button onClick={() => toggleAmb(i)} style={{ background: it.ambiente === "externo" ? C.amareloAlerta : C.cinza2, color: it.ambiente === "externo" ? "#fff" : C.dim, border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{it.ambiente === "externo" ? "🌦️ externo" : "interno"}</button></Td></tr>)}</tbody></table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.dim }}>{preview.itens.length} itens · valor à faturar {fmtR(sum(preview.itens.map((i) => Number(i.valorTotalVenda) || 0)))}{preview.bdiInformado ? ` · BDI ${pct(preview.bdiInformado, 2)}` : ""}</span>
              <div style={{ flex: 1 }} /><Btn kind="ghost" small onClick={() => setPreview(null)}>Descartar</Btn><Btn small onClick={confirmar} disabled={lendo}>Salvar obra e EAP</Btn>
            </div>
          </div>
        )}
      </Card>
      {obras.map((o) => (
        <Card key={o.id} title={`${o.codigo} · ${o.nome}`} right={<div style={{ display: "flex", gap: 8 }}>
          <Btn kind="ghost" small onClick={() => setEditObra({ id: o.id, codigo: o.codigo, nome: o.nome, contratante: o.contratante || "", contrato: o.contrato || "", local: o.local || "", cno: o.cno || "", centro_custo: o.centro_custo || "", prazo_dias: o.prazo_dias || "", data_inicio: o.data_inicio ? String(o.data_inicio).slice(0, 10) : "" })}>✎ Editar</Btn>
          <Btn kind="danger" small onClick={async () => { if (confirm(`Excluir ${o.codigo} e todos os dados?`)) { await remover("obras", o.id); onMudou(); } }}>Excluir</Btn>
        </div>}>
          {editObra?.id === o.id && (
            <div style={{ border: `2px solid ${C.laranja}`, borderRadius: 10, padding: 14, marginBottom: 12, background: C.laranjaClaro }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div><Lbl>Código (padrão da empresa)</Lbl><input value={editObra.codigo} onChange={(e) => setEditObra({ ...editObra, codigo: e.target.value })} style={inp({ width: 150 })} /></div>
                <div style={{ flex: 1, minWidth: 200 }}><Lbl>Nome da obra</Lbl><input value={editObra.nome} onChange={(e) => setEditObra({ ...editObra, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div><Lbl>Prazo (dias)</Lbl><input type="number" value={editObra.prazo_dias} onChange={(e) => setEditObra({ ...editObra, prazo_dias: e.target.value })} style={inp({ width: 90, textAlign: "right" })} /></div>
                <div><Lbl>Data de início</Lbl><input type="date" value={editObra.data_inicio} onChange={(e) => setEditObra({ ...editObra, data_inicio: e.target.value })} style={inp({ width: 150 })} /></div>
                <div><Lbl>Centro de custo</Lbl><input value={editObra.centro_custo} onChange={(e) => setEditObra({ ...editObra, centro_custo: e.target.value })} placeholder="ex.: CC-IFSC" style={inp({ width: 150 })} /></div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 180 }}><Lbl>Contratante</Lbl><input value={editObra.contratante} onChange={(e) => setEditObra({ ...editObra, contratante: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div style={{ flex: 1, minWidth: 180 }}><Lbl>Local</Lbl><input value={editObra.local} onChange={(e) => setEditObra({ ...editObra, local: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div style={{ flex: 1, minWidth: 180 }}><Lbl>Contrato</Lbl><input value={editObra.contrato} onChange={(e) => setEditObra({ ...editObra, contrato: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div style={{ minWidth: 170 }}><Lbl>CNO (Cadastro Nacional de Obra)</Lbl><input value={editObra.cno} onChange={(e) => setEditObra({ ...editObra, cno: e.target.value })} placeholder="00.000.00000/00" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn small onClick={salvarEditObra} disabled={!editObra.codigo || !editObra.nome}>Salvar</Btn>
                <Btn small kind="ghost" onClick={() => setEditObra(null)}>Cancelar</Btn>
              </div>
            </div>
          )}
          {(() => { const pz = prazoObra(o); return (
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>{(eapPorObra[o.id] || []).length} itens de EAP · {o.contratante || "sem contratante"} · prazo {o.prazo_dias || "—"} dias{o.data_inicio ? ` · início ${dataBR(o.data_inicio)}` : ""}{pz ? <span style={{ color: pz.rest < 0 ? C.vermelho : pz.rest <= 30 ? C.amareloAlerta : C.verde, fontWeight: 700 }}> · {pz.rest < 0 ? `vencida há ${-pz.rest}d` : `faltam ${pz.rest}d`} (término {dataBR(pz.fim.toISOString())})</span> : ""}{o.cno ? ` · CNO ${o.cno}` : ""}</div>
          ); })()}
          <Btn small kind="ghost" onClick={() => setEapAberta((s) => ({ ...s, [o.id]: !s[o.id] }))}>{eapAberta[o.id] ? "▲ Ocultar EAP" : `▼ Expandir EAP (${(eapPorObra[o.id] || []).length} itens)`}</Btn>
          {eapAberta[o.id] && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}><thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Unid.</Th><Th right>Qtde</Th><Th right>Valor c/BDI</Th><Th>Ambiente</Th></tr></thead>
              <tbody>{(eapPorObra[o.id] || []).slice(0, 400).map((it) => <tr key={it.id}><Td>{it.codigo}</Td><Td style={{ fontSize: 12 }}>{it.descricao}{it.nao_descrito ? <span style={{ marginLeft: 6, background: C.amareloAlerta, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px" }}>NÃO DESCR.</span> : null}</Td><Td><b style={{ color: C.laranja }}>{it.unidade}</b></Td><Td right>{fmt(it.qtde)}</Td><Td right>{fmt(it.valor_total)}</Td><Td>{it.ambiente === "externo" ? "🌦️ externo" : "interno"}</Td></tr>)}</tbody></table>
          )}
        </Card>
      ))}
    </div>
  );
}
