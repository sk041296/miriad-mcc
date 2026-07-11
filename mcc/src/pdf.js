import { TIMBRADO_HEADER } from "./timbrado.js";
import { dataBR, addDiasISO } from "./core.jsx";
import { LOGO_FULL } from "./logo.js";

/* Geração do PDF do RDO no papel timbrado da Miriad (via janela de impressão do navegador).
   IMPORTANTE: as restrições de material NÃO entram aqui — são internas, não vão ao cliente. */
const ESTILO_RDO = `
    @page { size: A4; margin: 14mm 12mm; }
    * { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; }
    body { margin: 0; font-size: 11px; }
    .header img { width: 100%; max-width: 720px; display: block; margin: 0 auto 6px; }
    .titulo { text-align: center; font-size: 15px; font-weight: 800; color: #c21000; letter-spacing: .04em; margin: 6px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #c9c9c9; padding: 4px 6px; font-size: 10.5px; vertical-align: top; }
    th { background: #141414; color: #fff; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
    .infogrid td:nth-child(odd) { background: #f3f3f1; font-weight: 700; width: 16%; }
    .sec { background: #f37335; color: #fff; font-weight: 800; padding: 4px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin: 4px 0; }
    .assin { margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; }
    .assin div { width: 45%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
    .obs { border: 1px solid #c9c9c9; padding: 6px 8px; min-height: 28px; font-size: 10.5px; white-space: pre-wrap; }`;

function corpoRdoHtml(rdo, obra, usuarioNome, funcao) {
  const climaLinha = rdo.clima || "—";
  const atividades = (rdo.atividades || []).map((a) => `
    <tr>
      <td>${a.eap || ""}</td>
      <td>${a.descricao || ""}</td>
      <td style="text-align:right">${a.qtde_dia != null ? Number(a.qtde_dia).toLocaleString("pt-BR") + " " + (a.unidade || "") : ""}</td>
      <td style="text-align:right">${a.pct_acum != null ? (a.pct_acum * 100).toFixed(1) + "%" : (a.pct_dia != null ? (a.pct_dia * 100).toFixed(1) + "%" : "")}</td>
    </tr>`).join("");
  const equipe = (rdo.equipe || []).map((m) => `
    <tr><td>${m.ocupacao || ""}</td><td>${m.nome || ""}</td><td style="text-align:center">${m.he_inicio || ""} – ${m.he_fim || ""}</td></tr>`).join("");
  return `
    <div class="header"><img src="${TIMBRADO_HEADER}" alt="Miriad"></div>
    <div class="titulo">RELATÓRIO DIÁRIO DE OBRA — RDO ${rdo.numero || ""}</div>
    <table class="infogrid">
      <tr><td>Obra</td><td>${obra.codigo || ""}</td><td>Data</td><td>${dataBR(rdo.data)}</td><td>Relatório nº</td><td>${rdo.numero || ""}</td></tr>
      <tr><td>Contratante</td><td colspan="3">${obra.contratante || ""}</td><td>Clima</td><td>${climaLinha}</td></tr>
      <tr><td>Local</td><td colspan="3">${obra.local || ""}</td><td>Efetivo</td><td>${rdo.efetivo || 0}</td></tr>
      <tr><td>Contrato</td><td colspan="5">${obra.contrato || ""}</td></tr>
    </table>
    <div class="sec">Serviços executados</div>
    <table><thead><tr><th>EAP</th><th>Descrição</th><th style="text-align:right">Avanço do dia</th><th style="text-align:right">% acumulado</th></tr></thead>
      <tbody>${atividades || '<tr><td colspan="4">Sem atividades na data.</td></tr>'}</tbody></table>
    <div class="sec">Mão de obra</div>
    <table><thead><tr><th>Ocupação</th><th>Nome</th><th style="text-align:center">Horário</th></tr></thead>
      <tbody>${equipe || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
    <div class="sec">Comentários</div>
    <div class="obs">${(rdo.comentarios || "").replace(/</g, "&lt;") || "—"}</div>
    ${rdo.ocorrencias ? `<div class="sec">Ocorrências</div><div class="obs">${rdo.ocorrencias.replace(/</g, "&lt;")}</div>` : ""}
    ${(rdo.fotos && rdo.fotos.length) ? `<div class="sec">Registro fotográfico</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${rdo.fotos.map((f) => `
      <div style="width:31%;border:1px solid #c9c9c9;border-radius:4px;overflow:hidden">
        <img src="${f.url}" style="width:100%;height:120px;object-fit:cover;display:block">
        <div style="padding:4px 6px;font-size:9.5px;line-height:1.35">
          ${f.legenda ? `<div>${String(f.legenda).replace(/</g, "&lt;")}</div>` : ""}
          ${f.eap_codigo ? `<div style="color:#c2410c;font-weight:bold;font-size:8.5px;margin-top:2px">EAP ${f.eap_codigo}</div>` : ""}
          ${!f.legenda && !f.eap_codigo ? "&nbsp;" : ""}
        </div>
      </div>`).join("")}</div>` : ""}
    <div style="margin-top:22px;text-align:center;page-break-inside:avoid">
      <div style="font-family:'Segoe Script','Brush Script MT',cursive;font-size:23px;color:#141414;line-height:1">${(usuarioNome || rdo.responsavel_nome || "").replace(/</g, "&lt;")}</div>
      <div style="border-top:1px solid #141414;width:280px;margin:3px auto 0;padding-top:4px;font-size:10px;color:#333">
        <b>Emitido por:</b> ${(usuarioNome || rdo.responsavel_nome || "").replace(/</g, "&lt;")} — ${(funcao || "Supervisor de Obras").replace(/</g, "&lt;")}
      </div>
      <div style="font-size:8.5px;color:#888;margin-top:2px">Assinatura digital gerada pelo MCC${rdo.numero ? ` — RDO nº ${rdo.numero}` : ""}${rdo.data ? ` — ${String(rdo.data).slice(0, 10).split("-").reverse().join("/")}` : ""}</div>
    </div>
    <div class="assin"><div>Responsável MIRIAD<br>${usuarioNome || rdo.responsavel_nome || ""}</div><div>Responsável CONTRATANTE<br>&nbsp;</div></div>`;
}

