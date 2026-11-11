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
import {
  CelulaInterseccao,
  InterseccaoResponse,
} from '../../core/models';

@Component({
  selector: 'app-intersection-matrix',
  templateUrl: './intersection-matrix.html',
  styleUrl: './intersection-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntersectionMatrixComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);
  private readonly metricStore = inject(MetricStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<InterseccaoResponse | null>(null);

  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({
    query: this.store.query(),
    metrica: this.metricStore.metrica(),
    tick: this.tick(),
  }));

  readonly mapa = computed(() => {
    const mapa = new Map<string, CelulaInterseccao>();
    for (const celula of this.dados()?.celulas ?? []) {
      mapa.set(`${celula.sexo}|${celula.raca_cor}`, celula);
    }
    return mapa;
  });

  readonly faixa = computed(() => {
    const valores = (this.dados()?.celulas ?? [])
      .map((celula) => celula.valor)
      .filter((valor): valor is number => valor !== null && Number.isFinite(valor));
    if (valores.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...valores), max: Math.max(...valores) };
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
          this.api.getInterseccao(query, metrica).pipe(
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

  valor(celula: CelulaInterseccao): string {
    const metrica = this.dados()?.metrica ?? 'total_movimentacoes';
    return formatMetricValue(celula.valor, metrica);
  }

  volume(celula: CelulaInterseccao): string {
    return `${formatCompact(celula.total_movimentacoes)} mov.`;
  }

  titulo(celula: CelulaInterseccao): string {
    return `${celula.sexo} · ${celula.raca_cor}: ${this.valor(celula)} (${celula.total_movimentacoes.toLocaleString(
      'pt-BR'
    )} movimentações)`;
  }

  estilo(celula: CelulaInterseccao): { background: string; color: string } {
    if (celula.valor === null) {
      return { background: '#f1f5f9', color: '#94a3b8' };
    }
    const { min, max } = this.faixa();
    const proporcao = max === min ? 0.45 : (celula.valor - min) / (max - min);
    const alpha = 0.1 + proporcao * 0.72;
    const negativo = celula.valor < 0;
    const rgb = negativo ? '190, 24, 93' : '15, 118, 110';
    return {
      background: `rgba(${rgb}, ${alpha.toFixed(3)})`,
      color: alpha > 0.55 ? '#ffffff' : '#0f172a',
    };
  }
}
