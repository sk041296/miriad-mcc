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
export const resumoRdo = (obraId) => req(`/api/data?t=rdo_resumo&obra_id=${obraId}`).then((d) => d);
export const criar = (t, row) => req("/api/data", { method: "POST", body: JSON.stringify({ t, row }) }).then((d) => d.row);
export const criarUsuario = (row) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "usuarios", row }) }).then((d) => d);
export const acaoData = (body) => req("/api/data", { method: "POST", body: JSON.stringify(body) }).then((d) => d);
export const criarObraComEap = (obra, itens) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "obra_com_eap", obra, itens }) });
export const criarRdoCompleto = (rdo, restricoes, rdo_id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "rdo_completo", rdo, restricoes, rdo_id }) }).then((d) => d.row);
export const editar = (t, id, patch) => req("/api/data", { method: "PATCH", body: JSON.stringify({ t, id, patch }) });
export const aprovarOrdem = (tabela, id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "aprovar_ordem", tabela, id }) });
export const aprovarBmp = (id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "aprovar_bmp", id }) }).then((d) => d);
export const rejeitarBmp = (id, motivo) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "rejeitar_bmp", id, motivo }) }).then((d) => d);
export const sugerirComposicaoIA = (itens) => req("/api/sugerir-composicao", { method: "POST", body: JSON.stringify({ itens }) }).then((d) => d.composicoes || []);
export const tornarProjeto = (id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "tornar_projeto", id }) });
export const decidirAcaoUsuario = (id, aprovar, motivo) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "decidir_acao_usuario", id, aprovar, motivo }) });
export const converterGastoEscritorio = (dados) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "converter_gasto_escritorio", ...dados }) });
export const pendenciasUsuarios = () => req("/api/data?t=pendencias_usuarios").then((d) => d.rows || []);
export const destravarUsuario = (id) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "destravar_usuario", id }) }).then((d) => d);
export const rejeitarOrdem = (tabela, id, motivo) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "rejeitar_ordem", tabela, id, motivo }) });
export const remover = (t, id) => req("/api/data", { method: "DELETE", body: JSON.stringify({ t, id }) });
export const parseEapApi = (linhas, nomeObra) => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ linhas, nomeObra }) }).then((d) => d.eap);
export const parseEapLote = (linhas) => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ linhas, lote: true }) }).then((d) => d.itens || []);
export const diagnosticarEap = () => req("/api/parse-eap", { method: "POST", body: JSON.stringify({ diagnostico: true }) });
export const getFin = (chave) => req(`/api/data?t=financeiro_estado&chave=${chave}`).then((d) => d.valor);
export const setFin = (chave, valor) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "financeiro_estado", chave, valor }) });
export const aplicarDesconto = (obra_id, desconto) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "eap_aplicar_desconto", obra_id, desconto }) });
export const definirMeta = (obra_id, meta_pct, ids) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "eap_definir_meta", obra_id, meta_pct, ids }) });
export const uploadFoto = (dataUrl, nome, obraCodigo) => req("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl, nome, obraCodigo }) });

/* Conferência rápida (IA) do parse de planilha — nunca lança e nunca bloqueia o import (v10.7).
   Timeout do lado do cliente em 8s (o servidor já corta a IA em 5s). Retorna sempre um objeto:
   {ok:true|false|null, resumo, alertas:[...], indisponivel?, motivo?}. */
export const verificarImport = async (tipo, itens, eapResumo, nomeObra) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("/api/verificar-import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ tipo, itens, eapResumo, nomeObra }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: null, indisponivel: true, motivo: `http_${r.status}` };
    return d;
  } catch (e) {
    return { ok: null, indisponivel: true, motivo: e?.name === "AbortError" ? "timeout" : "rede" };
  } finally { clearTimeout(timer); }
};
export const VINCULOS = ["direto", "indireto"];

