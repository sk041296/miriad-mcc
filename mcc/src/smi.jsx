import React, { useState, useEffect, useMemo } from "react";
import { C, fmt, sum, hojeISO, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, remover } from "./core.jsx";

/* ---- prazo da SM-i com base na data de necessidade ---- */
export function prazoSm(dataNec) {
  if (!dataNec) return { nivel: "sem", cor: C.dim, label: "sem data", dias: null, urgente: false };
  const dias = Math.ceil((new Date(String(dataNec).slice(0, 10) + "T00:00:00") - new Date(hojeISO() + "T00:00:00")) / 86400000);
  if (dias < 0) return { nivel: "vencida", cor: C.vermelho, label: `vencida há ${-dias}d`, dias, urgente: true };
  if (dias === 0) return { nivel: "hoje", cor: C.vermelho, label: "vence hoje", dias, urgente: true };
  if (dias <= 1) return { nivel: "destaque", cor: "#ea580c", label: "vence em 1 dia", dias, urgente: true };
  if (dias <= 2) return { nivel: "a2", cor: C.amareloAlerta, label: "faltam 2 dias", dias, urgente: false };
  if (dias <= 3) return { nivel: "a3", cor: C.amareloAlerta, label: "faltam 3 dias", dias, urgente: false };
  if (dias <= 5) return { nivel: "a5", cor: "#ca8a04", label: "faltam 5 dias", dias, urgente: false };
  return { nivel: "ok", cor: C.verde, label: `faltam ${dias}d`, dias, urgente: false };
}
const diasDesde = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0;

