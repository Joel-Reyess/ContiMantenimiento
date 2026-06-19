import httpClient from './httpClient';
import type {
  ApiResponse,
  ImageFault,
  ImageFaultCreateRequest,
  ImageFaultUpdateRequest,
} from '@/interfaces';

export const imageFaultsService = {
  async getAll(onlyActive = true): Promise<ApiResponse<ImageFault[]>> {
    return await httpClient.get<ImageFault[]>(`/imagefaults?onlyActive=${onlyActive}`);
  },

  async getById(id: number): Promise<ApiResponse<ImageFault>> {
    return await httpClient.get<ImageFault>(`/imagefaults/${id}`);
  },

  async create(payload: ImageFaultCreateRequest): Promise<ApiResponse<ImageFault>> {
    return await httpClient.post<ImageFault>('/imagefaults', payload);
  },

  async update(payload: ImageFaultUpdateRequest): Promise<ApiResponse<ImageFault>> {
    return await httpClient.put<ImageFault>(`/imagefaults/${payload.id}`, payload);
  },

  async delete(id: number): Promise<ApiResponse<boolean>> {
    return await httpClient.delete<boolean>(`/imagefaults/${id}`);
  },
};

export default imageFaultsService;
