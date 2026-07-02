import React, { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PieChart, Pie } from "recharts";
import { C, fmt, fmtR, fmtK, pct, sum, dataBR, hojeISO, FATOR_CLIMA, Card, Kpi, Th, Td, ChartTip, listar, Btn, aprovarOrdem, rejeitarOrdem, furosDeVerba, decidirAcaoUsuario } from "./core.jsx";
import { observacoesPorItem, projecaoItem, dataProjetada } from "./produtividade.js";

/* PAINEL GERAL — consolidação de todas as obras (restrito a gestores) */
export function PainelGeral({ obras, eapPorObra, rdos, restricoes, usuario, ocs, contratos }) {
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
      <PendenciasAcoesUsuario usuario={usuario} />
      <PainelFurosVerba usuario={usuario} obras={obras} eapPorObra={eapPorObra} ocs={ocs} contratos={contratos} />
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
  const ehSup = usuario && (usuario.papel === "coord_suprimentos" || usuario.papel === "coord_planejamento");
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

/* ============================================================
   Fatia D — Painel de furos de verba (estouro do orçamento)
   Visível para CEO, diretoria e coordenadores.
   Gráfico do excesso por EAP + listagem das OCs/OSs agrupadas.
   ============================================================ */
function PainelFurosVerba({ usuario, obras, eapPorObra, ocs, contratos }) {
  const [aberto, setAberto] = useState({});
  const papel = usuario && usuario.papel;
  const podeVer = ["ceo", "diretor", "coord_suprimentos", "coord_planejamento", "coord_obras", "coord_orcamentos"].includes(papel);
  if (!podeVer) return null;

  const furos = furosDeVerba(obras || [], eapPorObra || {}, ocs || [], contratos || []);
  if (!furos.length) return null;

  const totalExcesso = sum(furos.map((f) => f.excesso));
  const totalForaVerba = sum(furos.map((f) => f.consumido));
  const dadosGrafico = furos.slice(0, 12).map((f) => ({ nome: `${f.obraCodigo} · ${f.eap}`, excesso: f.excesso }));

  return (
    <Card title={`⚠ Custos fora da verba (${furos.length} ${furos.length === 1 ? "item" : "itens"} de EAP)`}>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Kpi label="Total contratado nas EAPs estouradas" value={fmtR(totalForaVerba)} accent={C.laranja} />
        <Kpi label="Excesso total sobre a verba" value={fmtR(totalExcesso)} accent={C.vermelho} />
        <Kpi label="Itens de EAP acima da verba" value={String(furos.length)} accent={C.vermelho} />
      </div>

      <div style={{ height: 230, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosGrafico} margin={{ top: 8, right: 12, left: 12, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.linha} />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
            <YAxis tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTip />} formatter={(v) => fmtR(v)} />
            <Bar dataKey="excesso" fill={C.vermelho} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {furos.map((f) => {
          const chave = f.obraId + ":" + f.eap;
          const exp = !!aberto[chave];
          return (
            <div key={chave} style={{ border: `1px solid ${C.linha}`, borderRadius: 8, overflow: "hidden" }}>
              <div onClick={() => setAberto((a) => ({ ...a, [chave]: !exp }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", background: `${C.vermelho}08` }}>
                <div style={{ fontSize: 12.5 }}>
                  <b>{exp ? "▾" : "▸"} {f.obraCodigo} · EAP {f.eap}</b>
                  <span style={{ color: C.dim }}> — {(f.descricao || "").slice(0, 44)}</span>
                </div>
                <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  <span style={{ color: C.dim }}>verba {fmtR(f.verba)} · consumido </span>
                  <b style={{ color: C.vermelho }}>{fmtR(f.consumido)}</b>
                  <span style={{ color: C.vermelho, fontWeight: 800 }}> ({(f.pct * 100).toFixed(0)}%)</span>
                </div>
              </div>
              {exp && (
                <div style={{ padding: "4px 12px 10px" }}>
                  <div style={{ fontSize: 11, color: C.dim, margin: "6px 0" }}>{f.ordens.length} ordem(ns) nesta EAP · excesso de {fmtR(f.excesso)}:</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><Th>Tipo</Th><Th>Nº</Th><Th>Fornecedor/Empresa</Th><Th right>Valor na EAP</Th><Th>Aprovação</Th></tr></thead>
                    <tbody>{f.ordens.map((o) => (
                      <tr key={o.tipo + o.id}>
                        <Td>{o.tipo}</Td>
                        <Td>{o.numero || "—"}</Td>
                        <Td style={{ fontSize: 12 }}>{o.nome || "—"}</Td>
                        <Td right color={C.laranja}>{fmtR(o.valor)}</Td>
                        <Td style={{ fontSize: 11 }}>{o.status_aprovacao === "aguardando" ? "● aguardando" : o.status_aprovacao === "rejeitada" ? "✕ rejeitada" : "✓ aprovada"}</Td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* Aprovação de ações de usuário solicitadas pelo Coord. de Planejamento (só diretoria) */
function PendenciasAcoesUsuario({ usuario }) {
  const [acoes, setAcoes] = useState([]);
  const [busy, setBusy] = useState(null);
  const ehDiretor = usuario && (usuario.papel === "ceo" || usuario.papel === "diretor");
  const carregar = () => listar("acoes_usuario_pendentes").then((xs) => setAcoes((xs || []).filter((a) => a.status === "aguardando"))).catch(() => setAcoes([]));
  useEffect(() => { if (ehDiretor) carregar(); }, []);
  if (!ehDiretor || acoes.length === 0) return null;

  const decidir = async (a, aprovar) => {
    if (!aprovar && !confirm("Rejeitar esta solicitação?")) return;
    setBusy(a.id);
    try { await decidirAcaoUsuario(a.id, aprovar); carregar(); }
    catch (e) { alert("Erro: " + (e.message || e)); }
    setBusy(null);
  };

  return (
    <Card title={`⚠ Ações de usuário aguardando sua aprovação (${acoes.length})`}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>Solicitações de criação/exclusão de usuário feitas pelo Coord. de Planejamento.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {acoes.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${C.linha}`, borderRadius: 8 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: a.tipo === "excluir" ? C.vermelho : C.verde }}>{a.tipo === "excluir" ? "Excluir" : "Criar"}</span>
              <span> — {a.descricao}</span>
            </div>
            <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
              <Btn small onClick={() => decidir(a, true)} disabled={busy === a.id}>Aprovar</Btn>
              <Btn small kind="ghost" onClick={() => decidir(a, false)} disabled={busy === a.id}>Rejeitar</Btn>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
