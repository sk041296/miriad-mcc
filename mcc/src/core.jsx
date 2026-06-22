import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ReferenceLine, PieChart, Pie,
} from "recharts";
import * as XLSX from "xlsx";

/* ================================================================
   MIRIAD CONSTRUCTION CONTROL (MCC)
   Tema: laranja (#f37335) · vermelho (#c21000) · preto · branco
   ================================================================ */

export const C = {
  laranja: "#f37335", laranjaEsc: "#d94f1a", vermelho: "#c21000", laranjaClaro: "#fdece2",
  preto: "#141414", grafite: "#1f1f1f", grafite2: "#2a2a2a", branco: "#ffffff",
  cinza: "#f5f5f4", cinza2: "#ebebe9", linha: "#e2e2df", texto: "#1c1c1c", dim: "#787873",
  verde: "#17935a", azul: "#2f6fed", amareloAlerta: "#d9930a",
};

export const fmt = (v, dec = 2) => (v === null || v === undefined || isNaN(v)) ? "—"
  : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtR = (v, dec = 2) => (v === null || isNaN(v)) ? "—" : `R$ ${fmt(v, dec)}`;
export const fmtK = (v) => {
  if (v === null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${v < 0 ? "−" : ""}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`;
  if (a >= 1e3) return `${v < 0 ? "−" : ""}R$ ${(a / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return fmtR(v, 0);
};
export const pct = (v, dec = 1) => (v === null || isNaN(v)) ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: dec })}%`;
export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const addDiasISO = (iso, dias) => { if (!iso) return iso; const d = new Date(String(iso).slice(0, 10) + "T00:00:00"); d.setDate(d.getDate() + (Number(dias) || 0)); return d.toISOString().slice(0, 10); };
export const ymISO = (iso) => String(iso || "").slice(0, 7);
export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const sum = (a) => a.reduce((s, v) => s + (Number(v) || 0), 0);
export const uid = () => Math.random().toString(36).slice(2, 9);
export const z8 = () => Array(8).fill(0);
export const parseBR = (s) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };

export const CLIMAS = ["Ensolarado", "Parcialmente nublado", "Nublado", "Chuva fraca", "Chuva forte", "Impraticável"];
// fator de produtividade por clima para atividades EXTERNAS (1 = dia cheio)
export const FATOR_CLIMA = { "Ensolarado": 1, "Parcialmente nublado": 0.9, "Nublado": 0.8, "Chuva fraca": 0.5, "Chuva forte": 0.15, "Impraticável": 0 };
export const FUNCOES_USUARIO = ["Gestor", "Supervisor de Obra", "Engenheiro Responsável", "Coordenador de Obras"];
export const ATRIBUICOES = [
  "Coordenador de Obras", "Engenheiro", "Mestre de obras", "Encarregado", "Pedreiro", "Ajudante de pedreiro",
  "Carpinteiro", "Ajudante de carpinteiro", "Armador", "Servente", "Ajudante", "Meio-Oficial", "Almoxarife",
  "Técnico de segurança", "Eletricista", "Ajudante de eletricista", "Encanador", "Gesseiro", "Azulejista",
  "Pintor", "Aplicador", "Soldador", "Serralheiro", "Vidraceiro", "Operador de máquinas", "Motorista",
  "Refrigeração", "Climatização",
  "Empreiteiro de pintura", "Empreiteiro de revestimentos", "Empreiteiro de cobertura", "Empreiteiro de HVAC",
  "Empreiteiro de estrutura metálica", "Empreiteiro de esquadrias", "Empreiteiro de impermeabilização",
  "Empreiteiro de instalações elétricas", "Empreiteiro de instalações hidráulicas", "Empreiteiro de drywall",
  "Empreiteiro de fundações", "Empreiteiro de alvenaria",
];

/* ---------------- camada de API (sessão por token) ---------------- */
const TKEY = "mcc_token", UKEY = "mcc_user";
export const getToken = () => localStorage.getItem(TKEY) || "";
export const getUser = () => { try { return JSON.parse(localStorage.getItem(UKEY)); } catch { return null; } };
export const setSessao = (token, usuario) => { localStorage.setItem(TKEY, token); localStorage.setItem(UKEY, JSON.stringify(usuario)); };
export const limparSessao = () => { localStorage.removeItem(TKEY); localStorage.removeItem(UKEY); };
export class AuthError extends Error {}

async function req(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) } });
  if (r.status === 401) { throw new AuthError(); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  return d;
}
export const apiAuth = (body) => fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
export const listar = (t, params = {}) => req(`/api/data?t=${t}&` + new URLSearchParams(params)).then((d) => d.rows || []);
export const criar = (t, row) => req("/api/data", { method: "POST", body: JSON.stringify({ t, row }) }).then((d) => d.row);
export const criarUsuario = (row) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "usuarios", row }) }).then((d) => d);
export const acaoData = (body) => req("/api/data", { method: "POST", body: JSON.stringify(body) }).then((d) => d);
export const criarObraComEap = (obra, itens) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "obra_com_eap", obra, itens }) });
export const criarRdoCompleto = (rdo, restricoes, rdo_id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "rdo_completo", rdo, restricoes, rdo_id }) }).then((d) => d.row);
export const editar = (t, id, patch) => req("/api/data", { method: "PATCH", body: JSON.stringify({ t, id, patch }) });
export const remover = (t, id) => req("/api/data", { method: "DELETE", body: JSON.stringify({ t, id }) });
export const parseEapApi = (linhas, nomeObra) => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ linhas, nomeObra }) }).then((d) => d.eap);
export const parseEapLote = (linhas) => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ linhas, lote: true }) }).then((d) => d.itens || []);
export const diagnosticarEap = () => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ diagnostico: true }) });
export const getFin = (chave) => req(`/api/data?t=financeiro_estado&chave=${chave}`).then((d) => d.valor);
export const setFin = (chave, valor) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "financeiro_estado", chave, valor }) });
export const aplicarDesconto = (obra_id, desconto) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "eap_aplicar_desconto", obra_id, desconto }) });
export const definirMeta = (obra_id, meta_pct, ids) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "eap_definir_meta", obra_id, meta_pct, ids }) });
export const uploadFoto = (dataUrl, nome, obraCodigo) => req("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl, nome, obraCodigo }) });
export const VINCULOS = ["direto", "indireto"];

/* ---------------- UI primitives ---------------- */
export const Card = ({ title, right, children, style }) => (
  <div className="mcc-card" style={{ background: C.branco, border: `1px solid ${C.linha}`, borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)", ...style }}>
    {(title || right) && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.preto, fontWeight: 800, borderLeft: `4px solid ${C.laranja}`, paddingLeft: 10 }}>{title}</div>
        {right}
      </div>
    )}
    {children}
  </div>
);
export const Btn = ({ children, onClick, kind = "primary", small, disabled, type }) => {
  const st = {
    primary: { background: C.laranja, color: "#fff", border: "none" },
    dark: { background: C.preto, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.texto, border: `1.5px solid ${C.linha}` },
    danger: { background: "transparent", color: C.vermelho, border: `1.5px solid ${C.vermelho}55` },
  }[kind];
  return <button type={type || "button"} onClick={onClick} disabled={disabled} className="mcc-btn"
    style={{ ...st, borderRadius: 9, padding: small ? "6px 13px" : "9px 18px", fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>{children}</button>;
};
export const inp = (extra = {}) => ({ background: C.branco, border: `1.5px solid ${C.linha}`, color: C.texto, borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none", ...extra });
export const Lbl = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{children}</div>;
export const Th = ({ children, right }) => <th style={{ padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: C.branco, background: C.preto, textAlign: right ? "right" : "left", whiteSpace: "nowrap" }}>{children}</th>;
export const Td = ({ children, right, color, style, colSpan, onClick }) => <td colSpan={colSpan} onClick={onClick} style={{ padding: "7px 10px", fontSize: 13, color: color || C.texto, textAlign: right ? "right" : "left", borderBottom: `1px solid ${C.linha}`, ...(right ? { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } : {}), ...style }}>{children}</td>;
export const Kpi = ({ label, value, sub, dark, accent }) => (
  <div className="mcc-kpi" style={{ background: dark ? C.preto : C.branco, border: `1px solid ${dark ? C.preto : C.linha}`, borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 175, boxShadow: dark ? "0 4px 14px rgba(20,20,20,0.18)" : "0 1px 2px rgba(16,24,40,0.04)" }}>
    <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "#a3a3a3" : C.dim, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 23, fontWeight: 800, color: accent || (dark ? C.laranja : C.preto), marginTop: 4, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: dark ? "#a3a3a3" : C.dim, marginTop: 3 }}>{sub}</div>}
  </div>
);
export const ChartTip = ({ active, payload, label, money = true }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ background: C.preto, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
    <div style={{ color: "#a3a3a3", marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color || C.laranja }}>{p.name}: {money ? fmtK(p.value) : fmt(p.value)}</div>)}
  </div>;
};
export const NumInput = ({ value, onChange, w = 124, dec = 0, ...rest }) => {
  const [ed, setEd] = useState(false); const [txt, setTxt] = useState("");
  const base = { width: w, minWidth: w, textAlign: "right", color: C.azul, fontFamily: "ui-monospace,monospace", padding: "4px 8px", fontSize: 13, whiteSpace: "nowrap" };
  if (dec) return <input type="number" value={value === 0 ? 0 : value || ""} step="0.001" onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={inp(base)} {...rest} />;
  return <input type="text" inputMode="decimal" value={ed ? txt : (value ? Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00")}
    onFocus={(e) => { setEd(true); setTxt(value ? String(value).replace(".", ",") : ""); requestAnimationFrame(() => e.target.select()); }}
    onChange={(e) => { setTxt(e.target.value); onChange(parseBR(e.target.value)); }} onBlur={() => setEd(false)}
    style={inp(base)} {...rest} />;
};

/* ===================== Papéis e permissões (v7) ===================== */
export const PAPEIS = {
  ceo: "CEO", diretor: "Diretor",
  coord_suprimentos: "Coord. de Suprimentos", coord_planejamento: "Coord. de Planejamento",
  coord_obras: "Coord. de Obras", coord_orcamentos: "Coord. de Orçamentos",
  op_suprimentos: "Operador de Suprimentos", op_planejamento: "Operador de Planejamento", op_orcamento: "Operador de Orçamento",
  financeiro: "Financeiro", sup_obras: "Supervisor de Obras",
};
export const SETOR_DE_PAPEL = {
  ceo: "direcao", diretor: "direcao",
  coord_suprimentos: "suprimentos", op_suprimentos: "suprimentos",
  coord_planejamento: "planejamento", op_planejamento: "planejamento",
  coord_obras: "obras", sup_obras: "obras",
  coord_orcamentos: "orcamentos", op_orcamento: "orcamentos",
  financeiro: "financeiro",
};
/* permissões de acesso a módulos por papel */
export const PERMS = {
  ceo:                { painel: 1, operacional: 1, financeiro: 1, usuarios: 1 },
  diretor:            { painel: 1, operacional: 1, financeiro: 1, usuarios: 1 },
  coord_suprimentos:  { painel: 1, operacional: 1, usuarios: 1 },
  coord_planejamento: { painel: 1, operacional: 1, usuarios: 1 },
  coord_obras:        { painel: 1, operacional: 1, usuarios: 1 },
  coord_orcamentos:   { painel: 1, operacional: 1, usuarios: 1 },
  op_planejamento:    { painel: 1, operacional: 1 },
  op_orcamento:       { painel: 1, operacional: 1 },
  op_suprimentos:     { operacional: 1 },
  financeiro:         { painel: 1, financeiro: 1 },
  sup_obras:          { operacional: 1 },
};
export const pode = (papel, area) => !!(PERMS[papel] && PERMS[papel][area]);
export const ehDirecao = (papel) => papel === "ceo" || papel === "diretor";
/* quem pode criar qual papel (espelha o backend) */
export function papeisQuePodeCriar(criador) {
  if (criador === "ceo") return Object.keys(PAPEIS);
  if (criador === "diretor") return Object.keys(PAPEIS).filter((p) => p !== "diretor" && p !== "ceo");
  if (criador === "coord_suprimentos") return ["op_suprimentos"];
  if (criador === "coord_planejamento") return ["op_planejamento"];
  if (criador === "coord_obras") return ["sup_obras"];
  if (criador === "coord_orcamentos") return ["op_orcamento"];
  return [];
}
/* papéis cujo acesso é restrito às obras designadas */
export const PRECISA_DESIGNACAO = new Set(["sup_obras", "op_suprimentos", "op_planejamento", "op_orcamento"]);
