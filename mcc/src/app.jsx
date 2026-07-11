import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  C, Btn, Card, inp, Lbl, listar, criar, criarUsuario, editar, remover, acaoData, apiAuth, getToken, getUser, setSessao, limparSessao, AuthError, pendenciasUsuarios, destravarUsuario,
  PAPEIS, PERMS, pode, ehDirecao, papeisQuePodeCriar, PRECISA_DESIGNACAO, SETOR_DE_PAPEL,
  registrarPapeisCustom, nomePapel, PAPEIS_CUSTOM,
  OP_IDS, FIN_IDS, acessoDe, mapaAcessoPadrao, mesclarAcesso, getConfig, setConfig,
} from "./core.jsx";
import { ModuloFinanceiro } from "./financeiro.jsx";
import { ModuloOperacional } from "./operacional.jsx";
import { PainelGeral } from "./painel.jsx";
import { Ranking } from "./ranking.jsx";
import { PainelGerencial } from "./painelger.jsx";
import { MeusProjetos, AlocacaoSupervisor } from "./extras.jsx";
import { BMPMedicoes } from "./bmp.jsx";
import { LOGO_FULL, LOGO_MARK } from "./logo.js";

function LogoMiriad({ size = 26 }) {
  return <img src={LOGO_MARK} alt="Miriad" width={size} height={size} style={{ flexShrink: 0, objectFit: "contain" }} />;
}
const btnMini = (cor) => ({ background: "none", border: `1px solid ${cor}`, color: cor, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" });

function useIsMobile(bp = 820) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const fn = (e) => setM(e.matches);
    setM(mq.matches); mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn); };
  }, [bp]);
  return m;
}

/* ---------------- Definir senha pelo convite ---------------- */
function DefinirSenha({ token, onEntrar }) {
  const [info, setInfo] = useState(null); const [erro, setErro] = useState(null);
  const [s1, setS1] = useState(""); const [s2, setS2] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { apiAuth({ acao: "validar_convite", token }).then((d) => { if (d.error) setErro(d.error); else setInfo(d); }).catch(() => setErro("Não foi possível validar o convite.")); }, [token]);
  const enviar = async () => {
    if (s1.length < 6) return setErro("A senha deve ter ao menos 6 caracteres.");
    if (s1 !== s2) return setErro("As senhas não conferem.");
    setBusy(true); setErro(null);
    const d = await apiAuth({ acao: "definir_senha", token, senha: s1 });
    setBusy(false);
    if (d.token) { setSessao(d.token, d.usuario); window.history.replaceState({}, "", window.location.pathname); onEntrar(d.usuario); }
    else setErro(d.error || "Falha ao definir a senha.");
  };
  return (
    <div style={{ minHeight: "100vh", background: C.preto, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: C.branco, borderRadius: 16, padding: 36, width: 410, borderTop: `6px solid ${C.laranja}` }}>
        <img src={LOGO_FULL} alt="Miriad" style={{ width: 220, maxWidth: "100%", display: "block", marginBottom: 8 }} />
        {erro && !info ? <div style={{ color: C.vermelho, fontSize: 13 }}>{erro}</div> : !info ? <div style={{ color: C.dim, fontSize: 13 }}>Validando convite…</div> : <>
          <div style={{ fontSize: 14, color: C.preto, fontWeight: 700, marginBottom: 2 }}>Olá, {info.nome.split(" ")[0]}!</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 18 }}>Crie sua senha para acessar o sistema ({info.email}).</div>
          <div style={{ marginBottom: 10 }}><Lbl>Nova senha</Lbl><input type="password" value={s1} onChange={(e) => setS1(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ marginBottom: 14 }}><Lbl>Confirme a senha</Lbl><input type="password" value={s2} onChange={(e) => setS2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          <Btn onClick={enviar} disabled={busy || !s1 || !s2}>{busy ? "…" : "Criar senha e entrar"}</Btn>
        </>}
      </div>
    </div>
  );
}

/* ---------------- Login / bootstrap ---------------- */
// Carrega o script do Google Identity Services uma única vez; resolve quem está pronto p/ usar.
let _gisPromise = null;
function carregarGIS() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => { _gisPromise = null; reject(new Error("Falha ao carregar o Google.")); };
    document.head.appendChild(s);
  });
  return _gisPromise;
}

