import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface LiderTipoVehiculoAsignacionDto {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  tipoVehiculo: number;
  tipoVehiculoNombre: string;
  createdAt: string;
}

export interface CreateLiderTipoVehiculoAsignacionRequest {
  usuarioId: number;
  tipoVehiculo: number;
}

export const asignacionesService = {
  async getAll(): Promise<ApiResponse<LiderTipoVehiculoAsignacionDto[]>> {
    return await httpClient.get<LiderTipoVehiculoAsignacionDto[]>('/lidertipovehiculoasignacion');
  },

  async getByUsuario(usuarioId: number): Promise<ApiResponse<LiderTipoVehiculoAsignacionDto[]>> {
    return await httpClient.get<LiderTipoVehiculoAsignacionDto[]>(`/lidertipovehiculoasignacion/usuario/${usuarioId}`);
  },

  async create(request: CreateLiderTipoVehiculoAsignacionRequest): Promise<ApiResponse<LiderTipoVehiculoAsignacionDto>> {
    return await httpClient.post<LiderTipoVehiculoAsignacionDto>('/lidertipovehiculoasignacion', request);
  },

  async createBatch(requests: CreateLiderTipoVehiculoAsignacionRequest[]): Promise<ApiResponse<LiderTipoVehiculoAsignacionDto[]>> {
    return await httpClient.post<LiderTipoVehiculoAsignacionDto[]>('/lidertipovehiculoasignacion/batch', requests);
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/lidertipovehiculoasignacion/${id}`);
  }
};

export default asignacionesService;
