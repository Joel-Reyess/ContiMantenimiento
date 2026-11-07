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
  | 'cancelarReporte'
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
  reporteTipoMantenimiento?: string;
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
  /** Correctivo o Preventivo: decide si la unidad puede operar (PDF 06-nov) */
  tipoMantenimiento?: string;
  items?: ItemReporte[];
  observaciones?: string;
}

/** Refacción o consumible usado en la orden (PDF 29-oct, 5.1) */
export interface MaterialOrden {
  id: number;
  consumibleId: number;
  codigo: string;
  nombre: string;
  categoria?: string;
  esRefaccion: boolean;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  /** Ya se descontó del inventario (al terminar la reparación): no se edita */
  descontado: boolean;
  fechaDescuento?: string;
  stockActual: number;
}

export interface MaterialesOrden {
  ordenId: number;
  ordenFolio: string;
  editable: boolean;
  bloqueo?: string;
  aplicaGarantia: boolean;
  items: MaterialOrden[];
  totalRefacciones: number;
  totalConsumibles: number;
  total: number;
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
  /** Cancela el reporte en INSPECCIÓN (PDF 06-nov); el motivo es obligatorio */
  cancelarReporte: (id: number, motivo: string) =>
    httpClient.post<ResultadoFlujo>(`/flujo/reportes/${id}/cancelar`, { motivo }),
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

  materiales: (ordenId: number) => httpClient.get<MaterialesOrden>(`/flujo/ordenes/${ordenId}/materiales`),
  /** Reemplaza los materiales aún no descontados */
  guardarMateriales: (ordenId: number, items: { consumibleId: number; cantidad: number }[]) =>
    httpClient.put<MaterialesOrden>(`/flujo/ordenes/${ordenId}/materiales`, { items }),
};
