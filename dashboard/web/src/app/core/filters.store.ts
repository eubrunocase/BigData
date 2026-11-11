import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import {
  FILTROS_VAZIOS,
  Filtros,
  MetaFilters,
  TipoMovimento,
} from './models';

@Injectable({ providedIn: 'root' })
export class FiltersStore {
  private readonly api = inject(ApiService);

  readonly meta = signal<MetaFilters | null>(null);
  readonly metaError = signal<string | null>(null);
  readonly carregandoMeta = signal(false);
  readonly filtros = signal<Filtros>({ ...FILTROS_VAZIOS });

  readonly ufsDisponiveis = computed(() => {
    const meta = this.meta();
    const regiao = this.filtros().regiao;
    if (!meta) return [];
    if (!regiao) return meta.ufs;
    return meta.ufs.filter((uf) => uf.regiao === regiao);
  });

  readonly query = computed<HttpParams>(() => {
    const filtros = this.filtros();
    const meta = this.meta();
    let params = new HttpParams();

    if (filtros.ano !== null) params = params.set('ano', String(filtros.ano));
    if (filtros.mes !== null) params = params.set('mes', String(filtros.mes));
    if (filtros.regiao) params = params.set('regiao', filtros.regiao);
    if (filtros.uf) params = params.set('uf', filtros.uf);
    if (filtros.setor) params = params.set('setor', filtros.setor);
    if (filtros.sexo) params = params.set('sexo', filtros.sexo);
    if (filtros.raca_cor) params = params.set('raca_cor', filtros.raca_cor);
    if (filtros.tipo !== 'todas') params = params.set('tipo', filtros.tipo);

    if (filtros.faixa && meta) {
      const faixa = meta.faixas_etarias.find((item) => item.valor === filtros.faixa);
      if (faixa?.idade_min !== null && faixa?.idade_min !== undefined) {
        params = params.set('idade_min', String(faixa.idade_min));
      }
      if (faixa?.idade_max !== null && faixa?.idade_max !== undefined) {
        params = params.set('idade_max', String(faixa.idade_max));
      }
    }

    return params;
  });

  readonly temFiltrosAtivos = computed(() => {
    const filtros = this.filtros();
    return Object.entries(filtros).some(([key, value]) =>
      key === 'tipo' ? value !== 'todas' : value !== null
    );
  });

  readonly periodoLabel = computed(() => {
    const periodo = this.meta()?.totais.periodo;
    if (!periodo) return 'ago/2025–jan/2026';
    return `${periodo.inicio.rotulo.slice(0, 3)}/${periodo.inicio.ano}–${periodo.fim.rotulo
      .slice(0, 3)}/${periodo.fim.ano}`;
  });

  init(): void {
    if (this.meta() || this.carregandoMeta()) return;
    this.carregandoMeta.set(true);
    this.metaError.set(null);
    this.api.getMeta().subscribe({
      next: (meta) => {
        this.meta.set(meta);
        this.carregandoMeta.set(false);
      },
      error: (error) => {
        this.metaError.set(
          error?.error?.erro ||
            'Não foi possível carregar os filtros. Verifique se a API está em execução.'
        );
        this.carregandoMeta.set(false);
      },
    });
  }

  setAno(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, ano: valor ? Number(valor) : null }));
  }

  setMes(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, mes: valor ? Number(valor) : null }));
  }

  setRegiao(valor: string): void {
    this.filtros.update((atual) => {
      const regiao = valor || null;
      const uf = regiao && atual.uf
        ? this.meta()?.ufs.find((item) => item.sigla === atual.uf)?.regiao === regiao
          ? atual.uf
          : null
        : atual.uf;
      return { ...atual, regiao, uf };
    });
  }

  setUf(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, uf: valor || null }));
  }

  setSetor(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, setor: valor || null }));
  }

  setSexo(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, sexo: valor || null }));
  }

  setRaca(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, raca_cor: valor || null }));
  }

  setFaixa(valor: string): void {
    this.filtros.update((atual) => ({ ...atual, faixa: valor || null }));
  }

  setTipo(valor: TipoMovimento): void {
    this.filtros.update((atual) => ({ ...atual, tipo: valor }));
  }

  limpar(): void {
    this.filtros.set({ ...FILTROS_VAZIOS });
  }
}
