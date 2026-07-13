import React, { useState, useEffect, useMemo } from "react";
import { C, fmt, sum, hojeISO, dataBR, Card, Btn, Lbl, inp, listar, criar, editar, remover, acaoData } from "./core.jsx";

export const mondayOf = (d) => { const x = new Date(d); const dia = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dia); x.setHours(0, 0, 0, 0); return x; };
export const fimDaSemana = () => { const m = mondayOf(new Date()); const f = new Date(m); f.setDate(f.getDate() + 6); f.setHours(23, 59, 59, 0); return f; };
export const ehEmergencial = (dataNec) => !!dataNec && new Date(String(dataNec).slice(0, 10) + "T00:00:00") <= fimDaSemana();

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
  const emerg = ehEmergencial(sm.data_necessidade);
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
      await criar("sm_itens", { obra_id: sm.obra_id, solicitante_id: usuario.id, itens: sm.itens, data_necessidade: sm.data_necessidade || null, descricao: sm.descricao, status: "aberta", emergencial: emerg, autorizada_emergencial: false });
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
      {emerg && sm.data_necessidade && (
        <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}66`, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: C.texto }}>
          <b style={{ color: C.vermelho }}>⚠ SM-i EMERGENCIAL</b> — a entrega é nesta mesma semana. Esta solicitação <b>só irá para o Suprimentos após autorização do Coordenador de Obras</b>. Use o emergencial apenas quando indispensável.
        </div>
      )}
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small disabled={busy || !podeEnviar} onClick={salvar}>{emerg ? "Enviar SM-i emergencial (p/ autorização)" : "Enviar SM-i para Suprimentos"}</Btn></div>
    </Card>
  );
}

/* ---- cartão de SM-i para os kanbans ---- */
function CardSm({ sm, obras, colaboradores, podeAtender, podeAutorizar, gestor, onMover, mostrarHistorico }) {
  const [aberto, setAberto] = useState(false);
  const obra = obras.find((o) => o.id === sm.obra_id);
  const solicitante = colaboradores.find((c) => c.id === sm.solicitante_id)?.nome || "—";
  const pz = prazoSm(sm.data_necessidade);
  const vencida = pz.nivel === "vencida" || pz.nivel === "hoje";
  const podeBaixar = !vencida || podeAutorizar || gestor;
  const stop = (e) => e.stopPropagation();
  return (
    <div onClick={() => setAberto((a) => !a)} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderLeft: `4px solid ${pz.cor}`, borderRadius: 8, padding: 10, marginBottom: 8, boxShadow: pz.urgente ? `0 0 0 1.5px ${pz.cor}33` : "none", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.preto }}>{obra?.codigo || "—"}{sm.emergencial ? <span style={{ marginLeft: 6, background: C.vermelho, color: "#fff", fontSize: 9.5, fontWeight: 800, borderRadius: 4, padding: "1px 6px", verticalAlign: "middle" }}>EMERG</span> : null}</span>
        <span style={{ background: `${pz.cor}1a`, color: pz.cor, fontSize: 10.5, fontWeight: 800, borderRadius: 5, padding: "2px 8px" }}>{pz.label}</span>
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Solicitante: {solicitante} · necessário {sm.data_necessidade ? dataBR(sm.data_necessidade) : "—"}{mostrarHistorico ? ` · aberta há ${diasDesde(sm.criado_em)}d` : ""} <span style={{ color: C.laranja, fontWeight: 700 }}>{aberto ? "▲" : "▼"}</span></div>
      {!aberto ? (
        <div style={{ fontSize: 12, color: C.texto }}>
          {(sm.itens || []).slice(0, 2).map((it, i) => <div key={i} style={{ marginBottom: 2 }}><b>{it.eap_codigo}</b> · {it.material} — {fmt(it.quantidade)} {it.unidade}</div>)}
          {(sm.itens || []).length > 2 && <div style={{ color: C.dim, fontSize: 11 }}>+{sm.itens.length - 2} item(ns)… (clique para ver tudo)</div>}
        </div>
      ) : (
        <div style={{ background: "#fafafa", border: `1px solid ${C.linha}`, borderRadius: 8, padding: 10, margin: "4px 0" }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Obra: <b>{obra?.codigo}{obra?.nome ? " — " + obra.nome : ""}</b> · Status: <b>{sm.status}</b> · Criada em {sm.criado_em ? dataBR(sm.criado_em) : "—"}{sm.emergencial ? ` · ${sm.autorizada_emergencial ? "emergencial autorizada" : "emergencial pendente"}` : ""}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Item EAP", "Descrição EAP", "Material", "Qtde", "Contratado"].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 10, color: C.dim, textTransform: "uppercase", padding: "3px 6px", borderBottom: `1px solid ${C.linha}` }}>{h}</th>)}</tr></thead>
            <tbody>{(sm.itens || []).map((it, i) => <tr key={i}><td style={tdDet}><b>{it.eap_codigo}</b></td><td style={tdDet}>{String(it.descricao || "—").slice(0, 40)}</td><td style={tdDet}>{it.material}</td><td style={tdDet}>{fmt(it.quantidade)} {it.unidade}</td><td style={{ ...tdDet, color: it.qtde_contratada && Number(it.quantidade) > it.qtde_contratada ? C.vermelho : C.dim }}>{it.qtde_contratada ? `${fmt(it.qtde_contratada)} ${it.unidade_eap || ""}` : "—"}</td></tr>)}</tbody>
          </table>
          {sm.descricao && <div style={{ fontSize: 12, color: C.texto, marginTop: 8 }}><b>Observações:</b> {sm.descricao}</div>}
        </div>
      )}
      {!aberto && sm.descricao && <div style={{ fontSize: 11, color: C.dim, marginTop: 4, fontStyle: "italic" }}>{String(sm.descricao).slice(0, 60)}{sm.descricao.length > 60 ? "…" : ""}</div>}
      {(podeAtender || podeAutorizar || gestor) && (
        <div onClick={stop} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {sm.status === "aberta" && <Btn small kind="ghost" onClick={() => onMover(sm, "em_atendimento")}>Atender</Btn>}
          {sm.status === "em_atendimento" && podeBaixar && <Btn small onClick={() => onMover(sm, "atendida")}>Concluir / baixar</Btn>}
          {sm.status === "em_atendimento" && !podeBaixar && <span style={{ fontSize: 10.5, color: C.vermelho, fontWeight: 700, alignSelf: "center" }}>Baixa vencida requer o Coord. de Suprimentos</span>}
          {sm.status !== "atendida" && (podeAutorizar || gestor) && <Btn small kind="ghost" onClick={() => onMover(sm, "cancelada")}>Cancelar</Btn>}
        </div>
      )}
    </div>
  );
}
const tdDet = { fontSize: 11.5, padding: "3px 6px", borderBottom: `1px solid ${C.linha}` };

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

/* ---- Autorização de SM-is emergenciais (Coord. Obras/Suprimentos/Planejamento + Diretoria) ---- */
function PainelAutorizaEmergSm({ usuario, sms, obras, onMudou }) {
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => { listar("usuarios").then(setUsuarios).catch(() => {}); }, []);
  const emergPend = sms.filter((s) => s.emergencial && !s.autorizada_emergencial && s.status !== "cancelada");
  const autorizar = async (sm) => { try { await editar("sm_itens", sm.id, { autorizada_emergencial: true, autorizada_por: usuario.id }); onMudou(); } catch (e) { alert(e.message); } };
  const descartar = async (sm) => { if (!confirm("Descartar esta SM-i emergencial? Ela será cancelada e não irá ao Suprimentos.")) return; try { await editar("sm_itens", sm.id, { status: "cancelada" }); onMudou(); } catch (e) { alert(e.message); } };
  const nomeObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  if (emergPend.length === 0) return null;
  return (
    <Card title={`SM-is emergenciais aguardando autorização (${emergPend.length})`}>
      {emergPend.map((sm) => {
        const sol = usuarios.find((u) => u.id === sm.solicitante_id)?.nome || "—";
        return <div key={sm.id} style={{ border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13 }}><b>{nomeObra(sm.obra_id)}</b> · {sol} · necessário {sm.data_necessidade ? dataBR(sm.data_necessidade) : "—"}<div style={{ fontSize: 12, color: C.dim }}>{(sm.itens || []).map((i) => `${i.eap_codigo} ${i.material} (${fmt(i.quantidade)} ${i.unidade})`).join(" · ")}</div></div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}><Btn small kind="ghost" onClick={() => descartar(sm)}>Descartar</Btn><Btn small onClick={() => autorizar(sm)}>Autorizar p/ Suprimentos</Btn></div>
        </div>;
      })}
    </Card>
  );
}

/* ---- Conformidade de envio dos Supervisores (Coord. de Obras + Diretoria) ---- */
function PainelConformidadeSm({ obras }) {
  const [usuarios, setUsuarios] = useState([]);
  const [envios, setEnvios] = useState([]);
  const recarregar = () => { listar("usuarios").then(setUsuarios).catch(() => {}); listar("envio_semanal").then(setEnvios).catch(() => {}); };
  useEffect(() => { recarregar(); }, []);
  const semana = mondayOf(new Date()).toISOString().slice(0, 10);
  const sups = usuarios.filter((u) => u.papel === "sup_obras");
  const confirmou = (uid) => envios.some((e) => e.usuario_id === uid && String(e.semana).slice(0, 10) === semana);
  const destravar = async (u) => { try { await editar("usuarios", u.id, { travado: false, travado_em: null }); recarregar(); } catch (e) { alert(e.message); } };
  const pendentes = sups.filter((u) => !confirmou(u.id) && !u.travado);
  return (
    <Card title="Conformidade de envio dos Supervisores (semana atual)" right={<span style={{ fontSize: 12, color: pendentes.length ? C.vermelho : C.verde, fontWeight: 700 }}>{pendentes.length ? `${pendentes.length} pendente(s)` : "todos em dia"}</span>}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>O envio das SM-is da próxima semana deve ser confirmado até a segunda-feira. Supervisores travados perderam o prazo por mais de 24h — use “Destravar” após alinhar.</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: C.preto }}>{["Supervisor", "Status da semana", "Ação"].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{sups.map((u) => {
          const st = u.travado ? { t: "bloqueado", c: C.vermelho } : confirmou(u.id) ? { t: "confirmado", c: C.verde } : { t: "pendente", c: C.amareloAlerta };
          return <tr key={u.id}><td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{u.nome}</td>
            <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, color: st.c, fontWeight: 700 }}>{st.t}</td>
            <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.linha}` }}>{u.travado ? <Btn small kind="ghost" onClick={() => destravar(u)}>Destravar</Btn> : "—"}</td></tr>;
        })}
        {sups.length === 0 && <tr><td colSpan={3} style={{ padding: 12, color: C.dim, fontSize: 13 }}>Nenhum supervisor cadastrado.</td></tr>}</tbody></table>
    </Card>
  );
}

