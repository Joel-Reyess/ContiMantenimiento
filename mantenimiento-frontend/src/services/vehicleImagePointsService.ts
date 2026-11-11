import httpClient from './httpClient';
import type {
  ApiResponse,
  VehicleImagePoint,
  VehicleImagePointCreateRequest,
  VehicleImagePointUpdateRequest,
} from '@/interfaces';

interface VehicleImagePointFilters {
  imageKey?: string;
  onlyActive?: boolean;
}

export const vehicleImagePointsService = {
  async getAll(filters?: VehicleImagePointFilters): Promise<ApiResponse<VehicleImagePoint[]>> {
    const params = new URLSearchParams();
    if (filters?.imageKey) params.append('imageKey', filters.imageKey);
    if (filters?.onlyActive !== undefined) params.append('onlyActive', String(filters.onlyActive));
    const qs = params.toString();
    return await httpClient.get<VehicleImagePoint[]>(`/vehicleimagepoints${qs ? `?${qs}` : ''}`);
  },

  async getById(id: number): Promise<ApiResponse<VehicleImagePoint>> {
    return await httpClient.get<VehicleImagePoint>(`/vehicleimagepoints/${id}`);
  },

  async create(payload: VehicleImagePointCreateRequest): Promise<ApiResponse<VehicleImagePoint>> {
    return await httpClient.post<VehicleImagePoint>('/vehicleimagepoints', payload);
  },

  async update(payload: VehicleImagePointUpdateRequest): Promise<ApiResponse<VehicleImagePoint>> {
    return await httpClient.put<VehicleImagePoint>(`/vehicleimagepoints/${payload.id}`, payload);
  },

  /** FV-03: liga el punto con la actividad del checklist que representa (para los puntos "Sin actividad") */
  async ligarActividad(id: number, checklistItemId: number): Promise<ApiResponse<number | null>> {
    return await httpClient.put<number | null>(`/vehicleimagepoints/${id}/actividad`, { checklistItemId });
  },

  async delete(id: number): Promise<ApiResponse<boolean>> {
    return await httpClient.delete<boolean>(`/vehicleimagepoints/${id}`);
  },
};

export default vehicleImagePointsService;
