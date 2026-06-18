import { TIMBRADO_HEADER } from "./timbrado.js";
import { dataBR } from "./core.jsx";

/* Geração do PDF do RDO no papel timbrado da Miriad (via janela de impressão do navegador).
   IMPORTANTE: as restrições de material NÃO entram aqui — são internas, não vão ao cliente. */
export function gerarPdfRdo(rdo, obra, usuarioNome) {
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

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>RDO ${rdo.numero || ""} — ${obra.codigo || ""}</title>
  <style>
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
    .obs { border: 1px solid #c9c9c9; padding: 6px 8px; min-height: 28px; font-size: 10.5px; white-space: pre-wrap; }
  </style></head><body>
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
        <div style="padding:3px 5px;font-size:9px">${f.eap_codigo ? `<b>EAP ${f.eap_codigo}</b> ` : ""}${(f.legenda || "").replace(/</g, "&lt;")}</div>
      </div>`).join("")}</div>` : ""}
    <div class="assin"><div>Responsável MIRIAD<br>${usuarioNome || rdo.responsavel_nome || ""}</div><div>Responsável CONTRATANTE<br>&nbsp;</div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF do RDO."); return; }
  w.document.write(html); w.document.close();
}
