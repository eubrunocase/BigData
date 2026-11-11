/**
 * Regras de negócio centrais do dashboard.
 *
 * IMPORTANTE: os textos de sexo e raça/cor não são hardcoded nas queries.
 * Os valores reais são descobertos no banco (SELECT DISTINCT) e mapeados aqui
 * por correspondência case-insensitive e sem acentos.
 */

/** Normaliza texto: minúsculas, sem acentos e sem espaços nas pontas. */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ============================================================
// Mapeamentos de perfil — ajuste apenas estas constantes se o
// dicionário do CAGED mudar.
// ============================================================

export const PERFIL_RULES = {
  MULHER: {
    campo: 'sexo',
    descricao: 'sexo que casa com /mulher|feminin/i',
    testa: (valor) => /mulher|feminin/.test(normalize(valor)),
  },
  HOMEM: {
    campo: 'sexo',
    descricao: 'sexo que casa com /homem|mascul/i',
    testa: (valor) => /homem|mascul/.test(normalize(valor)),
  },
  NEGRA: {
    campo: 'raca_cor',
    descricao: 'raça/cor preta ou parda (ODS 18)',
    testa: (valor) => ['preta', 'parda'].includes(normalize(valor)),
  },
  BRANCA: {
    campo: 'raca_cor',
    descricao: 'raça/cor branca',
    testa: (valor) => normalize(valor) === 'branca',
  },
};

/**
 * Resolve os valores reais de sexo e raça/cor para os grupos de negócio.
 * Falha na inicialização se algum mapeamento não casar com nenhum valor,
 * listando os valores encontrados para facilitar o ajuste.
 */
export function resolvePerfilGroups(sexos = [], racas = []) {
  const pick = (rule, values) => values.filter((valor) => rule.testa(valor));

  const groups = {
    mulheres: pick(PERFIL_RULES.MULHER, sexos),
    homens: pick(PERFIL_RULES.HOMEM, sexos),
    negras: pick(PERFIL_RULES.NEGRA, racas),
    brancas: pick(PERFIL_RULES.BRANCA, racas),
  };

  const faltando = Object.entries(groups)
    .filter(([, values]) => values.length === 0)
    .map(([key]) => key);

  if (faltando.length > 0) {
    throw new Error(
      'Mapeamento de perfil inválido. Não foi possível encontrar valores para: ' +
        faltando.join(', ') +
        '. Sexos encontrados: [' +
        sexos.join(', ') +
        ']. Raças/cor encontradas: [' +
        racas.join(', ') +
        ']. Ajuste PERFIL_RULES em businessRules.js.'
    );
  }

  return groups;
}

// ============================================================
// Classificação de movimentação
// ============================================================

/**
 * Admissão = texto começa com "Admiss" (inclui "Admissão Por Reintegração").
 * Desligamento = qualquer outro valor.
 * Predicado SQL fixo, sem interpolar input.
 */
export const ADMISSAO_SQL = `tm.tipo_movimentacao ILIKE 'admiss%'`;

export function classifyMovement(tipo) {
  return normalize(tipo).startsWith('admiss') ? 'admissao' : 'desligamento';
}

// ============================================================
// Faixas etárias aproximadas (a base só possui idade_media por grupo)
// ============================================================

export const FAIXAS_ETARIAS = [
  { valor: 'ate24', rotulo: 'Até 24 anos', idade_min: null, idade_max: 24 },
  { valor: '25a39', rotulo: '25 a 39 anos', idade_min: 25, idade_max: 39 },
  { valor: '40a54', rotulo: '40 a 54 anos', idade_min: 40, idade_max: 54 },
  { valor: '55mais', rotulo: '55 anos ou mais', idade_min: 55, idade_max: null },
];

// ============================================================
// Expressões SQL fixas para as métricas (whitelist)
// ============================================================

const ADMISSOES_SQL = `COALESCE(SUM(f.total_movimentacoes) FILTER (WHERE ${ADMISSAO_SQL}), 0)`;
const DESLIGAMENTOS_SQL = `COALESCE(SUM(f.total_movimentacoes) FILTER (WHERE NOT (${ADMISSAO_SQL})), 0)`;

