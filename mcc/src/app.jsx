import React, { useState, useEffect, useCallback } from "react";
import {
  C, Btn, Card, inp, Lbl, listar, apiAuth, getToken, getUser, setSessao, limparSessao, AuthError,
} from "./core.jsx";
import { ModuloFinanceiro } from "./financeiro.jsx";
import { ModuloOperacional } from "./operacional.jsx";
import { PainelGeral } from "./painel.jsx";
import { LOGO_FULL, LOGO_MARK } from "./logo.js";

/* Marca Miriad (cata-vento real) — usada como ícone no menu */
function LogoMiriad({ size = 26 }) {
  return <img src={LOGO_MARK} alt="Miriad" width={size} height={size} style={{ flexShrink: 0, objectFit: "contain" }} />;
}

/* ---------------- Login / bootstrap ---------------- */
function Login({ onEntrar }) {
  const [modo, setModo] = useState("login");
  const [bootstrap, setBootstrap] = useState(false);
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [nome, setNome] = useState("");
  const [erro, setErro] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { apiAuth({ acao: "precisa_bootstrap" }).then((d) => { if (d.bootstrap) { setBootstrap(true); setModo("bootstrap"); } }).catch(() => {}); }, []);
  const enviar = async () => {
    setBusy(true); setErro(null);
    const d = await apiAuth(modo === "bootstrap" ? { acao: "bootstrap", nome, email, senha } : { acao: "login", email, senha });
    setBusy(false);
    if (d.token) { setSessao(d.token, d.usuario); onEntrar(d.usuario); } else setErro(d.error || "Falha");
  };
  return (
    <div style={{ minHeight: "100vh", background: C.preto, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: C.branco, borderRadius: 16, padding: 36, width: 400, borderTop: `6px solid ${C.laranja}` }}>
        <div style={{ marginBottom: 6 }}>
          <img src={LOGO_FULL} alt="Miriad Construtora" style={{ width: 230, maxWidth: "100%", display: "block" }} />
          <div style={{ fontSize: 14, fontWeight: 800, color: C.laranja, marginTop: 6, letterSpacing: ".02em" }}>Construction Control</div>
        </div>
        <div style={{ fontSize: 13, color: C.dim, margin: "8px 0 22px" }}>{modo === "bootstrap" ? "Cadastre o primeiro acesso (gestor)." : "Acesse com seu e-mail e senha."}</div>
        {modo === "bootstrap" && <div style={{ marginBottom: 10 }}><Lbl>Nome completo</Lbl><input value={nome} onChange={(e) => setNome(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>}
        <div style={{ marginBottom: 10 }}><Lbl>E-mail</Lbl><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        <div style={{ marginBottom: 14 }}><Lbl>Senha</Lbl><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <Btn onClick={enviar} disabled={busy || !email || !senha || (modo === "bootstrap" && !nome)}>{busy ? "…" : modo === "bootstrap" ? "Criar acesso de gestor" : "Entrar"}</Btn>
      </div>
    </div>
  );
}

/* ---------------- Gestão de usuários (gestor) ---------------- */
function Usuarios() {
  const [lista, setLista] = useState([]); const [obras, setObras] = useState([]);
  const [u, setU] = useState({ nome: "", email: "", senha: "", papel: "supervisor", obra_id: "" });
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const carregar = () => { listar("usuarios").then(setLista).catch(() => {}); listar("obras").then(setObras).catch(() => {}); };
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    setBusy(true); setErro(null);
    try { const { criar } = await import("./core.jsx"); await criar("usuarios", { ...u, obra_id: u.papel === "residente" ? (u.obra_id || null) : null }); setU({ nome: "", email: "", senha: "", papel: "supervisor", obra_id: "" }); carregar(); }
    catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const nomeObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const papelLabel = { gestor: "Gestor", supervisor: "Supervisor", residente: "Sup. Residente" };
  const papelCor = (p) => p === "gestor" ? C.preto : p === "residente" ? C.laranja : C.cinza2;
  return (
    <Card title="Usuários e permissões">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 150 }}><Lbl>Nome</Lbl><input value={u.nome} onChange={(e) => setU({ ...u, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        <div style={{ flex: 1, minWidth: 150 }}><Lbl>E-mail</Lbl><input value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        <div><Lbl>Senha</Lbl><input type="password" value={u.senha} onChange={(e) => setU({ ...u, senha: e.target.value })} style={inp({ width: 120 })} /></div>
        <div><Lbl>Papel</Lbl><select value={u.papel} onChange={(e) => setU({ ...u, papel: e.target.value })} style={inp()}><option value="supervisor">Supervisor</option><option value="residente">Supervisor Residente</option><option value="gestor">Gestor</option></select></div>
        {u.papel === "residente" && <div style={{ minWidth: 150 }}><Lbl>Obra designada</Lbl><select value={u.obra_id} onChange={(e) => setU({ ...u, obra_id: e.target.value })} style={inp({ width: "100%" })}><option value="">— selecione —</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></div>}
        <Btn small disabled={busy || !u.nome || !u.email || !u.senha || (u.papel === "residente" && !u.obra_id)} onClick={salvar}>+ Criar</Btn>
      </div>
      {u.papel === "residente" && <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>O Supervisor Residente acessa apenas o módulo Operacional e enxerga somente a obra designada.</div>}
      {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: C.preto }}>{["Nome", "E-mail", "Papel", "Obra"].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{lista.map((x) => <tr key={x.id}><td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{x.nome}</td><td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}>{x.email}</td><td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}><span style={{ background: papelCor(x.papel), color: x.papel === "supervisor" ? C.dim : "#fff", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{papelLabel[x.papel] || x.papel}</span></td><td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}>{x.papel === "residente" ? nomeObra(x.obra_id) : "—"}</td></tr>)}</tbody></table>
    </Card>
  );
}

/* ---------------- Painel Geral wrapper (carrega dados) ---------------- */
function PainelGeralWrap() {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const obras = await listar("obras"); const eap = {}, rdos = [], restr = [];
    await Promise.all(obras.map(async (o) => { eap[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); (await listar("restricoes_material", { obra_id: o.id })).forEach((x) => restr.push(x)); }));
    setD({ obras, eapPorObra: eap, rdos, restricoes: restr });
  })(); }, []);
  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Consolidando obras…</div>;
  return <PainelGeral {...d} />;
}

