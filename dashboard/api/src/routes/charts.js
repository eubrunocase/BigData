import { Router } from 'express';
import { query, toInt, toNumber } from '../db.js';
import { getMeta, MESES } from '../meta.js';
import {
  METRICS,
  gapDefinition,
  gapGroupValues,
} from '../businessRules.js';
import { REGIAO_SQL } from '../regions.js';
import {
  SqlBuilder,
  addFilters,
  factFromSql,
  parseLimit,
  parseOrder,
  parseGrupo,
  requireMetric,
  requireTipoGap,
} from '../filters.js';

export const chartsRouter = Router();

const MIN_SAMPLE = 30;

function metricMeta(metrica) {
  return {
    metrica,
    rotulo: METRICS[metrica].rotulo,
    unidade: METRICS[metrica].unidade,
    casas: METRICS[metrica].casas,
  };
}

function pointFromRow(row) {
  const ano = Number(row.ano);
  const mes = Number(row.mes);
  return {
    ano,
    mes,
    rotulo: `${MESES[mes - 1].slice(0, 3)}/${ano}`,
    admissoes: toInt(row.admissoes),
    desligamentos: toInt(row.desligamentos),
    saldo: toInt(row.saldo),
    rotatividade: toNumber(row.rotatividade, 1),
    salario_medio: toNumber(row.salario_medio, 2),
    idade_media: toNumber(row.idade_media, 1),
    total_movimentacoes: toInt(row.total_movimentacoes),
  };
}

const SERIES_METRICS_SQL = `
  ${METRICS.admissoes.sql}::bigint AS admissoes,
  ${METRICS.desligamentos.sql}::bigint AS desligamentos,
  ${METRICS.saldo.sql}::bigint AS saldo,
  ${METRICS.rotatividade.sql} AS rotatividade,
  ${METRICS.salario_medio.sql} AS salario_medio,
  ${METRICS.idade_media.sql} AS idade_media,
  ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes
`;

/**
 * GET /api/series/mensal?grupo=total|sexo|raca_cor
 * Retorna sempre { grupo, series: [{ grupo, pontos: [...] }] }.
 */
chartsRouter.get('/series/mensal', async (req, res, next) => {
  try {
    const meta = getMeta();
    const grupo = parseGrupo(req.query);
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    const groupColumn = grupo === 'sexo' ? 'p.sexo' : grupo === 'raca_cor' ? 'p.raca_cor' : null;
    const groupSelect = groupColumn ? `${groupColumn} AS grupo,` : '';
    const groupBy = groupColumn ? `${groupColumn}, t.ano, t.mes` : 't.ano, t.mes';
    const groupOrder = groupColumn ? `${groupColumn}, t.ano, t.mes` : 't.ano, t.mes';

    const rows = await query(
      `SELECT ${groupSelect} t.ano, t.mes, ${SERIES_METRICS_SQL}
         ${factFromSql()}
         ${builder.where()}
        GROUP BY ${groupBy}
        ORDER BY ${groupOrder}`,
      builder.params
    );

    if (!groupColumn) {
      res.json({
        grupo: 'total',
        series: [
          {
            grupo: 'Total',
            rotulo: 'Total',
            pontos: rows.map(pointFromRow),
          },
        ],
      });
      return;
    }

    const map = new Map();
    for (const row of rows) {
      const key = row.grupo;
      if (!map.has(key)) {
        map.set(key, { grupo: key, rotulo: key, pontos: [] });
      }
      map.get(key).pontos.push(pointFromRow(row));
    }

    res.json({ grupo, series: [...map.values()] });
  } catch (error) {
    next(error);
  }
});