/* ---------- casamento de itens importados de planilha com a EAP da obra (v10.7) ----------
   Ao importar a planilha modelo na SS-i / OS-i, o código do item nem sempre bate com o
   `codigo` real da EAP cadastrada. Aqui tentamos reconhecer o item da EAP a partir do
   ITEM/CÓDIGO da planilha e, como reforço, pela descrição. Retorna o `codigo` real da EAP
   ou null se não houver casamento confiável. */
const _normTxt = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const _normCod = (s) => _normTxt(s).replace(/[^0-9A-Z.]/g, "").replace(/(^|\.)0+(\d)/g, "$1$2"); // tira acentos/espaços e zeros à esquerda de cada nível
// Converte texto numérico em formato BR ("R$ 1.606,21", "198,04") para Number. NaN se vazio/inválido.
export const numBR = (v) => { let s = String(v == null ? "" : v).replace(/[^\d.,-]/g, ""); if (!s) return NaN; if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); return parseFloat(s); };

// Extrai itens de uma planilha de escopo/orçamento usando a MESMA regra validada do upload de EAP (aba Obras):
// só linhas cujo ITEM é um código pontilhado (ehCod: "3.20", "5.2"), usando esse ITEM como código.
// Ignora linhas de seção/observação e códigos SINAPI avulsos. Retorna [{codigo, descricao, unidade, qtde, valorTotal}].
const _ehCodPlan = (c0) => /^\d+(\.\d+)+\.?$/.test(String(c0 == null ? "" : c0).replace(",", ".").trim());
export function extrairItensPlanilha(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const NORM = (s) => String(s == null ? "" : s).trim().toUpperCase();
  // Excel costuma converter códigos "S.N" (ex.: 4.1, 4.10) em datas (4/jan, 4/out).
  // Recupera o código original como "dia.mês" a partir do objeto Date.
  const recuperaCodData = (v) => {
    if (v instanceof Date && !isNaN(v)) { const dia = v.getDate(), mes = v.getMonth() + 1; return `${dia}.${mes}`; }
    return null;
  };
  const ehItemHdr = (c) => c === "ITEM" || c === "ÍTEM" || c === "EAP" || (c.includes("EAP") && c.length <= 6);
  let melhores = [];
  for (const sn of wb.SheetNames) {
    const grade = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
    let hdr = -1, col = {};
    for (let i = 0; i < Math.min(grade.length, 30); i++) {
      const cs = (grade[i] || []).map(NORM);
      const temItem = cs.some(ehItemHdr);
      const temDesc = cs.some((c) => c.includes("DESCRI") || c.includes("ESPECIFICA"));
      if (!temItem || !temDesc) continue;
      hdr = i; col = {};
      cs.forEach((c, j) => {
        if (ehItemHdr(c) && col.item == null) col.item = j;
        else if ((c.includes("DESCRI") || c.includes("ESPECIFICA")) && col.desc == null) col.desc = j;
        else if (c.includes("UNID") && col.unid == null) col.unid = j;
        else if ((c.includes("QUANT") || c === "QTD") && col.qtde == null) col.qtde = j;
      });
      // valor à faturar: prioriza qualquer coluna "...TOTAL" que não seja unitária (ex.: "MÃO DE OBRA TOTAL",
      // "VALOR TOTAL", "CUSTO TOTAL"); senão VALOR/PREÇO/CUSTO não-unitário.
      cs.forEach((c, j) => { if (c.includes("TOTAL") && !c.includes("UNIT") && col.vt == null) col.vt = j; });
      if (col.vt == null) cs.forEach((c, j) => { if ((c.includes("VALOR") || c.includes("PREÇO") || c.includes("PRECO") || c.includes("CUSTO")) && !c.includes("UNIT") && col.vt == null) col.vt = j; });
      break;
    }
    if (hdr < 0 || col.item == null || col.desc == null || col.unid == null || col.qtde == null) continue;
    const itens = [];
    for (let i = hdr + 1; i < grade.length; i++) {
      const r = grade[i] || [];
      const bruto = r[col.item];
      // recupera código corrompido em data (4.1 -> 04/jan); senão usa o texto normal
      const c0 = recuperaCodData(bruto) || String(bruto == null ? "" : bruto).trim();
      if (!_ehCodPlan(c0)) continue;                                   // só itens com código pontilhado (ITEM da EAP)
      const desc = String(r[col.desc] == null ? "" : r[col.desc]).trim();
      const unid = String(r[col.unid] == null ? "" : r[col.unid]).trim();
      const qt = numBR(r[col.qtde]);
      if (!desc || !unid || isNaN(qt) || qt <= 0) continue;            // ignora seções/observações
      const vt = col.vt != null ? (numBR(r[col.vt]) || 0) : 0;
      itens.push({ codigo: c0.replace(/\.$/, ""), descricao: desc, unidade: unid, qtde: qt, valorTotal: vt });
    }
    if (itens.length > melhores.length) melhores = itens;
  }
  return melhores;
}