/* ---------------- Shell com menu lateral ---------------- */
const MENU = [
  { id: "painel", label: "Painel Geral", icone: "▣", papel: "gestor" },
  { grupo: "Financeiro", papel: "gestor", itens: [{ id: "financeiro", label: "Fluxo de Caixa", icone: "$" }] },
  { grupo: "Operacional", papel: "todos", itens: [{ id: "operacional", label: "RDO-i · RSO-i · OC-i", icone: "▤" }] },
];

function Shell({ usuario, onSair }) {
  const ehGestor = usuario.papel === "gestor";
  const [secao, setSecao] = useState(ehGestor ? "painel" : "operacional");
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  const item = (id, label, icone, on) => (
    <button key={id} onClick={() => { setSecao(id); setUsuariosAberto(false); }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: secao === id && !usuariosAberto ? C.laranja : "transparent",
        color: secao === id && !usuariosAberto ? "#fff" : "#d4d4d4", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 2 }}>
      <span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{icone}</span>{label}</button>
  );
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: C.cinza, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <aside style={{ width: 234, background: C.preto, padding: "18px 14px", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, padding: "0 4px" }}><LogoMiriad size={28} />
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 900, lineHeight: 1.05 }}>Miriad<br /><span style={{ color: C.laranja, fontSize: 11, fontWeight: 700 }}>Construction Control</span></div></div>
        <div style={{ height: 1, background: "#333", margin: "14px 0" }} />
        {ehGestor && item("painel", "Painel Geral", "▣")}
        {ehGestor && <>
          <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Financeiro</div>
          {item("financeiro", "Fluxo de Caixa", "$")}
        </>}
        <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Operacional</div>
        {item("operacional", "RDO-i · RSO-i · OC-i", "▤")}
        <div style={{ flex: 1 }} />
        {ehGestor && <button onClick={() => setUsuariosAberto(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: usuariosAberto ? C.laranja : "transparent", color: usuariosAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>⚙</span>Usuários</button>}
        <div style={{ borderTop: "1px solid #333", marginTop: 10, paddingTop: 12 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{usuario.nome}</div>
          <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>{usuario.papel === "gestor" ? "Gestor" : "Supervisor"}</div>
          <button onClick={onSair} style={{ background: "transparent", border: "1px solid #444", color: "#aaa", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", width: "100%" }}>Sair</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, maxWidth: 1320, minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.preto, margin: "0 0 18px" }}>
          {usuariosAberto ? "Usuários e permissões" : secao === "painel" ? "Painel Geral" : secao === "financeiro" ? "Financeiro · Fluxo de Caixa" : "Operacional"}
        </h1>
        {usuariosAberto && ehGestor ? <Usuarios />
          : secao === "painel" && ehGestor ? <PainelGeralWrap />
          : secao === "financeiro" && ehGestor ? <ModuloFinanceiro />
          : <ModuloOperacional usuario={usuario} />}
      </main>
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(() => (getToken() ? getUser() : null));
  const sair = useCallback(() => { limparSessao(); setUsuario(null); }, []);
  // valida sessão expirada ao montar
  useEffect(() => { if (getToken()) listar("obras").catch((e) => { if (e instanceof AuthError) sair(); }); }, [sair]);
  if (!usuario) return <Login onEntrar={setUsuario} />;
  return <Shell usuario={usuario} onSair={sair} />;
}
