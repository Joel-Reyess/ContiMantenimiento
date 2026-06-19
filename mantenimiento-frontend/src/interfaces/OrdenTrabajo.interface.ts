import type { EstadoOrdenTrabajo, Prioridad } from './Api.interface';
import type { Evidencia, ReporteFalla } from './Reporte.interface';

export interface OrdenTrabajo {
  id: number;
  folio: string;
  reporteFallaId?: number;
  reporteFallaFolio?: string;
  reporteFalla?: ReporteFalla;
  vehiculoId: number;
  vehiculoCodigo?: string;
  vehiculoTipo?: string;
  tecnicoAsignadoId?: number;
  tecnicoNombre?: string;
  tecnicoAsignadoNombre?: string;
  tecnicoId?: number;
  tecnicoAsignado?: {
    id?: number;
    nombreCompleto?: string;
    username?: string;
    nombre?: string;
  };
  creadoPorId: number;
  creadoPorNombre?: string;
  estado: EstadoOrdenTrabajo;
  estadoNombre?: string;
  prioridad: Prioridad;
  prioridadNombre?: string;
  tipoMantenimiento: string;
  descripcion: string;
  diagnostico?: string;
  trabajoRealizado?: string;
  fechaCreacion: string;
  fechaAsignacion?: string;
  fechaInicio?: string;
  fechaFinalizacion?: string;
  fechaValidacion?: string;
  horasTrabajadas?: number;
  costoTotal?: number;
  validadoPorNombre?: string;
  notas?: string;
  checklistRecepcionJson?: string;
  herramientasUsadas?: string;
  horasHerramienta?: number;
  tiempoEsperaHoras?: number;
  tiempoReparacionHoras?: number;
  tiempoTransicionHoras?: number;
  vehiculoUbicacion?: number;
  vehiculoUbicacionNombre?: string;
  firmaAsignacionTexto?: string;
  fechaFirmaAsignacion?: string;
  firmadoPorId?: number;
  firmadoPorNombre?: string;
  
  // New Approval Fields
  estadoAprobacionLider?: number; // Enum: 0=Pendiente, 1=Aprobado, 2=Rechazado
  estadoAprobacionSupervisor?: number;
  comentariosAprobacionLider?: string;
  comentariosAprobacionSupervisor?: string;
  firmaLider?: string;
  firmaLiderNombre?: string;
  firmaLiderFecha?: string;
  firmaSupervisor?: string;
  firmaSupervisorNombre?: string;
  firmaSupervisorFecha?: string;

  evidencias: Evidencia[];
  respuestasChecklist: ChecklistRespuesta[];
  solicitudesRefaccion: SolicitudRefaccion[];
  solicitudesActividadAdicional: SolicitudActividadAdicional[];
  itemsChecklistReporte?: ReporteChecklistItem[];
  itemsChecklist?: OrdenTrabajoChecklistItem[];
}

export interface SolicitudActividadAdicional {
  id: number;
  ordenTrabajoId: number;
  ordenTrabajoFolio?: string;
  descripcion: string;
  justificacion?: string;
  estado: string;
  solicitadoPorId: number;
  solicitadoPorNombre?: string;
  fechaSolicitud: string;
  aprobadoPorId?: number;
  aprobadoPorNombre?: string;
  fechaRespuesta?: string;
  comentariosResolucion?: string;
  fotoUrl?: string;
}

export interface CreateSolicitudActividadAdicional {
  ordenTrabajoId: number;
  descripcion: string;
  justificacion?: string;
  fotoUrl?: string;
}

export interface ResponderSolicitudActividad {
  id: number;
  aprobado: boolean;
  comentarios?: string;
}

export interface OrdenTrabajoChecklistItem {
  id: number;
  ordenTrabajoId: number;
  checklistItemId: number;
  checklistItemPregunta: string;
  fechaAsignacion: string;
  fechaCompletado?: string;
  estado: string;
  cantidad?: number;
  notas?: string;
  fotoUrl?: string;
  tipo?: 'Checklist' | 'ActividadAdicional';
  solicitudActividadId?: number;
}

export interface OrdenTrabajoList {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  vehiculoUbicacion?: number;
  vehiculoUbicacionNombre?: string;
  tecnicoNombre?: string;
  estado: EstadoOrdenTrabajo;
  estadoNombre?: string;
  prioridad: Prioridad;
  prioridadNombre?: string;
  tipoMantenimiento: string;
  fechaCreacion: string;
  fechaFinalizacion?: string;
}

export interface OrdenTrabajoCreateRequest {
  reporteFallaId?: number;
  vehiculoId: number;
  tecnicoAsignadoId?: number;
  prioridad?: Prioridad;
  tipoMantenimiento?: string;
  descripcion: string;
  notas?: string;
}

export interface AsignarTecnicoRequest {
  tecnicoId: number;
  tecnicoAsignadoId?: number;
  firmadoPorId?: number;
  firmaAsignacionTexto?: string;
}

export interface IniciarTrabajoRequest {
  diagnostico?: string;
}

export interface CompletarTrabajoRequest {
  trabajoRealizado: string;
  horasTrabajadas: number;
  notas?: string;
}

export interface ValidarOrdenRequest {
  observaciones?: string;
  aprobado?: boolean;
}

export interface AprobarOrdenRequest {
  aprobado: boolean;
  comentarios?: string;
  rolAprobador: 'Lider' | 'Supervisor';
}

export interface ChecklistRespuesta {
  id: number;
  checklistItemId: number;
  pregunta?: string;
  valor?: string;
  fotoUrl?: string;
  notas?: string;
  cantidad?: number;
  fechaRespuesta: string;
  costoEstimado?: number;
}

export interface ReporteChecklistItem {
  id?: number;
  checklistItemId: number;
  checklistItemPregunta?: string;
  estado?: string;
  notas?: string;
  fechaAsignacion?: string;
}

export interface SolicitudRefaccion {
  id: number;
  ordenTrabajoId: number;
  ordenTrabajoFolio?: string;
  nombreRefaccion: string;
  numeroParte?: string;
  cantidad: number;
  justificacion?: string;
  estado: string;
  costoEstimado?: number;
  costoReal?: number;
  solicitadoPorNombre?: string;
  aprobadoPorNombre?: string;
  fechaSolicitud: string;
  fechaAprobacion?: string;
  fechaEntrega?: string;
  motivoRechazo?: string;
}