export function casarEapImport(eapItens, { item, cod, descricao }) {
  if (!Array.isArray(eapItens) || eapItens.length === 0) return null;
  const codigosImport = [item, cod].map(_normCod).filter(Boolean);
  // 1) código idêntico (normalizado, ignorando zeros à esquerda)
  for (const c of codigosImport) {
    const hit = eapItens.find((e) => _normCod(e.codigo) === c);
    if (hit) return hit.codigo;
  }
  // Se a planilha JÁ traz um código pontilhado válido (ex.: "7.10"), ele tem prioridade:
  // não deixamos o match por descrição substituí-lo pelo código de OUTRO item que por acaso
  // tenha a mesma descrição (caso de itens repetidos como TUBO 7.3 e 7.10). Mantemos o código da planilha.
  const temCodValido = codigosImport.some((c) => /^\d+(\.\d+)*$/.test(c));
  if (temCodValido) return null; // null => o chamador mantém o código original da planilha
  const d = _normTxt(descricao);
  if (d) {
    // 2) descrição idêntica (só quando NÃO há código válido na planilha)
    const exato = eapItens.find((e) => _normTxt(e.descricao) === d);
    if (exato) return exato.codigo;
    // 3) contenção sem ambiguidade (uma única EAP contém/está contida na descrição importada)
    const contidos = eapItens.filter((e) => { const ed = _normTxt(e.descricao); return ed.length >= 6 && d.length >= 6 && (ed.includes(d) || d.includes(ed)); });
    if (contidos.length === 1) return contidos[0].codigo;
  }
  return null;
}

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

/* Banner de conferência por IA do import (v10.7). `verif`: null=oculto; {loading:true};
   ou o objeto retornado por verificarImport ({ok, resumo, alertas, indisponivel, motivo}). */
export const VerifBanner = ({ verif }) => {
  if (!verif) return null;
  const base = { borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginTop: 8 };
  if (verif.loading) return <div style={{ ...base, background: C.cinza, border: `1px solid ${C.linha}`, color: C.dim }}>🔎 Conferindo a importação com IA…</div>;
  if (verif.indisponivel) return <div style={{ ...base, background: C.cinza, border: `1px solid ${C.linha}`, color: C.dim }}>Conferência por IA indisponível{verif.motivo === "timeout" ? " (excedeu 5s)" : ""} — itens importados normalmente.</div>;
  if (verif.ok) return <div style={{ ...base, background: `${C.verde}12`, border: `1px solid ${C.verde}55`, color: C.verde, fontWeight: 700 }}>✓ Importação conferida{verif.resumo ? ` — ${verif.resumo}` : "."}</div>;
  const alertas = verif.alertas || [];
  return (
    <div style={{ ...base, background: `${C.amareloAlerta}12`, border: `1px solid ${C.amareloAlerta}66`, color: C.texto }}>
      <div style={{ fontWeight: 800, color: C.amareloAlerta, marginBottom: 4 }}>⚠ A IA encontrou {alertas.length} ponto(s) a revisar{verif.resumo ? `: ${verif.resumo}` : ""}</div>
      {alertas.map((a, i) => <div key={i} style={{ fontSize: 12, marginTop: 2 }}>• <b>{a.item || "—"}</b>: {a.problema}</div>)}
      <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Revise os itens marcados antes de salvar. A conferência é um apoio — você decide.</div>
    </div>
  );
};
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
  tecnico_seguranca: "Técnico de Segurança",
};
export const SETOR_DE_PAPEL = {
  ceo: "direcao", diretor: "direcao",
  coord_suprimentos: "suprimentos", op_suprimentos: "suprimentos",
  coord_planejamento: "planejamento", op_planejamento: "planejamento",
  coord_obras: "obras", sup_obras: "obras",
  coord_orcamentos: "orcamentos", op_orcamento: "orcamentos",
  financeiro: "financeiro",
  tecnico_seguranca: "obras",
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
  tecnico_seguranca:  { painel: 1, operacional: 1 },
};
export const pode = (papel, area) => { const p = PERMS[papel] || PERMS[PAPEIS_CUSTOM[papel] ? PAPEIS_CUSTOM[papel].papel_base : papel]; return !!(p && p[area]); };
export const ehDirecao = (papel) => papel === "ceo" || papel === "diretor";

