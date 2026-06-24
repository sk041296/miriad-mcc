// /api/data — CRUD genérico do MCC com controle de acesso por papel
import { supabase, sessao, emitirConvite, enviarEmail } from "./_lib.js";

const TABELAS = {
  obras: { ordem: "criado_em", asc: false },
  eap_itens: { ordem: "ordem", asc: true, filtro: "obra_id" },
  contratos_servico: { ordem: "criado_em", asc: false },
  ordens_compra: { ordem: "data", asc: false },
  funcionarios: { ordem: "nome", asc: true },
  rdos: { ordem: "data", asc: false, filtro: "obra_id" },
  restricoes_material: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  sm_itens: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  ss_itens: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  designacoes: { ordem: "criado_em", asc: false },
  envio_semanal: { ordem: "semana", asc: false },
  pos: { ordem: "semana", asc: false, filtro: "obra_id" },
  pmm: { ordem: "mes", asc: false, filtro: "obra_id" },
  boletins_medicao: { ordem: "criado_em", asc: false, filtro: "obra_id" },
  usuarios: { ordem: "nome", asc: true },
};

// Grupos de papéis
const VE_FINANCEIRO   = new Set(["ceo", "diretor", "financeiro"]);
const GERENCIA_USUARIOS = new Set(["ceo", "diretor", "coord_suprimentos", "coord_planejamento", "coord_obras", "coord_orcamentos"]);
const ADMIN_TOTAL     = new Set(["ceo", "diretor"]);
const SUPRIMENTOS     = new Set(["op_suprimentos", "coord_suprimentos"]);
const ALOCA_SUPERVISOR = new Set(["ceo", "diretor", "coord_planejamento"]);
// papéis cujo acesso é restrito às obras em que foram designados
const OBRA_SCOPED     = new Set(["sup_obras", "op_suprimentos", "op_planejamento", "op_orcamento"]);

// segunda-feira (ISO) da semana de uma data, em yyyy-mm-dd
function mondayISO(d = new Date()) {
  const x = new Date(d); const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia); x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
// segunda-feira da próxima semana
function proximaSegundaISO(d = new Date()) {
  const m = new Date(mondayISO(d) + "T00:00:00"); m.setDate(m.getDate() + 7);
  return m.toISOString().slice(0, 10);
}
// primeiro dia do próximo mês (yyyy-mm-01)
function proximoMesISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1); return x.toISOString().slice(0, 10);
}

// quem pode criar qual papel
function podeCriarPapel(criador, alvo) {
  if (criador === "ceo") return true;
  if (criador === "diretor") return alvo !== "diretor" && alvo !== "ceo";
  if (criador === "coord_suprimentos") return alvo === "op_suprimentos";
  if (criador === "coord_planejamento") return alvo === "op_planejamento";
  if (criador === "coord_obras") return alvo === "sup_obras";
  if (criador === "coord_orcamentos") return alvo === "op_orcamento";
  return false;
}

