import React, { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PieChart, Pie } from "recharts";
import { C, fmt, fmtR, fmtK, pct, sum, dataBR, hojeISO, FATOR_CLIMA, Card, Kpi, Th, Td, ChartTip, listar, Btn, aprovarOrdem, rejeitarOrdem } from "./core.jsx";
import { observacoesPorItem, projecaoItem, dataProjetada } from "./produtividade.js";

/* PAINEL GERAL — consolidação de todas as obras (restrito a gestores) */
export function PainelGeral({ obras, eapPorObra, rdos, restricoes, usuario }) {
  const dados = obras.map((o) => {
    const itens = eapPorObra[o.id] || [];
    const rdosObra = rdos.filter((r) => r.obra_id === o.id);
    const medAcum = sum(rdosObra.flatMap((r) => (r.atividades || []).map((a) => Number(a.medicao) || 0)));
    const contrato = sum(itens.map((i) => Number(i.valor_total) || 0)); // valor_total já é líquido do desconto da licitação
    const obs = observacoesPorItem(rdosObra.map((r) => ({ ...r, obra_id: o.id })), o.id);
    const ultimoRdo = rdosObra.slice().sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    const climaRef = ultimoRdo?.clima || "Ensolarado";
    // projeção: maior data de término entre os itens em andamento
    let maiorDias = 0, itensAndamento = 0;
    const projItens = itens.map((it) => {
      const p = projecaoItem(it, obs[it.codigo], climaRef);
      if (p.executado > 0 && p.restante > 0 && p.diasRestantes != null) { maiorDias = Math.max(maiorDias, p.diasRestantes); itensAndamento++; }
      return { it, p };
    });
    const disciplinasAtivas = [...new Set(rdosObra.flatMap((r) => (r.atividades || []).map((a) => (a.descricao || "").split(" ")[0])).filter(Boolean))];
    const equipeUltimo = ultimoRdo?.equipe || [];
    const restAbertas = restricoes.filter((x) => x.obra_id === o.id && !x.resolvida);
    const hoje = hojeISO();
    const respondidoHoje = rdosObra.some((r) => String(r.data).slice(0, 10) === hoje);
    const diasSemRdo = ultimoRdo ? Math.round((new Date(hoje + "T00:00:00") - new Date(String(ultimoRdo.data).slice(0, 10) + "T00:00:00")) / 86400000) : null;
    return { o, itens, medAcum, contrato, aFaturar: Math.max(contrato - medAcum, 0), perc: contrato ? medAcum / contrato : 0, climaRef, maiorDias,
      itensAndamento, projItens, ultimoRdo, equipeUltimo, restAbertas, nRdos: rdosObra.length, respondidoHoje, diasSemRdo,
      terminoProj: maiorDias > 0 ? dataProjetada(maiorDias) : null };
  });
  const totalMed = sum(dados.map((d) => d.medAcum)), totalContrato = sum(dados.map((d) => d.contrato));
  const totalRestr = sum(dados.map((d) => d.restAbertas.length));
  const cores = [C.laranja, C.preto, C.vermelho, "#fb923c", "#525252", C.azul];
  const semRdoHoje = dados.filter((d) => !d.respondidoHoje);
  const corRdo = (d) => d.respondidoHoje ? C.verde : (d.diasSemRdo == null ? C.dim : d.diasSemRdo >= 3 ? C.vermelho : C.amareloAlerta);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PendenciasAprovacao usuario={usuario} obras={obras} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi dark label="Valor total dos contratos (à faturar)" value={fmtR(totalContrato)} sub={`${obras.length} obras · ${sum(dados.map((d) => d.nRdos))} RDOs`} />
        <Kpi label="Executado — reconhecido em RDO" value={fmtR(totalMed)} accent={C.verde} />
        <Kpi label="Saldo a faturar" value={fmtR(totalContrato - totalMed)} accent={C.laranja} />
        <Kpi label="% executado geral" value={totalContrato ? pct(totalMed / totalContrato) : "—"} accent={C.azul} />
        <Kpi label="Restrições de material abertas" value={totalRestr} accent={totalRestr > 0 ? C.vermelho : C.verde} sub="impedindo atividades" />
      </div>

      {obras.length > 0 && (
        <Card title="Controle de RDOs — último relatório e pendências do dia"
          right={<span style={{ fontSize: 12, fontWeight: 700, color: semRdoHoje.length ? C.vermelho : C.verde }}>{semRdoHoje.length ? `${semRdoHoje.length} sem RDO hoje` : "todas em dia"}</span>}>
          {semRdoHoje.length > 0 && (
            <div style={{ background: `${C.amareloAlerta}1a`, border: `1px solid ${C.amareloAlerta}66`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12 }}>
              <b style={{ color: C.amareloAlerta }}>⚠ RDO não respondido hoje ({dataBR(hojeISO())}):</b> <span style={{ color: C.texto }}>{semRdoHoje.map((d) => d.o.codigo).join(" · ")}</span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Obra</Th><Th>Contratante</Th><Th>Status hoje</Th><Th>Último RDO</Th><Th right>Nº</Th><Th right>Há quantos dias</Th><Th right>Total RDOs</Th></tr></thead>
            <tbody>{dados.slice().sort((a, b) => (a.respondidoHoje === b.respondidoHoje ? ((b.diasSemRdo ?? 999) - (a.diasSemRdo ?? 999)) : a.respondidoHoje ? 1 : -1)).map((d) => (
              <tr key={d.o.id}>
                <Td style={{ fontWeight: 600 }}>{d.o.codigo}</Td>
                <Td style={{ fontSize: 12, color: C.dim }}>{d.o.contratante || "—"}</Td>
                <Td><span style={{ background: d.respondidoHoje ? `${C.verde}1c` : `${C.vermelho}14`, color: d.respondidoHoje ? C.verde : C.vermelho, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{d.respondidoHoje ? "✓ respondido" : "● pendente"}</span></Td>
                <Td>{d.ultimoRdo ? dataBR(d.ultimoRdo.data) : "—"}</Td>
                <Td right>{d.ultimoRdo?.numero || "—"}</Td>
                <Td right color={corRdo(d)} style={{ fontWeight: 700 }}>{d.diasSemRdo == null ? "sem RDO" : d.diasSemRdo === 0 ? "hoje" : `${d.diasSemRdo}d`}</Td>
                <Td right>{d.nRdos}</Td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {obras.length > 0 && (
        <Card title="Avanço físico-financeiro por obra">
          <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 54)}>
            <BarChart data={dados.map((d) => ({ nome: d.o.codigo, "Executado": d.medAcum, "A executar": Math.max(d.contrato - d.medAcum, 0) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={C.linha} strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fill: C.dim, fontSize: 10 }} /><YAxis type="category" dataKey="nome" width={150} tick={{ fill: C.dim, fontSize: 11 }} />
              <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Executado" stackId="a" fill={C.laranja} radius={[0, 0, 0, 0]} /><Bar dataKey="A executar" stackId="a" fill={C.cinza2} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {obras.length > 0 && (
        <Card title="À faturar × Executado por contrato">
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Obra</Th><Th>Contratante</Th><Th right>Valor do contrato</Th><Th right>Executado (RDO)</Th><Th right>Saldo a faturar</Th><Th right>% exec.</Th></tr></thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.o.id}>
                  <Td style={{ fontWeight: 600 }}>{d.o.codigo}</Td>
                  <Td style={{ fontSize: 12, color: C.dim }}>{d.o.contratante || "—"}</Td>
                  <Td right>{fmtR(d.contrato)}</Td>
                  <Td right color={C.verde} style={{ fontWeight: 700 }}>{fmtR(d.medAcum)}</Td>
                  <Td right color={C.laranja} style={{ fontWeight: 700 }}>{fmtR(d.aFaturar)}</Td>
                  <Td right color={d.perc >= 1 ? C.verde : C.texto}>{pct(d.perc, 0)}</Td>
                </tr>
              ))}
              <tr style={{ background: C.preto }}>
                <Td colSpan={2} style={{ color: "#fff", fontWeight: 800 }}>TOTAL</Td>
                <Td right style={{ color: "#fff", fontWeight: 800 }}>{fmtR(totalContrato)}</Td>
                <Td right style={{ color: C.verde, fontWeight: 800 }}>{fmtR(totalMed)}</Td>
                <Td right style={{ color: C.laranja, fontWeight: 800 }}>{fmtR(totalContrato - totalMed)}</Td>
                <Td right style={{ color: "#fff", fontWeight: 800 }}>{totalContrato ? pct(totalMed / totalContrato, 0) : "—"}</Td>
              </tr>
            </tbody>
          </table></div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>Valor do contrato = soma da EAP com BDI, já líquida do desconto da licitação. Executado = medição reconhecida nos RDOs. Saldo a faturar = contrato − executado.</div>
        </Card>
      )}

      {dados.map((d) => (
        <Card key={d.o.id} title={`${d.o.codigo} · ${d.o.nome}`} right={<span style={{ fontSize: 12, color: C.dim }}>{d.o.contratante}</span>}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label="Execução" value={pct(d.perc)} sub={`${fmtR(d.medAcum)} de ${fmtR(d.contrato)}`} />
            <Kpi label="Saldo a faturar" value={fmtR(d.aFaturar)} accent={C.laranja} sub={`contrato ${fmtR(d.contrato)}`} />
            <Kpi label="Última condição climática" value={d.climaRef} sub={d.ultimoRdo ? `RDO de ${dataBR(d.ultimoRdo.data)}` : "sem RDO"} />
            <Kpi label="Equipe presente (último RDO)" value={(d.equipeUltimo.length || d.ultimoRdo?.efetivo || 0) + ""} sub={d.equipeUltimo.slice(0, 3).map((m) => m.ocupacao).join(", ") || "—"} />
            <Kpi label="Projeção de término" value={d.terminoProj ? dataBR(d.terminoProj) : "—"} accent={C.azul} sub={d.maiorDias ? `~${d.maiorDias} dias úteis · ${d.itensAndamento} itens em curso` : "sem produtividade suficiente"} />
          </div>
          <div style={{ height: 12, background: C.cinza, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ width: `${Math.min(d.perc * 100, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.laranja}, ${C.vermelho})` }} />
          </div>

          {d.restAbertas.length > 0 && (
            <div style={{ background: `${C.vermelho}0e`, border: `1px solid ${C.vermelho}44`, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              <b style={{ color: C.vermelho, fontSize: 12 }}>⚠ {d.restAbertas.length} restrição(ões) de material em aberto:</b>
              <span style={{ fontSize: 12, color: C.texto }}> {d.restAbertas.map((r) => `${r.eap_codigo} (${r.material}, pedido ${dataBR(r.data_solicitacao)})`).join(" · ")}</span>
            </div>
          )}

          <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Itens em andamento — produtividade e projeção</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>EAP</Th><Th>Atividade</Th><Th>Amb.</Th><Th right>Exec./Contr.</Th><Th right>%</Th><Th right>Produt./dia</Th><Th right>Dias restantes</Th></tr></thead>
            <tbody>{d.projItens.filter((x) => x.p.executado > 0).slice(0, 30).map(({ it, p }) => (
              <tr key={it.id}><Td>{it.codigo}</Td><Td style={{ fontSize: 12 }}>{it.descricao.length > 44 ? it.descricao.slice(0, 44) + "…" : it.descricao}</Td>
                <Td>{it.ambiente === "externo" ? "🌦️" : "—"}</Td><Td right>{fmt(p.executado)}/{fmt(p.contratado)} {it.unidade}</Td>
                <Td right color={p.pct >= 1 ? C.verde : C.texto}>{pct(p.pct, 0)}</Td>
                <Td right color={C.azul}>{p.prodEfetiva ? `${fmt(p.prodEfetiva)} ${it.unidade}` : "—"}{p.ambiente === "externo" && p.prodMedia ? ` (${pct(FATOR_CLIMA[p.clima] ?? 1, 0)} clima)` : ""}</Td>
                <Td right style={{ fontWeight: 700 }} color={p.diasRestantes == null ? C.dim : p.diasRestantes > 30 ? C.vermelho : C.preto}>{p.restante <= 0 ? "✓ concluído" : p.diasRestantes != null ? `${p.diasRestantes}d` : "s/ dados"}</Td></tr>
            ))}
            {d.projItens.filter((x) => x.p.executado > 0).length === 0 && <tr><Td colSpan={7} color={C.dim} style={{ padding: 12 }}>Sem avanços registrados ainda.</Td></tr>}</tbody>
          </table>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>Produtividade = média das 3 últimas observações no mesmo clima ({d.climaRef}). Itens externos têm a produtividade ponderada pelo fator do clima.</div>
        </Card>
      ))}
      {obras.length === 0 && <Card title="Sem obras"><div style={{ fontSize: 13, color: C.dim }}>Cadastre uma obra e a EAP no módulo Operacional → Obras.</div></Card>}
    </div>
  );
}

/* ============================================================
   Espelho de pendências de aprovação no Painel Geral
   Visível para Coord. Suprimentos e Diretoria.
   ============================================================ */
function PendenciasAprovacao({ usuario, obras }) {
  const [ocs, setOcs] = useState([]);
  const [oss, setOss] = useState([]);
  const [busy, setBusy] = useState(null);
  const ehSup = usuario && usuario.papel === "coord_suprimentos";
  const ehDir = usuario && (usuario.papel === "ceo" || usuario.papel === "diretor");
  const podeVer = ehSup || ehDir;

  const carregar = () => {
    if (!podeVer) return;
    Promise.all([listar("ordens_compra"), listar("contratos_servico")])
      .then(([a, b]) => {
        setOcs(a.filter((x) => (x.status_aprovacao || "aprovada") === "aguardando"));
        setOss(b.filter((x) => (x.status_aprovacao || "aprovada") === "aguardando"));
      }).catch(() => {});
  };
  useEffect(carregar, []);

  if (!podeVer) return null;

  const nomeObra = (id) => (obras.find((o) => o.id === id) || {}).codigo || "—";
  // pendentes da MINHA alçada = ainda não aprovei
  const minhasOc = ocs.filter((x) => ehSup ? !x.aprov_suprimentos_por : !x.aprov_diretor_por);
  const minhasOs = oss.filter((x) => ehSup ? !x.aprov_suprimentos_por : !x.aprov_diretor_por);
  const total = minhasOc.length + minhasOs.length;

  if (total === 0) return null;

  const aprovar = async (tabela, id) => {
    setBusy(id);
    try { const r = await aprovarOrdem(tabela, id); carregar(); if (r && r.status === "aprovada") alert(`Aprovada! ${r.ops_geradas || 0} OP(s) gerada(s).`); }
    catch (e) { alert("Erro: " + (e.message || e)); }
    setBusy(null);
  };

  const linha = (x, tabela, valorLabel) => (
    <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", background: C.branco, borderRadius: 8, border: `1px solid ${C.linha}` }}>
      <div style={{ fontSize: 12.5 }}>
        <b>{x.numero || x.empresa || "—"}</b> · {nomeObra(x.obra_id)} · {x.fornecedor || x.empresa || "—"}
        <span style={{ color: C.dim }}> · {valorLabel}</span>
        <span style={{ marginLeft: 8, fontSize: 10.5, color: C.dim }}>Sup {x.aprov_suprimentos_por ? "✓" : "—"} · Dir {x.aprov_diretor_por ? "✓" : "—"}</span>
      </div>
      <Btn small onClick={() => aprovar(tabela, x.id)} disabled={busy === x.id}>Aprovar</Btn>
    </div>
  );

  return (
    <Card title={`⚠ ${total} ordem(ns) aguardando sua aprovação`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {minhasOc.map((x) => linha(x, "ordens_compra", fmtR(x.valor)))}
        {minhasOs.map((x) => linha(x, "contratos_servico", fmtR(x.valor)))}
      </div>
    </Card>
  );
}