export function gerarPdfRdo(rdo, obra, usuarioNome, funcao) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>RDO ${rdo.numero || ""} — ${obra.codigo || ""}</title>
  <style>${ESTILO_RDO}</style></head><body>
    ${corpoRdoHtml(rdo, obra, usuarioNome, funcao)}
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF do RDO."); return; }
  w.document.write(html); w.document.close();
}

/* Gera um único documento com VÁRIOS RDOs (uma página por RDO) — usado no PDF em lote
   por faixa de datas. Cada responsável aparece conforme o RDO (passar usuarioNome = null). */
export function gerarPdfRdosLote(rdosArr, obra, usuarioNome, funcao) {
  if (!rdosArr || !rdosArr.length) { alert("Nenhum RDO no período selecionado."); return; }
  const paginas = rdosArr.map((rdo, i) => `<div style="${i > 0 ? "page-break-before:always;" : ""}">${corpoRdoHtml(rdo, obra, usuarioNome, funcao)}</div>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>RDOs ${obra.codigo || ""} (${rdosArr.length})</title>
  <style>${ESTILO_RDO}</style></head><body>
    ${paginas}
    <script>window.onload=()=>{setTimeout(()=>window.print(),450)}</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar os PDFs do período."); return; }
  w.document.write(html); w.document.close();
}

/* Geração do PDF de MEDIÇÃO (boletim de medição) no papel timbrado da Miriad.
   Usa o MESMO cabeçalho do RDO. Mostra a planilha analítica completa (sem as metas de custo),
   aplicando o percentual executado de cada atividade (a partir dos RDOs do período) e obtendo
   o valor com BDI de cada item. A última linha traz a somatória da medição COM e SEM BDI. */
export function gerarPdfMedicao(obra, linhas, periodo, usuarioNome) {
  const { ini, fim, modo } = periodo || {};
  const modoLabel = modo === "acumulada" ? "Medição acumulada (até a data final)" : "Medição do período (avanço no intervalo)";
  const totalComBdi = (linhas || []).reduce((s, l) => s + (Number(l.valorComBdi) || 0), 0);
  const totalSemBdi = (linhas || []).reduce((s, l) => s + (Number(l.valorSemBdi) || 0), 0);
  const totalContratoComBdi = (linhas || []).reduce((s, l) => s + (Number(l.valor_total) || 0), 0);
  const fmtBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const corpo = (linhas || []).map((l) => `
    <tr>
      <td>${l.codigo || ""}</td>
      <td>${l.descricao || ""}</td>
      <td style="text-align:center">${l.unidade || ""}</td>
      <td style="text-align:right">${fmtBR(l.qtde)}</td>
      <td style="text-align:right">${fmtBR(l.execQtde)}</td>
      <td style="text-align:right">${((Number(l.pctExec) || 0) * 100).toFixed(1)}%</td>
      <td style="text-align:right">${fmtBR(l.valorUnit)}</td>
      <td style="text-align:right">${fmtBR(l.valorSemBdi)}</td>
      <td style="text-align:right">${fmtBR(l.valorComBdi)}</td>
    </tr>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Medição — ${obra.codigo || ""}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; }
    body { margin: 0; font-size: 10px; }
    .header img { width: 100%; max-width: 900px; display: block; margin: 0 auto 6px; }
    .titulo { text-align: center; font-size: 15px; font-weight: 800; color: #c21000; letter-spacing: .04em; margin: 6px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #c9c9c9; padding: 3px 6px; font-size: 9.5px; vertical-align: top; }
    th { background: #141414; color: #fff; text-transform: uppercase; font-size: 8.5px; letter-spacing: .03em; }
    .infogrid td:nth-child(odd) { background: #f3f3f1; font-weight: 700; width: 14%; }
    .tot td { background: #f37335; color: #fff; font-weight: 800; font-size: 10.5px; }
    .tot2 td { background: #141414; color: #fff; font-weight: 800; font-size: 10.5px; }
    .assin { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
    .assin div { width: 45%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
  </style></head><body>
    <div class="header"><img src="${TIMBRADO_HEADER}" alt="Miriad"></div>
    <div class="titulo">BOLETIM DE MEDIÇÃO — ${obra.codigo || ""}</div>
    <table class="infogrid">
      <tr><td>Obra</td><td>${obra.codigo || ""}</td><td>Contratante</td><td colspan="3">${obra.contratante || ""}</td></tr>
      <tr><td>Local</td><td colspan="3">${obra.local || ""}</td><td>Contrato</td><td>${obra.contrato || ""}</td></tr>
      <tr><td>Período</td><td>${dataBR(ini)} a ${dataBR(fim)}</td><td>Critério</td><td>${modoLabel}</td><td>Emitido em</td><td>${dataBR(new Date().toISOString())}</td></tr>
    </table>
    <table>
      <thead><tr>
        <th>EAP</th><th>Descrição</th><th style="text-align:center">Unid.</th>
        <th style="text-align:right">Qtde contratada</th><th style="text-align:right">Qtde medida</th><th style="text-align:right">% medido</th>
        <th style="text-align:right">Valor unit. c/BDI</th><th style="text-align:right">Medição s/BDI</th><th style="text-align:right">Medição c/BDI</th>
      </tr></thead>
      <tbody>
        ${corpo || '<tr><td colspan="9">Sem itens na EAP.</td></tr>'}
        <tr class="tot"><td colspan="7" style="text-align:right">TOTAL DA MEDIÇÃO</td>
          <td style="text-align:right">${fmtBR(totalSemBdi)}</td><td style="text-align:right">${fmtBR(totalComBdi)}</td></tr>
        <tr class="tot2"><td colspan="7" style="text-align:right">VALOR TOTAL DO CONTRATO (c/BDI) · % MEDIDO</td>
          <td style="text-align:right" colspan="2">${fmtBR(totalContratoComBdi)} · ${totalContratoComBdi ? ((totalComBdi / totalContratoComBdi) * 100).toFixed(1) : "0.0"}%</td></tr>
      </tbody>
    </table>
    <div class="assin"><div>Responsável MIRIAD<br>${usuarioNome || ""}</div><div>Responsável CONTRATANTE<br>&nbsp;</div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF da medição."); return; }
  w.document.write(html); w.document.close();
}

/* ================================================================
   PDF do BOLETIM DE MEDIÇÃO DE PRESTADOR (BMP) — para envio manual ao
   prestador emitir a NF sobre o líquido medido. Papel timbrado Miriad.
   ================================================================ */
export function gerarPdfBMP(bmp, contrato, obra, usuarioNome) {
  const fmtBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const itens = bmp.itens || [];
  const prestador = contrato?.empresa || contrato?.responsavel || "—";
  const corpo = itens.map((it) => `
    <tr>
      <td>${it.eap_codigo || ""}</td>
      <td>${it.descricao || ""}${it.comentario ? `<br><span style="color:#b26a00;font-size:8.5px">⚠ ${it.comentario}</span>` : ""}</td>
      <td style="text-align:center">${it.unidade || ""}</td>
      <td style="text-align:right">${fmtBR(it.qtde_avancada)}</td>
      <td style="text-align:right">${((Number(it.pct) || 0) * 100).toFixed(1)}%</td>
      <td style="text-align:right">${fmtBR(it.valor_medido)}</td>
      <td style="text-align:right">${it.retencao_valor ? fmtBR(it.retencao_valor) : "—"}</td>
      <td style="text-align:right">${fmtBR(it.liquido)}</td>
    </tr>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>BMP ${bmp.numero || ""} — ${obra?.codigo || ""}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; }
    body { margin: 0; font-size: 10px; }
    .header img { width: 100%; max-width: 780px; display: block; margin: 0 auto 6px; }
    .titulo { text-align: center; font-size: 15px; font-weight: 800; color: #c21000; letter-spacing: .04em; margin: 6px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #c9c9c9; padding: 3px 6px; font-size: 9.5px; vertical-align: top; }
    th { background: #141414; color: #fff; text-transform: uppercase; font-size: 8.5px; letter-spacing: .03em; }
    .infogrid td:nth-child(odd) { background: #f3f3f1; font-weight: 700; width: 16%; }
    .tot td { background: #f37335; color: #fff; font-weight: 800; font-size: 10.5px; }
    .tot2 td { background: #141414; color: #fff; font-weight: 800; font-size: 10.5px; }
    .obs { font-size: 10px; margin: 6px 0 4px; }
    .nota { font-size: 9.5px; color: #555; margin-top: 10px; }
    .assin { margin-top: 34px; display: flex; justify-content: space-between; font-size: 11px; }
    .assin div { width: 45%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
  </style></head><body>
    <div class="header"><img src="${TIMBRADO_HEADER}" alt="Miriad"></div>
    <div class="titulo">BOLETIM DE MEDIÇÃO DE PRESTADOR (BMP) Nº ${bmp.numero || ""}</div>
    <table class="infogrid">
      <tr><td>Obra</td><td>${obra?.codigo || ""}</td><td>Prestador</td><td>${prestador}</td></tr>
      <tr><td>Contrato (OS-i)</td><td>${fmtBR(contrato?.valor)}</td><td>Emitido em</td><td>${dataBR((bmp.criado_em || new Date().toISOString()))}</td></tr>
    </table>
    <table>
      <thead><tr>
        <th>EAP</th><th>Descrição</th><th style="text-align:center">Unid.</th>
        <th style="text-align:right">Qtde medida</th><th style="text-align:right">% avanço</th>
        <th style="text-align:right">Valor medido</th><th style="text-align:right">Retenção</th><th style="text-align:right">Líquido</th>
      </tr></thead>
      <tbody>
        ${corpo || '<tr><td colspan="8">Sem itens medidos.</td></tr>'}
        <tr class="tot"><td colspan="5" style="text-align:right">TOTAL MEDIDO · RETENÇÃO</td>
          <td style="text-align:right">${fmtBR(bmp.total)}</td><td style="text-align:right">${fmtBR(bmp.retencao)}</td><td style="text-align:right"></td></tr>
        <tr class="tot2"><td colspan="7" style="text-align:right">VALOR LÍQUIDO A FATURAR</td>
          <td style="text-align:right">${fmtBR(bmp.liquido)}</td></tr>
      </tbody>
    </table>
    ${bmp.observacao ? `<div class="obs"><b>Observação:</b> ${bmp.observacao}</div>` : ""}
    <div class="nota">Solicitamos a emissão da Nota Fiscal referente a esta medição no valor líquido de <b>R$ ${fmtBR(bmp.liquido)}</b>. A retenção técnica, quando houver, será liberada conforme condições contratuais.</div>
    <div class="assin"><div>Responsável MIRIAD<br>${usuarioNome || ""}</div><div>Ciente — PRESTADOR<br>${prestador}</div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF do boletim."); return; }
  w.document.write(html); w.document.close();
}

/* ================================================================
   PDF da ORDEM DE COMPRA (OC-i) — para envio ao fornecedor.
   Replica o padrão da Miriad: cabeçalho da empresa, dados do fornecedor,
   pedido (cada material vinculado a uma atividade da EAP), condição de
   pagamento com parcelas por dias após o faturamento, dados de entrega e
   o bloco de NF com o CNO (Cadastro Nacional de Obra).
   AJUSTE os dados da empresa abaixo se necessário.
   ================================================================ */
const EMPRESA_OC = {
  nome: "MIRIAD ENGENHARIA, CONSTRUÇÕES E SERVIÇOS LTDA",
  endereco: "R. Dr. Roberto Barrozo, 528 — Centro Cívico — Curitiba/PR — CEP 80.520-092",
  cnpj: "33.863.254/0001-02",
  telefone: "(41) 98845-8401",
  email: "casa@miriadsolutions.com",
};

export function gerarPdfOC(oc, obra) {
  const d = oc.dados_oc || {};
  const forn = d.fornecedor || {};
  const ent = d.entrega || {};
  const fmtBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const baseFat = oc.data_faturamento || oc.data || "";
  const cno = d.cno || obra.cno || "";

  // linhas do pedido (cada material × atividade da EAP)
  const linhas = (oc.itens_eap && oc.itens_eap.length ? oc.itens_eap : []).map((l) => {
    const qt = Number(l.quantidade) || 0, vu = Number(l.valorUnit) || 0, vt = Number(l.valor) || (qt * vu);
    const ehFrete = /frete|carreto/i.test(String(l.material || l.descricao || ""));
    return `<tr>
      <td style="text-align:right">${qt ? fmtBR(qt) : ""}</td>
      <td style="text-align:center">${l.unidade || ""}</td>
      <td>${(l.material || l.descricao || "").replace(/</g, "&lt;")}</td>
      <td style="text-align:right">${vu ? "R$ " + fmtBR(vu) : ""}</td>
      <td style="text-align:right">R$ ${fmtBR(vt)}</td>
      <td><b>${l.eap_codigo || ""}</b>${l.descricao ? ` — ${String(l.descricao).replace(/</g, "&lt;").slice(0, 40)}` : ""}</td>
      <td style="text-align:center">${ehFrete ? "FRETES E CARRETOS" : "MATERIAL"}</td>
    </tr>`;
  }).join("");
  const total = (oc.itens_eap || []).reduce((s, l) => s + (Number(l.valor) || 0), 0);

  // parcelas (condição de pagamento)
  const cond = oc.condicao_pagamento || { tipo: "avista", parcelas: [{ dias: 0, valor: total }] };
  const parcelas = (cond.parcelas && cond.parcelas.length ? cond.parcelas : [{ dias: 0, valor: total }]);
  const formaLabel = cond.tipo === "avista" ? "À vista" : cond.tipo === "entrada_parcelas" ? "Entrada + parcelamento" : "Parcelado";
  const dinamica = `${parcelas.length}x`;
  const parcelasRows = parcelas.map((p, i) => `<tr>
    <td style="text-align:center">${p.entrada ? "Entrada" : `${i + (parcelas[0]?.entrada ? 0 : 1)}/${parcelas.filter((q) => !q.entrada).length}`}</td>
    <td style="text-align:center">${dataBR(addDiasISO(baseFat, p.dias))}</td>
    <td style="text-align:right">R$ ${fmtBR(p.valor)}</td>
    <td style="text-align:center">${p.entrada ? "Entrada" : `${p.dias} dias`}</td>
  </tr>`).join("");

  const linhaInfo = (rotulo, valor) => `<tr><td class="k">${rotulo}</td><td>${valor || "—"}</td></tr>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>OC ${oc.numero || ""} — ${obra.codigo || ""}</title>
  <style>
    @page { size: A4; margin: 10mm 9mm; }
    * { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; }
    body { margin: 0; font-size: 10px; }
    .barra { background: #f37335; color: #fff; font-weight: 800; font-size: 15px; letter-spacing: .06em; text-align: center; padding: 6px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #c9c9c9; padding: 3px 6px; font-size: 9.5px; vertical-align: top; }
    th { background: #141414; color: #fff; text-transform: uppercase; font-size: 8.5px; letter-spacing: .03em; }
    .sec { background: #f37335; color: #fff; font-weight: 800; padding: 4px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; margin: 6px 0 2px; border-radius: 2px; }
    .empresa { display: flex; gap: 14px; align-items: center; border: 1px solid #c9c9c9; padding: 8px 12px; margin-bottom: 8px; }
    .empresa .nome { font-size: 13px; font-weight: 800; color: #c21000; }
    .empresa .l { font-size: 9.5px; line-height: 1.5; }
    .logo { width: 165px; height: auto; flex-shrink: 0; }
    .k { background: #f3f3f1; font-weight: 700; width: 22%; }
    .tot td { background: #f37335; color: #fff; font-weight: 800; }
    .legal { font-size: 7.5px; color: #555; line-height: 1.4; margin-top: 8px; text-align: justify; }
    .assin { margin-top: 26px; display: flex; justify-content: space-between; font-size: 10px; }
    .assin div { width: 45%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
  </style></head><body>
    <div class="barra">ORDEM DE COMPRA</div>
    <table><thead><tr><th>Emissão</th><th>Entrega</th><th>OC nº</th><th>Comprador</th><th>Solicitante</th><th>Solicitação nº</th></tr></thead>
      <tbody><tr>
        <td style="text-align:center">${dataBR(oc.data)}</td>
        <td style="text-align:center">${ent.data ? dataBR(ent.data) : "—"}</td>
        <td style="text-align:center">${oc.numero || "—"}</td>
        <td>${d.comprador || "—"}</td>
        <td>${d.solicitante || "—"}</td>
        <td style="text-align:center">${d.solicitacaoNum || "—"}</td>
      </tr></tbody></table>

    <div class="empresa">
      <img class="logo" src="${LOGO_FULL}" alt="Miriad Construtora" />
      <div class="l">
        <div class="nome">${EMPRESA_OC.nome}</div>
        <div>${EMPRESA_OC.endereco}</div>
        <div>CNPJ: ${EMPRESA_OC.cnpj} · ${EMPRESA_OC.telefone} · ${EMPRESA_OC.email}</div>
        <div><b>Cliente:</b> ${d.cliente || "—"} &nbsp;·&nbsp; <b>Obra:</b> ${obra.codigo || ""} ${obra.nome ? "— " + obra.nome : ""}</div>
      </div>
    </div>

    <div class="sec">Dados do fornecedor</div>
    <table>
      ${linhaInfo("Nome fantasia", oc.fornecedor)}
      ${linhaInfo("Razão social", forn.razao)}
      ${linhaInfo("CNPJ", forn.cnpj)}
      ${linhaInfo("Vendedor", forn.vendedor)}
      ${linhaInfo("Contato do vendedor", forn.contatoVendedor)}
      ${linhaInfo("Endereço", forn.endereco)}
      ${linhaInfo("Contato da loja", forn.contatoLoja)}
    </table>

    <div class="sec">Pedido</div>
    <table><thead><tr>
        <th style="text-align:right">Quant.</th><th style="text-align:center">Unid.</th><th>Item (material)</th>
        <th style="text-align:right">Valor unitário</th><th style="text-align:right">Valor total</th>
        <th>Item da EAP (atividade)</th><th style="text-align:center">Descrição financeira</th>
      </tr></thead>
      <tbody>
        ${linhas || '<tr><td colspan="7">Sem itens.</td></tr>'}
        <tr class="tot"><td colspan="4" style="text-align:right">TOTAL DO PEDIDO</td><td style="text-align:right">R$ ${fmtBR(total)}</td><td colspan="2"></td></tr>
      </tbody></table>

    <div class="sec">Pagamento</div>
    <table><thead><tr><th>Forma de pagamento</th><th>Dinâmica</th><th style="text-align:right">Desconto</th><th style="text-align:right">Total</th></tr></thead>
      <tbody><tr><td>${formaLabel}</td><td style="text-align:center">${dinamica}</td><td style="text-align:right">R$ ${fmtBR(0)}</td><td style="text-align:right"><b>R$ ${fmtBR(total)}</b></td></tr></tbody></table>
    <table><thead><tr><th style="text-align:center">Parcela</th><th style="text-align:center">Vencimento</th><th style="text-align:right">Valor</th><th style="text-align:center">Prazo</th></tr></thead>
      <tbody>${parcelasRows}</tbody></table>

    <div class="sec">Dados de entrega</div>
    <table>
      ${linhaInfo("Endereço de entrega", ent.endereco || obra.local)}
      ${linhaInfo("Responsável", ent.responsavel)}
      ${linhaInfo("Contato", ent.contato)}
      ${linhaInfo("Data de entrega", ent.data ? dataBR(ent.data) : "")}
    </table>

    <div class="sec">Dados adicionais para a NF</div>
    <table>
      ${linhaInfo("Nº CNO (Cadastro Nacional de Obra) — destacar na NF", cno)}
      ${linhaInfo("Ordem de compra nº", oc.numero)}
      ${linhaInfo("Observação", d.observacao)}
    </table>

    <div class="legal">
      Informamos que os pedidos não atendidos dentro do prazo estipulado nesta Ordem de Compra estarão sujeitos às penalidades previstas
      no Código de Defesa do Consumidor (Lei nº 8.078/1990). Em caso de atraso na entrega dos bens especificados nesta ordem sem justa
      causa, será aplicada ao Fornecedor multa de 0,33% (trinta e três centésimos por cento) ao dia sobre o valor total do pedido,
      limitada a 20% (vinte por cento) do valor total da compra. O pagamento da multa não exime o Fornecedor da obrigação de entregar os
      materiais, salvo manifestação expressa do Comprador em sentido contrário.
    </div>

    <div class="assin"><div>MIRIAD — Comprador<br>${d.comprador || ""}</div><div>Fornecedor — de acordo<br>&nbsp;</div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF da OC."); return; }
  w.document.write(html); w.document.close();
}

/* Geração do PDF de ORÇAMENTO a partir de memoriais de custo.
   opcoes: { bdiEmbutido: bool, analitico: bool }
   memoriais: [{ cab: {eap_codigo, descricao, bdi, subtotal_sbdi, subtotal_cbdi}, itens: [...] }] */
export function gerarPdfOrcamento(obra, memoriais, opcoes) {
  const { bdiEmbutido = true, analitico = false } = opcoes || {};
  const fmtBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const SEG = { MATERIAL: "Material", MAO_DE_OBRA: "Mão de obra", EQUIPAMENTO: "Equip./ferram.", LOCACAO: "Locação" };

  let totalGeral = 0;
  const blocos = (memoriais || []).map((m) => {
    const cab = m.cab || {};
    const bdi = Number(cab.bdi) || 0;
    // valores conforme exibição: com BDI (embutido) ou sem
    const valSint = bdiEmbutido ? (Number(cab.subtotal_cbdi) || 0) : (Number(cab.subtotal_sbdi) || 0);
    totalGeral += valSint;

    if (!analitico) {
      // só linha sintética
      return `<tr>
        <td><b>${cab.eap_codigo || ""}</b></td>
        <td>${(cab.descricao || "").replace(/</g, "&lt;")}</td>
        <td style="text-align:center">${cab.tabela_ref || ""}</td>
        <td style="text-align:right"><b>R$ ${fmtBR(valSint)}</b></td>
      </tr>`;
    }
    // analítico: sintética + insumos
    const linhasItens = (m.itens || []).map((it) => {
      const q = Number(it.quantidade) || 0, vu = Number(it.valor_unit) || 0;
      const sub = q * vu;
      const vuShow = bdiEmbutido ? vu * (1 + bdi) : vu;
      const subShow = bdiEmbutido ? sub * (1 + bdi) : sub;
      return `<tr class="ana">
        <td style="padding-left:18px">${SEG[it.segmento] || it.segmento || ""}</td>
        <td>${(it.descricao || "").replace(/</g, "&lt;")}</td>
        <td style="text-align:center">${it.unidade || ""}</td>
        <td style="text-align:right">${q ? fmtBR(q) : ""}</td>
        <td style="text-align:right">${vu ? "R$ " + fmtBR(vuShow) : ""}</td>
        <td style="text-align:right">R$ ${fmtBR(subShow)}</td>
      </tr>`;
    }).join("");
    return `<tr class="sint">
        <td colspan="5"><b>${cab.eap_codigo || ""}</b> — ${(cab.descricao || "").replace(/</g, "&lt;")} ${cab.tabela_ref ? `<span style="font-weight:400">(${cab.tabela_ref})</span>` : ""}</td>
        <td style="text-align:right"><b>R$ ${fmtBR(valSint)}</b></td>
      </tr>${linhasItens}`;
  }).join("");

  const cabecalhoTabela = analitico
    ? `<tr><th>Segmento / EAP</th><th>Descrição</th><th>Un.</th><th style="text-align:right">Qtd</th><th style="text-align:right">V. unit${bdiEmbutido ? "" : " (s/BDI)"}</th><th style="text-align:right">Subtotal</th></tr>`
    : `<tr><th>EAP</th><th>Descrição</th><th style="text-align:center">Tab.</th><th style="text-align:right">Valor${bdiEmbutido ? "" : " (s/BDI)"}</th></tr>`;
  const colspanTotal = analitico ? 5 : 3;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Orçamento — ${obra.codigo || ""}</title>
  <style>
    @page { size: A4; margin: 10mm 9mm; }
    * { font-family: Arial, Helvetica, sans-serif; color: #1c1c1c; }
    body { margin: 0; font-size: 10px; }
    .barra { background: #f37335; color: #fff; font-weight: 800; font-size: 15px; letter-spacing: .06em; text-align: center; padding: 6px; border-radius: 3px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #c9c9c9; padding: 3px 6px; font-size: 9.5px; vertical-align: top; }
    th { background: #141414; color: #fff; text-transform: uppercase; font-size: 8.5px; letter-spacing: .03em; }
    tr.sint td { background: #f3f3f1; font-weight: 700; }
    tr.ana td { font-size: 9px; color: #333; }
    .empresa { display: flex; gap: 14px; align-items: center; border: 1px solid #c9c9c9; padding: 8px 12px; margin-bottom: 8px; }
    .empresa .nome { font-size: 13px; font-weight: 800; color: #c21000; }
    .empresa .l { font-size: 9.5px; line-height: 1.5; }
    .logo { width: 165px; height: auto; flex-shrink: 0; }
    .tot td { background: #f37335; color: #fff; font-weight: 800; font-size: 11px; }
    .obs { font-size: 8px; color: #555; margin-top: 6px; }
  </style></head><body>
    <div class="barra">ORÇAMENTO</div>
    <div class="empresa">
      <img class="logo" src="${LOGO_FULL}" alt="Miriad Construtora" />
      <div class="l">
        <div class="nome">${EMPRESA_OC.nome}</div>
        <div>${EMPRESA_OC.endereco}</div>
        <div>CNPJ: ${EMPRESA_OC.cnpj} · ${EMPRESA_OC.telefone} · ${EMPRESA_OC.email}</div>
        <div><b>Obra:</b> ${obra.codigo || ""} ${obra.nome ? "— " + obra.nome : ""} &nbsp;·&nbsp; <b>Data:</b> ${dataBR(new Date().toISOString())}</div>
      </div>
    </div>
    <table>
      <thead>${cabecalhoTabela}</thead>
      <tbody>
        ${blocos}
        <tr class="tot"><td colspan="${colspanTotal}" style="text-align:right">TOTAL GERAL</td><td style="text-align:right">R$ ${fmtBR(totalGeral)}</td></tr>
      </tbody>
    </table>
    <div class="obs">${bdiEmbutido ? "Valores com BDI embutido." : "Valores de custo, sem BDI."} ${analitico ? "Composição analítica detalhada." : "Resumo sintético por item de EAP."}</div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF do orçamento."); return; }
  w.document.write(html); w.document.close();
}
