import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { FiltersStore } from '../../core/filters.store';
import {
  formatCompact,
  formatMetricValue,
  mensagemErro,
} from '../../core/format';
import { MetricStore } from '../../core/metric.store';
import { MapaUfItem, MapaUfResponse } from '../../core/models';

@Component({
  selector: 'app-uf-chart',
  templateUrl: './uf-chart.html',
  styleUrl: './uf-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UfChartComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);
  private readonly metricStore = inject(MetricStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<MapaUfResponse | null>(null);

  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    metrica: this.metricStore.metrica(),
    tick: this.tick(),
  }));

  readonly faixa = computed(() => {
    const valores = (this.dados()?.items ?? [])
      .map((item) => item.valor)
      .filter((valor): valor is number => valor !== null && Number.isFinite(valor))
      .sort((a, b) => a - b);
    if (valores.length === 0) return { min: 0, max: 1 };

    // Percentis 5–95 evitam que um único outlier (ex.: PB) achate a escala de cor.
    if (valores.length >= 5) {
      const percentil = (q: number) =>
        valores[Math.round((valores.length - 1) * q)];
      const min = percentil(0.05);
      const max = percentil(0.95);
      if (max > min) return { min, max };
    }

    return { min: valores[0], max: valores[valores.length - 1] };
  });

  constructor() {
    toObservable(this.pedido)
      .pipe(
        debounceTime(250),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(null);
        }),
        switchMap(({ query, metrica }) =>
          this.api.getMapaUf(query, metrica).pipe(
            catchError((error) => {
              this.erro.set(mensagemErro(error));
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((resposta) => {
        if (resposta) this.dados.set(resposta);
        this.carregando.set(false);
      });
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  valor(item: MapaUfItem): string {
    const metrica = this.dados()?.metrica ?? 'total_movimentacoes';
    return formatMetricValue(item.valor, metrica);
  }

  volume(item: MapaUfItem): string {
    return `${formatCompact(item.total_movimentacoes)} mov.`;
  }

  rotuloAcessivel(item: MapaUfItem): string {
    return `${item.uf}, região ${item.regiao}: ${this.valor(item)}. ${item.total_movimentacoes.toLocaleString(
      'pt-BR'
    )} movimentações.`;
  }

  estilo(item: MapaUfItem): { background: string; color: string } {
    if (item.valor === null) {
      return { background: '#f1f5f9', color: '#94a3b8' };
    }

    const { min, max } = this.faixa();
    const proporcao =
      max === min ? 0.45 : Math.min(1, Math.max(0, (item.valor - min) / (max - min)));
    const alpha = 0.12 + proporcao * 0.68;
    const negativo = item.valor < 0;
    const rgb = negativo ? '190, 24, 93' : '15, 118, 110';

    return {
      background: `rgba(${rgb}, ${alpha.toFixed(3)})`,
      color: alpha > 0.55 ? '#ffffff' : '#0f172a',
    };
  }
}
