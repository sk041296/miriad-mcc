import { FATOR_CLIMA } from "./core.jsx";

/* Produtividade e projeção de término por item da EAP.
   Regra acordada: produtividade diária = média das 3 últimas observações do MESMO projeto
   na MESMA condição climática. Para itens EXTERNOS, o clima pondera a produtividade
   (dia de chuva rende fração de um dia ensolarado), via FATOR_CLIMA. */

export function observacoesPorItem(rdos, obraId) {
  // retorna { eapCodigo: [{data, clima, qtde}] } com avanços > 0
  const map = {};
  rdos.filter((r) => r.obra_id === obraId).sort((a, b) => (a.data < b.data ? -1 : 1)).forEach((r) => {
    (r.atividades || []).forEach((a) => {
      const q = Number(a.qtde_dia ?? a.avanco ?? 0);
      if (q > 0) (map[a.eap] = map[a.eap] || []).push({ data: r.data, clima: r.clima || "Ensolarado", qtde: q });
    });
  });
  return map;
}

// produtividade média (unid/dia) das últimas 3 observações do mesmo clima; fallback p/ qualquer clima
export function produtividadeMedia(observacoes, clima) {
  if (!observacoes || observacoes.length === 0) return null;
  const mesmo = observacoes.filter((o) => o.clima === clima);
  const base = (mesmo.length >= 3 ? mesmo : observacoes).slice(-3);
  if (base.length === 0) return null;
  const media = base.reduce((s, o) => s + o.qtde, 0) / base.length;
  return { media, n: base.length, mesmoClima: mesmo.length >= 3 };
}

/* Projeção de término de um item:
   - executado = soma das qtdes; restante = qtde contratada − executado
   - produtividade efetiva: se externo, multiplica pelo fator do clima de referência
   - dias restantes = restante / produtividade efetiva */
export function projecaoItem(item, observacoes, climaReferencia = "Ensolarado") {
  const executado = (observacoes || []).reduce((s, o) => s + o.qtde, 0);
  const contratado = Number(item.qtde) || 0;
  const restante = Math.max(contratado - executado, 0);
  const prod = produtividadeMedia(observacoes, climaReferencia);
  if (!prod || prod.media <= 0) return { executado, contratado, restante, pct: contratado ? executado / contratado : 0, prodMedia: null, prodEfetiva: null, diasRestantes: null, clima: climaReferencia };
  const fator = item.ambiente === "externo" ? (FATOR_CLIMA[climaReferencia] ?? 1) : 1;
  const prodEfetiva = prod.media * fator;
  const diasRestantes = prodEfetiva > 0 ? Math.ceil(restante / prodEfetiva) : null;
  return { executado, contratado, restante, pct: contratado ? executado / contratado : 0,
    prodMedia: prod.media, prodEfetiva, diasRestantes, n: prod.n, mesmoClima: prod.mesmoClima, ambiente: item.ambiente, clima: climaReferencia };
}

export function dataProjetada(diasUteisRestantes, base = new Date()) {
  if (diasUteisRestantes === null || diasUteisRestantes === undefined) return null;
  const d = new Date(base); d.setDate(d.getDate() + diasUteisRestantes);
  return d.toISOString().slice(0, 10);
}
