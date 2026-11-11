import { Metrica } from './models';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (decimals > 0) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return numberFormatter.format(value);
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return decimalFormatter.format(value);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
}

export function formatSignedNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${numberFormatter.format(value)}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return compactFormatter.format(value);
}

export function formatMetricValue(value: number | null | undefined, metrica: Metrica): string {
  switch (metrica) {
    case 'salario_medio':
      return formatCurrency(value);
    case 'rotatividade':
      return formatPercent(value, 1);
    case 'idade_media':
      return value === null || value === undefined ? '—' : `${formatDecimal(value)} anos`;
    case 'saldo':
      return formatSignedNumber(value);
    default:
      return formatNumber(value);
  }
}

export function formatMes(mes: number): string {
  const nomes = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return nomes[mes - 1] ?? String(mes);
}

export function truncateLabel(label: string, max = 38): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

export function mensagemErro(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const body = (error as { error?: { erro?: string } }).error;
    if (body?.erro) return body.erro;
  }
  return 'Não foi possível carregar os dados. Verifique se a API está em execução.';
}
