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
  formatCurrency,
  formatNumber,
  mensagemErro,
} from '../../core/format';
import { LinhaTabela, TabelaResponse } from '../../core/models';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(FiltersStore);

  readonly pageSize = 15;
  readonly linhas = signal<LinhaTabela[]>([]);
  readonly totalRecorte = signal(0);
  readonly limite = signal(2000);
  readonly pagina = signal(0);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.linhas().length / this.pageSize))
  );
  readonly linhasPagina = computed(() => {
    const inicio = this.pagina() * this.pageSize;
    return this.linhas().slice(inicio, inicio + this.pageSize);
  });
  readonly inicioExibido = computed(() =>
    this.linhas().length === 0 ? 0 : this.pagina() * this.pageSize + 1
  );
  readonly fimExibido = computed(() =>
    Math.min((this.pagina() + 1) * this.pageSize, this.linhas().length)
  );

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
          this.api.getTabela(query, 2000).pipe(
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
          this.aplicar(resposta);
        }
        this.carregando.set(false);
      });
  }

  recarregar(): void {
    this.tick.update((valor) => valor + 1);
  }

  paginaAnterior(): void {
    this.pagina.update((pagina) => Math.max(0, pagina - 1));
  }

  proximaPagina(): void {
    this.pagina.update((pagina) => Math.min(this.totalPaginas() - 1, pagina + 1));
  }

  irParaPrimeira(): void {
    this.pagina.set(0);
  }

  irParaUltima(): void {
    this.pagina.set(this.totalPaginas() - 1);
  }

  exportarCsv(): void {
    const linhas = this.linhasPagina();
    if (linhas.length === 0) return;

    const cabecalho = [
      'Ano',
      'Mês',
      'UF',
      'Região',
      'Setor (CNAE)',
      'Descrição do setor',
      'Sexo',
      'Raça/cor',
      'Tipo de movimentação',
      'Movimentações',
      'Salário médio',
      'Idade média',
    ];

    const corpo = linhas.map((linha) =>
      [
        linha.ano,
        linha.mes,
        linha.uf,
        linha.regiao,
        linha.setor,
        linha.setor_descricao,
        linha.sexo,
        linha.raca_cor,
        linha.tipo,
        this.csvNumero(linha.total_movimentacoes),
        this.csvNumero(linha.salario_medio, 2),
        this.csvNumero(linha.idade_media, 1),
      ]
        .map((valor) => this.csvCelula(valor))
        .join(';')
    );

    const csv = `\uFEFF${[cabecalho.map((valor) => this.csvCelula(valor)).join(';'), ...corpo].join(
      '\r\n'
    )}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caged-recorte-pagina-${this.pagina() + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  setorTexto(linha: LinhaTabela): string {
    return linha.setor_descricao || linha.setor;
  }

  formatarValor(valor: number | null): string {
    return valor === null ? '—' : formatCurrency(valor);
  }

  formatarIdade(valor: number | null): string {
    return valor === null ? '—' : `${formatNumber(valor, 1)}`;
  }

  formatarMovimentacoes(valor: number): string {
    return formatNumber(valor);
  }

  formatarNumero(valor: number): string {
    return formatNumber(valor);
  }

  private aplicar(resposta: TabelaResponse): void {
    this.linhas.set(resposta.linhas);
    this.totalRecorte.set(resposta.total_no_recorte);
    this.limite.set(resposta.limite);
    this.pagina.set(0);
  }

  private csvCelula(valor: unknown): string {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
  }

  private csvNumero(valor: number | null, casas = 0): string {
    if (valor === null) return '';
    return valor.toFixed(casas).replace('.', ',');
  }
}
