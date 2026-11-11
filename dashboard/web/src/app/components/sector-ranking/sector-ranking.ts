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
import { CORES_GRAFICO, OPCOES_BASE } from '../../core/chart-theme';
import { FiltersStore } from '../../core/filters.store';
import {
  formatCompact,
  formatMetricValue,
  formatNumber,
  mensagemErro,
  truncateLabel,
} from '../../core/format';
import { MetricStore } from '../../core/metric.store';
import { Metrica, RankingResponse } from '../../core/models';

@Component({
  selector: 'app-sector-ranking',
  imports: [BaseChartDirective],
  templateUrl: './sector-ranking.html',
  styleUrl: './sector-ranking.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectorRankingComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);
  private readonly metricStore = inject(MetricStore);

  readonly ordem = signal<'asc' | 'desc'>('desc');
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<RankingResponse | null>(null);
  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly chartOptions = signal<ChartConfiguration<'bar'>['options']>({});

  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    metrica: this.metricStore.metrica(),
    ordem: this.ordem(),
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
        switchMap(({ query, metrica, ordem }) =>
          this.api.getRankingSetores(query, metrica, ordem, 10).pipe(
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
          this.dados.set(resposta);
          this.montar(resposta);
        }
        this.carregando.set(false);
      });
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  mudarOrdem(ordem: 'asc' | 'desc'): void {
    this.ordem.set(ordem);
  }

  private montar(resposta: RankingResponse): void {
    const items = resposta.items;
    const metrica = resposta.metrica;

    const data: ChartData<'bar'> = {
      labels: items.map((item) => truncateLabel(item.rotulo, 34)),
      datasets: [
        {
          label: resposta.rotulo,
          data: items.map((item) => item.valor ?? 0),
          backgroundColor: items.map((item) =>
            (item.valor ?? 0) < 0 ? CORES_GRAFICO.rosa : CORES_GRAFICO.teal
          ),
          borderRadius: 4,
          barThickness: 16,
        },
      ],
    };

    const options: ChartConfiguration<'bar'>['options'] = {
      ...OPCOES_BASE,
      indexAxis: 'y',
      plugins: {
        ...OPCOES_BASE.plugins,
        legend: { display: false },
        tooltip: {
          ...OPCOES_BASE.plugins.tooltip,
          callbacks: {
            label: (item) => formatMetricValue(item.parsed.x, metrica),
            afterLabel: (item) => {
              const total = items[item.dataIndex]?.total_movimentacoes ?? 0;
              return `Total de movimentações: ${formatNumber(total)}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: false,
          grid: { color: CORES_GRAFICO.grade },
          ticks: {
            color: CORES_GRAFICO.texto,
            callback: (value) => this.tickMetrica(Number(value), metrica),
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: CORES_GRAFICO.texto, font: { size: 11 } },
        },
      },
    };

    this.chartData.set(data);
    this.chartOptions.set(options);
  }

  private tickMetrica(valor: number, metrica: Metrica): string {
    if (metrica === 'salario_medio') return `R$ ${formatCompact(valor)}`;
    if (metrica === 'rotatividade') return `${formatNumber(valor, 1)}%`;
    if (metrica === 'idade_media') return `${formatNumber(valor, 1)}`;
    return formatCompact(valor);
  }
}
