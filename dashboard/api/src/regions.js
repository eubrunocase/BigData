import { HttpError } from './errors.js';

/**
 * Mapa UF -> Região (Brasil). O código "XX" representa UF não identificada
 * no CAGED e é mantido como uma região própria para não perder o volume.
 */
export const UF_TO_REGIAO = {
  AC: 'Norte',
  AM: 'Norte',
  AP: 'Norte',
  PA: 'Norte',
  RO: 'Norte',
  RR: 'Norte',
  TO: 'Norte',
  AL: 'Nordeste',
  BA: 'Nordeste',
  CE: 'Nordeste',
  MA: 'Nordeste',
  PB: 'Nordeste',
  PE: 'Nordeste',
  PI: 'Nordeste',
  RN: 'Nordeste',
  SE: 'Nordeste',
  DF: 'Centro-Oeste',
  GO: 'Centro-Oeste',
  MT: 'Centro-Oeste',
  MS: 'Centro-Oeste',
  ES: 'Sudeste',
  MG: 'Sudeste',
  RJ: 'Sudeste',
  SP: 'Sudeste',
  PR: 'Sul',
  RS: 'Sul',
  SC: 'Sul',
  XX: 'Não identificada',
};

export const REGIOES = [
  'Norte',
  'Nordeste',
  'Centro-Oeste',
  'Sudeste',
  'Sul',
  'Não identificada',
];

export function regiaoDaUf(uf) {
  return UF_TO_REGIAO[String(uf || '').trim().toUpperCase()] || 'Não identificada';
}

export function ufsDaRegiao(regiao) {
  return Object.entries(UF_TO_REGIAO)
    .filter(([, valor]) => valor === regiao)
    .map(([uf]) => uf);
}

/**
 * Expressão SQL fixa para derivar a região a partir da UF.
 * Construída apenas com constantes do servidor — nunca com input do usuário.
 */
export const REGIAO_SQL = `CASE l.sigla_uf ${Object.entries(UF_TO_REGIAO)
  .map(([uf, regiao]) => `WHEN '${uf}' THEN '${regiao.replace(/'/g, "''")}'`)
  .join(' ')} ELSE 'Não identificada' END`;

export function requireRegiao(valor) {
  const regiao = String(valor || '').trim();
  if (!REGIOES.includes(regiao)) {
    throw new HttpError(400, `Região inválida: "${regiao}"`);
  }
  return regiao;
}