function Login({ onEntrar }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [nome, setNome] = useState("");
  const [erro, setErro] = useState(null); const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const gbtnRef = useRef(null);

  useEffect(() => { apiAuth({ acao: "precisa_bootstrap" }).then((d) => { if (d.bootstrap) setModo("bootstrap"); }).catch(() => {}); }, []);
  useEffect(() => { apiAuth({ acao: "config" }).then((d) => { if (d.googleClientId) setGoogleClientId(d.googleClientId); }).catch(() => {}); }, []);

  const entrarGoogle = useCallback(async (resp) => {
    const credential = resp?.credential;
    if (!credential) return;
    setGoogleBusy(true); setErro(null);
    try {
      const d = await apiAuth({ acao: "google", credential });
      if (d.token) { setSessao(d.token, d.usuario); onEntrar(d.usuario); }
      else setErro(d.error || "Falha no login com Google.");
    } catch { setErro("Falha no login com Google."); }
    finally { setGoogleBusy(false); }
  }, [onEntrar]);

  // inicializa e desenha o botão do Google quando há Client ID e estamos no modo login
  useEffect(() => {
    if (!googleClientId || modo !== "login") return;
    let vivo = true;
    carregarGIS().then((google) => {
      if (!vivo || !google?.accounts?.id || !gbtnRef.current) return;
      google.accounts.id.initialize({ client_id: googleClientId, callback: entrarGoogle, auto_select: false });
      gbtnRef.current.innerHTML = "";
      google.accounts.id.renderButton(gbtnRef.current, { theme: "outline", size: "large", width: 328, text: "signin_with", shape: "rectangular", locale: "pt-BR" });
    }).catch(() => {});
    return () => { vivo = false; };
  }, [googleClientId, modo, entrarGoogle]);

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
        <div style={{ fontSize: 13, color: C.dim, margin: "8px 0 22px" }}>{modo === "bootstrap" ? "Cadastre o primeiro acesso (CEO)." : "Acesse com o e-mail da empresa ou com sua senha."}</div>

        {googleClientId && modo === "login" && (
          <div style={{ marginBottom: 18 }}>
            <div ref={gbtnRef} style={{ display: "flex", justifyContent: "center", minHeight: 40, opacity: googleBusy ? 0.5 : 1, pointerEvents: googleBusy ? "none" : "auto" }} />
            {googleBusy && <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 6 }}>Entrando com o Google…</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 4px" }}>
              <div style={{ flex: 1, height: 1, background: C.linha }} />
              <span style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: ".06em" }}>ou com senha</span>
              <div style={{ flex: 1, height: 1, background: C.linha }} />
            </div>
          </div>
        )}

        {modo === "bootstrap" && <div style={{ marginBottom: 10 }}><Lbl>Nome completo</Lbl><input value={nome} onChange={(e) => setNome(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>}
        <div style={{ marginBottom: 10 }}><Lbl>E-mail</Lbl><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        <div style={{ marginBottom: 14 }}><Lbl>Senha</Lbl><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
        {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <Btn onClick={enviar} disabled={busy || !email || !senha || (modo === "bootstrap" && !nome)}>{busy ? "…" : modo === "bootstrap" ? "Criar acesso de CEO" : "Entrar"}</Btn>
      </div>
    </div>
  );
}

/* ---------------- Gestão de usuários ---------------- */
/* Gestão de papéis customizados (variações de um papel-base). Coord. de Planejamento e Diretoria. */
function GerenciadorPapeis({ usuario, papeisCustom, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // bases disponíveis = papéis fixos que o usuário pode criar (nunca ceo/diretor)
  const basesFixos = papeisQuePodeCriar(usuario.papel).filter((p) => PAPEIS[p] && p !== "ceo" && p !== "diretor");
  useEffect(() => { if (!base && basesFixos.length) setBase(basesFixos[0]); }, [basesFixos.length]);

  const criarPapel = async () => {
    if (!nome.trim()) { setMsg({ t: "erro", x: "Informe o nome do papel." }); return; }
    if (!base) { setMsg({ t: "erro", x: "Escolha o papel-base." }); return; }
    setBusy(true); setMsg(null);
    try {
      await criar("papeis_customizados", { nome: nome.trim(), papel_base: base });
      setNome(""); setMsg({ t: "ok", x: "Papel criado." }); onMudou && onMudou();
    } catch (e) { setMsg({ t: "erro", x: e.message || String(e) }); }
    setBusy(false);
  };
  const excluirPapel = async (p) => {
    if (!confirm(`Excluir o papel "${p.nome}"? Usuários com este papel precisarão ser reatribuídos.`)) return;
    try { await remover("papeis_customizados", p.id); onMudou && onMudou(); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ border: `1px solid ${C.linha}`, borderRadius: 10, padding: 12, marginBottom: 16, background: "#fafafa" }}>
      <div onClick={() => setAberto((a) => !a)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}>
        <b style={{ fontSize: 13 }}>{aberto ? "▾" : "▸"} Papéis customizados ({papeisCustom.length})</b>
        <span style={{ fontSize: 11, color: C.dim }}>crie variações de um cargo existente</span>
      </div>
      {aberto && <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 160 }}><Lbl>Nome do novo papel</Lbl><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Encarregado de Pintura" style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ minWidth: 190 }}><Lbl>Herda permissões de</Lbl><select value={base} onChange={(e) => setBase(e.target.value)} style={inp({ width: "100%" })}>{basesFixos.map((p) => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></div>
          <Btn onClick={criarPapel} disabled={busy}>{busy ? "Criando…" : "+ Criar papel"}</Btn>
          {msg && <span style={{ fontSize: 12, color: msg.t === "ok" ? C.verde : C.vermelho }}>{msg.x}</span>}
        </div>
        {papeisCustom.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Papel</Th><Th>Herda de</Th><Th /></tr></thead>
          <tbody>{papeisCustom.map((p) => (
            <tr key={p.id}>
              <Td><b>{p.nome}</b></Td>
              <Td style={{ fontSize: 12, color: C.dim }}>{PAPEIS[p.papel_base] || p.papel_base}</Td>
              <Td><button onClick={() => excluirPapel(p)} style={{ background: "none", border: "none", color: C.vermelho, cursor: "pointer", fontSize: 15 }}>×</button></Td>
            </tr>
          ))}</tbody>
        </table>}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>O papel customizado herda as permissões do papel-base. Ele fica disponível no cadastro de usuários. As permissões finas podem ser ajustadas na aba de permissões por cargo.</div>
      </div>}
    </div>
  );
}

