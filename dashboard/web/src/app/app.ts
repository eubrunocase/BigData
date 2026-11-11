import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { ApiService } from './core/api.service';
import { FiltersStore } from './core/filters.store';
import { CaveatsBannerComponent } from './components/caveats-banner/caveats-banner';
import { DataTableComponent } from './components/data-table/data-table';
import { DrilldownChartComponent } from './components/drilldown-chart/drilldown-chart';
import { FiltersPanelComponent } from './components/filters-panel/filters-panel';
import { GapChartComponent } from './components/gap-chart/gap-chart';
import { IntersectionMatrixComponent } from './components/intersection-matrix/intersection-matrix';
import { KpiCardsComponent } from './components/kpi-cards/kpi-cards';
import { MetricSelectorComponent } from './components/metric-selector/metric-selector';
import { MonthlyChartComponent } from './components/monthly-chart/monthly-chart';
import { SectorRankingComponent } from './components/sector-ranking/sector-ranking';
import { UfChartComponent } from './components/uf-chart/uf-chart';

@Component({
  selector: 'app-root',
  imports: [
    CaveatsBannerComponent,
    FiltersPanelComponent,
    KpiCardsComponent,
    MetricSelectorComponent,
    MonthlyChartComponent,
    SectorRankingComponent,
    UfChartComponent,
    IntersectionMatrixComponent,
    GapChartComponent,
    DrilldownChartComponent,
    DataTableComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly api = inject(ApiService);
  readonly store = inject(FiltersStore);
  readonly apiOnline = signal<boolean | null>(null);

  constructor() {
    timer(0, 30_000)
      .pipe(
        switchMap(() =>
          this.api.health().pipe(catchError(() => of({ status: 'down', db: false })))
        ),
        takeUntilDestroyed()
      )
      .subscribe((health) => this.apiOnline.set(health.db));
  }

  ngOnInit(): void {
    this.store.init();
  }
}
