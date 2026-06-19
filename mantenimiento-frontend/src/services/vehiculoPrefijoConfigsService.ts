import httpClient from './httpClient';
import type {
  VehiculoPrefijoConfig,
  ApiResponse
} from '@/interfaces';

export interface VehiculoPrefijoConfigFilters {
  activo?: boolean;
  tipoVehiculoId?: number;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const vehiculoPrefijoConfigsService = {
  async getAll(filters?: VehiculoPrefijoConfigFilters): Promise<ApiResponse<PaginatedResponse<VehiculoPrefijoConfig>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.activo !== undefined) params.append('activo', filters.activo.toString());
      if (filters.tipoVehiculoId !== undefined) params.append('tipoVehiculoId', filters.tipoVehiculoId.toString());
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/vehiculoprefijoconfigs${queryString ? `?${queryString}` : ''}`;

    const res = await httpClient.get<PaginatedResponse<VehiculoPrefijoConfig> | VehiculoPrefijoConfig[]>(endpoint);

    // Backend devuelve lista simple (no ApiResponse), normalizamos
    if (Array.isArray(res as any)) {
      const items = res as unknown as VehiculoPrefijoConfig[];
      return {
        success: true,
        data: {
          items,
          totalItems: items.length,
          page: 1,
          pageSize: items.length,
          totalPages: 1
        },
        message: 'OK'
      };
    }

    return res as ApiResponse<PaginatedResponse<VehiculoPrefijoConfig>>;
  },

  async getById(id: number): Promise<ApiResponse<VehiculoPrefijoConfig>> {
    const res = await httpClient.get<ApiResponse<VehiculoPrefijoConfig> | VehiculoPrefijoConfig>(`/vehiculoprefijoconfigs/${id}`);
    if ((res as ApiResponse<VehiculoPrefijoConfig>).success === undefined) {
      return { success: true, data: res as unknown as VehiculoPrefijoConfig, message: 'OK' };
    }
    return res as ApiResponse<VehiculoPrefijoConfig>;
  },

  async create(config: Omit<VehiculoPrefijoConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<VehiculoPrefijoConfig>> {
    const res = await httpClient.post<ApiResponse<VehiculoPrefijoConfig> | VehiculoPrefijoConfig>('/vehiculoprefijoconfigs', config);
    if ((res as ApiResponse<VehiculoPrefijoConfig>).success === undefined) {
      return { success: true, data: res as unknown as VehiculoPrefijoConfig, message: 'OK' };
    }
    return res as ApiResponse<VehiculoPrefijoConfig>;
  },

  async update(id: number, config: Partial<Omit<VehiculoPrefijoConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<VehiculoPrefijoConfig>> {
    const res = await httpClient.put<ApiResponse<VehiculoPrefijoConfig> | VehiculoPrefijoConfig>(`/vehiculoprefijoconfigs/${id}`, config);
    if ((res as ApiResponse<VehiculoPrefijoConfig>).success === undefined) {
      return { success: true, data: res as unknown as VehiculoPrefijoConfig, message: 'OK' };
    }
    return res as ApiResponse<VehiculoPrefijoConfig>;
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    const res = await httpClient.delete<ApiResponse<void> | null>(`/vehiculoprefijoconfigs/${id}`);
    if (res === null || (res as ApiResponse<void>).success === undefined) {
      return { success: true, data: null, message: 'OK' };
    }
    return res as ApiResponse<void>;
  },

  async getTipoVehiculoIdByCodigo(codigoVehiculo: string): Promise<ApiResponse<number | null>> {
    const res = await httpClient.get<ApiResponse<number | null> | number | null>(`/vehiculoprefijoconfigs/tipo-vehiculo-por-codigo/${encodeURIComponent(codigoVehiculo)}`);
    if ((res as ApiResponse<number | null>).success === undefined) {
      return { success: true, data: res as unknown as number | null, message: 'OK' };
    }
    return res as ApiResponse<number | null>;
  }
};

export type { VehiculoPrefijoConfig };
