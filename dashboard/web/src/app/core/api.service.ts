import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DrilldownResponse,
  GapsSetoresResponse,
  HealthResponse,
  InterseccaoResponse,
  Kpis,
  MapaUfResponse,
  MetaFilters,
  RankingResponse,
  SeriesResponse,
  TabelaResponse,
  TipoGap,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }

  getMeta(): Observable<MetaFilters> {
    return this.http.get<MetaFilters>(`${this.baseUrl}/meta/filters`);
  }

  getKpis(query: HttpParams): Observable<Kpis> {
    return this.http.get<Kpis>(`${this.baseUrl}/kpis`, { params: query });
  }

  getSeries(query: HttpParams, grupo: 'total' | 'sexo' | 'raca_cor'): Observable<SeriesResponse> {
    return this.http.get<SeriesResponse>(`${this.baseUrl}/series/mensal`, {
      params: query.set('grupo', grupo),
    });
  }

  getRankingSetores(
    query: HttpParams,
    metrica: string,
    ordem: 'asc' | 'desc',
    limit = 10
  ): Observable<RankingResponse> {
    return this.http.get<RankingResponse>(`${this.baseUrl}/ranking/setores`, {
      params: query.set('metrica', metrica).set('order', ordem).set('limit', String(limit)),
    });
  }

  getMapaUf(query: HttpParams, metrica: string): Observable<MapaUfResponse> {
    return this.http.get<MapaUfResponse>(`${this.baseUrl}/mapa/uf`, {
      params: query.set('metrica', metrica),
    });
  }

  getInterseccao(query: HttpParams, metrica: string): Observable<InterseccaoResponse> {
    return this.http.get<InterseccaoResponse>(`${this.baseUrl}/interseccao`, {
      params: query.set('metrica', metrica),
    });
  }

  getGapsSetores(query: HttpParams, tipoGap: TipoGap): Observable<GapsSetoresResponse> {
    return this.http.get<GapsSetoresResponse>(`${this.baseUrl}/gaps/setores`, {
      params: query.set('tipo_gap', tipoGap),
    });
  }

  getDrilldown(
    query: HttpParams,
    nivel: string,
    pai: string | null,
    metrica: string
  ): Observable<DrilldownResponse> {
    let params = query.set('nivel', nivel).set('metrica', metrica);
    if (pai) params = params.set('pai', pai);
    return this.http.get<DrilldownResponse>(`${this.baseUrl}/drilldown`, { params });
  }

  getTabela(query: HttpParams, limit = 2000): Observable<TabelaResponse> {
    return this.http.get<TabelaResponse>(`${this.baseUrl}/tabela`, {
      params: query.set('limit', String(limit)),
    });
  }
}