/* ============================ Formulário da SM-i (Supervisor de Obras) ============================ */
function FormSmI({ obras, eapPorObra, usuario, onCriou }) {
  const vazio = { obra_id: obras[0]?.id || "", data_necessidade: "", descricao: "", itens: [] };
  const [sm, setSm] = useState(vazio);
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const eapItens = eapPorObra[sm.obra_id] || [];
  const addItem = () => setSm((s) => ({ ...s, itens: [...s.itens, { eap_codigo: "", descricao: "", qtde_contratada: 0, unidade_eap: "", material: "", quantidade: 0, unidade: "un" }] }));
  const upItem = (i, patch) => setSm((s) => ({ ...s, itens: s.itens.map((x, j) => j === i ? { ...x, ...patch } : x) }));
  const delItem = (i) => setSm((s) => ({ ...s, itens: s.itens.filter((_, j) => j !== i) }));
  const escolherEap = (i, codigo) => {
    const it = eapItens.find((e) => e.codigo === codigo);
    upItem(i, { eap_codigo: codigo, descricao: it?.descricao || "", qtde_contratada: Number(it?.qtde) || 0, unidade_eap: it?.unidade || "", unidade: it?.unidade || "un" });
  };
  const salvar = async () => {
    setBusy(true); setErro(null);
    try {
      await criar("sm_itens", { obra_id: sm.obra_id, solicitante_id: usuario.id, itens: sm.itens, data_necessidade: sm.data_necessidade || null, descricao: sm.descricao, status: "aberta", emergencial: false });
      setSm({ ...vazio, obra_id: sm.obra_id }); onCriou();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const podeEnviar = sm.obra_id && sm.data_necessidade && sm.itens.length > 0 && sm.itens.every((x) => x.eap_codigo && x.material && Number(x.quantidade) > 0);

  return (
    <Card title="Nova SM-i · Solicitação de Material Inteligente">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 160 }}><Lbl>Obra</Lbl><select value={sm.obra_id} onChange={(e) => setSm({ ...sm, obra_id: e.target.value, itens: [] })} style={inp({ width: "100%" })}><option value="">—</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>
        <div><Lbl>Necessário em obra até</Lbl><input type="date" value={sm.data_necessidade} min={hojeISO()} onChange={(e) => setSm({ ...sm, data_necessidade: e.target.value })} style={inp({ boxSizing: "border-box" })} /></div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Lbl>Itens — vincule cada material a uma atividade da EAP</Lbl>
        {!sm.obra_id ? <div style={{ fontSize: 12, color: C.dim }}>Selecione a obra para listar a EAP.</div> : <>
          {sm.itens.map((x, i) => {
            const excesso = x.qtde_contratada > 0 && Number(x.quantidade) > x.qtde_contratada;
            return (
              <div key={i} style={{ border: `1px solid ${excesso ? C.vermelho : C.linha}`, borderRadius: 8, padding: 10, marginBottom: 8, background: excesso ? "#fff5f3" : "#fafafa" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 200 }}><Lbl>Item da EAP</Lbl>
                    <select value={x.eap_codigo} onChange={(e) => escolherEap(i, e.target.value)} style={inp({ width: "100%" })}>
                      <option value="">— selecione —</option>
                      {eapItens.map((e) => <option key={e.id} value={e.codigo}>{e.codigo} — {String(e.descricao || "").slice(0, 50)}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}><Lbl>Material (descrição detalhada)</Lbl><input value={x.material} onChange={(e) => upItem(i, { material: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <div style={{ width: 90 }}><Lbl>Quantidade</Lbl><input type="number" min="0" step="0.01" value={x.quantidade} onChange={(e) => upItem(i, { quantidade: parseFloat(e.target.value) || 0 })} style={inp({ width: "100%", textAlign: "right", boxSizing: "border-box" })} /></div>
                  <div style={{ width: 70 }}><Lbl>Unid.</Lbl><input value={x.unidade} onChange={(e) => upItem(i, { unidade: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, paddingBottom: 6 }}>✕</button>
                </div>
                {x.eap_codigo && <div style={{ fontSize: 11, marginTop: 6, color: excesso ? C.vermelho : C.dim }}>
                  Quantidade contratada do item: <b>{fmt(x.qtde_contratada)} {x.unidade_eap}</b>
                  {excesso && <b> ⚠ Quantidade solicitada ({fmt(x.quantidade)}) maior que a contratada — confira antes de enviar.</b>}
                </div>}
              </div>
            );
          })}
          <Btn small kind="ghost" onClick={addItem}>+ Adicionar item</Btn>
        </>}
      </div>

      <div style={{ marginTop: 10, marginBottom: 12 }}><Lbl>Observações (opcional)</Lbl><textarea value={sm.descricao} onChange={(e) => setSm({ ...sm, descricao: e.target.value })} rows={2} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small disabled={busy || !podeEnviar} onClick={salvar}>Enviar SM-i para Suprimentos</Btn></div>
    </Card>
  );
}

/* ---- cartão de SM-i para os kanbans ---- */
function CardSm({ sm, obras, colaboradores, podeAtender, podeAutorizar, gestor, onMover, mostrarHistorico }) {
  const obra = obras.find((o) => o.id === sm.obra_id);
  const solicitante = colaboradores.find((c) => c.id === sm.solicitante_id)?.nome || "—";
  const pz = prazoSm(sm.data_necessidade);
  const vencida = pz.nivel === "vencida" || pz.nivel === "hoje";
  const podeBaixar = !vencida || podeAutorizar || gestor;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderLeft: `4px solid ${pz.cor}`, borderRadius: 8, padding: 10, marginBottom: 8, boxShadow: pz.urgente ? `0 0 0 1.5px ${pz.cor}33` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.preto }}>{obra?.codigo || "—"}</span>
        <span style={{ background: `${pz.cor}1a`, color: pz.cor, fontSize: 10.5, fontWeight: 800, borderRadius: 5, padding: "2px 8px" }}>{pz.label}</span>
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Solicitante: {solicitante} · necessário {sm.data_necessidade ? dataBR(sm.data_necessidade) : "—"}{mostrarHistorico ? ` · aberta há ${diasDesde(sm.criado_em)}d` : ""}</div>
      <div style={{ fontSize: 12, color: C.texto }}>
        {(sm.itens || []).map((it, i) => <div key={i} style={{ marginBottom: 2 }}><b>{it.eap_codigo}</b> · {it.material} — {fmt(it.quantidade)} {it.unidade}</div>)}
      </div>
      {sm.descricao && <div style={{ fontSize: 11, color: C.dim, marginTop: 4, fontStyle: "italic" }}>{sm.descricao}</div>}
      {(podeAtender || podeAutorizar || gestor) && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {sm.status === "aberta" && <Btn small kind="ghost" onClick={() => onMover(sm, "em_atendimento")}>Atender</Btn>}
          {sm.status === "em_atendimento" && podeBaixar && <Btn small onClick={() => onMover(sm, "atendida")}>Concluir / baixar</Btn>}
          {sm.status === "em_atendimento" && !podeBaixar && <span style={{ fontSize: 10.5, color: C.vermelho, fontWeight: 700, alignSelf: "center" }}>Baixa vencida requer o Coord. de Suprimentos</span>}
          {sm.status !== "atendida" && (podeAutorizar || gestor) && <Btn small kind="ghost" onClick={() => onMover(sm, "cancelada")}>Cancelar</Btn>}
        </div>
      )}
    </div>
  );
}

/* ---- coluna do kanban ---- */
function Coluna({ titulo, cor, lista, ...props }) {
  return (
    <div style={{ flex: 1, minWidth: 240, background: C.cinza, borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span>{titulo}</span><span style={{ background: cor, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{lista.length}</span>
      </div>
      {lista.length === 0 ? <div style={{ fontSize: 11, color: C.dim, padding: 6 }}>—</div> : lista.map((sm) => <CardSm key={sm.id} sm={sm} {...props} />)}
    </div>
  );
}

/* ============================ Módulo SM-i ============================ */
export function SmI({ usuario, obras, eapPorObra, colaboradores = [], onMudou }) {
  const [sms, setSms] = useState([]); const [pronto, setPronto] = useState(false);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const ehOperador = p === "op_suprimentos";
  const ehCoord = p === "coord_suprimentos";
  const gestor = p === "ceo" || p === "diretor";

  const carregar = () => listar("sm_itens").then((r) => { setSms(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);

  const mover = async (sm, status) => {
    const patch = { status };
    const pz = prazoSm(sm.data_necessidade);
    if (status === "em_atendimento") patch.atendido_por = usuario.id;
    if (status === "atendida") { patch.baixado_em = new Date().toISOString(); if ((pz.nivel === "vencida" || pz.nivel === "hoje") && (ehCoord || gestor)) patch.baixa_autorizada_por = usuario.id; }
    try { await editar("sm_itens", sm.id, patch); carregar(); onMudou && onMudou(); } catch (e) { alert(e.message); }
  };

  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando solicitações…</div>;

  const ativas = sms.filter((s) => s.status !== "cancelada");
  const abertas = ativas.filter((s) => s.status === "aberta");
  const emAtend = ativas.filter((s) => s.status === "em_atendimento");
  const atendidas = ativas.filter((s) => s.status === "atendida");
  const urgentes = [...abertas, ...emAtend].filter((s) => prazoSm(s.data_necessidade).urgente);

  const propsCard = { obras, colaboradores, podeAtender: ehOperador || ehCoord || gestor, podeAutorizar: ehCoord || gestor, gestor, onMover: mover, mostrarHistorico: ehCoord || gestor };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ehSup && <FormSmI obras={obras} eapPorObra={eapPorObra} usuario={usuario} onCriou={carregar} />}

      {(ehOperador || ehCoord || gestor) && urgentes.length > 0 && (
        <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: "10px 14px" }}>
          <b style={{ color: C.vermelho }}>⚠ {urgentes.length} SM-i urgente(s)</b> <span style={{ color: C.texto, fontSize: 13 }}>— vencendo em até 1 dia ou já vencidas: {urgentes.map((s) => obras.find((o) => o.id === s.obra_id)?.codigo).filter(Boolean).join(" · ")}</span>
        </div>
      )}

      <Card title={ehSup ? "Minhas solicitações" : ehCoord ? "Gestão de SM-is (todas as obras)" : ehOperador ? "Atendimento de SM-is (suas obras)" : "SM-is"}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Coluna titulo="Aberta" cor={C.preto} lista={abertas} {...propsCard} />
          <Coluna titulo="Em atendimento" cor={C.laranja} lista={emAtend} {...propsCard} />
          <Coluna titulo="Atendida" cor={C.verde} lista={atendidas} {...propsCard} />
        </div>
        {ativas.length === 0 && <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>Nenhuma SM-i no momento.</div>}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 12 }}>Prazos: verde &gt;5 dias · amarelo 5/3/2 dias · laranja 1 dia (destaque) · vermelho no dia ou vencida. SM-i vencida só pode ser baixada com autorização do Coordenador de Suprimentos.</div>
      </Card>
    </div>
  );
}
