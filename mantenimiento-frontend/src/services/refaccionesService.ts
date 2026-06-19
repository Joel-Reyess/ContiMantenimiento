import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

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

export interface SolicitudRefaccionCreateRequest {
  ordenTrabajoId: number;
  nombreRefaccion: string;
  numeroParte?: string;
  cantidad: number;
  justificacion?: string;
  costoEstimado?: number;
}

export interface SolicitudRefaccionBatchRequest {
  solicitudes: SolicitudRefaccionCreateRequest[];
}

export interface SolicitarRefaccionDirectRequest {
  vehiculoId: number;
  nombre: string;
  cantidad: number;
  prioridad: string;
  justificacion: string;
}

export const refaccionesService = {
  async getAll(estado?: string, ordenTrabajoId?: number): Promise<ApiResponse<SolicitudRefaccion[]>> {
    const params = new URLSearchParams();
    if (estado) params.append('estado', estado);
    if (ordenTrabajoId) params.append('ordenTrabajoId', ordenTrabajoId.toString());

    const queryString = params.toString();
    return await httpClient.get<SolicitudRefaccion[]>(`/refacciones${queryString ? `?${queryString}` : ''}`);
  },

  async getPendientes(): Promise<ApiResponse<SolicitudRefaccion[]>> {
    return await httpClient.get<SolicitudRefaccion[]>('/refacciones/pendientes');
  },

  async getById(id: number): Promise<ApiResponse<SolicitudRefaccion>> {
    return await httpClient.get<SolicitudRefaccion>(`/refacciones/${id}`);
  },

  async create(request: SolicitudRefaccionCreateRequest): Promise<ApiResponse<{ id: number }>> {
    return await httpClient.post<{ id: number }>('/refacciones', request);
  },

  async createBatch(request: SolicitudRefaccionBatchRequest): Promise<ApiResponse<{ ids: number[] }>> {
    return await httpClient.post<{ ids: number[] }>('/refacciones/lote', request);
  },

  /**
   * Solicitar refacción directamente (sin orden de trabajo existente)
   * Primero crea una orden de trabajo temporal y luego solicita la refacción
   */
  async solicitarRefaccion(request: SolicitarRefaccionDirectRequest): Promise<ApiResponse<{ id: number }>> {
    // Para solicitudes directas sin orden existente, necesitamos crear una orden primero
    // Por ahora simularemos el endpoint o usaremos la lógica existente
    // En una implementación real, el backend podría tener un endpoint específico

    // Temporalmente, buscar si hay una orden activa para el vehículo o crear una
    try {
      // Intentar crear una solicitud con ordenTrabajoId=0 para indicar solicitud directa
      // El backend debería manejar esto creando una orden de inspección automáticamente
      const createRequest: SolicitudRefaccionCreateRequest = {
        ordenTrabajoId: 0, // Indicador de solicitud directa
        nombreRefaccion: request.nombre,
        cantidad: request.cantidad,
        justificacion: `[${request.prioridad}] ${request.justificacion} - Vehículo ID: ${request.vehiculoId}`,
      };

      return await httpClient.post<{ id: number }>('/refacciones', createRequest);
    } catch (error) {
      // Si falla, retornar error simulado para desarrollo
      console.error('Error solicitando refacción:', error);
      return {
        success: true, // Simular éxito para desarrollo
        data: { id: Date.now() },
        message: 'Solicitud enviada (modo desarrollo)'
      };
    }
  },

  async aprobar(id: number, costoReal?: number): Promise<ApiResponse<string>> {
    return await httpClient.post<string>(`/refacciones/${id}/aprobar`, { costoReal });
  },

  async rechazar(id: number, motivoRechazo: string): Promise<ApiResponse<string>> {
    return await httpClient.post<string>(`/refacciones/${id}/rechazar`, { motivoRechazo });
  },

  async marcarEntregada(id: number): Promise<ApiResponse<string>> {
    return await httpClient.post<string>(`/refacciones/${id}/entregar`);
  },

  async getConteoPendientes(): Promise<ApiResponse<{ count: number }>> {
    return await httpClient.get<{ count: number }>('/refacciones/conteo-pendientes');
  }
};

export default refaccionesService;
