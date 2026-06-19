import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface SolicitudCambio {
  id: number;
  vehiculoId: number;
  vehiculoCodigo: string;
  descripcion: string;
  estado: number;
  estadoNombre: string;
  solicitadoPorId: number;
  solicitadoPorNombre: string;
  fechaSolicitud: string;
  aprobadoPorId?: number;
  aprobadoPorNombre?: string;
  fechaRespuesta?: string;
  comentariosRespuesta?: string;
}

export interface CreateSolicitudCambio {
  vehiculoId: number;
  descripcion: string;
}

export interface ResponderSolicitudCambio {
  id: number;
  aprobado: boolean;
  comentarios?: string;
}

export const solicitudCambioService = {
  async getAll(vehiculoId?: number): Promise<ApiResponse<SolicitudCambio[]>> {
    const query = vehiculoId ? `?vehiculoId=${vehiculoId}` : '';
    return await httpClient.get<SolicitudCambio[]>(`/solicitudcambio${query}`);
  },

  async create(data: CreateSolicitudCambio): Promise<ApiResponse<SolicitudCambio>> {
    return await httpClient.post<SolicitudCambio>('/solicitudcambio', data);
  },

  async responder(data: ResponderSolicitudCambio): Promise<ApiResponse<boolean>> {
    return await httpClient.post<boolean>('/solicitudcambio/responder', data);
  }
};
