import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface VehiculoDocumento {
  id: number;
  vehiculoId: number;
  nombre: string;
  tipo?: string;
  descripcion?: string;
  urlArchivo: string;
  createdAt: string;
}

export interface VehiculoDocumentoCreateRequest {
  vehiculoId: number;
  nombre: string;
  tipo?: string;
  descripcion?: string;
}

export const vehiculoDocumentosService = {
  async getByVehiculo(vehiculoId: number): Promise<ApiResponse<VehiculoDocumento[]>> {
    return await httpClient.get<VehiculoDocumento[]>(`/vehiculos/${vehiculoId}/documentos`);
  },

  async upload(req: VehiculoDocumentoCreateRequest, file?: File | null): Promise<ApiResponse<VehiculoDocumento>> {
    const formData = new FormData();
    formData.append('vehiculoId', String(req.vehiculoId));
    formData.append('nombre', req.nombre);
    if (req.tipo) formData.append('tipo', req.tipo);
    if (req.descripcion) formData.append('descripcion', req.descripcion);
    if (file) formData.append('archivo', file);
    return await httpClient.uploadFile<VehiculoDocumento>(`/vehiculos/${req.vehiculoId}/documentos`, formData);
  },

  async delete(vehiculoId: number, id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/vehiculos/${vehiculoId}/documentos/${id}`);
  }
};

export default vehiculoDocumentosService;
