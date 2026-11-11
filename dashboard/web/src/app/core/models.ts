export type Metrica =
  | 'salario_medio'
  | 'rotatividade'
  | 'saldo'
  | 'admissoes'
  | 'desligamentos'
  | 'total_movimentacoes'
  | 'idade_media';

export type TipoGap = 'genero' | 'racial' | 'interseccional';
export type NivelDrilldown = 'regiao' | 'uf' | 'setor';
export type TipoMovimento = 'todas' | 'admissao' | 'desligamento';
export type GrupoSerie = 'total' | 'sexo' | 'raca_cor';

export interface MetaFilters {
  anos: number[];
  meses: number[];
  meses_rotulos: { mes: number; rotulo: string }[];
  ufs: { sigla: string; regiao: string }[];
  regioes: string[];
  setores: { cnae_2_secao: string; setor_descricao: string }[];
  sexos: string[];
  racas: string[];
  tipos: {
    valor: string;
    classe: 'admissao' | 'desligamento';
    movimentacoes: number;
  }[];
  faixas_etarias: {
    valor: string;
    rotulo: string;
    idade_min: number | null;
    idade_max: number | null;
  }[];
  grupos_perfil: {
    mulheres: string[];
    homens: string[];
    negras: string[];
    brancas: string[];
  };
  totais: {
    linhas: number;
    movimentacoes: number;
    periodo: {
      inicio: { ano: number; mes: number; rotulo: string };
      fim: { ano: number; mes: number; rotulo: string };
    } | null;
  };
  carregado_em: string;
}

export interface KpiGapGrupo {
  rotulo: string;
  salario: number | null;
  movimentacoes: number;
}

export interface KpiGap {
  valor: number | null;
  disponivel: boolean;
  motivo: string | null;
  grupo_a: KpiGapGrupo;
  grupo_b: KpiGapGrupo;
}

export interface Kpis {
  total_movimentacoes: number;
  admissoes: number;
  desligamentos: number;
  saldo: number;
  rotatividade: number | null;
  razao_desligamento_admissao: number | null;
  salario_medio: number | null;
  idade_media: number | null;
  gap_genero: KpiGap;
  gap_racial: KpiGap;
  gap_interseccional: KpiGap;
  mulher_negra: {
    participacao_admissoes: number | null;
    participacao_desligamentos: number | null;
  };
  cobertura: {
    linhas: number;
    total_movimentacoes: number;
    amostra_pequena: boolean;
  };
}

export interface SeriePonto {
  ano: number;
  mes: number;
  rotulo: string;
  admissoes: number;
  desligamentos: number;
  saldo: number;
  rotatividade: number | null;
  salario_medio: number | null;
  idade_media: number | null;
  total_movimentacoes: number;
}

export interface SerieGrupo {
  grupo: string;
  rotulo: string;
  pontos: SeriePonto[];
}

export interface SeriesResponse {
  grupo: GrupoSerie;
  series: SerieGrupo[];
}

export interface ItemValor {
  chave: string;
  rotulo: string;
  valor: number | null;
  total_movimentacoes: number;
}

export interface RankingResponse {
  metrica: Metrica;
  rotulo: string;
  unidade: string;
  casas: number;
  ordem: 'asc' | 'desc';
  items: ItemValor[];
}

export interface MapaUfItem {
  uf: string;
  regiao: string;
  valor: number | null;
  total_movimentacoes: number;
}

export interface MapaUfResponse {
  metrica: Metrica;
  rotulo: string;
  unidade: string;
  casas: number;
  items: MapaUfItem[];
}

export interface CelulaInterseccao {
  sexo: string;
  raca_cor: string;
  valor: number | null;
  total_movimentacoes: number;
}

export interface InterseccaoResponse {
  metrica: Metrica;
  rotulo: string;
  unidade: string;
  casas: number;
  sexos: string[];
  racas: string[];
  celulas: CelulaInterseccao[];
}

export interface ItemGap {
  chave: string;
  rotulo: string;
  gap: number;
  salario_a: number;
  salario_b: number;
  movimentacoes_a: number;
  movimentacoes_b: number;
}

export interface GapsSetoresResponse {
  tipo_gap: TipoGap;
  rotulo: string;
  grupo_a: string;
  grupo_b: string;
  minimo_amostra: number;
  items: ItemGap[];
}

export interface DrilldownResponse {
  nivel: NivelDrilldown;
  pai: string | null;
  metrica: Metrica;
  rotulo_metrica: string;
  unidade: string;
  casas: number;
  items: ItemValor[];
}

export interface LinhaTabela {
  ano: number;
  mes: number;
  uf: string;
  regiao: string;
  setor: string;
  setor_descricao: string;
  sexo: string;
  raca_cor: string;
  tipo: string;
  total_movimentacoes: number;
  salario_medio: number | null;
  idade_media: number | null;
}

export interface TabelaResponse {
  total_no_recorte: number;
  limite: number;
  linhas: LinhaTabela[];
}

export interface HealthResponse {
  status: string;
  db: boolean;
}

export interface Filtros {
  ano: number | null;
  mes: number | null;
  regiao: string | null;
  uf: string | null;
  setor: string | null;
  sexo: string | null;
  raca_cor: string | null;
  faixa: string | null;
  tipo: TipoMovimento;
}

export const FILTROS_VAZIOS: Filtros = {
  ano: null,
  mes: null,
  regiao: null,
  uf: null,
  setor: null,
  sexo: null,
  raca_cor: null,
  faixa: null,
  tipo: 'todas',
};

export interface MetricaDef {
  valor: Metrica;
  rotulo: string;
  curto: string;
  casas: number;
  unidade: string;
}

export const METRICAS: MetricaDef[] = [
  { valor: 'salario_medio', rotulo: 'Salário médio', curto: 'Salário', casas: 2, unidade: 'BRL' },
  {
    valor: 'rotatividade',
    rotulo: 'Taxa de rotatividade (proxy)',
    curto: 'Rotatividade',
    casas: 1,
    unidade: '%',
  },
  { valor: 'saldo', rotulo: 'Saldo', curto: 'Saldo', casas: 0, unidade: 'movimentações' },
  { valor: 'admissoes', rotulo: 'Admissões', curto: 'Admissões', casas: 0, unidade: 'movimentações' },
  {
    valor: 'desligamentos',
    rotulo: 'Desligamentos',
    curto: 'Desligamentos',
    casas: 0,
    unidade: 'movimentações',
  },
  {
    valor: 'total_movimentacoes',
    rotulo: 'Total de movimentações',
    curto: 'Movimentações',
    casas: 0,
    unidade: 'movimentações',
  },
  { valor: 'idade_media', rotulo: 'Idade média', curto: 'Idade média', casas: 1, unidade: 'anos' },
];

export const TIPOS_GAP: { valor: TipoGap; rotulo: string; descricao: string }[] = [
  {
    valor: 'genero',
    rotulo: 'Gênero',
    descricao: 'Homens × mulheres (mulher negra não isolada)',
  },
  {
    valor: 'racial',
    rotulo: 'Racial',
    descricao: 'Brancas × negras (pretas + pardas)',
  },
  {
    valor: 'interseccional',
    rotulo: 'Interseccional',
    descricao: 'Homens brancos × mulheres negras',
  },
];
