// Organograma de cargos Miriad (salários base 1º sem, "Sem Dissídio") — semente do PDF oficial.
// Editável em tela por CEO/Diretor (persistido em config "rh_organograma").
const ladder = (conta) => [
  ["Gerente Senior", 9000], ["Gerente Pleno", 7400], ["Gerente Jr", 6500],
  ["Coordenador III", 5800], ["Coordenador II", 5200], ["Coordenador I", 4800],
  ["Analista III", 4200], ["Analista II", 3500], ["Analista I", 3000],
  ["Assistente III", 2700], ["Assistente II", 2400], ["Assistente I", 2200],
  ["Estagiário 6horas", 1800], ["Estagiário 4horas", 1200],
].map(([cargo, salario]) => ({ cargo, salario, conta }));

export const ORGANOGRAMA_PADRAO = {
  "Operacional (MEI)": [
    ["Ajudante I Exp", 1600], ["Ajudante I", 2200], ["Ajudante II", 2400], ["Ajudante III", 2700],
    ["Oficial Júnior", 3000], ["Oficial Pleno", 3300], ["Oficial Sênior", 3650],
    ["Encarregado Junior", 4000], ["Encarregado Pleno", 4200], ["Encarregado Senior", 4600],
    ["Oficial Júnior - N1", 3500], ["Oficial Pleno - N1", 4000], ["Oficial Sênior - N1", 4700],
    ["Oficial Júnior - N2", 3800], ["Oficial Pleno - N2", 4300], ["Oficial Sênior - N2", 5000],
    ["Oficial Júnior - N3", 4300], ["Oficial Pleno - N3", 4800], ["Oficial Sênior - N3", 5500],
    ["Encarregado Junior - N1", 5300], ["Encarregado Pleno - N1", 5700], ["Encarregado Senior - N1", 6300],
    ["Encarregado Junior - N2", 5600], ["Encarregado Pleno - N2", 6000], ["Encarregado Senior - N2", 6600],
    ["Encarregado Junior - N3", 6100], ["Encarregado Pleno - N3", 6500], ["Encarregado Senior - N3", 7100],
  ].map(([cargo, salario]) => ({ cargo, salario, conta: "3020202007" })),
  "Administrativo": ladder("30302020042"),
  "Suprimentos": ladder("30301020006"),
  "Orçamentos": ladder("30301020006"),
  "Planejamento": ladder("30302020007"),
  "Supervisão": [
    ["Gerente", 9000], ["Gerente Jr", 7400], ["Engenheiro Jr", 6500],
    ["Supervisor de obra III", 5800], ["Supervisor de obra II", 5200], ["Supervisor de obra I", 4800],
    ["Analista III", 4200], ["Analista II", 3500], ["Analista I", 3000],
    ["Assistente III", 2700], ["Assistente II", 2400], ["Assistente I", 2200],
    ["Estagiário 6horas", 1800], ["Estagiário 4horas", 1200],
  ].map(([cargo, salario]) => ({ cargo, salario, conta: "30202020007" })),
  "Comercial": ladder("30301020006"),
  "Marketing": ladder("30301020006"),
  "Inovação": ladder("30302020042"),
  "Diretoria": [
    ["Diretor comercial", 9000, "30301010001"], ["Diretor de obras", 9000, "30202010001"],
    ["Diretor de engenharia", 9000, "30302010001"], ["Diretor executivo", 9000, "30302010001"],
  ].map(([cargo, salario, conta]) => ({ cargo, salario, conta })),
};

export const SETORES = Object.keys(ORGANOGRAMA_PADRAO);