export const SALARIO_PONDERADO_SQL = `(
  SUM(f.salario_medio * f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL)
  / NULLIF(SUM(f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL), 0)
)`;

export const IDADE_PONDERADA_SQL = `(
  SUM(f.idade_media * f.total_movimentacoes) FILTER (WHERE f.idade_media IS NOT NULL)
  / NULLIF(SUM(f.total_movimentacoes) FILTER (WHERE f.idade_media IS NOT NULL), 0)
)`;

/**
 * Whitelist de métricas. A chave vem da query string, mas o SQL usado é
 * sempre a expressão fixa definida aqui — nunca interpolação de input.
 */
export const METRICS = {
  salario_medio: {
    rotulo: 'Salário médio',
    sql: SALARIO_PONDERADO_SQL,
    unidade: 'BRL',
    casas: 2,
  },
  rotatividade: {
    rotulo: 'Taxa de rotatividade (proxy)',
    sql: `(100.0 * ${DESLIGAMENTOS_SQL} / NULLIF(SUM(f.total_movimentacoes), 0))`,
    unidade: '%',
    casas: 1,
  },
  saldo: {
    rotulo: 'Saldo (admissões − desligamentos)',
    sql: `(${ADMISSOES_SQL} - ${DESLIGAMENTOS_SQL})`,
    unidade: 'movimentações',
    casas: 0,
  },
  admissoes: {
    rotulo: 'Admissões',
    sql: ADMISSOES_SQL,
    unidade: 'movimentações',
    casas: 0,
  },
  desligamentos: {
    rotulo: 'Desligamentos',
    sql: DESLIGAMENTOS_SQL,
    unidade: 'movimentações',
    casas: 0,
  },
  total_movimentacoes: {
    rotulo: 'Total de movimentações',
    sql: `COALESCE(SUM(f.total_movimentacoes), 0)`,
    unidade: 'movimentações',
    casas: 0,
  },
  idade_media: {
    rotulo: 'Idade média',
    sql: IDADE_PONDERADA_SQL,
    unidade: 'anos',
    casas: 1,
  },
};

/** Retorna a expressão fixa da métrica ou lança erro 400. */
export function metricDefinition(metrica) {
  const definition = METRICS[metrica];
  if (!definition) {
    return null;
  }
  return definition;
}

export const METRIC_KEYS = Object.keys(METRICS);

// ============================================================
// Gaps salariais
// ============================================================

export const GAP_DEFINITIONS = {
  genero: {
    rotulo: 'Gap de gênero',
    grupoA: { rotulo: 'Homens', perfis: ['homens'] },
    grupoB: { rotulo: 'Mulheres', perfis: ['mulheres'] },
    ignorarSexo: true,
    ignorarRaca: false,
  },
  racial: {
    rotulo: 'Gap racial',
    grupoA: { rotulo: 'Pessoas brancas', perfis: ['brancas'] },
    grupoB: { rotulo: 'Pessoas negras (pretas + pardas)', perfis: ['negras'] },
    ignorarSexo: false,
    ignorarRaca: true,
  },
  interseccional: {
    rotulo: 'Gap interseccional',
    grupoA: { rotulo: 'Homens brancos', perfis: ['homens', 'brancas'] },
    grupoB: { rotulo: 'Mulheres negras', perfis: ['mulheres', 'negras'] },
    ignorarSexo: true,
    ignorarRaca: true,
  },
};

export function gapDefinition(tipoGap) {
  return GAP_DEFINITIONS[tipoGap] || null;
}

/** Monta os arrays de valores reais para um grupo de um gap. */
export function gapGroupValues(definition, perfilGroups) {
  const build = (group) => {
    const sexos = group.perfis.includes('homens')
      ? perfilGroups.homens
      : group.perfis.includes('mulheres')
        ? perfilGroups.mulheres
        : null;
    const racas = group.perfis.includes('brancas')
      ? perfilGroups.brancas
      : group.perfis.includes('negras')
        ? perfilGroups.negras
        : null;
    return { rotulo: group.rotulo, sexos, racas };
  };

  return {
    rotulo: definition.rotulo,
    grupoA: build(definition.grupoA),
    grupoB: build(definition.grupoB),
  };
}
