import { HttpError } from './errors.js';
import { REGIOES, ufsDaRegiao } from './regions.js';
import { METRIC_KEYS, gapDefinition } from './businessRules.js';

/** Acumula cláusulas e parâmetros posicionais ($1, $2...) de forma segura. */
export class SqlBuilder {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  addParam(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  add(clause) {
    this.clauses.push(clause);
    return this;
  }

  where() {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}

function rawValues(query, key) {
  const raw = query[key];
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [
    ...new Set(
      list
        .flatMap((value) => String(value).split(','))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    ),
  ];
}

function invalid(key, value) {
  throw new HttpError(400, `Valor inválido para "${key}": "${value}"`);
}

/**
 * Valida os filtros contra os valores reais de /api/meta/filters e adiciona
 * as condições parametrizadas ao builder. Nenhum valor do usuário entra em SQL.
 */
export function addFilters(builder, query, meta, options = {}) {
  const { ignoreSexo = false, ignoreRaca = false } = options;

  const anos = rawValues(query, 'ano');
  if (anos.length > 0) {
    const valores = anos.map((valor) => {
      const ano = Number(valor);
      if (!Number.isInteger(ano) || !meta.anos.includes(ano)) invalid('ano', valor);
      return ano;
    });
    builder.add(`t.ano = ANY(${builder.addParam(valores)})`);
  }

  const meses = rawValues(query, 'mes');
  if (meses.length > 0) {
    const valores = meses.map((valor) => {
      const mes = Number(valor);
      if (!Number.isInteger(mes) || !meta.meses.includes(mes)) invalid('mes', valor);
      return mes;
    });
    builder.add(`t.mes = ANY(${builder.addParam(valores)})`);
  }

  const regioes = rawValues(query, 'regiao');
  if (regioes.length > 0) {
    regioes.forEach((regiao) => {
      if (!REGIOES.includes(regiao)) invalid('regiao', regiao);
    });
    const ufs = [...new Set(regioes.flatMap((regiao) => ufsDaRegiao(regiao)))];
    builder.add(`l.sigla_uf = ANY(${builder.addParam(ufs)})`);
  }

  const ufs = rawValues(query, 'uf');
  if (ufs.length > 0) {
    const validas = new Set(meta.ufs.map((item) => item.sigla));
    ufs.forEach((uf) => {
      if (!validas.has(uf.toUpperCase())) invalid('uf', uf);
    });
    const valores = ufs.map((uf) => uf.toUpperCase());

    if (regioes.length > 0) {
      const permitidas = new Set(regioes.flatMap((regiao) => ufsDaRegiao(regiao)));
      const fora = valores.filter((uf) => !permitidas.has(uf));
      if (fora.length > 0) {
        throw new HttpError(400, `UF fora da região selecionada: ${fora.join(', ')}`);
      }
    }
    builder.add(`l.sigla_uf = ANY(${builder.addParam(valores)})`);
  }

  const setores = rawValues(query, 'setor');
  if (setores.length > 0) {
    const validos = new Set(meta.setores.map((item) => item.cnae_2_secao));
    setores.forEach((setor) => {
      if (!validos.has(setor)) invalid('setor', setor);
    });
    builder.add(`s.cnae_2_secao = ANY(${builder.addParam(setores)})`);
  }

  const sexos = rawValues(query, 'sexo');
  if (sexos.length > 0) {
    sexos.forEach((sexo) => {
      if (!meta.sexos.includes(sexo)) invalid('sexo', sexo);
    });
    if (!ignoreSexo) {
      builder.add(`p.sexo = ANY(${builder.addParam(sexos)})`);
    }
  }

  const racas = rawValues(query, 'raca_cor');
  if (racas.length > 0) {
    racas.forEach((raca) => {
      if (!meta.racas.includes(raca)) invalid('raca_cor', raca);
    });
    if (!ignoreRaca) {
      builder.add(`p.raca_cor = ANY(${builder.addParam(racas)})`);
    }
  }

  const tipos = rawValues(query, 'tipo');
  if (tipos.length > 0) {
    tipos.forEach((tipo) => {
      if (!['admissao', 'desligamento'].includes(tipo)) invalid('tipo', tipo);
    });
    if (tipos.length === 1 && tipos[0] === 'admissao') {
      builder.add(`tm.tipo_movimentacao ILIKE 'admiss%'`);
    }
    if (tipos.length === 1 && tipos[0] === 'desligamento') {
      builder.add(`NOT (tm.tipo_movimentacao ILIKE 'admiss%')`);
    }
  }

  const idadeMin = parseIdade(query.idade_min, 'idade_min');
  if (idadeMin !== null) {
    builder.add(`f.idade_media >= ${builder.addParam(idadeMin)}`);
  }

  const idadeMax = parseIdade(query.idade_max, 'idade_max');
  if (idadeMax !== null) {
    builder.add(`f.idade_media <= ${builder.addParam(idadeMax)}`);
  }

  if (idadeMin !== null && idadeMax !== null && idadeMin > idadeMax) {
    throw new HttpError(400, 'idade_min não pode ser maior que idade_max');
  }

  return builder;
}

function parseIdade(raw, key) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(Array.isArray(raw) ? raw[0] : String(raw).split(',')[0]);
  if (!Number.isFinite(value) || value < 0 || value > 120) invalid(key, raw);
  return value;
}

export function requireMetric(query, fallback = 'salario_medio') {
  const metrica = String(query.metrica ?? fallback).trim();
  if (!METRIC_KEYS.includes(metrica)) {
    throw new HttpError(
      400,
      `Métrica inválida: "${metrica}". Valores aceitos: ${METRIC_KEYS.join(', ')}`
    );
  }
  return metrica;
}

export function requireTipoGap(query) {
  const tipo = String(query.tipo_gap ?? 'genero').trim();
  if (!gapDefinition(tipo)) {
    throw new HttpError(
      400,
      `tipo_gap inválido: "${tipo}". Valores aceitos: genero, racial, interseccional`
    );
  }
  return tipo;
}

export function requireNivel(query) {
  const nivel = String(query.nivel ?? 'regiao').trim();
  if (!['regiao', 'uf', 'setor'].includes(nivel)) {
    throw new HttpError(400, `nivel inválido: "${nivel}". Valores aceitos: regiao, uf, setor`);
  }
  return nivel;
}

export function parseLimit(query, fallback = 10, max = 100) {
  if (query.limit === undefined || query.limit === '') return fallback;
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new HttpError(400, `limit inválido: deve ser um inteiro entre 1 e ${max}`);
  }
  return limit;
}

