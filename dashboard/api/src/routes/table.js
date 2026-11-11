import { Router } from 'express';
import { query, toInt, toNumber } from '../db.js';
import { getMeta } from '../meta.js';
import { REGIAO_SQL } from '../regions.js';
import {
  SqlBuilder,
  addFilters,
  factFromSql,
  parseLimit,
} from '../filters.js';

export const tableRouter = Router();

/**
 * GET /api/tabela?limit=2000
 * Extensão ao dicionário da SPEC: devolve o recorte atual no grão da fato.
 * O limite evita respostas gigantes no free tier; a paginação é no cliente.
 */
tableRouter.get('/tabela', async (req, res, next) => {
  try {
    const meta = getMeta();
    const limit = parseLimit(req.query, 2000, 5000);
    const builder = new SqlBuilder();
    addFilters(builder, req.query, meta);

    const [countRows, rows] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           ${factFromSql()}
           ${builder.where()}`,
        [...builder.params]
      ),
      query(
        `SELECT t.ano,
                t.mes,
                l.sigla_uf AS uf,
                ${REGIAO_SQL} AS regiao,
                s.cnae_2_secao AS setor,
                COALESCE(NULLIF(s.setor_descricao, ''), s.cnae_2_secao) AS setor_descricao,
                p.sexo,
                p.raca_cor,
                tm.tipo_movimentacao AS tipo,
                f.total_movimentacoes,
                f.salario_medio,
                f.idade_media
           ${factFromSql()}
           ${builder.where()}
          ORDER BY f.total_movimentacoes DESC, t.ano, t.mes
          LIMIT ${builder.addParam(limit)}`,
        builder.params
      ),
    ]);

    res.json({
      total_no_recorte: toInt(countRows[0]?.total),
      limite: limit,
      linhas: rows.map((row) => ({
        ano: Number(row.ano),
        mes: Number(row.mes),
        uf: row.uf,
        regiao: row.regiao,
        setor: row.setor,
        setor_descricao: row.setor_descricao,
        sexo: row.sexo,
        raca_cor: row.raca_cor,
        tipo: row.tipo,
        total_movimentacoes: toInt(row.total_movimentacoes),
        salario_medio: toNumber(row.salario_medio, 2),
        idade_media: toNumber(row.idade_media, 1),
      })),
    });
  } catch (error) {
    next(error);
  }
});
