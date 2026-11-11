import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-caveats-banner',
  templateUrl: './caveats-banner.html',
  styleUrl: './caveats-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaveatsBannerComponent {
  readonly aberto = signal(true);

  toggle(): void {
    this.aberto.update((valor) => !valor);
  }
}
