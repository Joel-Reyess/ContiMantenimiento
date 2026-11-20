import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';
import type { ResultadoFlujo } from './flujoService';

/** Acciones de la orden en el flujo de equipos eléctricos (montacargas, tuggers y traspaletas) */
export interface ResultadoChecklist {
  id: number;
  resultado?: 'Bueno' | 'Malo' | null;
  observacion?: string;
}

export interface ChecklistPreventivoGuardar {
  resultados: ResultadoChecklist[];
  tipoRevision?: string;
  codigoFallaEncontrado?: boolean | null;
  codigoFalla?: string;
  codigoFallaResuelto?: boolean | null;
  notas?: string;
}

const base = '/equipos-electricos/ordenes';

export const electricoService = {
  aceptar: (id: number) => httpClient.post<ResultadoFlujo>(`${base}/${id}/aceptar`),
  ingresoTaller: (id: number) => httpClient.post<ResultadoFlujo>(`${base}/${id}/ingreso-taller`),
  inspeccionPrevia: (id: number, diagnostico: string) => httpClient.post<ResultadoFlujo>(`${base}/${id}/inspeccion-previa`, { diagnostico }),
  pruebas: (id: number, aprobadas: boolean, observaciones?: string) =>
    httpClient.post<ResultadoFlujo>(`${base}/${id}/pruebas`, { aprobadas, observaciones }),
  checklist: (id: number, datos: ChecklistPreventivoGuardar, terminar = false) =>
    httpClient.put<ResultadoFlujo>(`${base}/${id}/checklist${terminar ? '?terminar=true' : ''}`, datos),
  trasladoArea: (id: number) => httpClient.post<ResultadoFlujo>(`${base}/${id}/traslado-area`),
  aprobarEntrega: (id: number) => httpClient.post<ResultadoFlujo>(`${base}/${id}/aprobar-entrega`),
  cancelar: (id: number, motivo: string) => httpClient.post<ResultadoFlujo>(`${base}/${id}/cancelar`, { motivo }),
  documento: (id: number, archivos: File[]): Promise<ApiResponse<ResultadoFlujo>> => {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('archivos', a));
    return httpClient.uploadFile<ResultadoFlujo>(`${base}/${id}/documento`, fd);
  },
};
