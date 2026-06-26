import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { C, fmt, hojeISO, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, casarEapImport, verificarImport, VerifBanner, numBR } from "./core.jsx";
import { prazoSm, ehEmergencial, ModalGerar } from "./smi.jsx";

const TIPOS = [["empreitada", "Empreitada"], ["locacao", "Locação de equipamentos"], ["outros", "Outros serviços"]];
const tipoLabel = (t) => (TIPOS.find((x) => x[0] === t) || [, "—"])[1];
const diasDesde = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0;

/* ============================ Formulário da SS-i (Supervisor de Obras) ============================ */
function FormSsI({ obras, eapPorObra, usuario, onCriou }) {
  const vazio = { obra_id: obras[0]?.id || "", tipo: "empreitada", data_necessidade: "", descricao: "", itens: [] };
  const [ss, setSs] = useState(vazio);
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const eapItens = eapPorObra[ss.obra_id] || [];
  const emerg = ehEmergencial(ss.data_necessidade);
  const addItem = () => setSs((s) => ({ ...s, itens: [...s.itens, { eap_codigo: "", descricao: "", servico: "", quantidade: 1, unidade: "vb" }] }));
  const upItem = (i, patch) => setSs((s) => ({ ...s, itens: s.itens.map((x, j) => j === i ? { ...x, ...patch } : x) }));
  const delItem = (i) => setSs((s) => ({ ...s, itens: s.itens.filter((_, j) => j !== i) }));
  const escolherEap = (i, codigo) => { const it = eapItens.find((e) => e.codigo === codigo); upItem(i, { eap_codigo: codigo, descricao: it?.descricao || "" }); };
  const [importando, setImportando] = useState(false);
  const [verif, setVerif] = useState(null);
  const importarPlanilha = async (file) => {
    if (!file) return;
    setImportando(true); setVerif(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      let melhores = [];
      wb.SheetNames.forEach((sn) => {
        const grade = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
        let hdr = -1, cols = null;
        for (let r = 0; r < Math.min(grade.length, 40); r++) {
          const linha = (grade[r] || []).map((c) => String(c == null ? "" : c).toUpperCase());
          const desc = linha.findIndex((c) => c.includes("DESCRI") && (c.includes("SERVI") || c.includes("ITEM") || c.includes("INSUMO")));
          const qtd = linha.findIndex((c) => c.includes("QUANTI"));
          const uni = linha.findIndex((c) => c.includes("UNIDADE") || c === "UN" || c === "UN ");
          if (desc >= 0 && qtd >= 0 && uni >= 0) {
            hdr = r;
            cols = { item: linha.findIndex((c) => c === "ITEM" || c === "EAP" || (c.includes("EAP") && c.length <= 6)), cod: linha.findIndex((c) => c.includes("CÓDIGO") || c.includes("CODIGO")), desc, uni, qtd };
            break;
          }
        }
        if (hdr < 0) return;
        const itens = [];
        let casados = 0;
        for (let r = hdr + 1; r < grade.length; r++) {
          const row = grade[r] || [];
          const descricao = String(row[cols.desc] == null ? "" : row[cols.desc]).trim();
          const unidade = String(row[cols.uni] == null ? "" : row[cols.uni]).trim();
          const qtde = numBR(row[cols.qtd]);
          if (!descricao || !unidade || isNaN(qtde) || qtde <= 0) continue; // ignora seções/observações
          const item = cols.item >= 0 ? String(row[cols.item] == null ? "" : row[cols.item]).trim() : "";
          const cod = cols.cod >= 0 ? String(row[cols.cod] == null ? "" : row[cols.cod]).trim() : "";
          const casado = casarEapImport(eapItens, { item, cod, descricao }); // reconhece a EAP da obra (v10.7)
          if (casado) casados++;
          itens.push({ eap_codigo: casado || item || cod || `IMP-${itens.length + 1}`, descricao, servico: descricao, quantidade: qtde, unidade });
        }
        itens._casados = casados;
        if (itens.length > melhores.length) melhores = itens;
      });
      if (melhores.length === 0) { alert("Não encontrei itens na planilha. Verifique se há colunas DESCRIÇÃO DO SERVIÇO, UNIDADE DE MEDIDA e QUANTIDADE."); return; }
      setSs((s) => ({ ...s, itens: [...s.itens, ...melhores] }));
      const rec = melhores._casados || 0;
      alert(`${melhores.length} item(ns) importado(s) para a SS-i.` + (eapItens.length ? `\n${rec} reconhecido(s) automaticamente na EAP da obra` + (rec < melhores.length ? ` — os demais ficaram com o código da planilha; ajuste manualmente se necessário.` : `.`) : ``));
      // conferência rápida por IA (não bloqueia; máx. 5s no servidor)
      setVerif({ loading: true });
      verificarImport("ssi", melhores, eapItens.map((e) => ({ codigo: e.codigo, descricao: e.descricao })), obras.find((o) => o.id === ss.obra_id)?.codigo || "").then(setVerif).catch(() => setVerif(null));
    } catch (e) { alert("Falha ao ler a planilha: " + e.message); }
    finally { setImportando(false); }
  };
  const salvar = async () => {
    setBusy(true); setErro(null);
    try {
      await criar("ss_itens", { obra_id: ss.obra_id, solicitante_id: usuario.id, tipo: ss.tipo, itens: ss.itens, data_necessidade: ss.data_necessidade || null, descricao: ss.descricao, status: "aberta", emergencial: emerg, autorizada_emergencial: false });
      setSs({ ...vazio, obra_id: ss.obra_id }); onCriou();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const podeEnviar = ss.obra_id && ss.data_necessidade && ss.itens.length > 0 && ss.itens.every((x) => x.eap_codigo && x.servico);

  return (
    <Card title="Nova SS-i · Solicitação de Serviço">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 160 }}><Lbl>Obra</Lbl><select value={ss.obra_id} onChange={(e) => setSs({ ...ss, obra_id: e.target.value, itens: [] })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
        <div style={{ minWidth: 200 }}><Lbl>Tipo</Lbl><select value={ss.tipo} onChange={(e) => setSs({ ...ss, tipo: e.target.value })} style={inp({ width: "100%" })}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><Lbl>Necessário em obra até</Lbl><input type="date" value={ss.data_necessidade} min={hojeISO()} onChange={(e) => setSs({ ...ss, data_necessidade: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Lbl>Serviços/locações — vincule cada um a uma atividade da EAP</Lbl>
        {!ss.obra_id ? <div style={{ fontSize: 12, color: C.dim }}>Selecione a obra para listar a EAP.</div> : <>
          {ss.itens.map((x, i) => (
            <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 8, padding: 10, marginBottom: 8, background: "#fafafa" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 200 }}><Lbl>Item da EAP</Lbl>
                  <select value={x.eap_codigo} onChange={(e) => escolherEap(i, e.target.value)} style={inp({ width: "100%" })}>
                    <option value="">— selecione —</option>
                    {eapItens.map((e) => <option key={e.id} value={e.codigo}>{e.codigo} — {String(e.descricao || "").slice(0, 50)}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}><Lbl>Serviço / equipamento (detalhe)</Lbl><input value={x.servico} onChange={(e) => upItem(i, { servico: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div style={{ width: 90 }}><Lbl>Qtde</Lbl><input type="number" min="0" step="0.01" value={x.quantidade} onChange={(e) => upItem(i, { quantidade: parseFloat(e.target.value) || 0 })} style={inp({ width: "100%", textAlign: "right", boxSizing: "border-box" })} /></div>
                <div style={{ width: 70 }}><Lbl>Unid.</Lbl><input value={x.unidade} onChange={(e) => upItem(i, { unidade: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, paddingBottom: 6 }}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn small kind="ghost" onClick={addItem}>+ Adicionar serviço/locação</Btn>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: C.laranja, cursor: "pointer", border: `1px solid ${C.laranja}`, borderRadius: 8, padding: "6px 12px" }}>
              {importando ? "Importando…" : "📄 Importar planilha modelo (.xlsx)"}
              <input type="file" accept=".xlsx,.xls" disabled={importando} onChange={(e) => { importarPlanilha(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
            </label>
          </div>
          <VerifBanner verif={verif} />
        </>}
      </div>

      <div style={{ marginTop: 10, marginBottom: 12 }}><Lbl>Observações (prazo de locação, condições etc.)</Lbl><textarea value={ss.descricao} onChange={(e) => setSs({ ...ss, descricao: e.target.value })} rows={2} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
      {emerg && ss.data_necessidade && (
        <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}66`, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: C.texto }}>
          <b style={{ color: C.vermelho }}>⚠ SS-i EMERGENCIAL</b> — necessidade nesta mesma semana. Só irá para o Suprimentos após autorização do Coordenador de Obras.
        </div>
      )}
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small disabled={busy || !podeEnviar} onClick={salvar}>{emerg ? "Enviar SS-i emergencial (p/ autorização)" : "Enviar SS-i para Suprimentos"}</Btn></div>
    </Card>
  );
}

/* ---- cartão de SS-i ---- */
function CardSs({ ss, obras, colaboradores, podeAtender, podeBaixar, gestor, onMover, mostrarHistorico, alertaAberta, onGerarOs }) {
  const [aberto, setAberto] = useState(false);
  const obra = obras.find((o) => o.id === ss.obra_id);
  const solicitante = colaboradores.find((c) => c.id === ss.solicitante_id)?.nome || "—";
  const pz = prazoSm(ss.data_necessidade);
  const dias = diasDesde(ss.criado_em);
  const corBorda = alertaAberta && dias >= 60 ? C.vermelho : pz.cor;
  const stop = (e) => e.stopPropagation();
  return (
    <div onClick={() => setAberto((a) => !a)} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderLeft: `4px solid ${corBorda}`, borderRadius: 8, padding: 10, marginBottom: 8, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.preto }}>{obra?.codigo || "—"}{ss.emergencial ? <span style={{ marginLeft: 6, background: C.vermelho, color: "#fff", fontSize: 9.5, fontWeight: 800, borderRadius: 4, padding: "1px 6px" }}>EMERG</span> : null}</span>
        <span style={{ background: `${C.preto}10`, color: C.preto, fontSize: 10, fontWeight: 800, borderRadius: 5, padding: "2px 8px" }}>{tipoLabel(ss.tipo)}</span>
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Solicitante: {solicitante} · necessário {ss.data_necessidade ? dataBR(ss.data_necessidade) : "—"}{mostrarHistorico || alertaAberta ? ` · aberta há ${dias}d` : ""}{alertaAberta && dias >= 60 ? <b style={{ color: C.vermelho }}> — aberta há +2 meses!</b> : ""} <span style={{ color: C.laranja, fontWeight: 700 }}>{aberto ? "▲" : "▼"}</span></div>
      {!aberto ? (
        <div style={{ fontSize: 12, color: C.texto }}>{(ss.itens || []).slice(0, 2).map((it, i) => <div key={i} style={{ marginBottom: 2 }}><b>{it.eap_codigo}</b> · {it.servico} — {fmt(it.quantidade)} {it.unidade}</div>)}{(ss.itens || []).length > 2 && <div style={{ color: C.dim, fontSize: 11 }}>+{ss.itens.length - 2} item(ns)… (clique para ver tudo)</div>}</div>
      ) : (
        <div style={{ background: "#fafafa", border: `1px solid ${C.linha}`, borderRadius: 8, padding: 10, margin: "4px 0" }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Obra: <b>{obra?.codigo}{obra?.nome ? " — " + obra.nome : ""}</b> · Tipo: <b>{tipoLabel(ss.tipo)}</b> · Status: <b>{ss.status}</b> · Criada em {ss.criado_em ? dataBR(ss.criado_em) : "—"}{ss.emergencial ? ` · ${ss.autorizada_emergencial ? "emergencial autorizada" : "emergencial pendente"}` : ""}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Item EAP", "Descrição EAP", "Serviço", "Qtde"].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 10, color: C.dim, textTransform: "uppercase", padding: "3px 6px", borderBottom: `1px solid ${C.linha}` }}>{h}</th>)}</tr></thead>
            <tbody>{(ss.itens || []).map((it, i) => <tr key={i}><td style={tdDetSs}><b>{it.eap_codigo}</b></td><td style={tdDetSs}>{String(it.descricao || "—").slice(0, 40)}</td><td style={tdDetSs}>{it.servico}</td><td style={tdDetSs}>{fmt(it.quantidade)} {it.unidade}</td></tr>)}</tbody>
          </table>
          {ss.descricao && <div style={{ fontSize: 12, color: C.texto, marginTop: 8 }}><b>Observações:</b> {ss.descricao}</div>}
        </div>
      )}
      {!aberto && ss.descricao && <div style={{ fontSize: 11, color: C.dim, marginTop: 4, fontStyle: "italic" }}>{String(ss.descricao).slice(0, 60)}{ss.descricao.length > 60 ? "…" : ""}</div>}
      <div onClick={stop} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {ss.status === "aberta" && podeAtender && <Btn small kind="ghost" onClick={() => onMover(ss, "em_atendimento")}>Atender</Btn>}
        {ss.status === "em_atendimento" && podeAtender && <Btn small kind="ghost" onClick={() => onMover(ss, "ativa")}>Marcar contratado/ativo</Btn>}
        {ss.status === "ativa" && podeBaixar && <Btn small onClick={() => onMover(ss, "baixada")}>Baixar (concluído)</Btn>}
        {ss.status === "ativa" && !podeBaixar && <span style={{ fontSize: 10.5, color: C.dim, alignSelf: "center" }}>Baixa pelo Supervisor ao concluir</span>}
        {(ss.status === "ativa" || ss.status === "baixada") && onGerarOs && <Btn small kind="ghost" onClick={() => onGerarOs(ss)}>→ Gerar OS-i</Btn>}
        {ss.status !== "baixada" && gestor && <Btn small kind="ghost" onClick={() => onMover(ss, "cancelada")}>Cancelar</Btn>}
      </div>
    </div>
  );
}
const tdDetSs = { fontSize: 11.5, padding: "3px 6px", borderBottom: `1px solid ${C.linha}` };

function Coluna({ titulo, cor, lista, ...props }) {
  return (
    <div style={{ flex: 1, minWidth: 220, background: C.cinza, borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span>{titulo}</span><span style={{ background: cor, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{lista.length}</span>
      </div>
      {lista.length === 0 ? <div style={{ fontSize: 11, color: C.dim, padding: 6 }}>—</div> : lista.map((ss) => <CardSs key={ss.id} ss={ss} {...props} />)}
    </div>
  );
}

/* ---- autorização de emergenciais (Coord. de Obras) ---- */
function PainelAutorizaSs({ usuario, sss, obras, colaboradores, onMudou }) {
  const pend = sss.filter((s) => s.emergencial && !s.autorizada_emergencial && s.status !== "cancelada");
  if (pend.length === 0) return null;
  const nomeObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const autorizar = async (ss) => { try { await editar("ss_itens", ss.id, { autorizada_emergencial: true, autorizada_por: usuario.id }); onMudou(); } catch (e) { alert(e.message); } };
  const descartar = async (ss) => { if (!confirm("Descartar esta SS-i emergencial? Ela será cancelada e não irá ao Suprimentos.")) return; try { await editar("ss_itens", ss.id, { status: "cancelada" }); onMudou(); } catch (e) { alert(e.message); } };
  return (
    <Card title={`SS-is emergenciais aguardando sua autorização (${pend.length})`}>
      {pend.map((ss) => <div key={ss.id} style={{ border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13 }}><b>{nomeObra(ss.obra_id)}</b> · {tipoLabel(ss.tipo)} · necessário {ss.data_necessidade ? dataBR(ss.data_necessidade) : "—"}<div style={{ fontSize: 12, color: C.dim }}>{(ss.itens || []).map((i) => `${i.eap_codigo} ${i.servico}`).join(" · ")}</div></div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}><Btn small kind="ghost" onClick={() => descartar(ss)}>Descartar</Btn><Btn small onClick={() => autorizar(ss)}>Autorizar p/ Suprimentos</Btn></div>
      </div>)}
    </Card>
  );
}

/* ============================ Módulo SS-i ============================ */
export function SsI({ usuario, obras, eapPorObra, colaboradores = [], acesso, onGerarOs, onMudou }) {
  const [sss, setSss] = useState([]); const [pronto, setPronto] = useState(false);
  const [perguntarOs, setPerguntarOs] = useState(null);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const ehOperador = p === "op_suprimentos";
  const ehCoord = p === "coord_suprimentos";
  const ehCoordObras = p === "coord_obras";
  const ehCoordPlan = p === "coord_planejamento";
  const gestor = p === "ceo" || p === "diretor";
  const podeCriar = acesso?.ssi_criar ?? ehSup;
  const podeVer = (acesso?.ssi_gestao ?? (ehOperador || ehCoord || ehCoordPlan || gestor)) || podeCriar;
  const podeKanban = acesso?.ssi_kanban ?? (ehOperador || ehCoord || ehCoordObras || ehCoordPlan || p === "coord_orcamentos" || p === "op_planejamento" || p === "op_orcamento" || gestor);

  const carregar = () => listar("ss_itens").then((r) => { setSss(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);

  const mover = async (ss, status) => {
    const patch = { status };
    if (status === "em_atendimento" || status === "ativa") patch.atendido_por = usuario.id;
    if (status === "baixada") { patch.baixado_por = usuario.id; patch.baixado_em = new Date().toISOString(); }
    try {
      await editar("ss_itens", ss.id, patch); carregar(); onMudou && onMudou();
      if (status === "ativa" && (ehOperador || ehCoord || gestor) && onGerarOs) setPerguntarOs(ss);
    } catch (e) { alert(e.message); }
  };

  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando solicitações de serviço…</div>;

  const ativasTodas = sss.filter((s) => s.status !== "cancelada");
  const cron = (a, b) => { const da = a.data_necessidade || a.criado_em || "", db = b.data_necessidade || b.criado_em || ""; return da < db ? -1 : da > db ? 1 : 0; };
  const abertas = ativasTodas.filter((s) => s.status === "aberta").sort(cron);
  const emAtend = ativasTodas.filter((s) => s.status === "em_atendimento").sort(cron);
  const ativas = ativasTodas.filter((s) => s.status === "ativa").sort(cron);
  const baixadas = ativasTodas.filter((s) => s.status === "baixada").sort(cron);
  const abertasAntigas = [...emAtend, ...ativas].filter((s) => diasDesde(s.criado_em) >= 60);
  const minhasAbertas = sss.filter((s) => s.solicitante_id === usuario.id && ["aberta", "em_atendimento", "ativa"].includes(s.status));

  const propsCard = { obras, colaboradores, podeAtender: ehOperador || ehCoord || gestor, podeBaixar: ehSup || ehCoord || gestor, gestor, onMover: mover, mostrarHistorico: ehCoord || gestor, onGerarOs: ((ehOperador || ehCoord || gestor) && onGerarOs) ? onGerarOs : null };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {podeCriar && <FormSsI obras={obras} eapPorObra={eapPorObra} usuario={usuario} onCriou={carregar} />}

      {ehSup && minhasAbertas.length > 0 && (
        <div style={{ background: `${C.amareloAlerta}14`, border: `1px solid ${C.amareloAlerta}66`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.texto }}>
          <b style={{ color: C.amareloAlerta }}>🔔 Você tem {minhasAbertas.length} SS-i(s) em aberto</b> — lembre-se de <b>baixar</b> os serviços já concluídos e as locações de equipamentos que não estão mais em uso para não pagar por algo encerrado.
        </div>
      )}

      {(ehCoordObras || gestor) && <PainelAutorizaSs usuario={usuario} sss={sss} obras={obras} colaboradores={colaboradores} onMudou={carregar} />}

      {(ehCoord || gestor) && abertasAntigas.length > 0 && (
        <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: "10px 14px" }}>
          <b style={{ color: C.vermelho }}>⚠ {abertasAntigas.length} SS-i(s) aberta(s) há mais de 2 meses</b> <span style={{ color: C.texto, fontSize: 13 }}>— verifique locações/serviços que talvez já tenham terminado: {abertasAntigas.map((s) => obras.find((o) => o.id === s.obra_id)?.codigo).filter(Boolean).join(" · ")}</span>
        </div>
      )}

      {(podeVer || podeKanban) && (
        <Card title={ehSup ? "Minhas solicitações de serviço" : ehCoord ? "Gestão de SS-is (todas as obras)" : ehOperador ? "Atendimento de SS-is (suas obras)" : "Kanban de SS-is (todas as obras)"}>
          <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>Cartões em ordem cronológica pela data necessária; a borda colorida indica o vencimento (verde no prazo, amarelo próximo, vermelho vencido).</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Coluna titulo="Aberta" cor={C.preto} lista={abertas} {...propsCard} />
            <Coluna titulo="Em atendimento" cor={C.laranja} lista={emAtend} {...propsCard} />
            <Coluna titulo="Ativa" cor={C.azul} lista={ativas} {...propsCard} alertaAberta={ehCoord || gestor} />
            <Coluna titulo="Baixada" cor={C.verde} lista={baixadas} {...propsCard} />
          </div>
          {ativasTodas.length === 0 && <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>Nenhuma SS-i no momento.</div>}
          <div style={{ fontSize: 11, color: C.dim, marginTop: 12 }}>A SS-i é <b>baixada pelo Supervisor de Obras</b> ao concluir o serviço ou encerrar a locação. SS-is abertas há mais de 2 meses são sinalizadas para evitar locação de equipamento fora de uso.</div>
        </Card>
      )}

      {perguntarOs && (
        <ModalGerar
          titulo="SS-i marcada como ativa"
          texto="Deseja gerar uma OS-i (Ordem de Serviço) já pré-preenchida com os itens desta solicitação? Você completará a empresa e os valores antes de formalizar."
          rotuloOk="Gerar OS-i"
          onSim={() => { const ss = perguntarOs; setPerguntarOs(null); onGerarOs && onGerarOs(ss); }}
          onNao={() => setPerguntarOs(null)}
        />
      )}
    </div>
  );
}
