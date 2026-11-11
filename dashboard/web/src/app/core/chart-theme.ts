/**
 * Paleta e helpers visuais compartilhados pelos gráficos.
 * As cores foram escolhidas com contraste suficiente em fundo claro.
 */
export const PALETA = [
  '#0f766e',
  '#7c3aed',
  '#be185d',
  '#b45309',
  '#1d4ed8',
  '#047857',
  '#9333ea',
  '#db2777',
  '#ca8a04',
  '#0e7490',
];

export const CORES_GRAFICO = {
  teal: '#0f766e',
  tealClaro: 'rgba(15, 118, 110, 0.18)',
  roxo: '#7c3aed',
  roxoClaro: 'rgba(124, 58, 237, 0.18)',
  rosa: '#be185d',
  rosaClaro: 'rgba(190, 24, 93, 0.16)',
  laranja: '#b45309',
  cinza: '#64748b',
  grade: 'rgba(100, 116, 139, 0.18)',
  texto: '#334155',
};

export const FONTE_GRAFICO = {
  family:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  size: 12,
};

export const OPCOES_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: {
    legend: {
      labels: {
        color: CORES_GRAFICO.texto,
        font: FONTE_GRAFICO,
        boxWidth: 12,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      titleFont: FONTE_GRAFICO,
      bodyFont: FONTE_GRAFICO,
      padding: 10,
      cornerRadius: 6,
    },
  },
};