/* ===== Papéis customizados (dinâmicos, carregados do banco no boot) ===== */
/* Cada um herda o comportamento de um papel-base fixo. Chave prefixada com "custom_". */
export let PAPEIS_CUSTOM = {}; // { chave: { nome, papel_base } }
export function registrarPapeisCustom(lista) {
  PAPEIS_CUSTOM = {};
  (lista || []).forEach((p) => { if (p && p.chave && p.papel_base) PAPEIS_CUSTOM[p.chave] = { nome: p.nome || p.chave, papel_base: p.papel_base }; });
}
// papel-base de um papel (o próprio, se for fixo)
export const basePapel = (papel) => (PAPEIS_CUSTOM[papel] ? PAPEIS_CUSTOM[papel].papel_base : papel);
// nome de exibição de qualquer papel (fixo ou customizado)
export const nomePapel = (papel) => PAPEIS[papel] || (PAPEIS_CUSTOM[papel] ? PAPEIS_CUSTOM[papel].nome : papel);
// permissões efetivas (customizado herda do base)
export const permsDePapel = (papel) => PERMS[papel] || PERMS[basePapel(papel)] || {};
// setor efetivo
export const setorDePapel = (papel) => SETOR_DE_PAPEL[papel] || SETOR_DE_PAPEL[basePapel(papel)] || "obras";
/* quem pode criar qual papel (espelha o backend). Inclui papéis customizados cujo base o criador pode criar. */
export function papeisQuePodeCriar(criador) {
  let fixos;
  if (criador === "ceo") fixos = Object.keys(PAPEIS);
  else if (criador === "diretor") fixos = Object.keys(PAPEIS).filter((p) => p !== "diretor" && p !== "ceo");
  else if (criador === "coord_suprimentos") fixos = ["op_suprimentos"];
  else if (criador === "coord_planejamento") fixos = Object.keys(PAPEIS).filter((p) => p !== "diretor" && p !== "ceo");
  else if (criador === "coord_obras") fixos = ["sup_obras"];
  else if (criador === "coord_orcamentos") fixos = ["op_orcamento"];
  else fixos = [];
  // papéis customizados: disponíveis se o criador pode criar o papel-base
  const custom = Object.keys(PAPEIS_CUSTOM).filter((ch) => fixos.includes(PAPEIS_CUSTOM[ch].papel_base));
  return [...fixos, ...custom];
}
/* papéis cujo acesso é restrito às obras designadas */
export const PRECISA_DESIGNACAO = new Set(["sup_obras", "op_suprimentos", "op_planejamento", "op_orcamento"]);

