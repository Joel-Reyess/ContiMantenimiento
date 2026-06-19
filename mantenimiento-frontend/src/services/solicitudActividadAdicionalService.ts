import httpClient from './httpClient';
import type { ApiResponse, SolicitudActividadAdicional, CreateSolicitudActividadAdicional, ResponderSolicitudActividad } from '@/interfaces';

export const solicitudActividadAdicionalService = {
  async getAll(estado?: string, ordenTrabajoId?: number): Promise<ApiResponse<SolicitudActividadAdicional[]>> {
    let query = '';
    const params = new URLSearchParams();
    if (estado) params.append('estado', estado);
    if (ordenTrabajoId) params.append('ordenTrabajoId', ordenTrabajoId.toString());
    
    if (params.toString()) query = `?${params.toString()}`;
    
    return await httpClient.get<SolicitudActividadAdicional[]>(`/solicitudactividadadicional${query}`);
  },

  async getById(id: number): Promise<ApiResponse<SolicitudActividadAdicional>> {
    return await httpClient.get<SolicitudActividadAdicional>(`/solicitudactividadadicional/${id}`);
  },

  async create(data: CreateSolicitudActividadAdicional): Promise<ApiResponse<any>> {
    return await httpClient.post<any>('/solicitudactividadadicional', data);
  },

  async responder(data: ResponderSolicitudActividad): Promise<ApiResponse<string>> {
    return await httpClient.post<string>(`/solicitudactividadadicional/${data.id}/responder`, {
      aprobado: data.aprobado,
      comentarios: data.comentarios
    });
  }
};
