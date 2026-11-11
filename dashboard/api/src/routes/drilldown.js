import { Router } from 'express';
import { query, toInt, toNumber } from '../db.js';
import { getMeta } from '../meta.js';
import { METRICS } from '../businessRules.js';
import { REGIAO_SQL, ufsDaRegiao } from '../regions.js';
import {
  SqlBuilder,
  addFilters,
  factFromSql,
  requireMetric,
  requireNivel,
  requirePai,
} from '../filters.js';

export const drilldownRouter = Router();

/** GET /api/drilldown?nivel=regiao|uf|setor&pai=...&metrica=... */
drilldownRouter.get('/drilldown', async (req, res, next) => {
  try {
    const meta = getMeta();
    const nivel = requireNivel(req.query);
    const pai = requirePai(req.query, nivel, meta);
    const metrica = requireMetric(req.query);

    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    let selectColumn;
    let groupColumn;
    let orderColumn = 'valor DESC NULLS LAST, total_movimentacoes DESC';

    if (nivel === 'regiao') {
      selectColumn = `${REGIAO_SQL} AS chave, ${REGIAO_SQL} AS rotulo`;
      groupColumn = REGIAO_SQL;
    } else if (nivel === 'uf') {
      builder.add(`l.sigla_uf = ANY(${builder.addParam(ufsDaRegiao(pai))})`);
      selectColumn = `l.sigla_uf AS chave, l.sigla_uf AS rotulo`;
      groupColumn = 'l.sigla_uf';
    } else {
      builder.add(`l.sigla_uf = ${builder.addParam(pai)}`);
      selectColumn = `s.cnae_2_secao AS chave,
                      COALESCE(NULLIF(s.setor_descricao, ''), s.cnae_2_secao) AS rotulo`;
      groupColumn = 's.cnae_2_secao, s.setor_descricao';
    }

    const rows = await query(
      `SELECT ${selectColumn},
              (${METRICS[metrica].sql}) AS valor,
              ${METRICS.total_movimentacoes.sql}::bigint AS total_movimentacoes
         ${factFromSql()}
         ${builder.where()}
        GROUP BY ${groupColumn}
        ORDER BY ${orderColumn}`,
      builder.params
    );

    res.json({
      nivel,
      pai,
      metrica,
      rotulo_metrica: METRICS[metrica].rotulo,
      unidade: METRICS[metrica].unidade,
      casas: METRICS[metrica].casas,
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
