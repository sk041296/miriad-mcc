import React, { useState, useEffect, useCallback } from "react";
import {
  C, Btn, Card, inp, Lbl, listar, criar, criarUsuario, editar, remover, acaoData, apiAuth, getToken, getUser, setSessao, limparSessao, AuthError,
  PAPEIS, PERMS, pode, ehDirecao, papeisQuePodeCriar, PRECISA_DESIGNACAO, SETOR_DE_PAPEL,
} from "./core.jsx";
import { ModuloFinanceiro } from "./financeiro.jsx";
import { ModuloOperacional } from "./operacional.jsx";
import { PainelGeral } from "./painel.jsx";
import { Ranking } from "./ranking.jsx";
import { PainelGerencial } from "./painelger.jsx";
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
function Login({ onEntrar }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [nome, setNome] = useState("");
  const [erro, setErro] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { apiAuth({ acao: "precisa_bootstrap" }).then((d) => { if (d.bootstrap) setModo("bootstrap"); }).catch(() => {}); }, []);
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
        <div style={{ fontSize: 13, color: C.dim, margin: "8px 0 22px" }}>{modo === "bootstrap" ? "Cadastre o primeiro acesso (CEO)." : "Acesse com seu e-mail e senha."}</div>
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
function Usuarios({ usuario }) {
  const [lista, setLista] = useState([]); const [obras, setObras] = useState([]); const [designacoes, setDesignacoes] = useState([]);
  const criaveis = papeisQuePodeCriar(usuario.papel);
  const vazio = { nome: "", email: "", papel: criaveis[0] || "sup_obras", obras: [] };
  const [u, setU] = useState(vazio);
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const [convite, setConvite] = useState(null); const [expandido, setExpandido] = useState(null);
  const ehAdmin = usuario.papel === "ceo" || usuario.papel === "diretor";
  const ehCeo = usuario.papel === "ceo";
  const [edit, setEdit] = useState(null);
  const [testeBusy, setTesteBusy] = useState(false); const [testeMsg, setTesteMsg] = useState(null); const [testeSenha, setTesteSenha] = useState("Teste@123");
  const carregar = () => {
    listar("usuarios").then(setLista).catch(() => {});
    listar("obras").then(setObras).catch(() => {});
    listar("designacoes").then(setDesignacoes).catch(() => {});
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
        await criarUsuario({ nome: `TESTE — ${PAPEIS[pp]}`, email, papel: pp, senha: testeSenha, obras: PRECISA_DESIGNACAO.has(pp) ? todasObras : [] });
        criados++;
      } catch (e) { pulados++; }
    }
    setTesteBusy(false); setTesteMsg(`${criados} usuário(s) de teste criado(s)${pulados ? `, ${pulados} já existia(m)` : ""}. Entre com o e-mail teste.<papel>@miriad.test e a senha definida.`); carregar();
  };
  const corPapel = (p) => p === "ceo" ? C.preto : ehDirecao(p) ? "#7c2d12" : p.startsWith("coord") ? C.laranja : p === "financeiro" ? C.azul : C.cinza2;

  return (
    <Card title="Usuários e permissões">
      {criaveis.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Seu papel não permite cadastrar usuários.</div> : <>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 150 }}><Lbl>Nome</Lbl><input value={u.nome} onChange={(e) => setU({ ...u, nome: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ flex: 1, minWidth: 150 }}><Lbl>E-mail</Lbl><input value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} style={inp({ width: "100%", boxSizing: "border-box" })} /></div>
          <div style={{ minWidth: 190 }}><Lbl>Papel</Lbl><select value={u.papel} onChange={(e) => setU({ ...u, papel: e.target.value, obras: [] })} style={inp({ width: "100%" })}>{criaveis.map((p) => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></div>
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
              <td style={{ padding: "7px 10px", fontSize: 13, borderBottom: `1px solid ${C.linha}` }}><span style={{ background: corPapel(x.papel), color: "#fff", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{PAPEIS[x.papel] || x.papel}</span></td>
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
                  <div style={{ minWidth: 180 }}><Lbl>Papel</Lbl><select value={edit.papel} onChange={(e) => setEdit({ ...edit, papel: e.target.value })} style={inp({ width: "100%" })}>{criaveis.map((pp) => <option key={pp} value={pp}>{PAPEIS[pp]}</option>)}{!criaveis.includes(edit.papel) && <option value={edit.papel}>{PAPEIS[edit.papel]}</option>}</select></div>
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
    </Card>
  );
}

/* ---------------- Painel Geral wrapper ---------------- */
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
];
/* abas do Financeiro visíveis por papel (Coord. de Planejamento vê só a Medição projetada) */
const finItensDe = (papel) => {
  if (papel === "ceo" || papel === "diretor" || papel === "financeiro") return FIN_ITENS;
  if (papel === "coord_planejamento") return FIN_ITENS.filter((i) => i.id === "medprojetada");
  return [];
};

/* ---------------- Shell ---------------- */
function Shell({ usuario, onSair }) {
  const p = usuario.papel;
  const finItens = finItensDe(p);
  const temFin = finItens.length > 0;
  const secaoInicial = pode(p, "painel") ? "painel" : pode(p, "operacional") ? "operacional" : "financeiro";
  const [secao, setSecao] = useState(secaoInicial);
  const [opTab, setOpTab] = useState("rdo");
  const [finTab, setFinTab] = useState(finItens[0]?.id || "premissas");
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  const [rankingAberto, setRankingAberto] = useState(false);
  const [gerencialAberto, setGerencialAberto] = useState(false);
  const ehDir = p === "ceo" || p === "diretor";
  const mobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);

  const abrir = (sec, tab) => { setSecao(sec); if (tab) { if (sec === "operacional") setOpTab(tab); if (sec === "financeiro") setFinTab(tab); } setUsuariosAberto(false); setRankingAberto(false); setGerencialAberto(false); setDrawer(false); };
  const tabDe = (sec) => sec === "operacional" ? opTab : sec === "financeiro" ? finTab : null;
  const ativo = (sec, tab) => !usuariosAberto && !rankingAberto && !gerencialAberto && secao === sec && (!tab || tabDe(sec) === tab);

  const botao = (sec, tab, label, icone, nota) => (
    <button key={(tab || sec)} onClick={() => abrir(sec, tab)}
      style={{ display: "block", width: "100%", textAlign: "left", background: ativo(sec, tab) ? C.laranja : "transparent", color: ativo(sec, tab) ? "#fff" : "#d4d4d4", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", marginBottom: 2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700 }}><span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{icone}</span>{label}</span>
      {nota && <span style={{ display: "block", fontSize: 10.5, color: ativo(sec, tab) ? "#ffe2cf" : "#7d7d7d", marginLeft: 28, marginTop: 1 }}>{nota}</span>}
    </button>
  );

  const tituloOp = OP_ITENS.find((i) => i.id === opTab);
  const tituloFin = FIN_ITENS.find((i) => i.id === finTab);
  const titulo = gerencialAberto ? "Painel Gerencial" : rankingAberto ? "Ranking de Supervisores" : usuariosAberto ? "Usuários e permissões" : secao === "painel" ? "Painel Geral" : secao === "financeiro" ? `Financeiro · ${tituloFin?.label || ""}` : `Operacional · ${tituloOp?.label || ""}`;

  const navInterno = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, padding: "0 4px" }}><LogoMiriad size={28} />
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 900, lineHeight: 1.05 }}>Miriad<br /><span style={{ color: C.laranja, fontSize: 11, fontWeight: 700 }}>Construction Control</span></div></div>
      <div style={{ height: 1, background: "#333", margin: "14px 0" }} />

      {pode(p, "painel") && botao("painel", null, "Painel Geral", "▣", "Visão consolidada das obras")}

      {temFin && <>
        <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Financeiro</div>
        {finItens.map((i) => botao("financeiro", i.id, i.label, "$", i.nota))}
      </>}

      {pode(p, "operacional") && <>
        <div style={{ color: "#777", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", margin: "12px 4px 6px", fontWeight: 800 }}>Operacional</div>
        {OP_ITENS.map((i) => botao("operacional", i.id, i.label, "▤", i.embreve ? `${i.nota} · em breve (${i.embreve})` : i.nota))}
      </>}

      <div style={{ flex: 1, minHeight: 12 }} />
      {ehDir && <button onClick={() => { setGerencialAberto(true); setRankingAberto(false); setUsuariosAberto(false); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: gerencialAberto ? C.laranja : "transparent", color: gerencialAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>📊</span>Painel Gerencial</button>}
      {ehDir && <button onClick={() => { setRankingAberto(true); setUsuariosAberto(false); setGerencialAberto(false); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: rankingAberto ? C.laranja : "transparent", color: rankingAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>🏆</span>Ranking</button>}
      {pode(p, "usuarios") && <button onClick={() => { setUsuariosAberto(true); setRankingAberto(false); setGerencialAberto(false); setDrawer(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: usuariosAberto ? C.laranja : "transparent", color: usuariosAberto ? "#fff" : "#999", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><span style={{ width: 18, textAlign: "center" }}>⚙</span>Usuários</button>}
      <div style={{ borderTop: "1px solid #333", marginTop: 10, paddingTop: 12 }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{usuario.nome}</div>
        <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>{PAPEIS[p] || p}</div>
        <button onClick={onSair} style={{ background: "transparent", border: "1px solid #444", color: "#aaa", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", width: "100%" }}>Sair</button>
      </div>
    </>
  );

  const conteudo = (
    <div key={`${secao}-${opTab}-${finTab}-${usuariosAberto}-${rankingAberto}-${gerencialAberto}`} className="mcc-fade">
      {gerencialAberto && ehDir ? <PainelGerencial />
        : rankingAberto && ehDir ? <Ranking />
        : usuariosAberto && pode(p, "usuarios") ? <Usuarios usuario={usuario} />
        : secao === "painel" && pode(p, "painel") ? <PainelGeralWrap />
        : secao === "financeiro" && temFin ? <ModuloFinanceiro sub={finTab} setSub={setFinTab} />
        : pode(p, "operacional") ? <ModuloOperacional usuario={usuario} sub={opTab} setSub={setOpTab} />
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
  const conviteToken = new URLSearchParams(window.location.search).get("convite");
  const [usuario, setUsuario] = useState(() => (getToken() ? getUser() : null));
  const sair = useCallback(() => { limparSessao(); setUsuario(null); }, []);
  useEffect(() => { if (getToken() && !conviteToken) listar("obras").catch((e) => { if (e instanceof AuthError) sair(); }); }, [sair, conviteToken]);
  if (conviteToken && !usuario) return <DefinirSenha token={conviteToken} onEntrar={setUsuario} />;
  if (!usuario) return <Login onEntrar={setUsuario} />;
  return <Shell usuario={usuario} onSair={sair} />;
}
