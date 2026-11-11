import { Injectable, signal } from '@angular/core';
import { Metrica } from './models';

@Injectable({ providedIn: 'root' })
export class MetricStore {
  readonly metrica = signal<Metrica>('salario_medio');

  set(metrica: Metrica): void {
    this.metrica.set(metrica);
  }
}
