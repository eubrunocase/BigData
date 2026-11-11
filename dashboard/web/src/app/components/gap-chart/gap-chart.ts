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
  formatCurrency,
  formatNumber,
  formatPercent,
  mensagemErro,
  truncateLabel,
} from '../../core/format';
import {
  GapsSetoresResponse,
  TIPOS_GAP,
  TipoGap,
} from '../../core/models';

@Component({
  selector: 'app-gap-chart',
  imports: [BaseChartDirective],
  templateUrl: './gap-chart.html',
  styleUrl: './gap-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GapChartComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);

  readonly tipos = TIPOS_GAP;
  readonly tipoGap = signal<TipoGap>('genero');
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<GapsSetoresResponse | null>(null);
  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly chartOptions = signal<ChartConfiguration<'bar'>['options']>({});

  readonly bloqueado = computed(() => {
    const filtros = this.store.filtros();
    if (this.tipoGap() === 'genero') return filtros.sexo !== null;
    if (this.tipoGap() === 'racial') return filtros.raca_cor !== null;
    return filtros.sexo !== null || filtros.raca_cor !== null;
  });

  readonly motivoBloqueio = computed(() => {
    if (!this.bloqueado()) return '';
    if (this.tipoGap() === 'genero') {
      return 'Há um filtro de sexo ativo. O gap de gênero compara homens e mulheres e, por isso, é exibido como n/d.';
    }
    if (this.tipoGap() === 'racial') {
      return 'Há um filtro de raça/cor ativo. O gap racial compara brancas e negras e, por isso, é exibido como n/d.';
    }
    return 'Há filtro de sexo e/ou raça/cor ativo. O gap interseccional compara homens brancos e mulheres negras e, por isso, é exibido como n/d.';
  });

  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    tipoGap: this.tipoGap(),
    bloqueado: this.bloqueado(),
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
        switchMap(({ query, tipoGap, bloqueado }) => {
          if (bloqueado) {
            this.dados.set(null);
            this.chartData.set({ labels: [], datasets: [] });
            return of(null);
          }
          return this.api.getGapsSetores(query, tipoGap).pipe(
            catchError((error) => {
              this.erro.set(mensagemErro(error));
              return of(null);
            })
          );
        }),
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

  selecionar(tipo: TipoGap): void {
    this.tipoGap.set(tipo);
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  private montar(resposta: GapsSetoresResponse): void {
    const items = resposta.items;
    const data: ChartData<'bar'> = {
      labels: items.map((item) => truncateLabel(item.rotulo, 30)),
      datasets: [
        {
          label: `Gap — ${resposta.grupo_a} vs. ${resposta.grupo_b}`,
          data: items.map((item) => item.gap),
          backgroundColor: items.map((item) =>
            item.gap < 0 ? CORES_GRAFICO.rosa : CORES_GRAFICO.teal
          ),
          borderRadius: 4,
          barThickness: 14,
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
            label: (item) => `Gap: ${formatPercent(item.parsed.x)}`,
            afterLabel: (item) => {
              const linha = items[item.dataIndex];
              if (!linha) return [];
              return [
                `${resposta.grupo_a}: ${formatCurrency(linha.salario_a)}`,
                `${resposta.grupo_b}: ${formatCurrency(linha.salario_b)}`,
                `Amostra: ${formatNumber(linha.movimentacoes_a)} vs. ${formatNumber(
                  linha.movimentacoes_b
                )}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: CORES_GRAFICO.grade },
          ticks: {
            color: CORES_GRAFICO.texto,
            callback: (value) => `${formatNumber(Number(value))}%`,
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
}
