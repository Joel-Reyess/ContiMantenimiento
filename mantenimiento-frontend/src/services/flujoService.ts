import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

/** Flujo de 7 etapas y Zona de Transición (PDF 23-oct-2026) */

export type EstadoEtapa = 'completada' | 'pendiente' | 'rechazada' | 'bloqueada' | 'inactiva';

export interface EtapaFlujo {
  clave: 'REPORTE' | 'INSPECCION' | 'TRASLADO' | 'TALLER' | 'TRASLADO_RETORNO' | 'VALIDACION' | 'DISPONIBLE';
  nombre: string;
  estado: EstadoEtapa;
  etiqueta?: string;
  responsable?: string;
  mensaje?: string;
  fecha?: string;
}

export interface ItemFlujo {
  tipo: 'checklist' | 'componente';
  id: number;
  checklistItemId?: number;
  nombre: string;
  cantidad?: number;
  notas?: string;
  reportadoPorTaller: boolean;
}

export interface HistorialFlujo {
  fecha: string;
  etapa: string;
  accion: string;
  usuario?: string;
  rol?: string;
  detalle?: string;
  motivos: string[];
}

export type AccionFlujo =
  | 'validarReporte'
  | 'rechazarReporte'
  | 'corregirReporte'
  | 'confirmarTraslado'
  | 'aceptarOrden'
  | 'iniciarReparacion'
  | 'agregarHallazgo'
  | 'terminarReparacion'
  | 'confirmarRetorno'
  | 'validarReparacion';

export interface Flujo {
  reporteId?: number;
  reporteFolio?: string;
  ordenId?: number;
  ordenFolio?: string;
  vehiculoId?: number;
  vehiculoCodigo?: string;
  vehiculoTipo?: string;
  cancelada: boolean;
  etapas: EtapaFlujo[];
  acciones: AccionFlujo[];
  bloqueo?: string;
  items: ItemFlujo[];
  reportadoPorNombre?: string;
  reporteDescripcion?: string;
  reportePrioridad?: number;
  reportePuedeOperar?: boolean;
  ultimoRechazo?: HistorialFlujo;
  historial: HistorialFlujo[];
}

export interface ZonaCapacidad {
  zona: 'danados' | 'reparados';
  nombre: string;
  ocupados: number;
  capacidad: number;
  disponibles: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
  alertaDesde: number;
  enFila: number;
}

export interface CapacidadZonas {
  danados: ZonaCapacidad;
  reparados: ZonaCapacidad;
}

export interface AlertaCapacidad {
  zona: 'danados' | 'reparados';
  nivel: 'preventiva' | 'saturada';
  mensaje: string;
  ocupados: number;
  capacidad: number;
}

export interface ResultadoFlujo {
  mensaje: string;
  ordenId?: number;
  ordenFolio?: string;
  alerta?: AlertaCapacidad | null;
}

export interface UnidadZona {
  ordenId: number;
  ordenFolio: string;
  reporteId?: number;
  reporteFolio?: string;
  vehiculoId: number;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  descripcion?: string;
  tecnico?: string;
  prioridad: number;
  desde: string;
  posicionFila?: number;
  sinEspacio: boolean;
  acciones: AccionFlujo[];
}

export interface ReportePorInspeccionar {
  reporteId: number;
  folio: string;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  descripcion?: string;
  reportadoPor?: string;
  fecha: string;
  /** 0 pendiente, 2 rechazado */
  estado: number;
}

export interface ZonaTransicion {
  capacidad: CapacidadZonas;
  porInspeccionar: ReportePorInspeccionar[];
  porTrasladar: UnidadZona[];
  enZonaDanados: UnidadZona[];
  porEntregar: UnidadZona[];
  enZonaReparados: UnidadZona[];
}

export interface MotivoRechazo {
  tipo: 'checklist' | 'componente';
  id: number;
}

export interface ItemReporte {
  checklistItemId: number;
  cantidad?: number;
  notas?: string;
}

export interface CorregirReporte {
  descripcion?: string;
  prioridad?: number;
  puedeOperar?: boolean;
  items?: ItemReporte[];
  observaciones?: string;
}

export const flujoService = {
  capacidad: () => httpClient.get<CapacidadZonas>('/flujo/capacidad'),
  guardarCapacidad: (danados: number, reparados: number) =>
    httpClient.put<CapacidadZonas>('/flujo/capacidad', { danados, reparados }),
  zona: () => httpClient.get<ZonaTransicion>('/flujo/zona'),
  deOrden: (id: number) => httpClient.get<Flujo>(`/flujo/orden/${id}`),
  deReporte: (id: number) => httpClient.get<Flujo>(`/flujo/reporte/${id}`),

  validarReporte: (id: number, observaciones?: string): Promise<ApiResponse<ResultadoFlujo>> =>
    httpClient.post<ResultadoFlujo>(`/flujo/reportes/${id}/validar`, { observaciones }),
  rechazarReporte: (id: number, motivos: MotivoRechazo[], observacion?: string) =>
    httpClient.post<ResultadoFlujo>(`/flujo/reportes/${id}/rechazar`, { motivos, observacion }),
  corregirReporte: (id: number, cambios: CorregirReporte) =>
    httpClient.post<ResultadoFlujo>(`/flujo/reportes/${id}/corregir`, cambios),

  confirmarTraslado: (ordenId: number) => httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/traslado`),
  aceptar: (ordenId: number) => httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/aceptar`),
  hallazgos: (ordenId: number, items: ItemReporte[]) =>
    httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/hallazgos`, { items }),
  confirmarRetorno: (ordenId: number) => httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/retorno`),
  validarReparacion: (ordenId: number, aprobado: boolean, motivos: MotivoRechazo[] = [], observacion?: string) =>
    httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/validar`, { aprobado, motivos, observacion }),
};
