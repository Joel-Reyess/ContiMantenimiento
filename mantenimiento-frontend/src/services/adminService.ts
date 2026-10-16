import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';

/** Un registro de la bitácora: quién hizo qué y cuándo (la fecha viene en UTC) */
export interface RegistroBitacora {
  id: number;
  fecha: string;
  usuario?: string;
  accion: string;
  entidad: string;
  entidadId?: number;
  descripcion?: string;
}

export interface FiltrosBitacora {
  accion?: string;
  entidad?: string;
  busqueda?: string;
  /** ISO con zona horaria (p. ej. el inicio del día local convertido a UTC) */
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export const adminService = {
  async resetDatos(claveMaestra: string): Promise<ApiResponse<string>> {
    return await httpClient.post<string>('/admin/reset-datos', { claveMaestra });
  },

  async getBitacora(filtros: FiltrosBitacora = {}): Promise<ApiResponse<PaginatedResponse<RegistroBitacora>>> {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') params.append(clave, String(valor));
    });
    const qs = params.toString();
    return await httpClient.get<PaginatedResponse<RegistroBitacora>>(`/admin/bitacora${qs ? `?${qs}` : ''}`);
  }
};

export default adminService;
