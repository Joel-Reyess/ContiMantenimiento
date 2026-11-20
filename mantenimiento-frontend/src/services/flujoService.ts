import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

/** Flujo de 7 etapas y Zona de Transición (PDF 23-oct-2026) */

/** sinproveedor (Reporte 6): la orden espera en SELECCIÓN porque ninguna empresa está disponible (morado oscuro) */
export type EstadoEtapa = 'completada' | 'pendiente' | 'rechazada' | 'bloqueada' | 'sinproveedor' | 'inactiva';

export interface EtapaFlujo {
  clave:
    | 'REPORTE' | 'INSPECCION' | 'TRASLADO' | 'SELECCION' | 'TALLER' | 'TRASLADO_RETORNO' | 'VALIDACION' | 'DISPONIBLE'
    // Flujo de equipos eléctricos (correctivo y preventivo)
    | 'ACEPTACION' | 'INSPECCION_PREVIA' | 'REPARACION' | 'PRUEBAS' | 'TRASLADO_AREA' | 'ENTREGA'
    | 'INICIO' | 'TRASLADO_TALLER' | 'CHECKLIST' | 'COMPLETADO';
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
  | 'validarReparacion'
  /** Reporte 6: vista previa de la etapa SELECCIÓN y reasignación (Administrador y Gerente) */
  | 'verSeleccion'
  | 'reasignarProveedor'
  // Flujo de equipos eléctricos
  | 'aceptarElectrico'
  | 'cancelarElectrico'
  | 'confirmarIngresoTaller'
  | 'inspeccionPrevia'
  | 'registrarPruebas'
  | 'checklistPreventivo'
  | 'confirmarTrasladoArea'
  | 'aprobarEntrega'
  | 'subirDocumentoEntrega'
  | 'imprimirFormatoEntrega';

/** Datos propios del flujo de equipos eléctricos en el seguimiento de la orden */
export interface ElectricoInfo {
  esPreventivo: boolean;
  /** Operativo o Fuera de servicio */
  estadoEquipo: string;
  /** Pendiente de ingreso, En reparación o En mantenimiento */
  subestadoEquipo?: string;
  numeroEconomico?: string;
  horometro?: number;
  empresa?: string;
  tecnico?: string;
  diagnostico?: string;
  resultadoPruebas?: string;
  trabajoRealizado?: string;
  tipoRevision?: string;
  codigoFallaEncontrado?: boolean;
  codigoFalla?: string;
  codigoFallaResuelto?: boolean;
  fechaAprobacionEntrega?: string;
  aproboEntrega?: string;
  fechaDocumentoEntrega?: string;
  documentos: { id: number; url: string; nombreArchivo: string; tipoContenido?: string; tamano: number; subidoPor?: string; fecha: string }[];
  checklist: { numero: number; nombre: string; actividades: { id: number; numero: string; descripcion: string; resultado?: 'Bueno' | 'Malo' | null; observacion?: string }[] }[];
  activas: number;
  capacidad: number;
}

export interface Flujo {
  /** Contenedor (8 etapas) o Electrico (equipos eléctricos) */
  flujo?: 'Contenedor' | 'Electrico';
  electrico?: ElectricoInfo;
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
  /** Empresa proveedora asignada (Reporte 6) */
  empresaId?: number;
  empresa?: string;
  /** En la zona sin empresa: espera en SELECCIÓN */
  sinProveedor?: boolean;
  /** La empresa está en su capacidad máxima de órdenes activas */
  capacidadLlena?: boolean;
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

/** Situación de una empresa para la asignación automática (Reporte 6) */
export interface EmpresaSeleccion {
  id: number;
  nombre: string;
  identificador?: string;
  activa: boolean;
  tienePresupuesto: boolean;
  asignado: number;
  utilizado: number;
  saldo: number;
  /** Disponible, Preventivo, Agotado, Sin presupuesto */
  estadoFinanciero: string;
  activas: number;
  capacidad: number;
  semaforoCapacidad: 'verde' | 'amarillo' | 'rojo';
  elegible: boolean;
  motivo?: string;
  /** Disponible, Inactiva, Sin presupuesto, Capacidad máxima, Sin técnicos */
  disponibilidad: string;
  tecnicos: { id: number; nombre: string; ordenes: number }[];
}

export interface ActividadCosto {
  checklistItemId?: number;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

/** Vista previa de la etapa SELECCIÓN de una orden */
export interface SeleccionOrden {
  ordenId: number;
  ordenFolio: string;
  vehiculoCodigo?: string;
  estado: 'pendiente' | 'asignada' | 'sinDisponibilidad' | 'aceptada';
  empresa?: EmpresaSeleccion;
  tecnicoId?: number;
  tecnico?: string;
  fechaSeleccion?: string;
  fechaSinProveedor?: string;
  costosAplicables: ActividadCosto[];
  costoEstimado: number;
  puedeReasignar: boolean;
  empresas: EmpresaSeleccion[];
  historial: HistorialFlujo[];
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
  seleccion: (ordenId: number) => httpClient.get<SeleccionOrden>(`/flujo/ordenes/${ordenId}/seleccion`),
  reasignar: (ordenId: number, empresaId: number, tecnicoId: number | undefined, motivo: string) =>
    httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/seleccion/reasignar`, { empresaId, tecnicoId, motivo }),
  validarReparacion: (ordenId: number, aprobado: boolean, motivos: MotivoRechazo[] = [], observacion?: string) =>
    httpClient.post<ResultadoFlujo>(`/flujo/ordenes/${ordenId}/validar`, { aprobado, motivos, observacion }),

  materiales: (ordenId: number) => httpClient.get<MaterialesOrden>(`/flujo/ordenes/${ordenId}/materiales`),
  /** Reemplaza los materiales aún no descontados */
  guardarMateriales: (ordenId: number, items: { consumibleId: number; cantidad: number }[]) =>
    httpClient.put<MaterialesOrden>(`/flujo/ordenes/${ordenId}/materiales`, { items }),
};
