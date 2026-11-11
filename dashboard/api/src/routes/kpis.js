import { Router } from 'express';
import { query, toInt, toNumber } from '../db.js';
import { getMeta } from '../meta.js';
import {
  METRICS,
  gapDefinition,
  gapGroupValues,
} from '../businessRules.js';
import {
  SqlBuilder,
  addFilters,
  factFromSql,
} from '../filters.js';

export const kpisRouter = Router();

function roundPercent(value) {
  return toNumber(value, 1);
}

function roundSalary(value) {
  return toNumber(value, 2);
}

function groupSalarySql(builder, group) {
  const conditions = [];
  if (group.sexos) {
    conditions.push(`p.sexo = ANY(${builder.addParam(group.sexos)})`);
  }
  if (group.racas) {
    conditions.push(`p.raca_cor = ANY(${builder.addParam(group.racas)})`);
  }
  const predicate = conditions.join(' AND ');
  const weighted = `SUM(f.salario_medio * f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL AND ${predicate})`;
  const weight = `SUM(f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL AND ${predicate})`;
  const movimentacoes = `COALESCE(SUM(f.total_movimentacoes) FILTER (WHERE ${predicate}), 0)`;
  return {
    salario: `(${weighted} / NULLIF(${weight}, 0))`,
    movimentacoes,
  };
}

function computeGap(grupoA, grupoB) {
  const a = grupoA.salario;
  const b = grupoB.salario;
  if (a === null || b === null || a <= 0) return null;
  return roundPercent(((a - b) / a) * 100);
}

async function loadGap(tipo, queryParams, meta) {
  const definition = gapDefinition(tipo);
  const grupo = gapGroupValues(definition, meta.grupos_perfil);
  const builder = new SqlBuilder();
  addFilters(builder, queryParams, meta, {
    ignoreSexo: definition.ignorarSexo,
    ignoreRaca: definition.ignorarRaca,
  });

  const sqlA = groupSalarySql(builder, grupo.grupoA);
  const sqlB = groupSalarySql(builder, grupo.grupoB);

  const rows = await query(
    `SELECT ${sqlA.salario} AS salario_a,
            ${sqlA.movimentacoes}::bigint AS mov_a,
            ${sqlB.salario} AS salario_b,
            ${sqlB.movimentacoes}::bigint AS mov_b
       ${factFromSql()}
       ${builder.where()}`,
    builder.params
  );

  const row = rows[0] || {};
  const grupoAResult = {
    rotulo: grupo.grupoA.rotulo,
    salario: roundSalary(row.salario_a),
    movimentacoes: toInt(row.mov_a),
  };
  const grupoBResult = {
    rotulo: grupo.grupoB.rotulo,
    salario: roundSalary(row.salario_b),
    movimentacoes: toInt(row.mov_b),
  };

  const valor = computeGap(grupoAResult, grupoBResult);

  // Se o usuário filtrou a própria dimensão do gap, o KPI é exibido como n/d.
  const filtroProprioAtivo =
    (tipo === 'genero' && hasParam(queryParams, 'sexo')) ||
    (tipo === 'racial' && hasParam(queryParams, 'raca_cor')) ||
    (tipo === 'interseccional' &&
      (hasParam(queryParams, 'sexo') || hasParam(queryParams, 'raca_cor')));

  let motivo = null;
  if (filtroProprioAtivo) {
    motivo =
      'Filtro de sexo/raça/cor ativo: o gap compara grupos e, por isso, é exibido como n/d.';
  } else if (valor === null) {
    motivo = 'Sem dados salariais suficientes para comparar os grupos neste recorte.';
  }

  return {
    valor,
    disponivel: valor !== null && !filtroProprioAtivo,
    motivo,
    grupo_a: grupoAResult,
    grupo_b: grupoBResult,
  };
}

function hasParam(queryParams, key) {
  const raw = queryParams[key];
  if (raw === undefined || raw === null) return false;
  return (Array.isArray(raw) ? raw : [raw]).some((value) => String(value).trim().length > 0);
}

kpisRouter.get('/kpis', async (req, res, next) => {
  try {
    const meta = getMeta();
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    // Participação de mulheres negras (parâmetros adicionados após os filtros).
    const sexoMulher = builder.addParam(meta.grupos_perfil.mulheres);
    const racaNegra = builder.addParam(meta.grupos_perfil.negras);

    const querySql = `
      SELECT
        ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes,
        ${METRICS.admissoes.sql}::bigint AS admissoes,
        ${METRICS.desligamentos.sql}::bigint AS desligamentos,
        ${METRICS.saldo.sql}::bigint AS saldo,
        ${METRICS.rotatividade.sql} AS rotatividade,
        ${METRICS.salario_medio.sql} AS salario_medio,
        ${METRICS.idade_media.sql} AS idade_media,
        COUNT(*)::int AS linhas,
        (
          COALESCE(SUM(f.total_movimentacoes) FILTER (
            WHERE tm.tipo_movimentacao ILIKE 'admiss%'
              AND p.sexo = ANY(${sexoMulher})
              AND p.raca_cor = ANY(${racaNegra})
          ), 0)::numeric
          / NULLIF(SUM(f.total_movimentacoes) FILTER (
            WHERE tm.tipo_movimentacao ILIKE 'admiss%'
          ), 0)
        ) * 100 AS mulher_negra_admissoes,
        (
          COALESCE(SUM(f.total_movimentacoes) FILTER (
            WHERE NOT (tm.tipo_movimentacao ILIKE 'admiss%')
              AND p.sexo = ANY(${sexoMulher})
              AND p.raca_cor = ANY(${racaNegra})
          ), 0)::numeric
          / NULLIF(SUM(f.total_movimentacoes) FILTER (
            WHERE NOT (tm.tipo_movimentacao ILIKE 'admiss%')
          ), 0)
        ) * 100 AS mulher_negra_desligamentos
      ${factFromSql()}
      ${builder.where()}
    `;

    const [totalRow] = await query(querySql, builder.params);

    const [gapGenero, gapRacial, gapInterseccional] = await Promise.all([
      loadGap('genero', req.query, meta),
      loadGap('racial', req.query, meta),
      loadGap('interseccional', req.query, meta),
    ]);

    const admissoes = toInt(totalRow.admissoes);
    const desligamentos = toInt(totalRow.desligamentos);
    const total = toInt(totalRow.total_movimentacoes);

    res.json({
      total_movimentacoes: total,
      admissoes,
      desligamentos,
      saldo: toInt(totalRow.saldo),
      rotatividade: roundPercent(totalRow.rotatividade),
      razao_desligamento_admissao:
        admissoes > 0 ? toNumber(desligamentos / admissoes, 2) : null,
      salario_medio: roundSalary(totalRow.salario_medio),
      idade_media: toNumber(totalRow.idade_media, 1),
      gap_genero: gapGenero,
      gap_racial: gapRacial,
      gap_interseccional: gapInterseccional,
      mulher_negra: {
        participacao_admissoes: roundPercent(totalRow.mulher_negra_admissoes),
        participacao_desligamentos: roundPercent(totalRow.mulher_negra_desligamentos),
      },
      cobertura: {
        linhas: toInt(totalRow.linhas),
        total_movimentacoes: total,
        amostra_pequena: total < 30,
      },
    });
  } catch (error) {
    next(error);
  }
});
