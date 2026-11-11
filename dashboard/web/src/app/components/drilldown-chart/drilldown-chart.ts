import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ChartConfiguration, ChartData, ChartEvent } from 'chart.js';
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
import { DrilldownResponse, NivelDrilldown } from '../../core/models';

interface CliqueChart {
  event?: ChartEvent;
  active?: object[];
}

@Component({
  selector: 'app-drilldown-chart',
  imports: [BaseChartDirective],
  templateUrl: './drilldown-chart.html',
  styleUrl: './drilldown-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrilldownChartComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);
  private readonly metricStore = inject(MetricStore);

  readonly nivel = signal<NivelDrilldown>('regiao');
  readonly regiao = signal<string | null>(null);
  readonly uf = signal<string | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<DrilldownResponse | null>(null);
  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly chartOptions = signal<ChartConfiguration<'bar'>['options']>({});

  readonly pai = computed(() => {
    if (this.nivel() === 'uf') return this.regiao();
    if (this.nivel() === 'setor') return this.uf();
    return null;
  });

  readonly nivelRotulo = computed(() => {
    if (this.nivel() === 'regiao') return 'Regiões do Brasil';
    if (this.nivel() === 'uf') return `UFs da região ${this.regiao() ?? ''}`;
    return `Setores da UF ${this.uf() ?? ''}`;
  });

  readonly podeDescer = computed(() => this.nivel() !== 'setor');

  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    nivel: this.nivel(),
    pai: this.pai(),
    metrica: this.metricStore.metrica(),
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
        switchMap(({ query, nivel, pai, metrica }) =>
          this.api.getDrilldown(query, nivel, pai, metrica).pipe(
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

  irParaBrasil(): void {
    this.regiao.set(null);
    this.uf.set(null);
    this.nivel.set('regiao');
  }

  irParaRegiao(): void {
    if (!this.regiao()) return;
    this.uf.set(null);
    this.nivel.set('uf');
  }

  onChartClick(evento: CliqueChart): void {
    const ativo = evento.active?.[0] as { index?: number } | undefined;
    if (ativo?.index === undefined) return;
    const item = this.dados()?.items[ativo.index];
    if (!item) return;

    if (this.nivel() === 'regiao') {
      this.regiao.set(item.chave);
      this.uf.set(null);
      this.nivel.set('uf');
    } else if (this.nivel() === 'uf') {
      this.uf.set(item.chave);
      this.nivel.set('setor');
    }
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  private montar(resposta: DrilldownResponse): void {
    const items = resposta.items;
    const metrica = resposta.metrica;
    const data: ChartData<'bar'> = {
      labels: items.map((item) => truncateLabel(item.rotulo, 38)),
      datasets: [
        {
          label: resposta.rotulo_metrica,
          data: items.map((item) => item.valor ?? 0),
          backgroundColor: items.map((item) =>
            (item.valor ?? 0) < 0 ? CORES_GRAFICO.rosa : CORES_GRAFICO.teal
          ),
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    };

    const options: ChartConfiguration<'bar'>['options'] = {
      ...OPCOES_BASE,
      indexAxis: 'y',
      onHover: (event, elements) => {
        const target = event.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = elements.length > 0 && this.podeDescer() ? 'pointer' : 'default';
      },
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
            afterBody: () =>
              this.podeDescer() ? ['Clique na barra para descer um nível.'] : [],
          },
        },
      },
      scales: {
        x: {
          beginAtZero: false,
          grid: { color: CORES_GRAFICO.grade },
          ticks: {
            color: CORES_GRAFICO.texto,
            callback: (value) => this.tickValor(Number(value), resposta),
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: CORES_GRAFICO.texto },
        },
      },
    };

    this.chartData.set(data);
    this.chartOptions.set(options);
  }

  private tickValor(valor: number, resposta: DrilldownResponse): string {
    if (resposta.metrica === 'salario_medio') return `R$ ${formatCompact(valor)}`;
    if (resposta.metrica === 'rotatividade') return `${formatNumber(valor, 1)}%`;
    if (resposta.metrica === 'idade_media') return formatNumber(valor, 1);
    return formatCompact(valor);
  }
}
