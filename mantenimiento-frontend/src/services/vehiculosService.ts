import httpClient from './httpClient';
import type {
  Vehiculo,
  VehiculoList,
  VehiculoCreateRequest,
  VehiculoUpdateRequest,
  ApiResponse
} from '@/interfaces';

export interface VehiculoFilters {
  tipo?: number;
  estado?: number;
  ubicacion?: number;
  areaId?: number;
  busqueda?: string;
  soloActivos?: boolean;
  page?: number;
  pageSize?: number;
}

export enum UbicacionVehiculo {
  Piso = 1,
  Taller = 2,
  Transicion = 3,
  TransicionPorReparar = 4,
  TransicionReparado = 5
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const vehiculosService = {
  async getAll(filters?: VehiculoFilters): Promise<ApiResponse<PaginatedResponse<VehiculoList>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.tipo !== undefined) params.append('tipo', filters.tipo.toString());
      if (filters.estado !== undefined) params.append('estado', filters.estado.toString());
      if (filters.ubicacion !== undefined) params.append('ubicacion', filters.ubicacion.toString());
      if (filters.areaId !== undefined) params.append('areaId', filters.areaId.toString());
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.soloActivos !== undefined) params.append('soloActivos', filters.soloActivos.toString());
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/vehiculos${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<PaginatedResponse<VehiculoList>>(endpoint);
  },

  async getById(id: number): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.get<Vehiculo>(`/vehiculos/${id}`);
  },

  async getByCodigo(codigo: string): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.get<Vehiculo>(`/vehiculos/codigo/${encodeURIComponent(codigo)}`);
  },

  async create(vehiculo: VehiculoCreateRequest): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.post<Vehiculo>('/vehiculos', vehiculo);
  },

  async update(id: number, vehiculo: VehiculoUpdateRequest): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.put<Vehiculo>(`/vehiculos/${id}`, vehiculo);
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/vehiculos/${id}`);
  },

  async cambiarEstado(id: number, estado: number): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.patch<Vehiculo>(`/vehiculos/${id}/estado`, estado);
  },

  async cambiarUbicacion(id: number, ubicacion: UbicacionVehiculo): Promise<ApiResponse<string>> {
    return await httpClient.patch<string>(`/vehiculos/${id}/ubicacion`, { ubicacion });
  },

  async getHistorial(id: number): Promise<ApiResponse<unknown[]>> {
    return await httpClient.get<unknown[]>(`/vehiculos/${id}/historial`);
  },

  async uploadImagen(id: number, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('imagen', file);
    return await httpClient.uploadFile<{ url: string }>(`/vehiculos/${id}/imagen`, formData);
  }
};

export default vehiculosService;