export function parseOrder(query, fallback = 'desc') {
  if (query.order === undefined || query.order === '') return fallback;
  const order = String(query.order).toLowerCase();
  if (!['asc', 'desc'].includes(order)) {
    throw new HttpError(400, 'order inválido: use "asc" ou "desc"');
  }
  return order;
}

export function parseGrupo(query) {
  const grupo = String(query.grupo ?? 'total').trim();
  if (!['total', 'sexo', 'raca_cor'].includes(grupo)) {
    throw new HttpError(400, 'grupo inválido: use "total", "sexo" ou "raca_cor"');
  }
  return grupo;
}

/** Valida o parâmetro "pai" do drill-down contra o nível anterior. */
export function requirePai(query, nivel, meta) {
  const pai = String(query.pai ?? '').trim();
  if (nivel === 'regiao') {
    if (pai) throw new HttpError(400, 'O nível "regiao" não aceita o parâmetro "pai"');
    return null;
  }
  if (!pai) {
    throw new HttpError(400, `O nível "${nivel}" exige o parâmetro "pai"`);
  }
  if (nivel === 'uf') {
    if (!REGIOES.includes(pai)) {
      throw new HttpError(400, `pai inválido para nível "uf": "${pai}"`);
    }
    return pai;
  }
  const ufs = new Set(meta.ufs.map((item) => item.sigla));
  if (!ufs.has(pai.toUpperCase())) {
    throw new HttpError(400, `pai inválido para nível "setor": "${pai}"`);
  }
  return pai.toUpperCase();
}

/** Filtro base fixo reutilizado por todas as consultas analíticas. */
export function factFromSql() {
  return `FROM fato_movimentacao f
    JOIN dim_tempo t ON t.id_tempo = f.id_tempo
    JOIN dim_localizacao l ON l.id_localizacao = f.id_localizacao
    JOIN dim_setor s ON s.id_setor = f.id_setor
    JOIN dim_perfil p ON p.id_perfil = f.id_perfil
    JOIN dim_tipo_movimentacao tm ON tm.id_tipo_movimentacao = f.id_tipo_movimentacao`;
}