/* ===================== Acesso configurável por cargo (v9.3) ===================== */
export const OP_IDS = ["rdo", "pos", "pmm", "smi", "ssi", "oc", "os", "prestadores", "novoprojeto", "metascusto", "orcamentos", "orccomercial", "eap", "obras"];
export const FIN_IDS = ["premissas", "antecipacao", "comparativo", "sensibilidade", "resultado", "custos", "custosdir", "medprojetada", "op", "custosfixos", "cartoes", "fluxocaixa", "planejamento"];
const mapBool = (ids, val) => Object.fromEntries(ids.map((k) => [k, typeof val === "function" ? !!val(k) : !!val]));
const inc = (papel, ...lista) => lista.includes(papel);

export function acessoPadrao(papel) {
  const P = PERMS[papel] || {};
  const dir = papel === "ceo" || papel === "diretor";
  const finFull = dir || papel === "financeiro";
  return {
    painel: !!P.painel, usuarios: !!P.usuarios, ranking: dir, gerencial: dir,
    op: mapBool(OP_IDS, !!P.operacional),
    fin: (() => { const b = mapBool(FIN_IDS, finFull ? true : (papel === "coord_planejamento" ? (k) => k === "medprojetada" : false)); b.fluxocaixa = dir; return b; })(),
    cap: {
      smi_criar: inc(papel, "sup_obras", "coord_planejamento"),
      ssi_criar: inc(papel, "sup_obras", "coord_planejamento"),
      pos_criar: inc(papel, "sup_obras", "coord_planejamento"),
      pmm_criar: inc(papel, "sup_obras", "coord_planejamento"),
      smi_gestao: inc(papel, "op_suprimentos", "coord_suprimentos", "coord_obras", "coord_planejamento", "ceo", "diretor"),
      ssi_gestao: inc(papel, "op_suprimentos", "coord_suprimentos", "coord_obras", "coord_planejamento", "ceo", "diretor"),
      pos_gestao: inc(papel, "coord_planejamento", "ceo", "diretor"),
      pmm_gestao: inc(papel, "coord_obras", "coord_planejamento", "ceo", "diretor"),
    },
  };
}
export function mapaAcessoPadrao() { const m = {}; Object.keys(PAPEIS).forEach((p) => (m[p] = acessoPadrao(p))); return m; }
export function mesclarAcesso(base, ov) {
  const out = JSON.parse(JSON.stringify(base));
  Object.keys(ov || {}).forEach((p) => {
    if (!out[p]) out[p] = acessoPadrao(p);
    const o = ov[p] || {};
    ["painel", "usuarios", "ranking", "gerencial"].forEach((k) => { if (typeof o[k] === "boolean") out[p][k] = o[k]; });
    ["op", "fin", "cap"].forEach((g) => { if (o[g]) out[p][g] = { ...out[p][g], ...o[g] }; });
  });
  return out;
}
export const acessoDe = (mapa, papel) => (mapa && mapa[papel]) || acessoPadrao(papel);
export const getConfig = (chave = "acesso") => req(`/api/data?t=config&chave=${chave}`).then((d) => d.valor);
export const setConfig = (chave, valor) => req("/api/data", { method: "POST", body: JSON.stringify({ t: "config", chave, valor }) });
export const dispararNotificacoes = () => req("/api/notificar?manual=1").then((d) => d);

/* ===== Cálculo de verba/consumido por EAP (compartilhado: operacional + painel) ===== */
const codEap = (c) => String(c || "").split(" ")[0].trim();

export function consumidoPorEapObra(ocs, contratos, obraId) {
  const m = {};
  const add = (cod, val) => { const c = codEap(cod); if (!c) return; m[c] = (m[c] || 0) + (Number(val) || 0); };
  (ocs || []).filter((o) => o.obra_id === obraId).forEach((o) => {
    if (Array.isArray(o.itens_eap) && o.itens_eap.length && o.itens_eap.some((x) => x.eap_codigo)) o.itens_eap.forEach((x) => add(x.eap_codigo, x.valor != null ? x.valor : x.valor_total));
    else add(o.eap_codigo, o.valor);
  });
  (contratos || []).filter((c) => c.obra_id === obraId).forEach((c) => {
    if (Array.isArray(c.itens_eap) && c.itens_eap.length) {
      if (c.tipo === "direto") { const v = (Number(c.custo_mensal) || 0) * (Number(c.meses) || 0); const n = c.itens_eap.length || 1; c.itens_eap.forEach((x) => add(x.eap_codigo, v / n)); }
      else c.itens_eap.forEach((x) => add(x.eap_codigo, x.valor));
    } else add(c.escopo_eap, c.valor);
  });
  return m;
}

