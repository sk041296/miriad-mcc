import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, Card, Btn, Lbl, inp, NumInput, listar, criar, uploadFoto, aprovarBmp, rejeitarBmp } from "./core.jsx";
import { gerarPdfBMP } from "./pdf.js";

// normalização acento/caixa para as buscas do módulo BMP
const normTxt = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const podeMedir = (p) => ["sup_obras", "coord_planejamento", "ceo", "diretor"].includes(p);
const podeAprovarBmpFn = (p) => ["ceo", "diretor", "coord_planejamento", "coord_obras"].includes(p);

export function BMPMedicoes({ usuario }) {
  const [d, setD] = useState(null);
  const [medindo, setMedindo] = useState(null); // contrato em medição
  const [aberto, setAberto] = useState({});
  const [busy, setBusy] = useState(null);
  const [filtroObra, setFiltroObra] = useState("");
  const [buscaBmp, setBuscaBmp] = useState("");
  const [pIni, setPIni] = useState("");
  const [pFim, setPFim] = useState("");
  const podeAprovarBmp = podeAprovarBmpFn(usuario.papel);

  const carregar = async () => {
    const [contratos, obras, boletins] = await Promise.all([listar("contratos_servico"), listar("obras"), listar("boletins_medicao")]);
    const eapPorObra = {};
    await Promise.all([...new Set(contratos.map((c) => c.obra_id).filter(Boolean))].map(async (oid) => { eapPorObra[oid] = await listar("eap_itens", { obra_id: oid }); }));
    setD({ contratos, obras, boletins, eapPorObra });
  };
  useEffect(() => { carregar(); }, []);
  const aprovar = async (b) => {
    if (!confirm(`Aprovar o boletim nº ${b.numero} e gerar a OP de ${fmtR(b.liquido)} no financeiro?`)) return;
    setBusy(b.id);
    try { const r = await aprovarBmp(b.id); await carregar(); alert(`Boletim aprovado! OP de ${fmtR(r.op_valor != null ? r.op_valor : b.liquido)} gerada no financeiro (Pendente NF). Use “PDF” para enviar a medição ao prestador.`); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  };
  const rejeitar = async (b) => {
    const m = prompt("Motivo da rejeição (opcional):", ""); if (m === null) return;
    setBusy(b.id);
    try { await rejeitarBmp(b.id, m); await carregar(); } catch (e) { alert(e.message); } finally { setBusy(null); }
  };
  const baixarPdf = (b, ct, o) => gerarPdfBMP(b, ct, o, usuario.nome);
  const stBadgeBmp = (st) => st === "aprovado" ? { t: "aprovado · OP gerada", c: C.verde } : st === "rejeitado" ? { t: "rejeitado", c: C.vermelho } : { t: "aguardando aprovação", c: C.amareloAlerta };
  const boletimRow = (b, ct, o, comObra) => { const st = stBadgeBmp(b.status); return (
    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderBottom: `1px solid ${C.linha}` }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>Nº {b.numero}</span>
      {comObra && <span style={{ fontSize: 11, color: C.dim }}>{o?.codigo || "—"} · {ct?.empresa || "—"}</span>}
      <span style={{ fontSize: 11, color: C.dim }}>{dataBR(b.criado_em)}</span>
      <span style={{ fontSize: 12, color: C.verde, fontWeight: 700 }}>{fmtR(b.liquido)}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: st.c, borderRadius: 5, padding: "1px 7px" }}>{st.t}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
        <Btn small kind="ghost" onClick={() => baixarPdf(b, ct, o)}>PDF</Btn>
        {b.status === "aguardando_aprovacao" && podeAprovarBmp && <>
          <Btn small kind="ghost" disabled={busy === b.id} onClick={() => rejeitar(b)}>Rejeitar</Btn>
          <Btn small disabled={busy === b.id} onClick={() => aprovar(b)}>{busy === b.id ? "…" : "Aprovar e gerar OP"}</Btn>
        </>}
      </div>
    </div>
  ); };
  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Carregando contratos…</div>;
  const { contratos, obras, boletins, eapPorObra } = d;
  const obraDe = (id) => obras.find((o) => o.id === id);
  const contratoDe = (id) => contratos.find((c) => c.id === id);

  // segmentação/busca dos boletins
  const filtroAtivo = !!(buscaBmp.trim() || pIni || pFim);
  const nq = normTxt(buscaBmp);
  const obrasComContrato = obras.filter((o) => contratos.some((c) => c.obra_id === o.id));
  const boletinsFiltrados = boletins.filter((b) => {
    const ct = contratoDe(b.contrato_id); const o = obraDe(b.obra_id);
    if (filtroObra && b.obra_id !== filtroObra) return false;
    if (pIni && String(b.criado_em).slice(0, 10) < pIni) return false;
    if (pFim && String(b.criado_em).slice(0, 10) > pFim) return false;
    if (nq && !(normTxt(ct?.empresa).includes(nq) || normTxt(o?.codigo).includes(nq) || normTxt(String(b.numero)).includes(nq))) return false;
    return true;
  }).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  const contratosVis = filtroObra ? contratos.filter((c) => c.obra_id === filtroObra) : contratos;

  const bmpDoContrato = (cid) => boletins.filter((b) => b.contrato_id === cid && b.status !== "rejeitado");
  const medidoContrato = (cid) => sum(bmpDoContrato(cid).map((b) => Number(b.total) || 0));
  const medidoPorItem = (cid) => { const m = {}; bmpDoContrato(cid).forEach((b) => (b.itens || []).forEach((i) => { m[i.eap_codigo] = (m[i.eap_codigo] || 0) + (Number(i.valor_medido) || 0); })); return m; };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title="Boletins de medição (BMP)">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 4 }}>
          <div><Lbl>Obra</Lbl>
            <select value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)} style={inp({ fontSize: 13, minWidth: 150 })}>
              <option value="">Todas</option>
              {obrasComContrato.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}><Lbl>Buscar (prestador, obra ou nº)</Lbl>
            <input value={buscaBmp} onChange={(e) => setBuscaBmp(e.target.value)} placeholder="ex.: Construtora X · CENSE · 3" style={inp({ width: "100%", boxSizing: "border-box", fontSize: 13 })} />
          </div>
          <div><Lbl>Período — de</Lbl><input type="date" value={pIni} onChange={(e) => setPIni(e.target.value)} style={inp({ fontSize: 12 })} /></div>
          <div><Lbl>até</Lbl><input type="date" value={pFim} onChange={(e) => setPFim(e.target.value)} style={inp({ fontSize: 12 })} /></div>
          {filtroAtivo && <Btn small kind="ghost" onClick={() => { setBuscaBmp(""); setPIni(""); setPFim(""); }}>Limpar</Btn>}
        </div>
        {filtroAtivo ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>{boletinsFiltrados.length} boletim(ns) no filtro/período.</div>
            {boletinsFiltrados.map((b) => boletimRow(b, contratoDe(b.contrato_id), obraDe(b.obra_id), true))}
            {boletinsFiltrados.length === 0 && <div style={{ fontSize: 13, color: C.dim, padding: 8 }}>Nenhum boletim encontrado.</div>}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: C.dim }}>Mostrando abaixo os cartões por contrato (com os 5 boletins mais recentes de cada). Use a busca ou o período acima para localizar boletins antigos.</div>
        )}
      </Card>

      {!filtroAtivo && (
      <Card title="Medições de prestadores (BMP) — OS-is vigentes">
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 12 }}>Cada cartão é um contrato de serviço (OS-i). Clique em <b>Gerar medição</b> para medir o avanço do prestador. Ao ser <b>aprovada</b> (Coord. de Obras, Planejamento ou Diretoria), a medição gera automaticamente a <b>OP no financeiro</b> (pelo líquido) e disponibiliza o <b>PDF</b> para envio manual ao prestador.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {contratosVis.map((ct) => {
            const o = obraDe(ct.obra_id);
            const valorCt = Number(ct.valor) || 0;
            const medido = medidoContrato(ct.id);
            const saldo = valorCt - medido;
            const porItem = medidoPorItem(ct.id);
            const itens = (ct.itens_eap && ct.itens_eap.length) ? ct.itens_eap : [];
            return (
              <div key={ct.id} style={{ border: `1px solid ${C.linha}`, borderRadius: 12, padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14 }}>{ct.empresa || "—"}</div><div style={{ fontSize: 12, color: C.dim }}>{o?.codigo || "—"} · {ct.tipo || "indireto"}</div></div>
                  <span style={{ background: C.laranjaClaro, color: C.laranja, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{fmtR(valorCt)}</span>
                </div>
                <div style={{ display: "flex", gap: 10, margin: "10px 0", fontSize: 12 }}>
                  <div style={{ flex: 1 }}><div style={{ color: C.dim }}>Já medido</div><div style={{ fontWeight: 800, color: C.verde }}>{fmtR(medido)}</div></div>
                  <div style={{ flex: 1 }}><div style={{ color: C.dim }}>Saldo a medir</div><div style={{ fontWeight: 800, color: saldo > 0 ? C.preto : C.dim }}>{fmtR(saldo)}</div></div>
                </div>
                <div style={{ background: C.cinza, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 10 }}><div style={{ width: `${valorCt ? Math.min(medido / valorCt * 100, 100) : 0}%`, height: "100%", background: C.verde }} /></div>
                <div style={{ display: "flex", gap: 6 }}>
                  {podeMedir(usuario.papel) && <Btn small onClick={() => setMedindo(ct)}>Gerar medição</Btn>}
                  <Btn small kind="ghost" onClick={() => setAberto((s) => ({ ...s, [ct.id]: !s[ct.id] }))}>{aberto[ct.id] ? "Ocultar itens" : "Ver por item"}</Btn>
                </div>
                {aberto[ct.id] && (
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                    <thead><tr><th style={thb}>Item</th><th style={{ ...thb, textAlign: "right" }}>Contrato</th><th style={{ ...thb, textAlign: "right" }}>Medido</th><th style={{ ...thb, textAlign: "right" }}>Saldo</th></tr></thead>
                    <tbody>{itens.map((it, k) => { const med = porItem[it.eap_codigo] || 0; const v = Number(it.valor) || 0; return (
                      <tr key={k}><td style={tdb}><b>{it.eap_codigo}</b> {String(it.descricao || "").slice(0, 18)}</td><td style={{ ...tdb, textAlign: "right" }}>{fmt(v)}</td><td style={{ ...tdb, textAlign: "right", color: C.verde }}>{fmt(med)}</td><td style={{ ...tdb, textAlign: "right" }}>{fmt(v - med)}</td></tr>
                    ); })}
                      {itens.length === 0 && <tr><td colSpan={4} style={{ ...tdb, color: C.dim }}>Contrato sem itens de EAP detalhados.</td></tr>}</tbody>
                  </table>
                )}
                {(() => {
                  const lista = boletins.filter((b) => b.contrato_id === ct.id).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
                  if (!lista.length) return null;
                  const ultimos = lista.slice(0, 5);
                  return (
                    <div style={{ marginTop: 10, borderTop: `1px solid ${C.linha}`, paddingTop: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Boletins recentes{lista.length > 5 ? ` (5 de ${lista.length})` : ""}</div>
                      {ultimos.map((b) => boletimRow(b, ct, o, false))}
                      {lista.length > 5 && <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>Use a busca/período no topo para ver os demais {lista.length - 5} boletim(ns).</div>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {contratosVis.length === 0 && <div style={{ fontSize: 13, color: C.dim }}>Nenhuma OS-i {filtroObra ? "para esta obra" : "cadastrada"}.</div>}
        </div>
      </Card>
      )}

      {medindo && <ModalMedicao contrato={medindo} obra={obraDe(medindo.obra_id)} eap={eapPorObra[medindo.obra_id] || []} usuario={usuario}
        numero={(boletins.filter((b) => b.contrato_id === medindo.id).length) + 1}
        onFechar={() => setMedindo(null)} onGerou={() => { setMedindo(null); carregar(); }} />}
    </div>
  );
}

const thb = { fontSize: 10, color: C.dim, textTransform: "uppercase", textAlign: "left", padding: "4px 6px", borderBottom: `1px solid ${C.linha}` };
const tdb = { fontSize: 11.5, padding: "4px 6px", borderBottom: `1px solid ${C.linha}` };

function ModalMedicao({ contrato, obra, eap, usuario, numero, onFechar, onGerou }) {
  const itensBase = (contrato.itens_eap && contrato.itens_eap.length ? contrato.itens_eap : []).map((it) => {
    const e = eap.find((x) => x.codigo === it.eap_codigo) || {};
    return { eap_codigo: it.eap_codigo, descricao: it.descricao || e.descricao || "", unidade: e.unidade || "un", qtde_contratada: Number(e.qtde) || 0, valor_item: Number(it.valor) || Number(e.valor_total) || 0, qtde_avancada: 0, retencao_pct: 0, comentario: "", foto_url: "", foto_legenda: "" };
  });
  const [itens, setItens] = useState(itensBase);
  const [obs, setObs] = useState("");
  const [etapa, setEtapa] = useState("preencher"); // preencher | resumo
  const [busy, setBusy] = useState(false);

  const calc = (it) => { const p = it.qtde_contratada > 0 ? (Number(it.qtde_avancada) || 0) / it.qtde_contratada : 0; const medido = p * it.valor_item; const ret = medido * (Number(it.retencao_pct) || 0) / 100; return { p, medido, ret, liquido: medido - ret }; };
  const up = (i, patch) => setItens((arr) => arr.map((x, j) => j === i ? { ...x, ...patch } : x));
  const totBruto = sum(itens.map((it) => calc(it).medido));
  const totRet = sum(itens.map((it) => calc(it).ret));
  const totLiq = totBruto - totRet;

  const subirFoto = async (i, file) => {
    if (!file) return;
    try { const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); const { url } = await uploadFoto(dataUrl, file.name, obra?.codigo); up(i, { foto_url: url }); } catch (e) { alert("Falha no upload da foto: " + e.message); }
  };

  const gerar = async () => {
    setBusy(true);
    try {
      const itensFinal = itens.map((it) => { const c = calc(it); return { ...it, pct: c.p, valor_medido: c.medido, retencao_valor: c.ret, liquido: c.liquido }; });
      await criar("boletins_medicao", { contrato_id: contrato.id, obra_id: contrato.obra_id || null, numero, status: "aguardando_aprovacao", itens: itensFinal, total: totBruto, retencao: totRet, liquido: totLiq, observacao: obs, criado_por: usuario.id });
      onGerou();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 60, padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="mcc-card" style={{ background: "#fff", borderRadius: 14, padding: 20, maxWidth: 880, width: "100%", margin: "20px 0", boxShadow: "0 18px 50px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <b style={{ fontSize: 16 }}>{etapa === "preencher" ? `Medição nº ${numero} — ${contrato.empresa}` : `Resumo da medição nº ${numero}`}</b>
          <button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.dim }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{obra?.codigo} · prestador {contrato.empresa} · contrato {fmtR(contrato.valor)}</div>

        {etapa === "preencher" ? (
          <>
            {itens.length === 0 && <div style={{ fontSize: 13, color: C.amareloAlerta }}>Este contrato não tem itens de EAP detalhados; cadastre os itens na OS-i para medir por item.</div>}
            {itens.map((it, i) => { const c = calc(it); return (
              <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{it.eap_codigo} — {it.descricao} <span style={{ color: C.dim, fontWeight: 500 }}>· contratado {fmt(it.qtde_contratada)} {it.unidade} · {fmtR(it.valor_item)}</span></div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div><Lbl>Qtde avançada ({it.unidade})</Lbl><input type="number" min="0" step="0.01" value={it.qtde_avancada || ""} onChange={(e) => up(i, { qtde_avancada: parseFloat(e.target.value) || 0 })} style={inp({ width: 120, textAlign: "right" })} /></div>
                  <div><Lbl>Retenção técnica (%)</Lbl><input type="number" min="0" max="100" step="0.5" value={it.retencao_pct || ""} onChange={(e) => up(i, { retencao_pct: parseFloat(e.target.value) || 0 })} style={inp({ width: 110, textAlign: "right" })} /></div>
                  <div style={{ fontSize: 12, color: C.dim, paddingBottom: 4 }}>Avanço {pct(c.p)} · medido <b style={{ color: C.verde }}>{fmtR(c.medido)}</b>{c.ret > 0 ? ` · retenção ${fmtR(c.ret)}` : ""} · líquido <b>{fmtR(c.liquido)}</b></div>
                </div>
                <div style={{ marginTop: 8 }}><Lbl>Comentário de pendência</Lbl><input value={it.comentario} onChange={(e) => up(i, { comentario: e.target.value })} placeholder="ex.: falta acabamento no trecho X" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                  <div><Lbl>Foto</Lbl><input type="file" accept="image/*" onChange={(e) => subirFoto(i, e.target.files?.[0])} style={{ fontSize: 12 }} /></div>
                  {it.foto_url && <img src={it.foto_url} alt="" style={{ height: 44, borderRadius: 6, border: `1px solid ${C.linha}` }} />}
                  {it.foto_url && <div style={{ flex: 1, minWidth: 160 }}><Lbl>Legenda da foto</Lbl><input value={it.foto_legenda} onChange={(e) => up(i, { foto_legenda: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>}
                </div>
              </div>
            ); })}
            <div style={{ marginTop: 6 }}><Lbl>Observação geral da medição</Lbl><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box", resize: "vertical" })} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <div style={{ fontSize: 13 }}>Total medido: <b style={{ color: C.verde, fontSize: 16 }}>{fmtR(totBruto)}</b> · líquido <b>{fmtR(totLiq)}</b></div>
              <Btn onClick={() => setEtapa("resumo")} disabled={itens.length === 0 || totBruto <= 0}>Confirmar medição</Btn>
            </div>
          </>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead><tr><th style={thb}>Item</th><th style={{ ...thb, textAlign: "right" }}>Avanço</th><th style={{ ...thb, textAlign: "right" }}>Medido</th><th style={{ ...thb, textAlign: "right" }}>Retenção</th><th style={{ ...thb, textAlign: "right" }}>Líquido</th></tr></thead>
              <tbody>{itens.map((it, i) => { const c = calc(it); return (
                <tr key={i}><td style={tdb}><b>{it.eap_codigo}</b> {String(it.descricao || "").slice(0, 26)}{it.comentario ? <div style={{ fontSize: 10.5, color: C.amareloAlerta }}>⚠ {it.comentario}</div> : null}</td><td style={{ ...tdb, textAlign: "right" }}>{pct(c.p)}</td><td style={{ ...tdb, textAlign: "right" }}>{fmt(c.medido)}</td><td style={{ ...tdb, textAlign: "right" }}>{c.ret ? fmt(c.ret) : "—"}</td><td style={{ ...tdb, textAlign: "right", fontWeight: 700 }}>{fmt(c.liquido)}</td></tr>
              ); })}</tbody>
              <tfoot><tr style={{ background: C.cinza }}><td style={{ ...tdb, fontWeight: 800 }}>TOTAL</td><td style={tdb} /><td style={{ ...tdb, textAlign: "right", fontWeight: 800 }}>{fmt(totBruto)}</td><td style={{ ...tdb, textAlign: "right", fontWeight: 800 }}>{fmt(totRet)}</td><td style={{ ...tdb, textAlign: "right", fontWeight: 800, color: C.verde }}>{fmt(totLiq)}</td></tr></tfoot>
            </table>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>Ao gerar, a medição fica <b>aguardando aprovação</b> (Coord. de Obras, Planejamento ou Diretoria). Depois de aprovada, o sistema gera a <b>OP no financeiro</b> pelo líquido e o <b>PDF do boletim</b> fica disponível para envio manual ao prestador emitir a NF.</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn kind="ghost" onClick={() => setEtapa("preencher")}>← Voltar e ajustar</Btn>
              <Btn onClick={gerar} disabled={busy}>{busy ? "Gerando…" : "Gerar medição"}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