function Usuarios({ usuario }) {
  const [lista, setLista] = useState([]); const [obras, setObras] = useState([]); const [designacoes, setDesignacoes] = useState([]);
  const [papeisCustom, setPapeisCustom] = useState([]);
  const criaveis = papeisQuePodeCriar(usuario.papel);
  const vazio = { nome: "", email: "", papel: criaveis[0] || "sup_obras", obras: [] };
  const [u, setU] = useState(vazio);
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const [convite, setConvite] = useState(null); const [expandido, setExpandido] = useState(null);
  const ehAdmin = usuario.papel === "ceo" || usuario.papel === "diretor";
  const ehCeo = usuario.papel === "ceo";
  const podeGerirPapeis = usuario.papel === "ceo" || usuario.papel === "diretor" || usuario.papel === "coord_planejamento";
  const podeVerPendencias = ehAdmin || usuario.papel === "coord_planejamento";
  const [aba, setAba] = useState("usuarios");
  const [edit, setEdit] = useState(null);
  const [testeBusy, setTesteBusy] = useState(false); const [testeMsg, setTesteMsg] = useState(null); const [testeSenha, setTesteSenha] = useState("Teste@123");
  const carregar = () => {
    listar("usuarios").then(setLista).catch(() => {});
    listar("obras").then(setObras).catch(() => {});
    listar("designacoes").then(setDesignacoes).catch(() => {});
    listar("papeis_customizados").then((ps) => { setPapeisCustom(ps || []); registrarPapeisCustom(ps || []); }).catch(() => {});
  };
  useEffect(() => { carregar(); }, []);
  const precisaObra = PRECISA_DESIGNACAO.has(u.papel);
  const toggleObraNova = (id) => setU((x) => ({ ...x, obras: x.obras.includes(id) ? x.obras.filter((o) => o !== id) : [...x.obras, id] }));
  const salvar = async () => {
    setBusy(true); setErro(null); setConvite(null);
    try {
      const r = await criarUsuario({ nome: u.nome, email: u.email, papel: u.papel, obras: precisaObra ? u.obras : [] });
      if (r && r.convite) {
        const link = `${window.location.origin}${window.location.pathname}?convite=${r.convite}`;
        setConvite({ nome: u.nome, link });
      }
      setU(vazio); carregar();
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };
  const obrasDoUsuario = (uid) => designacoes.filter((d) => d.usuario_id === uid);
  const toggleDesignacao = async (uid, obraId, papel) => {
    const existente = designacoes.find((d) => d.usuario_id === uid && d.obra_id === obraId);
    try {
      if (existente) await remover("designacoes", existente.id);
      else await criar("designacoes", { usuario_id: uid, obra_id: obraId, funcao: papel });
      listar("designacoes").then(setDesignacoes);
    } catch (e) { alert(e.message); }
  };
  const nomeObra = (id) => obras.find((o) => o.id === id)?.codigo || "—";
  const resetar = async (x) => {
    if (!confirm(`Resetar a senha de ${x.nome}? Será gerado um novo link de convite e a senha atual deixará de funcionar.`)) return;
    try { const r = await acaoData({ t: "resetar_senha", id: x.id }); if (r.error) return alert(r.error);
      setConvite({ nome: x.nome, link: `${window.location.origin}${window.location.pathname}?convite=${r.convite}` }); carregar();
    } catch (e) { alert(e.message); }
  };
  const excluir = async (x) => {
    if (!confirm(`Excluir definitivamente o usuário ${x.nome}? Esta ação não pode ser desfeita.`)) return;
    try { await remover("usuarios", x.id); carregar(); } catch (e) { alert(e.message); }
  };
  const salvarEdicao = async () => {
    try { await editar("usuarios", edit.id, { nome: edit.nome, email: edit.email, papel: edit.papel, ativo: edit.ativo }); setEdit(null); carregar(); }
    catch (e) { alert(e.message); }
  };
  const criarAmbienteTeste = async () => {
    if (!confirm("Criar um usuário de teste para cada papel da empresa, com a senha informada? Você poderá entrar como cada um para testar.")) return;
    setTesteBusy(true); setTesteMsg(null);
    const papeis = ["diretor", "coord_suprimentos", "coord_planejamento", "coord_obras", "coord_orcamentos", "op_suprimentos", "op_planejamento", "op_orcamento", "financeiro", "sup_obras"];
    const todasObras = obras.map((o) => o.id);
    let criados = 0, pulados = 0;
    for (const pp of papeis) {
      const email = `teste.${pp}@miriad.test`;
      try {
        await criarUsuario({ nome: `TESTE — ${nomePapel(pp)}`, email, papel: pp, senha: testeSenha, obras: PRECISA_DESIGNACAO.has(pp) ? todasObras : [] });
        criados++;
      } catch (e) { pulados++; }
    }
    setTesteBusy(false); setTesteMsg(`${criados} usuário(s) de teste criado(s)${pulados ? `, ${pulados} já existia(m)` : ""}. Entre com o e-mail teste.<papel>@miriad.test e a senha definida.`); carregar();
  };
  const corPapel = (p) => p === "ceo" ? C.preto : ehDirecao(p) ? "#7c2d12" : p.startsWith("coord") ? C.laranja : p === "financeiro" ? C.azul : C.cinza2;

  return (
    <Card title="Usuários e permissões">
      {podeVerPendencias && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: `1px solid ${C.linha}`, paddingBottom: 12 }}>
          <button onClick={() => setAba("usuarios")} style={abaBtn(aba === "usuarios")}>Usuários</button>
          <button onClick={() => setAba("pendencias")} style={abaBtn(aba === "pendencias")}>Pendências e travamentos</button>
        </div>
      )}
      {aba === "pendencias" && <PendenciasUsuarios usuario={usuario} />}
      {aba === "usuarios" && (<>
      {podeGerirPapeis && <GerenciadorPapeis usuario={usuario} papeisCustom={papeisCustom} onMudou={carregar} />}
      {criaveis.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Seu papel não permite cadastrar usuários.</div> : <>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 150 }}><Lbl>Nome</Lbl><input value={u.nome} onChange={(e) => setU({ ...u, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ flex: 1, minWidth: 150 }}><Lbl>E-mail</Lbl><input value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ minWidth: 190 }}><Lbl>Papel</Lbl><select value={u.papel} onChange={(e) => setU({ ...u, papel: e.target.value, obras: [] })} style={inp({ width: "100%" })}>{criaveis.map((p) => <option key={p} value={p}>{nomePapel(p)}</option>)}</select></div>
          <Btn small disabled={busy || !u.nome || !u.email || (precisaObra && u.obras.length === 0)} onClick={salvar}>+ Criar e gerar convite</Btn>
        </div>
        {precisaObra && (
          <div style={{ marginBottom: 10 }}>
            <Lbl>Obras designadas (o usuário só enxerga estas)</Lbl>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {obras.map((o) => <button key={o.id} onClick={() => toggleObraNova(o.id)} style={{ border: `1.5px solid ${u.obras.includes(o.id) ? C.laranja : C.linha}`, background: u.obras.includes(o.id) ? C.laranjaClaro : "#fff", color: C.preto, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{o.codigo}</button>)}
              {obras.length === 0 && <span style={{ fontSize: 12, color: C.dim }}>Nenhuma obra cadastrada ainda.</span>}
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>Ao criar, o sistema gera um <b>link de convite</b> para o usuário definir a própria senha. Copie e envie a ele.</div>
        {convite && (
          <div style={{ background: `${C.verde}10`, border: `1px solid ${C.verde}55`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.verde, marginBottom: 6 }}>✓ Convite gerado para {convite.nome}. Envie este link (válido por 7 dias):</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={convite.link} onFocus={(e) => e.target.select()} style={inp({ width: "100%", boxSizing: "border-box", fontSize: 11 })} />
              <Btn small kind="ghost" onClick={() => { navigator.clipboard?.writeText(convite.link); }}>Copiar</Btn>
            </div>
          </div>
        )}
        {erro && <div style={{ color: C.vermelho, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
      </>}

      {ehCeo && (
        <div style={{ border: `1px dashed ${C.laranja}`, borderRadius: 10, padding: 14, marginBottom: 14, background: C.laranjaClaro }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>🧪 Ambiente de teste</div>
          <div style={{ fontSize: 12.5, color: C.texto, marginBottom: 10 }}>Cria um usuário de teste para cada papel da empresa (e-mail <code>teste.&lt;papel&gt;@miriad.test</code>), com a senha abaixo. Saia e entre com cada um para testar as telas fora do seu acesso de CEO. Depois é só excluí-los pela lista.</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div><Lbl>Senha de teste (para todos)</Lbl><input value={testeSenha} onChange={(e) => setTesteSenha(e.target.value)} style={inp({ width: 180 })} /></div>
            <Btn small disabled={testeBusy || testeSenha.length < 6} onClick={criarAmbienteTeste}>{testeBusy ? "Criando…" : "Criar ambiente de teste"}</Btn>
          </div>
          {testeMsg && <div style={{ fontSize: 12.5, color: C.verde, fontWeight: 700, marginTop: 8 }}>{testeMsg}</div>}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: C.preto }}>{["Nome", "E-mail", "Papel", "Status", "Obras", ...(ehAdmin ? ["Ações"] : [])].map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#fff", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{lista.map((x) => {
          const scoped = PRECISA_DESIGNACAO.has(x.papel);
          const dos = obrasDoUsuario(x.id);
          const podeMexer = ehAdmin && x.id !== usuario.id && !(x.papel === "ceo" && !ehCeo) && !(x.papel === "diretor" && !ehCeo);
          const editavel = edit && edit.id === x.id;
          return <React.Fragment key={x.id}>
            <tr>
              <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}`, fontWeight: 600 }}>{x.nome}</td>
              <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}>{x.email}</td>
              <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}><span style={{ background: corPapel(x.papel), color: "#fff", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{nomePapel(x.papel)}</span></td>
              <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, color: x.travado ? C.vermelho : x.senha_definida ? C.verde : C.amareloAlerta, fontWeight: 700 }}>{x.travado ? "bloqueado" : x.senha_definida ? "ativo" : "convite pendente"}</td>
              <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}` }}>
                {scoped ? <button onClick={() => setExpandido(expandido === x.id ? null : x.id)} style={{ background: "none", border: `1px solid ${C.linha}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: C.dim }}>{dos.length ? dos.map((d) => nomeObra(d.obra_id)).join(", ") : "designar"} ▾</button> : "—"}
              </td>
              {ehAdmin && <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.linha}`, whiteSpace: "nowrap" }}>
                {podeMexer ? <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEdit({ id: x.id, nome: x.nome, email: x.email, papel: x.papel, ativo: x.ativo !== false })} style={btnMini(C.azul)}>editar</button>
                  <button onClick={() => resetar(x)} style={btnMini(C.amareloAlerta)}>resetar</button>
                  <button onClick={() => excluir(x)} style={btnMini(C.vermelho)}>excluir</button>
                </span> : <span style={{ color: C.dim }}>—</span>}
              </td>}
            </tr>
            {editavel && (
              <tr><td colSpan={6} style={{ padding: "10px", borderBottom: `1px solid ${C.linha}`, background: "#f5f8ff" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ minWidth: 150 }}><Lbl>Nome</Lbl><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <div style={{ minWidth: 170 }}><Lbl>E-mail</Lbl><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
                  <div style={{ minWidth: 180 }}><Lbl>Papel</Lbl><select value={edit.papel} onChange={(e) => setEdit({ ...edit, papel: e.target.value })} style={inp({ width: "100%" })}>{criaveis.map((pp) => <option key={pp} value={pp}>{nomePapel(pp)}</option>)}{!criaveis.includes(edit.papel) && <option value={edit.papel}>{nomePapel(edit.papel)}</option>}</select></div>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, paddingBottom: 6 }}><input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />Ativo</label>
                  <Btn small onClick={salvarEdicao}>Salvar</Btn>
                  <Btn small kind="ghost" onClick={() => setEdit(null)}>Cancelar</Btn>
                </div>
              </td></tr>
            )}
            {expandido === x.id && scoped && criaveis.length > 0 && (
              <tr><td colSpan={ehAdmin ? 6 : 5} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}`, background: "#fafafa" }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Obras designadas a {x.nome.split(" ")[0]}:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {obras.map((o) => { const on = dos.some((d) => d.obra_id === o.id); return <button key={o.id} onClick={() => toggleDesignacao(x.id, o.id, x.papel)} style={{ border: `1.5px solid ${on ? C.laranja : C.linha}`, background: on ? C.laranjaClaro : "#fff", color: C.preto, borderRadius: 7, padding: "4px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{on ? "✓ " : ""}{o.codigo}</button>; })}
                </div>
              </td></tr>
            )}
          </React.Fragment>;
        })}</tbody></table>
      </>)}
    </Card>
  );
}

/* ---------------- Pendências e travamentos por usuário (Diretoria / Coord. Planejamento) ---------------- */
function abaBtn(on) {
  return { border: `1.5px solid ${on ? C.laranja : C.linha}`, background: on ? C.laranjaClaro : "#fff", color: on ? C.preto : C.dim, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
function PendenciasUsuarios({ usuario }) {
  const [linhas, setLinhas] = useState(null);
  const [busy, setBusy] = useState(null);
  const carregar = () => pendenciasUsuarios().then(setLinhas).catch(() => setLinhas([]));
  useEffect(() => { carregar(); }, []);
  const destravar = async (u) => {
    if (!confirm(`Destravar o acesso de ${u.nome}? O usuário voltará a poder enviar normalmente.`)) return;
    setBusy(u.id);
    try { await destravarUsuario(u.id); await carregar(); } catch (e) { alert(e.message); } finally { setBusy(null); }
  };
  if (linhas === null) return <div style={{ color: C.dim, padding: 16 }}>Carregando pendências…</div>;
  const corStatus = (st) => st === "atrasado" ? C.vermelho : st === "proximo" ? C.amareloAlerta : C.verde;
  const rotStatus = (st) => st === "atrasado" ? "atrasado" : st === "proximo" ? "vence em breve" : "em dia";
  const dataBR = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  const dtHora = (iso) => iso ? new Date(iso).toLocaleString("pt-BR") : "—";
  const temAlgo = (l) => l.travado || l.pendencias.length || l.travamentos.some((t) => !t.destravado_em);
  const comAlgo = linhas.filter(temAlgo);
  const emDia = linhas.filter((l) => !temAlgo(l));
  const areaLabel = { rdo: "RDO", smi: "SM-i", pos: "POS", pmm: "PMM", ssi: "SS-i" };
  const tipoLabel = { sm: "SM-i", pos: "POS", pmm: "PMM", rdo: "RDO", ssi: "SS-i" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12.5, color: C.dim }}>Pendências e prazos dos supervisores de obra, com o histórico de travamentos de acesso e a tarefa que motivou cada um. Como Diretoria/Coord. de Planejamento, você pode destravar o acesso diretamente aqui.</div>
      {comAlgo.length === 0 && <div style={{ fontSize: 13, color: C.verde, fontWeight: 600 }}>✓ Nenhum supervisor com pendências, travamentos ou bloqueios no momento.</div>}
      {comAlgo.map((l) => (
        <div key={l.id} style={{ border: `1px solid ${l.travado ? C.vermelho : C.linha}`, borderRadius: 12, padding: 14, background: l.travado ? `${C.vermelho}08` : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{l.nome}</span>
              <span style={{ fontSize: 12, color: C.dim }}> · {l.obras.join(", ") || "sem obra designada"}</span>
              {l.travado && <span style={{ marginLeft: 8, background: C.vermelho, color: "#fff", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>🔒 bloqueado{l.travado_em ? ` em ${dataBR(l.travado_em)}` : ""}</span>}
            </div>
            {l.travado && <Btn small disabled={busy === l.id} onClick={() => destravar(l)}>{busy === l.id ? "Destravando…" : "Destravar acesso"}</Btn>}
          </div>
          {l.pendencias.length > 0 ? (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {l.pendencias.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.cinza, borderRadius: 8, padding: "7px 10px", flexWrap: "wrap" }}>
                  <span style={{ background: corStatus(p.status), color: "#fff", borderRadius: 5, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, minWidth: 96, textAlign: "center" }}>{rotStatus(p.status)}</span>
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{areaLabel[p.area] || p.area}</span>
                  <span style={{ fontSize: 12, color: C.texto }}>{p.titulo} — {p.detalhe}</span>
                  {p.prazo && <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.dim }}>prazo {dataBR(p.prazo)}</span>}
                </div>
              ))}
            </div>
          ) : <div style={{ marginTop: 8, fontSize: 12, color: C.verde }}>✓ Sem pendências de envio.</div>}
          {l.travamentos.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.dim }}>Histórico de travamentos ({l.travamentos.length})</summary>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                {l.travamentos.map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: C.texto, borderLeft: `3px solid ${t.destravado_em ? C.verde : C.vermelho}`, paddingLeft: 10 }}>
                    <b>{tipoLabel[t.tipo] || t.tipo}</b> · {dtHora(t.criado_em)} — {t.motivo}
                    {t.destravado_em
                      ? <span style={{ color: C.verde }}> · destravado em {dtHora(t.destravado_em)}{t.destravado_por_nome ? ` por ${t.destravado_por_nome}` : ""}</span>
                      : <span style={{ color: C.vermelho, fontWeight: 700 }}> · em aberto</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
      {emDia.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, color: C.dim }}>Supervisores em dia ({emDia.length})</summary>
          <div style={{ marginTop: 6, fontSize: 12.5, color: C.texto }}>{emDia.map((l) => l.nome).join(" · ")}</div>
        </details>
      )}
    </div>
  );
}

/* ---------------- Painel Geral wrapper ---------------- */
function PainelGeralWrap({ usuario }) {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const obras = await listar("obras"); const eap = {}, rdos = [], restr = [];
    await Promise.all(obras.map(async (o) => { eap[o.id] = await listar("eap_itens", { obra_id: o.id }); (await listar("rdos", { obra_id: o.id })).forEach((r) => rdos.push(r)); (await listar("restricoes_material", { obra_id: o.id })).forEach((x) => restr.push(x)); }));
    const [ocs, contratos] = await Promise.all([listar("ordens_compra").catch(() => []), listar("contratos_servico").catch(() => [])]);
    setD({ obras, eapPorObra: eap, rdos, restricoes: restr, ocs, contratos });
  })(); }, []);
  if (!d) return <div style={{ color: C.dim, padding: 20 }}>Consolidando obras…</div>;
  return <PainelGeral {...d} usuario={usuario} />;
}

/* ---------------- Itens do menu Operacional (com notas) ---------------- */
const OP_ITENS = [
  { id: "rdo", label: "RDO-i", nota: "Relatório diário de obra" },
  { id: "pos", label: "POS", nota: "Plano operacional semanal" },
  { id: "pmm", label: "PMM", nota: "Plano de medição mensal" },
  { id: "smi", label: "SM-i", nota: "Solicitação de material" },
  { id: "ssi", label: "SS-i", nota: "Solicitação de serviço e locação" },
  { id: "oc", label: "OC-i", nota: "Ordem de compra de materiais" },
  { id: "os", label: "OS-i", nota: "Ordem de serviço (mão de obra)" },
  { id: "prestadores", label: "Prestadores", nota: "Mão de obra direta e indireta" },
  { id: "novoprojeto", label: "Novo Projeto", nota: "Upload da EAP e abertura de projeto" },
  { id: "metascusto", label: "Metas de Custo", nota: "Verba por EAP × consumido" },
  { id: "orcamentos", label: "Memorial Executivo", nota: "Composições e consulta de memoriais" },
  { id: "orccomercial", label: "Orçamento Comercial", nota: "Propostas e conversão em projeto" },
  { id: "eap", label: "EAP & Custos", nota: "Orçamento e curva de custos" },
  { id: "obras", label: "Obras", nota: "Cadastro e EAP das obras" },
];
const FIN_ITENS = [
  { id: "premissas", label: "Premissas", nota: "Contratos, impostos e medições" },
  { id: "antecipacao", label: "Antecipação", nota: "Cenários de factoring" },
  { id: "comparativo", label: "Antes × Depois", nota: "Impacto da antecipação" },
  { id: "sensibilidade", label: "Sensibilidade", nota: "Variação de taxa e prazo" },
  { id: "resultado", label: "Resultado", nota: "DRE e fluxo consolidado" },
  { id: "custos", label: "Custos por obra", nota: "Serviço × material por mês" },
  { id: "custosdir", label: "Custos diretos (auto)", nota: "Despesas diretas por obra" },
  { id: "medprojetada", label: "Medição projetada", nota: "Previsto dos PMM por obra/mês" },
  { id: "op", label: "Ordens de Pagamento", nota: "Kanban: pendente NF → liberada → paga" },
  { id: "custosfixos", label: "Custos Fixos", nota: "Cadastro que vira OP todo mês" },
];
/* abas do Financeiro visíveis por papel (Coord. de Planejamento vê só a Medição projetada) */
const finItensDe = (papel) => {
  if (papel === "ceo" || papel === "diretor" || papel === "financeiro") return FIN_ITENS;
  if (papel === "coord_planejamento") return FIN_ITENS.filter((i) => i.id === "medprojetada");
  return [];
};

const CAP_LABELS = [
  ["smi_criar", "Criar SM-i"], ["smi_gestao", "Ver / gerir SM-i"],
  ["ssi_criar", "Criar SS-i"], ["ssi_gestao", "Ver / gerir SS-i"], ["ssi_kanban", "Ver kanban SS-i"],
  ["pos_criar", "Criar POS"], ["pos_gestao", "Gerir POS"],
  ["pmm_criar", "Criar PMM"], ["pmm_gestao", "Gerir PMM"],
];

function Permissoes({ acessoMap, onSaved }) {
  const [mapa, setMapa] = useState(() => JSON.parse(JSON.stringify(acessoMap || mapaAcessoPadrao())));
  const [papel, setPapel] = useState("coord_planejamento");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const [travados, setTravados] = useState([]);
  const carregarTravados = () => listar("usuarios").then((us) => setTravados(us.filter((u) => u.travado))).catch(() => {});
  useEffect(() => { carregarTravados(); }, []);
  const destravar = async (u) => { try { await editar("usuarios", u.id, { travado: false, travado_em: null }); carregarTravados(); } catch (e) { alert(e.message); } };
  const a = mapa[papel] || mapaAcessoPadrao()[papel];

  const setTop = (k, v) => setMapa((m) => ({ ...m, [papel]: { ...m[papel], [k]: v } }));
  const setGrupo = (g, k, v) => setMapa((m) => ({ ...m, [papel]: { ...m[papel], [g]: { ...m[papel][g], [k]: v } } }));
  const restaurar = () => setMapa((m) => ({ ...m, [papel]: JSON.parse(JSON.stringify(mapaAcessoPadrao()[papel])) }));
  const salvar = async () => { setBusy(true); setMsg(null); try { await setConfig("acesso", mapa); onSaved && onSaved(mapa); setMsg("Permissões salvas."); setTimeout(() => setMsg(null), 2500); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };

  const Check = ({ on, onClick, label }) => (
    <label onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "5px 8px", borderRadius: 7, background: on ? C.laranjaClaro : "#fafafa", border: `1px solid ${on ? C.laranja : C.linha}` }}>
      <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? C.laranja : C.dim}`, background: on ? C.laranja : "#fff", color: "#fff", fontSize: 11, lineHeight: "12px", textAlign: "center", flexShrink: 0 }}>{on ? "✓" : ""}</span>
      {label}
    </label>
  );
  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8, marginBottom: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Card title="Permissões por cargo" right={<span style={{ fontSize: 12, color: msg ? C.verde : C.dim, fontWeight: 700 }}>{msg}</span>}>
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 12 }}>Defina o que cada cargo enxerga e pode fazer. Itens sensíveis (dados financeiros, gestão de usuários) continuam protegidos no servidor independentemente desta tela.</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ minWidth: 240 }}><Lbl>Cargo</Lbl><select value={papel} onChange={(e) => setPapel(e.target.value)} style={inp({ width: "100%" })}>{Object.keys(PAPEIS).map((p) => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></div>
        <Btn small kind="ghost" onClick={restaurar}>Restaurar padrão deste cargo</Btn>
        <Btn small disabled={busy} onClick={salvar}>{busy ? "Salvando…" : "Salvar permissões"}</Btn>
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 6px" }}>Módulos gerais</div>
      <div style={grade}>
        <Check on={a.painel} onClick={() => setTop("painel", !a.painel)} label="Painel Geral" />
        <Check on={a.usuarios} onClick={() => setTop("usuarios", !a.usuarios)} label="Usuários" />
        <Check on={a.ranking} onClick={() => setTop("ranking", !a.ranking)} label="Ranking" />
        <Check on={a.gerencial} onClick={() => setTop("gerencial", !a.gerencial)} label="Painel Gerencial" />
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 6px" }}>Operacional (telas)</div>
      <div style={grade}>{OP_ITENS.map((i) => <Check key={i.id} on={!!a.op[i.id]} onClick={() => setGrupo("op", i.id, !a.op[i.id])} label={i.label} />)}</div>

      <div style={{ fontSize: 11, fontWeight: 800, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 6px" }}>Financeiro (abas)</div>
      <div style={grade}>{FIN_ITENS.map((i) => <Check key={i.id} on={!!a.fin[i.id]} onClick={() => setGrupo("fin", i.id, !a.fin[i.id])} label={i.label} />)}</div>

      <div style={{ fontSize: 11, fontWeight: 800, color: C.preto, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 6px" }}>Capacidades dos entregáveis</div>
      <div style={grade}>{CAP_LABELS.map(([k, label]) => <Check key={k} on={!!a.cap[k]} onClick={() => setGrupo("cap", k, !a.cap[k])} label={label} />)}</div>
    </Card>

    <Card title="Usuários bloqueados por perda de prazo">
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Usuários travados por não enviar RDO/SM-i/POS/PMM no prazo. Como CEO/Diretor, você pode destravar diretamente aqui (além dos coordenadores nas telas de cada documento).</div>
      {travados.length === 0 ? <div style={{ fontSize: 13, color: C.verde, fontWeight: 600 }}>✓ Nenhum usuário bloqueado no momento.</div> : travados.map((u) => (
        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: `1px solid ${C.vermelho}44`, borderRadius: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 13 }}><b>{u.nome}</b> <span style={{ color: C.dim }}>· {nomePapel(u.papel)}{u.travado_em ? ` · bloqueado em ${new Date(u.travado_em).toLocaleDateString("pt-BR")}` : ""}</span></div>
          <Btn small onClick={() => destravar(u)}>Destravar</Btn>
        </div>
      ))}
    </Card>
    </div>
  );
}

/* ---------------- Shell ---------------- */
function Shell({ usuario, onSair, acessoMap, setAcessoMap, irPara }) {
  const p = usuario.papel;
  const A = acessoDe(acessoMap, p);
  const finItens = FIN_ITENS.filter((i) => A.fin && A.fin[i.id]);
  const opItens = OP_ITENS.filter((i) => A.op && A.op[i.id]);
  const temFin = finItens.length > 0;
  const temOp = opItens.length > 0;
  const irOpValido = irPara && opItens.some((i) => i.id === irPara);
  const secaoInicial = irOpValido ? "operacional" : A.painel ? "painel" : temOp ? "operacional" : "financeiro";
  const [secao, setSecao] = useState(secaoInicial);
  const [opTab, setOpTab] = useState(irOpValido ? irPara : opItens[0]?.id || "rdo");
  const [finTab, setFinTab] = useState(finItens[0]?.id || "premissas");
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  const [rankingAberto, setRankingAberto] = useState(false);
  const [gerencialAberto, setGerencialAberto] = useState(false);
  const [permsAberto, setPermsAberto] = useState(false);
  const [meusAberto, setMeusAberto] = useState(false);
  const [alocAberto, setAlocAberto] = useState(false);
  const [bmpAberto, setBmpAberto] = useState(false);
  const ehDir = p === "ceo" || p === "diretor";
  const ehSupObras = p === "sup_obras";
  const podeAlocar = ehDir || p === "coord_planejamento";
  const podeBmp = ehSupObras || p === "coord_planejamento" || ehDir;
  const mobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);

  const fecharEspeciais = () => { setUsuariosAberto(false); setRankingAberto(false); setGerencialAberto(false); setPermsAberto(false); setMeusAberto(false); setAlocAberto(false); setBmpAberto(false); };
  const abrir = (sec, tab) => { setSecao(sec); if (tab) { if (sec === "operacional") setOpTab(tab); if (sec === "financeiro") setFinTab(tab); } fecharEspeciais(); setDrawer(false); };
  const tabDe = (sec) => sec === "operacional" ? opTab : sec === "financeiro" ? finTab : null;
  const ativo = (sec, tab) => !usuariosAberto && !rankingAberto && !gerencialAberto && !permsAberto && !meusAberto && !alocAberto && !bmpAberto && secao === sec && (!tab || tabDe(sec) === tab);

  const botao = (sec, tab, label, icone, nota) => (
    <button key={(tab || sec)} onClick={() => abrir(sec, tab)}
      style={{ display: "block", width: "100%", textAlign: "left", background: ativo(sec, tab) ? C.laranja : "transparent", color: ativo(sec, tab) ? "#fff" : "#d4d4d4", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", marginBottom: 2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700 }}><span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{icone}</span>{label}</span>
      {nota && <span style={{ display: "block", fontSize: 10.5, color: ativo(sec, tab) ? "#ffe2cf" : "#7d7d7d", marginLeft: 28, marginTop: 1 }}>{nota}</span>}
    </button>
  );

  const tituloOp = OP_ITENS.find((i) => i.id === opTab);
  const tituloFin = FIN_ITENS.find((i) => i.id === finTab);
  const titulo = bmpAberto ? "Medições de prestadores (BMP)" : meusAberto ? "Meus Projetos" : alocAberto ? "Alocação de Supervisores" : permsAberto ? "Permissões por cargo" : gerencialAberto ? "Painel Gerencial" : rankingAberto ? "Ranking de Supervisores" : usuariosAberto ? "Usuários e permissões" : secao === "painel" ? "Painel Geral" : secao === "financeiro" ? `Financeiro · ${tituloFin?.label || ""}` : `Operacional · ${tituloOp?.label || ""}`;

  const navInterno = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, padding: "0 4px" }}><LogoMiriad size={28} />
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 900, lineHeight: 1.05 }}>Miriad<br /><span style={{ color: C.laranja, fontSize: 11, fontWeight: 700 }}>Construction Control</span></div></div>
      <div style={{ height: 1, background: "#333", margin: "14px 0" }} />

      {A.painel && botao("painel", null, "Painel Geral", "▣", "Visão consolidada das obras")}

      {temFin && <>
        <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Financeiro</div>
        {finItens.map((i) => botao("financeiro", i.id, i.label, "$", i.nota))}
      </>}

      {temOp && <>
        <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Operacional</div>
        {opItens.map((i) => botao("operacional", i.id, i.label, "▤", i.embreve ? `${i.nota} · em breve (${i.embreve})` : i.nota))}
      </>}

      <div style={{ flex: 1, minHeight: 12 }} />
      {podeBmp && <button onClick={() => { fecharEspeciais(); setBmpAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: bmpAberto ? C.laranja : "transparent", color: bmpAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>📐</span>Medições (BMP)</button>}
      {ehSupObras && <button onClick={() => { fecharEspeciais(); setMeusAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: meusAberto ? C.laranja : "transparent", color: meusAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>🗂️</span>Meus Projetos</button>}
      {podeAlocar && <button onClick={() => { fecharEspeciais(); setAlocAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: alocAberto ? C.laranja : "transparent", color: alocAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>👷</span>Alocação de Supervisor</button>}
      {A.gerencial && ehDir && <button onClick={() => { fecharEspeciais(); setGerencialAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: gerencialAberto ? C.laranja : "transparent", color: gerencialAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>📊</span>Painel Gerencial</button>}
      {A.ranking && ehDir && <button onClick={() => { fecharEspeciais(); setRankingAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: rankingAberto ? C.laranja : "transparent", color: rankingAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>🏆</span>Ranking</button>}
      {A.usuarios && pode(p, "usuarios") && <button onClick={() => { fecharEspeciais(); setUsuariosAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: usuariosAberto ? C.laranja : "transparent", color: usuariosAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>⚙</span>Usuários</button>}
      {ehDir && <button onClick={() => { fecharEspeciais(); setPermsAberto(true); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: permsAberto ? C.laranja : "transparent", color: permsAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>🔑</span>Permissões</button>}
      <div style={{ borderTop: "1px solid #333", marginTop: 10, paddingTop: 12 }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{usuario.nome}</div>
        <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>{nomePapel(p)}</div>
        <button onClick={onSair} style={{ background: "transparent", border: "1px solid #444", color: "#aaa", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", width: "100%" }}>Sair</button>
      </div>
    </>
  );

  const conteudo = (
    <div key={`${secao}-${opTab}-${finTab}-${usuariosAberto}-${rankingAberto}-${gerencialAberto}-${permsAberto}-${meusAberto}-${alocAberto}-${bmpAberto}`} className="mcc-fade">
      {bmpAberto && podeBmp ? <BMPMedicoes usuario={usuario} />
        : meusAberto && ehSupObras ? <MeusProjetos usuario={usuario} />
        : alocAberto && podeAlocar ? <AlocacaoSupervisor usuario={usuario} />
        : permsAberto && ehDir ? <Permissoes acessoMap={acessoMap} onSaved={setAcessoMap} />
        : gerencialAberto && ehDir ? <PainelGerencial />
        : rankingAberto && ehDir ? <Ranking />
        : usuariosAberto && pode(p, "usuarios") ? <Usuarios usuario={usuario} />
        : secao === "painel" && A.painel ? <PainelGeralWrap usuario={usuario} />
        : secao === "financeiro" && temFin ? <ModuloFinanceiro sub={finTab} setSub={setFinTab} />
        : temOp ? <ModuloOperacional usuario={usuario} sub={opTab} setSub={setOpTab} acesso={A.cap} />
        : <div style={{ color: C.dim }}>Sem acesso a este módulo.</div>}
    </div>
  );

  if (mobile) {
    return (
      <div style={{ minHeight: "100vh", background: C.cinza }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: C.preto, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", boxShadow: "0 2px 10px rgba(0,0,0,.25)" }}>
          <button aria-label="Menu" onClick={() => setDrawer(true)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>☰</button>
          <LogoMiriad size={24} />
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
        </header>
        {drawer && <>
          <div className="mcc-backdrop" onClick={() => setDrawer(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
          <aside className="mcc-drawer" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 264, maxWidth: "84vw", background: C.preto, padding: "16px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", zIndex: 50, overflowY: "auto", boxShadow: "4px 0 24px rgba(0,0,0,.4)" }}>{navInterno}</aside>
        </>}
        <main className="mcc-main" style={{ padding: "16px 14px" }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: C.preto, margin: "2px 0 14px" }}>{titulo}</h1>
          {conteudo}
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: C.cinza }}>
      <aside style={{ width: 248, background: C.preto, padding: "18px 14px", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>{navInterno}</aside>
      <main className="mcc-main" style={{ flex: 1, padding: 24, maxWidth: 1320, minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.preto, margin: "0 0 18px" }}>{titulo}</h1>
        {conteudo}
      </main>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const conviteToken = params.get("convite");
  const irPara = params.get("ir");
  const [usuario, setUsuario] = useState(() => (getToken() ? getUser() : null));
  const [acessoMap, setAcessoMap] = useState(null);
  const sair = useCallback(() => { limparSessao(); setUsuario(null); }, []);
  useEffect(() => { if (getToken() && !conviteToken) listar("obras").catch((e) => { if (e instanceof AuthError) sair(); }); }, [sair, conviteToken]);
  useEffect(() => {
    if (!usuario) { setAcessoMap(null); return; }
    getConfig("acesso").then((ov) => setAcessoMap(mesclarAcesso(mapaAcessoPadrao(), ov || {}))).catch(() => setAcessoMap(mapaAcessoPadrao()));
    listar("papeis_customizados").then(registrarPapeisCustom).catch(() => {});
  }, [usuario]);
  if (conviteToken && !usuario) return <DefinirSenha token={conviteToken} onEntrar={setUsuario} />;
  if (!usuario) return <Login onEntrar={setUsuario} />;
  return <Shell usuario={usuario} onSair={sair} acessoMap={acessoMap} setAcessoMap={setAcessoMap} irPara={irPara} />;
}
