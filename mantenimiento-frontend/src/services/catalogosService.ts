import httpClient from './httpClient';
import type { CategoriaFalla, Area, ApiResponse } from '@/interfaces';

export interface TipoVehiculoItem {
  id: number;
  nombre: string;
  descripcion?: string;
  imagenUrl?: string;
  imagenFallasUrl?: string;
  maxInWorkshop?: number;
  frecuenciaMantenimientoDias?: number;
  frecuenciaPreventivoMeses?: number;
  programadosPorSemana?: number;
  fechaProximoMantenimiento?: string;
  activo: boolean;
  proveedorId?: number;
  proveedorNombre?: string;
  totalVehiculos?: number;
}

export interface EstadoItem {
  id: number;
  nombre: string;
}

export interface PrioridadItem {
  id: number;
  nombre: string;
}

export interface RolItem {
  id: number;
  nombre: string;
}

export interface TecnicoItem {
  id: number;
  nombre: string;
  tipo: string;
  especialidad?: string;
  activo: boolean;
}

export const catalogosService = {
  // Tipos de Vehículo
  async getTiposVehiculo(): Promise<ApiResponse<TipoVehiculoItem[]>> {
    return await httpClient.get<TipoVehiculoItem[]>('/tipovehiculo');
  },

  async createTipoVehiculo(tipo: Partial<TipoVehiculoItem>): Promise<ApiResponse<TipoVehiculoItem>> {
    return await httpClient.post<TipoVehiculoItem>('/tipovehiculo', tipo);
  },

  async updateTipoVehiculo(id: number, tipo: Partial<TipoVehiculoItem>): Promise<ApiResponse<void>> {
    const payload = { ...tipo };
    // Aseguramos que la frecuencia sea número o null
    if (payload.frecuenciaMantenimientoDias !== undefined) {
      payload.frecuenciaMantenimientoDias = payload.frecuenciaMantenimientoDias ? Number(payload.frecuenciaMantenimientoDias) : undefined;
    }
    if (payload.frecuenciaPreventivoMeses !== undefined) {
      payload.frecuenciaPreventivoMeses = payload.frecuenciaPreventivoMeses ? Number(payload.frecuenciaPreventivoMeses) : undefined;
    }
    if (payload.programadosPorSemana !== undefined) {
      payload.programadosPorSemana = payload.programadosPorSemana ? Number(payload.programadosPorSemana) : undefined;
    }
    return await httpClient.put<void>(`/tipovehiculo/${id}`, payload);
  },

  async deleteTipoVehiculo(id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/tipovehiculo/${id}`);
  },

  async uploadImagenTipoVehiculo(id: number, file: File): Promise<ApiResponse<{ imagenUrl: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return await httpClient.uploadFile<{ imagenUrl: string }>(`/tipovehiculo/${id}/imagen`, formData);
  },

  async uploadImagenFallasTipoVehiculo(id: number, file: File): Promise<ApiResponse<{ imagenFallasUrl: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return await httpClient.uploadFile<{ imagenFallasUrl: string }>(`/tipovehiculo/${id}/imagen-fallas`, formData);
  },

  // Estados de Vehículo
  async getEstadosVehiculo(): Promise<ApiResponse<EstadoItem[]>> {
    return await httpClient.get<EstadoItem[]>('/catalogos/estados-vehiculo');
  },

  // Estados de Orden de Trabajo
  async getEstadosOrden(): Promise<ApiResponse<EstadoItem[]>> {
    return await httpClient.get<EstadoItem[]>('/catalogos/estados-orden');
  },

  // Prioridades
  async getPrioridades(): Promise<ApiResponse<PrioridadItem[]>> {
    return await httpClient.get<PrioridadItem[]>('/catalogos/prioridades');
  },

  // Categorías de Falla
  async getCategoriasFalla(): Promise<ApiResponse<CategoriaFalla[]>> {
    return await httpClient.get<CategoriaFalla[]>('/catalogos/categorias-falla');
  },
  // Alias de compatibilidad
  async getCategorias(): Promise<ApiResponse<CategoriaFalla[]>> {
    return await httpClient.get<CategoriaFalla[]>('/catalogos/categorias-falla');
  },

  // Áreas
  async getAreas(): Promise<ApiResponse<Area[]>> {
    return await httpClient.get<Area[]>('/catalogos/areas');
  },

  async getAreaById(id: number): Promise<ApiResponse<Area>> {
    return await httpClient.get<Area>(`/catalogos/areas/${id}`);
  },

  async createArea(area: { nombre: string; codigo?: string; descripcion?: string; supervisorId?: number }): Promise<ApiResponse<Area>> {
    return await httpClient.post<Area>('/catalogos/areas', area);
  },

  async updateArea(id: number, area: { nombre?: string; codigo?: string; descripcion?: string; supervisorId?: number; activa?: boolean }): Promise<ApiResponse<Area>> {
    return await httpClient.put<Area>(`/catalogos/areas/${id}`, area);
  },

  // Roles
  async getRoles(): Promise<ApiResponse<RolItem[]>> {
    return await httpClient.get<RolItem[]>('/catalogos/roles');
  },

  // Técnicos disponibles
  async getTecnicos(soloActivos: boolean = true): Promise<ApiResponse<TecnicoItem[]>> {
    const endpoint = soloActivos
      ? '/catalogos/tecnicos?soloActivos=true'
      : '/catalogos/tecnicos';
    return await httpClient.get<TecnicoItem[]>(endpoint);
  },

  // Tipos de Mantenimiento
  async getTiposMantenimiento(): Promise<ApiResponse<string[]>> {
    return await httpClient.get<string[]>('/catalogos/tipos-mantenimiento');
  }
};

export default catalogosService;

