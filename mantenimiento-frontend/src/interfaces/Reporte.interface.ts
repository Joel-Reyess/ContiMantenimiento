import { Prioridad } from './Api.interface';
import type { ReportImageFault, ReportImageFaultCreateRequest } from './ImageFault.interface';

export interface ReporteFallaChecklistItem {
  id: number;
  reporteFallaId: number;
  checklistItemId: number;
  checklistItemPregunta?: string;
  estado?: string;
  notas?: string;
  cantidad?: number;
  fechaAsignacion: string;
}

export interface ReporteFalla {
  id: number;
  folio: string;
  vehiculoId: number;
  vehiculoCodigo?: string;
  vehiculoTipo?: string;
  vehiculoTipoId?: number;
  categoriaFallaId?: number;
  categoriaNombre?: string;
  reportadoPorId: number;
  reportadoPorNombre?: string;
  prioridad: Prioridad;
  prioridadNombre?: string;
  tipoMantenimiento?: string;
  descripcion: string;
  ubicacion?: string;
  puedeOperar: boolean;
  fechaReporte: string;
  tieneOrdenTrabajo: boolean;
  /** INSPECCIÓN: 0 en validación, 1 validado, 2 rechazado */
  estadoInspeccion?: number;
  ordenTrabajoId?: number;
  evidencias: Evidencia[];
  itemsChecklist?: ReporteFallaChecklistItem[];
  imageFaults?: ReportImageFault[];
}

export interface ReporteFallaList {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  categoriaNombre?: string;
  prioridad: Prioridad;
  prioridadNombre?: string;
  tipoMantenimiento?: string;
  fechaReporte: string;
  tieneOrdenTrabajo: boolean;
  /** INSPECCIÓN: 0 en validación, 1 validado, 2 rechazado */
  estadoInspeccion?: number;
  reportadoPorNombre?: string;
  cantidadEvidencias: number;
}

export interface ReporteFallaCreateRequest {
  codigoVehiculo: string;
  categoriaFallaId?: number;
  prioridad?: Prioridad;
  tipoMantenimiento?: string;
  descripcion: string;
  ubicacion?: string;
  puedeOperar?: boolean;
  checklistItemIds?: number[];
  checklistItems?: { id: number; cantidad?: number }[];
  imageFaults?: ReportImageFaultCreateRequest[];
}

export interface Evidencia {
  id: number;
  urlImagen: string;
  nombreArchivo?: string;
  descripcion?: string;
  tipoEvidencia?: string;
  fechaCaptura: string;
}

export interface CategoriaFalla {
  id: number;
  nombre: string;
  descripcion?: string;
  icono?: string;
  activa: boolean;
}
