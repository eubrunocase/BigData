import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CORES_GRAFICO, OPCOES_BASE, PALETA } from '../../core/chart-theme';
import { FiltersStore } from '../../core/filters.store';
import { formatCompact, formatNumber, mensagemErro } from '../../core/format';
import { GrupoSerie, SeriePonto, SeriesResponse } from '../../core/models';

@Component({
  selector: 'app-monthly-chart',
  imports: [BaseChartDirective],
  templateUrl: './monthly-chart.html',
  styleUrl: './monthly-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyChartComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);

  readonly modo = signal<GrupoSerie>('total');
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly serie = signal<SeriesResponse | null>(null);
  readonly chartData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  readonly chartOptions = signal<ChartConfiguration<'line'>['options']>(
    this.opcoesIniciais()
  );

  private seriesAtuais: { rotulo: string; pontos: (SeriePonto | null)[] }[] = [];
  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    modo: this.modo(),
    tick: this.tick(),
  }));

  constructor() {
    toObservable(this.pedido)
      .pipe(
        debounceTime(250),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(null);
        }),
        switchMap(({ query, modo }) =>
          this.api.getSeries(query, modo).pipe(
            catchError((error) => {
              this.erro.set(mensagemErro(error));
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((resposta) => {
        if (resposta) {
          this.serie.set(resposta);
          this.montarGrafico(resposta);
        }
        this.carregando.set(false);
      });
  }

  trocarModo(modo: GrupoSerie): void {
    this.modo.set(modo);
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  private opcoesIniciais(): ChartConfiguration<'line'>['options'] {
    return {
      ...OPCOES_BASE,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        ...OPCOES_BASE.plugins,
        legend: { display: true, position: 'bottom', labels: OPCOES_BASE.plugins.legend.labels },
        tooltip: {
          ...OPCOES_BASE.plugins.tooltip,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatNumber(item.parsed.y)}`,
            afterBody: (items) => {
              const item = items[0];
              const ponto = this.seriesAtuais[item.datasetIndex]?.pontos[item.dataIndex];
              if (!ponto) return [];
              return [
                `Admissões: ${formatNumber(ponto.admissoes)}`,
                `Desligamentos: ${formatNumber(ponto.desligamentos)}`,
                `Saldo: ${formatNumber(ponto.saldo)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CORES_GRAFICO.texto, maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          grid: { color: CORES_GRAFICO.grade },
          ticks: {
            color: CORES_GRAFICO.texto,
            callback: (value) => formatCompact(Number(value)),
          },
        },
      },
    };
  }

  private montarGrafico(resposta: SeriesResponse): void {
    const chaves = new Map<string, SeriePonto>();
    for (const grupo of resposta.series) {
      for (const ponto of grupo.pontos) {
        chaves.set(`${ponto.ano}-${ponto.mes}`, ponto);
      }
    }

    const ordenados = [...chaves.entries()].sort(([, a], [, b]) =>
      a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano
    );
    const labels = ordenados.map(([, ponto]) => ponto.rotulo);
    const keys = ordenados.map(([chave]) => chave);

    this.seriesAtuais = resposta.series.map((grupo) => {
      const porChave = new Map(grupo.pontos.map((ponto) => [`${ponto.ano}-${ponto.mes}`, ponto]));
      return {
        rotulo: grupo.rotulo,
        pontos: keys.map((chave) => porChave.get(chave) ?? null),
      };
    });

    const datasets = resposta.series.map((grupo, index) => {
      const porChave = new Map(grupo.pontos.map((ponto) => [`${ponto.ano}-${ponto.mes}`, ponto]));
      const cor = PALETA[index % PALETA.length];
      return {
        label: grupo.rotulo,
        data: keys.map((chave) => porChave.get(chave)?.total_movimentacoes ?? null),
        borderColor: cor,
        backgroundColor: `${cor}22`,
        pointBackgroundColor: cor,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.3,
        fill: resposta.series.length === 1,
      };
    });

    this.chartData.set({ labels, datasets });
    this.chartOptions.set(this.opcoesIniciais());
  }
}
