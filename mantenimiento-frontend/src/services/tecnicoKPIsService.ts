import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface TecnicoKpi {
  tecnicoId: number;
  nombreCompleto: string;
  mantenimientosCompletados: number;
  metaMensual: number;
  porcentajeCumplimientoMeta: number;
  porcentajeMantenimientosATiempo: number;
  tiempoPromedioResolucionDias: number;
  ordenesActivas: number;
  ordenesVencidas: number;
  mantenimientosDetalle?: any[];
}

export interface UpsertMetaTecnico {
  tecnicoId: number;
  mes: number;
  anio: number;
  metaMantenimientos: number;
}

export const tecnicoKPIsService = {
  async getKPIs(mes?: number, anio?: number): Promise<ApiResponse<TecnicoKpi[]>> {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (anio) params.append('anio', anio.toString());
    
    const queryString = params.toString();
    const endpoint = `/tecnicokpis${queryString ? `?${queryString}` : ''}`;
    
    return await httpClient.get<TecnicoKpi[]>(endpoint);
  },

  async getDetalleKPI(tecnicoId: number, mes: number, anio: number): Promise<ApiResponse<any>> {
    return await httpClient.get<any>(`/tecnicokpis/detalle/${tecnicoId}?mes=${mes}&anio=${anio}`);
  },

  async upsertMeta(data: UpsertMetaTecnico): Promise<ApiResponse<string>> {
    return await httpClient.post<string>('/tecnicokpis/meta', data);
  }
};

export default tecnicoKPIsService;