/* ---- Painel da Diretoria: emergenciais por obra (últimos 15 dias) ---- */
function PainelDiretoria({ sms, obras }) {
  const corte = Date.now() - 15 * 86400 * 1000;
  const recentes = sms.filter((s) => s.emergencial && new Date(s.criado_em).getTime() >= corte);
  const porObra = {};
  recentes.forEach((s) => { porObra[s.obra_id] = (porObra[s.obra_id] || 0) + 1; });
  const linhas = Object.entries(porObra).map(([oid, n]) => ({ obra: obras.find((o) => o.id === oid)?.codigo || "—", n })).sort((a, b) => b.n - a.n);
  const excesso = linhas.filter((l) => l.n > 3);
  return (
    <Card title="Diretoria · Solicitações emergenciais por obra (últimos 15 dias)">
      {excesso.length > 0 && <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}><b style={{ color: C.vermelho }}>⚠ Acima do limite (3 em 15 dias):</b> {excesso.map((l) => `${l.obra} (${l.n})`).join(" · ")}</div>}
      {linhas.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Nenhuma SM-i emergencial nos últimos 15 dias.</div> : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{linhas.map((l) => <div key={l.obra} style={{ border: `1.5px solid ${l.n > 3 ? C.vermelho : C.linha}`, borderRadius: 8, padding: "8px 14px", minWidth: 90 }}><div style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>{l.obra}</div><div style={{ fontSize: 22, fontWeight: 800, color: l.n > 3 ? C.vermelho : C.preto }}>{l.n}</div></div>)}</div>
      )}
    </Card>
  );
}