/** GET /api/ranking/setores?metrica=...&limit=10&order=desc */
chartsRouter.get('/ranking/setores', async (req, res, next) => {
  try {
    const meta = getMeta();
    const metrica = requireMetric(req.query);
    const limit = parseLimit(req.query, 10, 50);
    const order = parseOrder(req.query, 'desc');
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    const rows = await query(
      `SELECT s.cnae_2_secao AS chave,
              COALESCE(NULLIF(s.setor_descricao, ''), s.cnae_2_secao) AS rotulo,
              (${METRICS[metrica].sql}) AS valor,
              ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes
         ${factFromSql()}
         ${builder.where()}
        GROUP BY s.cnae_2_secao, s.setor_descricao
        ORDER BY valor ${order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, total_movimentacoes DESC
        LIMIT ${builder.addParam(limit)}`,
      builder.params
    );

    res.json({
      ...metricMeta(metrica),
      ordem: order,
      items: rows.map((row) => ({
        chave: row.chave,
        rotulo: row.rotulo,
        valor: toNumber(row.valor, METRICS[metrica].casas),
        total_movimentacoes: toInt(row.total_movimentacoes),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/mapa/uf?metrica=... */
chartsRouter.get('/mapa/uf', async (req, res, next) => {
  try {
    const meta = getMeta();
    const metrica = requireMetric(req.query);
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    const rows = await query(
      `SELECT l.sigla_uf AS uf,
              ${REGIAO_SQL} AS regiao,
              (${METRICS[metrica].sql}) AS valor,
              ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes
         ${factFromSql()}
         ${builder.where()}
        GROUP BY l.sigla_uf
        ORDER BY valor DESC NULLS LAST, total_movimentacoes DESC`,
      builder.params
    );

    res.json({
      ...metricMeta(metrica),
      items: rows.map((row) => ({
        uf: row.uf,
        regiao: row.regiao,
        valor: toNumber(row.valor, METRICS[metrica].casas),
        total_movimentacoes: toInt(row.total_movimentacoes),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/interseccao?metrica=... */
chartsRouter.get('/interseccao', async (req, res, next) => {
  try {
    const meta = getMeta();
    const metrica = requireMetric(req.query);
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    const rows = await query(
      `SELECT p.sexo AS sexo,
              p.raca_cor AS raca_cor,
              (${METRICS[metrica].sql}) AS valor,
              ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes
         ${factFromSql()}
         ${builder.where()}
        GROUP BY p.sexo, p.raca_cor
        ORDER BY p.sexo, p.raca_cor`,
      builder.params
    );

    res.json({
      ...metricMeta(metrica),
      sexos: meta.sexos,
      racas: meta.racas,
      celulas: rows.map((row) => ({
        sexo: row.sexo,
        raca_cor: row.raca_cor,
        valor: toNumber(row.valor, METRICS[metrica].casas),
        total_movimentacoes: toInt(row.total_movimentacoes),
      })),
    });
  } catch (error) {
    next(error);
  }
});

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

/** GET /api/gaps/setores?tipo_gap=genero|racial|interseccional */
chartsRouter.get('/gaps/setores', async (req, res, next) => {
  try {
    const meta = getMeta();
    const tipoGap = requireTipoGap(req.query);
    const definition = gapDefinition(tipoGap);
    const grupo = gapGroupValues(definition, meta.grupos_perfil);
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta, {
      ignoreSexo: definition.ignorarSexo,
      ignoreRaca: definition.ignorarRaca,
    });

    const sqlA = groupSalarySql(builder, grupo.grupoA);
    const sqlB = groupSalarySql(builder, grupo.grupoB);

    const rows = await query(
      `SELECT q.*,
              ((q.salario_a - q.salario_b) / NULLIF(q.salario_a, 0)) * 100 AS gap
         FROM (
           SELECT s.cnae_2_secao AS chave,
                  COALESCE(NULLIF(s.setor_descricao, ''), s.cnae_2_secao) AS rotulo,
                  ${sqlA.salario} AS salario_a,
                  ${sqlA.movimentacoes}::bigint AS mov_a,
                  ${sqlB.salario} AS salario_b,
                  ${sqlB.movimentacoes}::bigint AS mov_b
             ${factFromSql()}
             ${builder.where()}
            GROUP BY s.cnae_2_secao, s.setor_descricao
         ) q
        WHERE q.mov_a >= ${MIN_SAMPLE}
          AND q.mov_b >= ${MIN_SAMPLE}
          AND q.salario_a IS NOT NULL
          AND q.salario_b IS NOT NULL
          AND q.salario_a > 0
        ORDER BY gap DESC NULLS LAST
        LIMIT 50`,
      builder.params
    );

    res.json({
      tipo_gap: tipoGap,
      rotulo: definition.rotulo,
      grupo_a: grupo.grupoA.rotulo,
      grupo_b: grupo.grupoB.rotulo,
      minimo_amostra: MIN_SAMPLE,
      items: rows.map((row) => ({
        chave: row.chave,
        rotulo: row.rotulo,
        gap: toNumber(row.gap, 1),
        salario_a: toNumber(row.salario_a, 2),
        salario_b: toNumber(row.salario_b, 2),
        movimentacoes_a: toInt(row.mov_a),
        movimentacoes_b: toInt(row.mov_b),
      })),
    });
  } catch (error) {
    next(error);
  }
});
