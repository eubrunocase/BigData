import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FiltersStore } from '../../core/filters.store';
import { TipoMovimento } from '../../core/models';

@Component({
  selector: 'app-filters-panel',
  templateUrl: './filters-panel.html',
  styleUrl: './filters-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltersPanelComponent {
  readonly store = inject(FiltersStore);

  onAno(event: Event): void {
    this.selectValue(event, (valor) => this.store.setAno(valor));
  }

  onMes(event: Event): void {
    this.selectValue(event, (valor) => this.store.setMes(valor));
  }

  onRegiao(event: Event): void {
    this.selectValue(event, (valor) => this.store.setRegiao(valor));
  }

  onUf(event: Event): void {
    this.selectValue(event, (valor) => this.store.setUf(valor));
  }

  onSetor(event: Event): void {
    this.selectValue(event, (valor) => this.store.setSetor(valor));
  }

  onSexo(event: Event): void {
    this.selectValue(event, (valor) => this.store.setSexo(valor));
  }

  onRaca(event: Event): void {
    this.selectValue(event, (valor) => this.store.setRaca(valor));
  }

  onFaixa(event: Event): void {
    this.selectValue(event, (valor) => this.store.setFaixa(valor));
  }

  onTipo(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as TipoMovimento;
    this.store.setTipo(valor);
  }

  private selectValue(event: Event, setter: (valor: string) => void): void {
    setter((event.target as HTMLSelectElement).value);
  }
}
