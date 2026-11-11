import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MetricStore } from '../../core/metric.store';
import { METRICAS, Metrica } from '../../core/models';

@Component({
  selector: 'app-metric-selector',
  templateUrl: './metric-selector.html',
  styleUrl: './metric-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricSelectorComponent {
  readonly store = inject(MetricStore);
  readonly metricas = METRICAS;
  readonly rotuloAtual = computed(
    () => METRICAS.find((item) => item.valor === this.store.metrica())?.rotulo ?? '—'
  );

  selecionar(metrica: Metrica): void {
    this.store.set(metrica);
  }
}