/* ---- Aviso semanal + travamento na tela do Supervisor de Obras ---- */
function AvisoEnvioSupervisor({ usuario, onState }) {
  const [c, setC] = useState(null); const [busy, setBusy] = useState(false); const [envios, setEnvios] = useState([]);
  const semanaAtual = mondayOf(new Date()).toISOString().slice(0, 10);
  const checar = () => acaoData({ t: "sm_compliance" }).then((d) => { setC(d); onState && onState(d); }).catch(() => {});
  const carregarHist = () => listar("envio_semanal").then((rows) => setEnvios((rows || []).filter((e) => e.usuario_id === usuario?.id))).catch(() => {});
  useEffect(() => { checar(); carregarHist(); }, []);
  const confirmar = async () => { setBusy(true); try { await acaoData({ t: "confirmar_envio" }); await checar(); await carregarHist(); } finally { setBusy(false); } };
  const semNecessidade = async () => { setBusy(true); try { await acaoData({ t: "sm_sem_necessidade" }); await checar(); await carregarHist(); } finally { setBusy(false); } };
  if (!c) return null;
  const meuDaSemana = envios.find((e) => String(e.semana).slice(0, 10) === semanaAtual);
  const semLabel = (e) => e.sem_necessidade ? "Sem necessidade de SM-i" : "Envio confirmado";
  const hist = envios.length > 0 && (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.dim }}>Histórico de semanas ({envios.length})</summary>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {envios.slice(0, 10).map((e) => (
          <div key={e.id} style={{ fontSize: 11.5, color: C.texto, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "ui-monospace,monospace", color: C.dim }}>{String(e.semana).slice(0, 10).split("-").reverse().join("/")}</span>
            <span style={{ background: e.sem_necessidade ? `${C.amareloAlerta}22` : `${C.verde}18`, color: e.sem_necessidade ? C.amareloAlerta : C.verde, borderRadius: 5, padding: "1px 8px", fontWeight: 700 }}>{semLabel(e)}</span>
          </div>
        ))}
      </div>
    </details>
  );
  if (c.travado) return (
    <div style={{ background: C.vermelho, color: "#fff", borderRadius: 10, padding: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🔒 Seu acesso de envio está bloqueado</div>
      <div style={{ fontSize: 13, opacity: 0.95 }}>As SM-is desta semana não foram enviadas nem confirmadas dentro do prazo (segunda-feira + 24h). Procure seu Coordenador de Obras ou a Diretoria para liberar o acesso.</div>
    </div>
  );
  if (c.confirmado) return (
    <div>
      <div style={{ background: `${C.verde}12`, border: `1px solid ${C.verde}55`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: meuDaSemana?.sem_necessidade ? C.amareloAlerta : C.verde, fontWeight: 700 }}>
        {meuDaSemana?.sem_necessidade ? "✓ Semana marcada como “sem necessidade de SM-i”. Registrado no histórico." : "✓ Envio da semana confirmado."}
      </div>
      {hist}
    </div>
  );
  return (
    <div>
      <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}66`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.texto }}><b style={{ color: C.vermelho }}>⚠ {c.atrasado ? "Envio em atraso!" : "Atenção ao prazo de envio"}</b> — envie até <b>segunda-feira</b> as SM-is dos materiais que precisam chegar na próxima semana. Se nada for necessário, use “sem necessidade”. O atraso por mais de 24h bloqueia seu envio e aciona o Coordenador de Obras.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small disabled={busy} onClick={confirmar}>Confirmar envio da semana</Btn>
          <Btn small kind="ghost" disabled={busy} onClick={semNecessidade}>Sem necessidade de SM-is nesta semana</Btn>
        </div>
      </div>
      {hist}
    </div>
  );
}
export function SmI({ usuario, obras, eapPorObra, colaboradores = [], acesso, onGerarOc, onMudou }) {
  const [sms, setSms] = useState([]); const [pronto, setPronto] = useState(false);
  const [compSup, setCompSup] = useState(null);
  const [perguntarOc, setPerguntarOc] = useState(null);
  const p = usuario.papel;
  const ehSup = p === "sup_obras";
  const ehOperador = p === "op_suprimentos";
  const ehCoord = p === "coord_suprimentos";
  const ehCoordPlan = p === "coord_planejamento";
  const gestor = p === "ceo" || p === "diretor";
  const podeCriar = acesso?.smi_criar ?? ehSup;
  const podeVer = (acesso?.smi_gestao ?? (ehOperador || ehCoord || ehCoordPlan || gestor)) || podeCriar;

  const carregar = () => listar("sm_itens").then((r) => { setSms(r); setPronto(true); }).catch(() => setPronto(true));
  useEffect(() => { carregar(); }, []);

  const mover = async (sm, status) => {
    const patch = { status };
    const pz = prazoSm(sm.data_necessidade);
    if (status === "em_atendimento") patch.atendido_por = usuario.id;
    if (status === "atendida") { patch.baixado_em = new Date().toISOString(); if ((pz.nivel === "vencida" || pz.nivel === "hoje") && (ehCoord || gestor)) patch.baixa_autorizada_por = usuario.id; }
    try {
      await editar("sm_itens", sm.id, patch); carregar(); onMudou && onMudou();
      if (status === "atendida" && (ehOperador || ehCoord || gestor) && onGerarOc) setPerguntarOc(sm);
    } catch (e) { alert(e.message); }
  };

  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando solicitações…</div>;

  const ativas = sms.filter((s) => s.status !== "cancelada");
  const abertas = ativas.filter((s) => s.status === "aberta");
  const emAtend = ativas.filter((s) => s.status === "em_atendimento");
  const atendidas = ativas.filter((s) => s.status === "atendida");
  const urgentes = [...abertas, ...emAtend].filter((s) => prazoSm(s.data_necessidade).urgente);

  const propsCard = { obras, colaboradores, podeAtender: ehOperador || ehCoord || gestor, podeAutorizar: ehCoord || gestor, gestor, onMover: mover, mostrarHistorico: ehCoord || gestor };
  const ehCoordObras = p === "coord_obras";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ehSup && <AvisoEnvioSupervisor usuario={usuario} onState={setCompSup} />}
      {podeCriar && !(ehSup && compSup?.travado) && <FormSmI obras={obras} eapPorObra={eapPorObra} usuario={usuario} onCriou={carregar} />}

      {gestor && <PainelDiretoria sms={sms} obras={obras} />}
      {(acesso?.emerg_autorizar ?? (ehCoordObras || ehCoord || ehCoordPlan || gestor)) && <PainelAutorizaEmergSm usuario={usuario} sms={sms} obras={obras} onMudou={carregar} />}
      {(ehCoordObras || gestor) && <PainelConformidadeSm obras={obras} />}

      {(ehOperador || ehCoord || gestor) && urgentes.length > 0 && (
        <div style={{ background: `${C.vermelho}10`, border: `1px solid ${C.vermelho}55`, borderRadius: 8, padding: "10px 14px" }}>
          <b style={{ color: C.vermelho }}>⚠ {urgentes.length} SM-i urgente(s)</b> <span style={{ color: C.texto, fontSize: 13 }}>— vencendo em até 1 dia ou já vencidas: {urgentes.map((s) => obras.find((o) => o.id === s.obra_id)?.codigo).filter(Boolean).join(" · ")}</span>
        </div>
      )}

      {podeVer && (
        <Card title={ehSup ? "Minhas solicitações" : ehCoord ? "Gestão de SM-is (todas as obras)" : ehOperador ? "Atendimento de SM-is (suas obras)" : "SM-is (todas as obras)"}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Coluna titulo="Aberta" cor={C.preto} lista={abertas} {...propsCard} />
            <Coluna titulo="Em atendimento" cor={C.laranja} lista={emAtend} {...propsCard} />
            <Coluna titulo="Atendida" cor={C.verde} lista={atendidas} {...propsCard} />
          </div>
          {ativas.length === 0 && <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>Nenhuma SM-i no momento.</div>}
          <div style={{ fontSize: 11, color: C.dim, marginTop: 12 }}>Prazos: verde &gt;5 dias · amarelo 5/3/2 dias · laranja 1 dia (destaque) · vermelho no dia ou vencida. SM-i vencida só pode ser baixada com autorização do Coordenador de Suprimentos.</div>
        </Card>
      )}

      {perguntarOc && (
        <ModalGerar
          titulo="SM-i baixada"
          texto="Deseja gerar uma OC-i (Ordem de Compra) já pré-preenchida com os itens desta solicitação? Você completará o fornecedor e os valores antes de emitir o PDF."
          rotuloOk="Gerar OC-i"
          onSim={() => { const sm = perguntarOc; setPerguntarOc(null); onGerarOc && onGerarOc(sm); }}
          onNao={() => setPerguntarOc(null)}
        />
      )}
    </div>
  );
}

/* Modal simples de confirmação para gerar OC-i / OS-i a partir da solicitação */
export function ModalGerar({ titulo, texto, rotuloOk, onSim, onNao }) {
  return (
    <div onClick={onNao} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="mcc-card" style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 420, width: "100%", boxShadow: "0 18px 50px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.preto, marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 13.5, color: C.texto, lineHeight: 1.55, marginBottom: 18 }}>{texto}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn small kind="ghost" onClick={onNao}>Agora não</Btn>
          <Btn small onClick={onSim}>{rotuloOk}</Btn>
        </div>
      </div>
    </div>
  );
}
