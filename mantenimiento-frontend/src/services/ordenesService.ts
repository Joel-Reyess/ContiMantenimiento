import httpClient from './httpClient';
import type {
  OrdenTrabajo,
  OrdenTrabajoList,
  AsignarTecnicoRequest,
  IniciarTrabajoRequest,
  CompletarTrabajoRequest,
  ValidarOrdenRequest,
  AprobarOrdenRequest,
  SolicitudRefaccion,
  Evidencia,
  ApiResponse
} from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';
import { Prioridad } from '@/interfaces/Api.interface'; // Import Prioridad enum

export interface OrdenTrabajoCreateRequest {
  reporteFallaId?: number;
  vehiculoId: number;
  tecnicoAsignadoId?: number;
  prioridad: Prioridad;
  tipoMantenimiento: string;
  descripcion: string;
  notas?: string;
  force?: boolean;
}

export interface OrdenFilters {
  vehiculoId?: number;
  tecnicoId?: number;
  estado?: number;
  prioridad?: number;
  tipoMantenimiento?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export const ordenesService = {
  async getAll(filters?: OrdenFilters): Promise<ApiResponse<PaginatedResponse<OrdenTrabajoList>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.vehiculoId !== undefined) params.append('vehiculoId', filters.vehiculoId.toString());
      if (filters.tecnicoId !== undefined) params.append('tecnicoId', filters.tecnicoId.toString());
      if (filters.estado !== undefined) params.append('estado', filters.estado.toString());
      if (filters.prioridad !== undefined) params.append('prioridad', filters.prioridad.toString());
      if (filters.tipoMantenimiento) params.append('tipoMantenimiento', filters.tipoMantenimiento);
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/ordenes${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<PaginatedResponse<OrdenTrabajoList>>(endpoint);
  },

  async getById(id: number): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.get<OrdenTrabajo>(`/ordenes/${id}`);
  },

  async getMisOrdenes(): Promise<ApiResponse<OrdenTrabajoList[]>> {
    return await httpClient.get<OrdenTrabajoList[]>('/ordenes/mis-ordenes');
  },

  async getByVehiculo(vehiculoId: number): Promise<ApiResponse<OrdenTrabajoList[]>> {
    return await httpClient.get<OrdenTrabajoList[]>(`/ordenes/vehiculo/${vehiculoId}`);
  },

  async create(orden: OrdenTrabajoCreateRequest, force: boolean = false): Promise<ApiResponse<{
    id: number;
    folio: string;
  }>> {
    const params = new URLSearchParams();
    if (force) params.append("force", "true");
    const queryString = params.toString();

    return await httpClient.post<{
      id: number;
      folio: string;
    }>(`/ordenes${queryString ? `?${queryString}` : ""}`, orden);
  },

  async asignarTecnico(ordenId: number, request: AsignarTecnicoRequest): Promise<ApiResponse<OrdenTrabajo>> {
    console.debug('POST /ordenes/asignar payload', { ordenId, request });
    const response = await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/asignar`, request);
    console.debug('POST /ordenes/asignar response', response);
    return response;
  },

  async iniciarTrabajo(ordenId: number, request?: IniciarTrabajoRequest): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/iniciar`, request || {});
  },

  async completarTrabajo(ordenId: number, request: CompletarTrabajoRequest): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/completar`, request);
  },

  async validarOrden(ordenId: number, request?: ValidarOrdenRequest): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/validar`, request || {});
  },

  async aprobarOrden(ordenId: number, request: AprobarOrdenRequest): Promise<ApiResponse<string>> {
    return await httpClient.post<string>(`/ordenes/${ordenId}/aprobar`, request);
  },

  async rechazarOrden(ordenId: number, motivo: string): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/rechazar`, { motivo });
  },

  async cancelarOrden(ordenId: number, motivo: string): Promise<ApiResponse<OrdenTrabajo>> {
    return await httpClient.post<OrdenTrabajo>(`/ordenes/${ordenId}/cancelar`, { motivo });
  },

  async programarPreventivo(tipoVehiculoId: number): Promise<ApiResponse<{ cantidadCreada?: number }>> {
    return await httpClient.post<{ cantidadCreada?: number }>(`/ordenes/programar-preventivo/${tipoVehiculoId}`);
  },

  // Evidencias
  async uploadEvidencia(ordenId: number, file: File, descripcion?: string, tipoEvidencia?: string): Promise<ApiResponse<Evidencia>> {
    const formData = new FormData();
    formData.append('archivo', file);
    if (descripcion) {
      formData.append('descripcion', descripcion);
    }
    if (tipoEvidencia) {
      formData.append('tipoEvidencia', tipoEvidencia);
    }
    return await httpClient.uploadFile<Evidencia>(`/ordenes/${ordenId}/evidencias`, formData);
  },

  async deleteEvidencia(ordenId: number, evidenciaId: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/ordenes/${ordenId}/evidencias/${evidenciaId}`);
  },

  // Checklist
  async guardarRespuestaChecklist(
    ordenId: number,
    itemId: number,
    valor: string,
    notas?: string
  ): Promise<ApiResponse<void>> {
    return await httpClient.post<void>(`/ordenes/${ordenId}/checklist/${itemId}`, { valor, notas });
  },

  async uploadFotoChecklist(
    ordenId: number,
    itemId: number,
    file: File
  ): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('foto', file);
    return await httpClient.uploadFile<{ url: string }>(`/ordenes/${ordenId}/checklist/${itemId}/foto`, formData);
  },

  // Solicitudes de Refacción
  async getSolicitudesRefaccion(ordenId: number): Promise<ApiResponse<SolicitudRefaccion[]>> {
    return await httpClient.get<SolicitudRefaccion[]>(`/ordenes/${ordenId}/refacciones`);
  },

  async crearSolicitudRefaccion(
    ordenId: number,
    solicitud: {
      nombreRefaccion: string;
      numeroParte?: string;
      cantidad: number;
      justificacion?: string;
      costoEstimado?: number;
    }
  ): Promise<ApiResponse<SolicitudRefaccion>> {
    return await httpClient.post<SolicitudRefaccion>(`/ordenes/${ordenId}/refacciones`, solicitud);
  },

  async aprobarRefaccion(solicitudId: number): Promise<ApiResponse<SolicitudRefaccion>> {
    return await httpClient.post<SolicitudRefaccion>(`/refacciones/${solicitudId}/aprobar`);
  },

  async rechazarRefaccion(solicitudId: number, motivo: string): Promise<ApiResponse<SolicitudRefaccion>> {
    return await httpClient.post<SolicitudRefaccion>(`/refacciones/${solicitudId}/rechazar`, { motivo });
  },

  async marcarEntregada(solicitudId: number, costoReal?: number): Promise<ApiResponse<SolicitudRefaccion>> {
    return await httpClient.post<SolicitudRefaccion>(`/refacciones/${solicitudId}/entregar`, { costoReal });
  }
};

export default ordenesService;
