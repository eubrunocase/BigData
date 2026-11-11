import { query, toInt } from './db.js';
import { REGIOES, regiaoDaUf } from './regions.js';
import {
  FAIXAS_ETARIAS,
  classifyMovement,
  resolvePerfilGroups,
} from './businessRules.js';

export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

let meta = null;

function sortPt(a, b) {
  return a.localeCompare(b, 'pt-BR');
}

/**
 * Carrega os valores reais das dimensões. Os textos de sexo/raça/cor nunca
 * são hardcoded: vêm do banco e são mapeados por businessRules.js.
 */
export async function loadMeta() {
  const [tempos, ufs, setores, perfis, tipos, totais] = await Promise.all([
    query('SELECT ano, mes FROM dim_tempo ORDER BY ano, mes'),
    query('SELECT sigla_uf FROM dim_localizacao ORDER BY sigla_uf'),
    query(
      'SELECT cnae_2_secao, COALESCE(setor_descricao, cnae_2_secao) AS setor_descricao FROM dim_setor ORDER BY cnae_2_secao'
    ),
    query('SELECT DISTINCT sexo, raca_cor FROM dim_perfil ORDER BY sexo, raca_cor'),
    query(
      `SELECT tm.tipo_movimentacao, COUNT(*)::int AS linhas,
              COALESCE(SUM(f.total_movimentacoes), 0)::bigint AS movimentacoes
         FROM dim_tipo_movimentacao tm
         JOIN fato_movimentacao f USING (id_tipo_movimentacao)
        GROUP BY tm.tipo_movimentacao
        ORDER BY movimentacoes DESC`
    ),
    query(
      `SELECT COUNT(*)::int AS linhas,
              COALESCE(SUM(total_movimentacoes), 0)::bigint AS movimentacoes
         FROM fato_movimentacao`
    ),
  ]);

  const sexos = [...new Set(perfis.map((row) => row.sexo))].sort(sortPt);
  const racas = [...new Set(perfis.map((row) => row.raca_cor))].sort(sortPt);

  // Falha com mensagem clara se algum mapeamento de perfil não casar.
  const gruposPerfil = resolvePerfilGroups(sexos, racas);

  const anos = [...new Set(tempos.map((row) => Number(row.ano)))].sort((a, b) => a - b);
  const meses = [...new Set(tempos.map((row) => Number(row.mes)))].sort((a, b) => a - b);

  const periodo = tempos.length
    ? {
        inicio: {
          ano: Number(tempos[0].ano),
          mes: Number(tempos[0].mes),
          rotulo: `${MESES[Number(tempos[0].mes) - 1]}/${tempos[0].ano}`,
        },
        fim: {
          ano: Number(tempos[tempos.length - 1].ano),
          mes: Number(tempos[tempos.length - 1].mes),
          rotulo: `${MESES[Number(tempos[tempos.length - 1].mes) - 1]}/${tempos[tempos.length - 1].ano}`,
        },
      }
    : null;

  meta = {
    anos,
    meses,
    meses_rotulos: meses.map((mes) => ({ mes, rotulo: MESES[mes - 1] })),
    ufs: ufs.map((row) => ({
      sigla: row.sigla_uf,
      regiao: regiaoDaUf(row.sigla_uf),
    })),
    regioes: REGIOES,
    setores,
    sexos,
    racas,
    tipos: tipos.map((row) => ({
      valor: row.tipo_movimentacao,
      classe: classifyMovement(row.tipo_movimentacao),
      movimentacoes: toInt(row.movimentacoes),
    })),
    faixas_etarias: FAIXAS_ETARIAS,
    grupos_perfil: gruposPerfil,
    totais: {
      linhas: toInt(totais[0]?.linhas),
      movimentacoes: toInt(totais[0]?.movimentacoes),
      periodo,
    },
    carregado_em: new Date().toISOString(),
  };

  return meta;
}

export function getMeta() {
  if (!meta) {
    throw new Error('Metadados ainda não carregados.');
  }
  return meta;
}
