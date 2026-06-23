import React, { useState, useEffect } from "react";
import { C, fmt, fmtR, pct, sum, dataBR, hojeISO, Card, Btn, Lbl, inp, listar, acaoData, remover } from "./core.jsx";

const DIA = 86400000;
const valorUnit = (e) => { const q = Number(e?.qtde) || 0; return q > 0 ? (Number(e?.valor_total) || 0) / q : 0; };
const mondayOf = (d) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; };

/* ============================ Meus Projetos (Supervisor) ============================ */
export function MeusProjetos({ usuario }) {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const [obras, desig, pos, pmm, sm, ss] = await Promise.all([
      listar("obras"), listar("designacoes"), listar("pos"), listar("pmm"), listar("sm_itens"), listar("ss_itens"),
    ]);
    const minhas = obras.filter((o) => desig.some((x) => x.usuario_id === usuario.id && x.obra_id === o.id));
    const eapPorObra = {}, rdos = [];
    await Promise.all(minhas.map(async (o) => { eapPorObra[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); }));
    setD({ minhas, eapPorObra, rdos, pos, pmm, sm, ss });
  })().catch(() => setD({ minhas: [], eapPorObra: {}, rdos: [], pos: [], pmm: [], sm: [], ss: [] })); }, [usuario.id]);

  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Carregando seus projetos…</div>;
  const { minhas, eapPorObra, rdos, pos, pmm, sm, ss } = d;
  if (minhas.length === 0) return <Card title="Meus projetos"><div style={{ fontSize: 13, color: C.dim }}>Você ainda não está alocado em nenhuma obra. Procure o Planejamento ou a Diretoria.</div></Card>;

  const proxSeg = (() => { const m = mondayOf(new Date()); m.setDate(m.getDate() + 7); return m.toISOString().slice(0, 10); })();
  const proxMes = (() => { const x = new Date(); const m = x.getMonth() + 1 > 11 ? 0 : x.getMonth() + 1; const y = x.getMonth() + 1 > 11 ? x.getFullYear() + 1 : x.getFullYear(); return `${y}-${String(m + 1).padStart(2, "0")}-01`; })();
  const hoje = hojeISO();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {minhas.map((o) => {
        const eap = eapPorObra[o.id] || [];
        const contrato = sum(eap.map((e) => Number(e.valor_total) || 0));
        let med = 0; rdos.filter((r) => r.obra_id === o.id).forEach((r) => (r.atividades || []).forEach((a) => { const it = eap.find((e) => e.codigo === a.eap); if (it) med += (Number(a.qtde_dia ?? a.avanco) || 0) * valorUnit(it); }));
        const pctExec = contrato ? med / contrato : 0;
        let prazoTxt = "—", prazoCor = C.dim;
        if (o.data_inicio && o.prazo_dias) { const fim = new Date(new Date(o.data_inicio).getTime() + o.prazo_dias * DIA); const rest = Math.ceil((fim - Date.now()) / DIA); prazoTxt = rest < 0 ? `vencida há ${-rest} dias` : `faltam ${rest} dias (${dataBR(fim.toISOString())})`; prazoCor = rest < 0 ? C.vermelho : rest <= 30 ? C.amareloAlerta : C.verde; }
        const rdoHoje = rdos.some((r) => r.obra_id === o.id && String(r.data).slice(0, 10) === hoje);
        const temPos = pos.some((p) => p.supervisor_id === usuario.id && p.obra_id === o.id && String(p.semana).slice(0, 10) === proxSeg);
        const temPmm = pmm.some((p) => p.supervisor_id === usuario.id && p.obra_id === o.id && String(p.mes).slice(0, 10) === proxMes);
        const smAb = sm.filter((x) => x.obra_id === o.id && x.solicitante_id === usuario.id && x.status === "aberta").length;
        const ssAb = ss.filter((x) => x.obra_id === o.id && x.solicitante_id === usuario.id && ["aberta", "em_atendimento", "ativa"].includes(x.status)).length;
        const Pend = ({ ok, label, info }) => <div style={{ flex: 1, minWidth: 120, border: `1px solid ${C.linha}`, borderLeft: `4px solid ${ok ? C.verde : C.amareloAlerta}`, borderRadius: 10, padding: "8px 12px" }}><div style={{ fontSize: 12, fontWeight: 700, color: ok ? C.verde : C.amareloAlerta }}>{ok ? "✓ em dia" : "pendente"}</div><div style={{ fontSize: 11.5, color: C.dim }}>{label}{info != null ? `: ${info}` : ""}</div></div>;
        return (
          <Card key={o.id} title={`${o.codigo}${o.nome ? " — " + o.nome : ""}`}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 180 }}><Lbl>Prazo da obra</Lbl><div style={{ fontSize: 15, fontWeight: 800, color: prazoCor }}>{prazoTxt}</div></div>
              <div style={{ flex: 1, minWidth: 180 }}><Lbl>% executado (pelos RDOs)</Lbl><div style={{ fontSize: 15, fontWeight: 800, color: C.laranja }}>{pct(pctExec)} <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>· {fmtR(med)} de {fmtR(contrato)}</span></div>
                <div style={{ background: C.cinza, borderRadius: 8, height: 10, overflow: "hidden", marginTop: 4 }}><div style={{ width: `${Math.min(pctExec * 100, 100)}%`, height: "100%", background: C.laranja }} /></div></div>
            </div>
            <Lbl>Pendências de envio</Lbl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <Pend ok={rdoHoje} label="RDO de hoje" />
              <Pend ok={temPos} label="POS próxima semana" />
              <Pend ok={temPmm} label="PMM próximo mês" />
              <Pend ok={smAb === 0} label="SM-i abertas" info={smAb} />
              <Pend ok={ssAb === 0} label="SS-i abertas" info={ssAb} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================ Alocação de Supervisor ============================ */
export function AlocacaoSupervisor({ usuario }) {
  const [obras, setObras] = useState([]);
  const [sups, setSups] = useState([]);
  const [desig, setDesig] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [sel, setSel] = useState({});
  const [msg, setMsg] = useState(null);

  const carregar = async () => {
    const [ob, us, dg] = await Promise.all([listar("obras"), listar("usuarios"), listar("designacoes")]);
    setObras(ob); setSups(us.filter((u) => u.papel === "sup_obras")); setDesig(dg); setPronto(true);
  };
  useEffect(() => { carregar(); }, []);
  if (!pronto) return <div style={{ color: C.dim, padding: 20 }}>Carregando…</div>;

  const supsDaObra = (oid) => desig.filter((x) => x.obra_id === oid).map((x) => sups.find((u) => u.id === x.usuario_id)).filter(Boolean).map((u) => ({ ...u, desigId: desig.find((d) => d.obra_id === oid && d.usuario_id === u.id)?.id }));
  const alocar = async (oid) => {
    const supId = sel[oid]; if (!supId) return;
    setMsg(null);
    try {
      const r = await acaoData({ t: "alocar_supervisor", obra_id: oid, supervisor_id: supId });
      await carregar(); setSel({ ...sel, [oid]: "" });
      const sup = sups.find((u) => u.id === supId);
      if (r?.email?.ok) setMsg({ tipo: "ok", txt: `Supervisor alocado e e-mail enviado para ${sup?.email}.` });
      else if (r?.email?.motivo === "sem_provedor") setMsg({ tipo: "aviso", txt: `Supervisor alocado. E-mail NÃO enviado: provedor de e-mail não configurado (defina RESEND_API_KEY e EMAIL_FROM na Vercel). E-mail do supervisor: ${sup?.email || "—"}.` });
      else setMsg({ tipo: "aviso", txt: `Supervisor alocado. Não foi possível enviar o e-mail automático (${sup?.email || "sem e-mail cadastrado"}).` });
    } catch (e) { setMsg({ tipo: "erro", txt: e.message }); }
  };
  const desalocar = async (desigId) => { if (!desigId || !confirm("Remover este supervisor da obra?")) return; try { await remover("designacoes", desigId); carregar(); } catch (e) { alert(e.message); } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.tipo === "ok" ? "#eafaf1" : msg.tipo === "erro" ? "#fbeae7" : "#fff8e6", color: msg.tipo === "ok" ? C.verde : msg.tipo === "erro" ? C.vermelho : "#8a6d00", border: `1px solid ${msg.tipo === "ok" ? C.verde : msg.tipo === "erro" ? C.vermelho : C.amareloAlerta}55` }}>{msg.txt}</div>}
      <Card title="Alocação de Supervisores nas obras">
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 12 }}>Ao alocar um supervisor, ele recebe um e-mail comunicando a obra (se houver provedor de e-mail configurado). Um supervisor só enxerga as obras em que está alocado.</div>
        {obras.length === 0 && <div style={{ fontSize: 13, color: C.dim }}>Nenhuma obra cadastrada.</div>}
        {obras.map((o) => {
          const atuais = supsDaObra(o.id);
          const disponiveis = sups.filter((u) => !atuais.some((a) => a.id === u.id));
          return (
            <div key={o.id} style={{ border: `1px solid ${C.linha}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.preto }}>{o.codigo}{o.nome ? <span style={{ fontWeight: 500, color: C.dim }}> — {o.nome}</span> : ""}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
                {atuais.length === 0 ? <span style={{ fontSize: 12.5, color: C.amareloAlerta, fontWeight: 700 }}>Sem supervisor alocado</span> : atuais.map((u) => (
                  <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.laranjaClaro, border: `1px solid ${C.laranja}`, borderRadius: 20, padding: "3px 6px 3px 12px", fontSize: 12.5, fontWeight: 700 }}>{u.nome}<button onClick={() => desalocar(u.desigId)} style={{ background: C.laranja, color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 11, lineHeight: "16px" }}>✕</button></span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={sel[o.id] || ""} onChange={(e) => setSel({ ...sel, [o.id]: e.target.value })} style={inp({ minWidth: 240 })}>
                  <option value="">+ Alocar supervisor…</option>
                  {disponiveis.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.email ? `(${u.email})` : ""}</option>)}
                </select>
                <Btn small disabled={!sel[o.id]} onClick={() => alocar(o.id)}>Alocar e comunicar</Btn>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
