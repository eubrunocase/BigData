import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { FiltersStore } from '../../core/filters.store';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  mensagemErro,
} from '../../core/format';
import { KpiGap, Kpis } from '../../core/models';

@Component({
  selector: 'app-kpi-cards',
  templateUrl: './kpi-cards.html',
  styleUrl: './kpi-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardsComponent {
  private readonly api = inject(ApiService);
  readonly store = inject(FiltersStore);

  readonly kpis = signal<Kpis | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  private readonly tick = signal(0);
  private readonly pedido = computed(() => ({ query: this.store.query(), tick: this.tick() }));

  constructor() {
    toObservable(this.pedido)
      .pipe(
        debounceTime(250),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(null);
        }),
        switchMap(({ query }) =>
          this.api.getKpis(query).pipe(
            catchError((error) => {
              this.erro.set(mensagemErro(error));
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((dados) => {
        if (dados) this.kpis.set(dados);
        this.carregando.set(false);
      });
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  valorGap(gap: KpiGap): string {
    return gap.disponivel ? formatPercent(gap.valor) : 'n/d';
  }

  motivoGap(gap: KpiGap): string {
    return gap.disponivel ? '' : gap.motivo || 'Sem dados suficientes para este recorte.';
  }

  saldoTexto(valor: number): string {
    return `Saldo: ${formatSignedNumber(valor)}`;
  }

  mulheresNegrasSaemMais(k: Kpis): boolean {
    const a = k.mulher_negra.participacao_admissoes;
    const d = k.mulher_negra.participacao_desligamentos;
    return a !== null && d !== null && d > a;
  }

  formatarMoeda(valor: number | null): string {
    return formatCurrency(valor);
  }

  formatarPercentual(valor: number | null): string {
    return formatPercent(valor);
  }

  formatarNumero(valor: number | null): string {
    return formatNumber(valor);
  }

  formatarRazao(valor: number | null): string {
    return valor === null ? '—' : formatNumber(valor, 2);
  }
}