export default async function handler(req, res) {
  const s = sessao(req);
  if (!s) return res.status(401).json({ error: "Sessão inválida ou expirada" });

  // obras às quais o usuário tem acesso (papéis escopados por designação)
  let obrasPermitidas = null;
  if (OBRA_SCOPED.has(s.papel)) {
    const { data: des } = await supabase.from("designacoes").select("obra_id").eq("usuario_id", s.id);
    obrasPermitidas = [...new Set((des || []).map((d) => d.obra_id).filter(Boolean))];
    if (obrasPermitidas.length === 0) obrasPermitidas = ["00000000-0000-0000-0000-000000000000"]; // nenhuma → vazio
  }

  // ---- estado financeiro (key-value) ----
  if ((req.query.t || req.body?.t) === "financeiro_estado") {
    if (!VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito ao Financeiro" });
    if (req.method === "GET") {
      const { data } = await supabase.from("financeiro_estado").select("valor").eq("chave", req.query.chave).maybeSingle();
      return res.status(200).json({ valor: data ? data.valor : null });
    }
    if (req.method === "POST") {
      const { chave, valor } = req.body;
      const { error } = await supabase.from("financeiro_estado").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // tabelas que possuem coluna obra_id (para escopo por designação)
  const TEM_OBRA_ID = new Set(["obras", "eap_itens", "contratos_servico", "ordens_compra", "funcionarios", "rdos", "restricoes_material", "sm_itens", "ss_itens", "pos", "pmm", "boletins_medicao"]);

  if (req.method === "GET") {
    const t = String(req.query.t || "");
    if (t === "ping") return res.status(200).json({ ok: true, papel: s.papel });

    // configuração de acesso por cargo (leitura liberada a qualquer autenticado)
    if (t === "config") {
      const { data } = await supabase.from("app_config").select("valor").eq("chave", req.query.chave || "acesso").maybeSingle();
      return res.status(200).json({ valor: data ? data.valor : null });
    }

    // lista enxuta de colaboradores para os dropdowns de responsável (qualquer autenticado)
    if (t === "colaboradores") {
      const { data, error } = await supabase.from("usuarios").select("id,nome,papel,ativo").eq("ativo", true).order("nome");
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ rows: data });
    }

    const cfg = TABELAS[t];
    if (!cfg) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    let q = supabase.from(t).select(t === "usuarios" ? "id,nome,email,papel,ativo,criado_em,obra_id,senha_definida,travado" : "*").order(cfg.ordem, { ascending: cfg.asc });
    if (cfg.filtro && req.query[cfg.filtro]) q = q.eq(cfg.filtro, req.query[cfg.filtro]);
    if (obrasPermitidas && TEM_OBRA_ID.has(t)) q = q.in(t === "obras" ? "id" : "obra_id", obrasPermitidas);
    // emergenciais só aparecem para Suprimentos depois de autorizadas pelo Coord. de Obras
    if (t === "sm_itens" && SUPRIMENTOS.has(s.papel)) q = q.or("emergencial.eq.false,autorizada_emergencial.eq.true");
    if (t === "ss_itens" && SUPRIMENTOS.has(s.papel)) q = q.or("emergencial.eq.false,autorizada_emergencial.eq.true");
    const { data, error } = await q.limit(20000);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }

  if (req.method === "POST") {
    const { t, row, obra, itens } = req.body || {};

    // alocação de supervisor numa obra + e-mail de comunicação
    if (t === "alocar_supervisor") {
      if (!ALOCA_SUPERVISOR.has(s.papel)) return res.status(403).json({ error: "Sem permissão para alocar supervisores." });
      const { obra_id, supervisor_id } = req.body;
      if (!obra_id || !supervisor_id) return res.status(400).json({ error: "Informe obra e supervisor." });
      await supabase.from("designacoes").upsert({ usuario_id: supervisor_id, obra_id, funcao: "sup_obras" }, { onConflict: "usuario_id,obra_id" });
      const { data: sup } = await supabase.from("usuarios").select("nome,email").eq("id", supervisor_id).maybeSingle();
      const { data: obra } = await supabase.from("obras").select("codigo,nome").eq("id", obra_id).maybeSingle();
      let email = { ok: false, motivo: "sem_destinatario" };
      if (sup && sup.email) {
        email = await enviarEmail({
          to: sup.email,
          subject: `Você foi alocado na obra ${obra?.codigo || ""}`.trim(),
          html: `<div style="font-family:Arial,sans-serif"><h2 style="color:#f37335">Miriad Construction Control</h2><p>Olá, ${(sup.nome || "").split(" ")[0]}.</p><p>Você foi alocado(a) como Supervisor de Obras na obra <b>${obra?.codigo || ""}${obra?.nome ? " — " + obra.nome : ""}</b>.</p><p>Acesse o MCC para registrar o RDO diário e seus planejamentos (POS/PMM) desta obra.</p></div>`,
        });
      }
      return res.status(200).json({ ok: true, email });
    }

    // gravação da configuração de acesso por cargo (apenas CEO/Diretor)
    if (t === "config") {      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem alterar as permissões." });
      const { chave, valor } = req.body;
      const { error } = await supabase.from("app_config").upsert({ chave: chave || "acesso", valor, atualizado_em: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ---- conformidade semanal de envio das SM-is (Supervisor de Obras) ----
    if (t === "confirmar_envio") {
      const semana = mondayISO();
      const { error } = await supabase.from("envio_semanal").upsert({ usuario_id: s.id, semana, confirmado_em: new Date().toISOString() }, { onConflict: "usuario_id,semana" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, semana });
    }
    // ---- reset de senha (CEO/Diretor): invalida a senha e gera novo convite ----
    if (t === "resetar_senha") {
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem resetar senhas." });
      const { id } = req.body;
      const { data: alvo } = await supabase.from("usuarios").select("id,nome,email,papel").eq("id", id).maybeSingle();
      if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });
      if (alvo.papel === "ceo" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode resetar um CEO." });
      const { error } = await supabase.from("usuarios").update({ senha_hash: null, senha_definida: false, travado: false, travado_em: null }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, convite: emitirConvite(alvo) });
    }

    // ---- conformidade do PMM: planejar o próximo mês até o dia 25 + 24h ----
    if (t === "pmm_compliance") {
      const alvoMes = proximoMesISO();
      const agora = new Date();
      const prazo = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59);   // dia 25 do mês atual
      const trava = new Date(prazo.getTime() + 24 * 3600 * 1000);
      const { data: existe } = await supabase.from("pmm").select("id").eq("supervisor_id", s.id).eq("mes", alvoMes).limit(1);
      const preenchido = !!(existe && existe.length);
      let travado = false;
      if (s.papel === "sup_obras" && !preenchido && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        travado = true;
      }
      return res.status(200).json({ mes: alvoMes, preenchido, atrasado: !preenchido && agora > prazo, travado, prazo: prazo.toISOString() });
    }

    // ---- conformidade do POS (Plano Operacional Semanal): prazo sexta-feira + 24h ----
    if (t === "pos_compliance") {
      const alvoSemana = proximaSegundaISO();                                // semana-alvo do POS
      const seg = new Date(mondayISO() + "T00:00:00");
      const sexta = new Date(seg); sexta.setDate(sexta.getDate() + 4); sexta.setHours(23, 59, 59, 0); // sexta 23:59
      const trava = new Date(sexta.getTime() + 24 * 3600 * 1000);
      const agora = new Date();
      const { data: existe } = await supabase.from("pos").select("id").eq("supervisor_id", s.id).eq("semana", alvoSemana).limit(1);
      const preenchido = !!(existe && existe.length);
      let travado = false;
      if (s.papel === "sup_obras" && !preenchido && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        travado = true;
      }
      return res.status(200).json({ semana: alvoSemana, preenchido, atrasado: !preenchido && agora > sexta, travado, prazo: sexta.toISOString() });
    }

    if (t === "sm_compliance") {      const semana = mondayISO();
      const seg = new Date(semana + "T00:00:00");
      const prazo = new Date(seg); prazo.setHours(23, 59, 59, 0);            // segunda 23:59
      const trava = new Date(prazo.getTime() + 24 * 3600 * 1000);            // +24h
      const agora = new Date();
      const { data: conf } = await supabase.from("envio_semanal").select("id").eq("usuario_id", s.id).eq("semana", semana).maybeSingle();
      const confirmado = !!conf;
      let travado = false;
      if (s.papel === "sup_obras" && !confirmado && agora > trava) {
        await supabase.from("usuarios").update({ travado: true, travado_em: agora.toISOString() }).eq("id", s.id);
        travado = true;
      }
      return res.status(200).json({ semana, confirmado, atrasado: !confirmado && agora > prazo, travado, prazo: prazo.toISOString() });
    }

    // criação de obra + EAP em transação lógica
    if (t === "obra_com_eap") {
      const { data: ob, error: e1 } = await supabase.from("obras").insert(obra).select().single();
      if (e1) return res.status(500).json({ error: e1.message });
      if (Array.isArray(itens) && itens.length) {
        const { error: e2 } = await supabase.from("eap_itens").insert(itens.map((i) => ({ ...i, obra_id: ob.id })));
        if (e2) { await supabase.from("obras").delete().eq("id", ob.id); return res.status(500).json({ error: e2.message }); }
      }
      return res.status(200).json({ ok: true, obra: ob });
    }

    // aplica desconto da licitação a TODOS os itens da EAP de uma obra (sobre custo sem BDI)
    if (t === "eap_aplicar_desconto") {
      const { obra_id, desconto } = req.body; // desconto fracionário (0.11)
      const { data: itens } = await supabase.from("eap_itens").select("*").eq("obra_id", obra_id);
      for (const it of itens || []) {
        const csb = Number(it.custo_sem_bdi) || 0;
        const csbDesc = csb * (1 - (Number(desconto) || 0));
        const vu = csbDesc * (1 + (Number(it.bdi) || 0));
        await supabase.from("eap_itens").update({
          desconto: Number(desconto) || 0,
          valor_unit: vu,
          valor_total: vu * (Number(it.qtde) || 0),
          meta_valor: it.meta_pct != null ? csbDesc * (Number(it.meta_pct) || 0) : it.meta_valor,
        }).eq("id", it.id);
      }
      await supabase.from("obras").update({ desconto: Number(desconto) || 0 }).eq("id", obra_id);
      return res.status(200).json({ ok: true, n: (itens || []).length });
    }

    // define meta de custo: % sobre custo SEM BDI (já com desconto), p/ todos ou itens específicos
    if (t === "eap_definir_meta") {
      const { obra_id, meta_pct, ids } = req.body; // ids opcional (subset)
      let q = supabase.from("eap_itens").select("*").eq("obra_id", obra_id);
      if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
      const { data: itens } = await q;
      for (const it of itens || []) {
        const csbDesc = (Number(it.custo_sem_bdi) || 0) * (1 - (Number(it.desconto) || 0));
        await supabase.from("eap_itens").update({
          meta_pct: Number(meta_pct) || 0,
          meta_valor: csbDesc * (Number(meta_pct) || 0),
        }).eq("id", it.id);
      }
      if (!Array.isArray(ids) || !ids.length) await supabase.from("obras").update({ meta_pct_padrao: Number(meta_pct) || 0 }).eq("id", obra_id);
      return res.status(200).json({ ok: true, n: (itens || []).length });
    }

    if (!TABELAS[t] && t !== "rdo_completo") return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "financeiro_estado" && !VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito ao Financeiro" });
    if ((t === "designacoes") && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });

    // RDO + restrições de material (restrições nunca vão ao PDF do cliente)
    if (t === "rdo_completo") {
      const { rdo, restricoes, rdo_id } = req.body;
      let r;
      if (rdo_id) {
        // edição: atualiza o RDO e substitui as restrições vinculadas
        const { data, error } = await supabase.from("rdos").update(rdo).eq("id", rdo_id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        r = data;
        await supabase.from("restricoes_material").delete().eq("rdo_id", rdo_id);
      } else {
        const { data, error } = await supabase.from("rdos").insert(rdo).select().single();
        if (error) return res.status(500).json({ error: error.message });
        r = data;
      }
      if (Array.isArray(restricoes) && restricoes.length) {
        await supabase.from("restricoes_material").insert(restricoes.map((x) => ({ ...x, rdo_id: r.id, obra_id: rdo.obra_id })));
      }
      return res.status(200).json({ row: r });
    }

    // criação de usuário: respeita quem-pode-criar-quem e gera convite (link p/ definir senha)
    if (t === "usuarios") {
      if (!GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
      if (!podeCriarPapel(s.papel, row.papel)) return res.status(403).json({ error: "Você não tem permissão para criar este papel de usuário." });
      const { hashSenha } = await import("./_lib.js");
      const temSenha = !!row.senha;
      const payload = { nome: row.nome, email: String(row.email).toLowerCase(), papel: row.papel,
        senha_hash: temSenha ? hashSenha(row.senha) : null, senha_definida: temSenha };
      const { data, error } = await supabase.from("usuarios").insert(payload).select("id,nome,email,papel,ativo,senha_definida").single();
      if (error) return res.status(500).json({ error: error.message.includes("duplicate") ? "E-mail já cadastrado" : error.message });
      // designações (obras) enviadas junto, se houver
      if (Array.isArray(row.obras) && row.obras.length) {
        await supabase.from("designacoes").insert(row.obras.map((oid) => ({ usuario_id: data.id, obra_id: oid, funcao: row.papel })));
      }
      const convite = temSenha ? null : emitirConvite(data);
      return res.status(200).json({ row: data, convite });
    }

    // SM-i: criar a solicitação também conta como envio da semana (conformidade)
    if (t === "sm_itens") {
      const { data, error } = await supabase.from("sm_itens").insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      if (s.papel === "sup_obras") {
        await supabase.from("envio_semanal").upsert({ usuario_id: s.id, semana: mondayISO(), confirmado_em: new Date().toISOString() }, { onConflict: "usuario_id,semana" });
      }
      return res.status(200).json({ row: data });
    }

    const { data, error } = await supabase.from(t).insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  if (req.method === "PATCH") {
    const { t, id, patch } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios") {
      if (!GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
      // coordenadores só podem (des)travar ou (in)ativar; editar cadastro é CEO/Diretor
      if (!ADMIN_TOTAL.has(s.papel)) {
        const permitido = ["travado", "travado_em", "ativo"];
        if (Object.keys(patch || {}).some((k) => !permitido.includes(k))) return res.status(403).json({ error: "Apenas CEO/Diretor podem editar o cadastro do usuário." });
      } else if (patch && patch.papel && !podeCriarPapel(s.papel, patch.papel)) {
        return res.status(403).json({ error: "Você não pode atribuir este papel." });
      }
      const { data: alvo } = await supabase.from("usuarios").select("papel").eq("id", id).maybeSingle();
      if (alvo && alvo.papel === "ceo" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode alterar um CEO." });
      if (patch && patch.email) patch.email = String(patch.email).toLowerCase();
    }
    if (t === "financeiro_estado" && !VE_FINANCEIRO.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).update(patch).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { t, id } = req.body || {};
    if (!TABELAS[t]) return res.status(400).json({ error: "Recurso não permitido" });
    if (t === "usuarios") {
      if (!ADMIN_TOTAL.has(s.papel)) return res.status(403).json({ error: "Apenas CEO/Diretor podem excluir usuários." });
      if (id === s.id) return res.status(400).json({ error: "Não é possível excluir o próprio usuário." });
      const { data: alvo } = await supabase.from("usuarios").select("papel").eq("id", id).maybeSingle();
      if (alvo?.papel === "ceo") {
        if (s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode excluir um CEO." });
        const { count } = await supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("papel", "ceo");
        if ((count || 0) <= 1) return res.status(400).json({ error: "Não é possível excluir o único CEO." });
      }
      if (alvo?.papel === "diretor" && s.papel !== "ceo") return res.status(403).json({ error: "Apenas o CEO pode excluir um Diretor." });
    }
    if (t === "designacoes" && !GERENCIA_USUARIOS.has(s.papel)) return res.status(403).json({ error: "Acesso restrito" });
    const { error } = await supabase.from(t).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método não suportado" });
}