// quanto uma OC/OS contribuiu para uma EAP específica
function valorOrdemNaEap(ordem, cod, ehContrato) {
  const alvo = codEap(cod);
  if (Array.isArray(ordem.itens_eap) && ordem.itens_eap.length && ordem.itens_eap.some((x) => x.eap_codigo)) {
    if (ehContrato && ordem.tipo === "direto") {
      const v = (Number(ordem.custo_mensal) || 0) * (Number(ordem.meses) || 0); const n = ordem.itens_eap.length || 1;
      return ordem.itens_eap.filter((x) => codEap(x.eap_codigo) === alvo).length * (v / n);
    }
    return ordem.itens_eap.filter((x) => codEap(x.eap_codigo) === alvo).reduce((s, x) => s + (Number(x.valor != null ? x.valor : x.valor_total) || 0), 0);
  }
  const codOrdem = codEap(ehContrato ? ordem.escopo_eap : ordem.eap_codigo);
  return codOrdem === alvo ? (Number(ordem.valor) || 0) : 0;
}

/* Varre todas as obras e retorna as EAPs cujo consumido ultrapassou a verba,
   com o GRUPO de OCs/OSs que compõem o consumo daquela EAP. */
// verba de referência: memorial tem prioridade; senão usa a meta de custo genérica.
// Retorna null quando não há nenhuma das duas.
export function verbaEfetivaItem(e) {
  if (e.verba_contratacao != null && Number(e.verba_contratacao) > 0) return Number(e.verba_contratacao);
  if (e.meta_valor != null) return Number(e.meta_valor) * (Number(e.qtde) || 0);
  const csb = Number(e.custo_sem_bdi);
  if (csb && e.meta_pct != null) return csb * (1 - (Number(e.desconto) || 0)) * (Number(e.meta_pct) || 0) * (Number(e.qtde) || 0);
  return null;
}

export function furosDeVerba(obras, eapPorObra, ocs, contratos) {
  const furos = [];
  (obras || []).forEach((obra) => {
    const itens = (eapPorObra && eapPorObra[obra.id]) || [];
    const consumido = consumidoPorEapObra(ocs, contratos, obra.id);
    itens.forEach((i) => {
      const verba = verbaEfetivaItem(i);
      if (!(verba > 0)) return;
      const cod = codEap(i.codigo);
      const gasto = consumido[cod] || 0;
      if (gasto <= verba + 0.005) return;
      // grupo de ordens que tocam essa EAP
      const ordens = [];
      (ocs || []).filter((o) => o.obra_id === obra.id).forEach((o) => {
        const v = valorOrdemNaEap(o, cod, false);
        if (v > 0) ordens.push({ tipo: "OC", id: o.id, numero: o.numero || "", nome: o.fornecedor || "", valor: v, status_aprovacao: o.status_aprovacao || "aprovada" });
      });
      (contratos || []).filter((c) => c.obra_id === obra.id).forEach((c) => {
        const v = valorOrdemNaEap(c, cod, true);
        if (v > 0) ordens.push({ tipo: "OS", id: c.id, numero: c.numero || "", nome: c.empresa || "", valor: v, status_aprovacao: c.status_aprovacao || "aprovada" });
      });
      ordens.sort((a, b) => b.valor - a.valor);
      furos.push({ obraId: obra.id, obraCodigo: obra.codigo, eap: i.codigo, descricao: i.descricao, verba, consumido: gasto, excesso: gasto - verba, pct: gasto / verba, ordens });
    });
  });
  return furos.sort((a, b) => b.excesso - a.excesso);
}
