import httpClient from './httpClient';
import type { User, UserList, UserCreateRequest, UserUpdateRequest, ApiResponse } from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';

export interface UserFilters {
  rolId?: number;
  areaId?: number;
  activo?: boolean;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export const usuariosService = {
  async getAll(filters?: UserFilters): Promise<ApiResponse<PaginatedResponse<UserList>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.rolId !== undefined) params.append('rolId', filters.rolId.toString());
      if (filters.areaId !== undefined) params.append('areaId', filters.areaId.toString());
      if (filters.activo !== undefined) params.append('activo', filters.activo.toString());
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/usuarios${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<PaginatedResponse<UserList>>(endpoint);
  },

  async getById(id: number): Promise<ApiResponse<User>> {
    return await httpClient.get<User>(`/usuarios/${id}`);
  },

  async getByNumeroEmpleado(numero: string): Promise<ApiResponse<User>> {
    return await httpClient.get<User>(`/usuarios/empleado/${encodeURIComponent(numero)}`);
  },

  async create(usuario: UserCreateRequest): Promise<ApiResponse<User>> {
    // El backend expone /auth/register para crear usuarios
    const payload: any = {
      nombreCompleto: usuario.nombreCompleto,
      username: usuario.username,
      password: usuario.password,
      email: usuario.email,
      numeroEmpleado: usuario.numeroEmpleado,
      telefono: usuario.telefono,
      areaId: usuario.areaId,
      roleIds: usuario.rolId ? [usuario.rolId] : []
    };
    return await httpClient.post<User>('/auth/register', payload);
  },

  async update(id: number, usuario: UserUpdateRequest): Promise<ApiResponse<User>> {
    return await httpClient.put<User>(`/usuarios/${id}`, usuario);
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/usuarios/${id}`);
  },

  async activar(id: number): Promise<ApiResponse<void>> {
    return await httpClient.post<void>(`/usuarios/${id}/activar`);
  },

  async desactivar(id: number): Promise<ApiResponse<void>> {
    return await httpClient.post<void>(`/usuarios/${id}/desactivar`);
  },

  async resetPassword(id: number): Promise<ApiResponse<{ passwordTemporal: string }>> {
    return await httpClient.post<{ passwordTemporal: string }>(`/usuarios/${id}/reset-password`);
  },

  async getTecnicos(): Promise<ApiResponse<UserList[]>> {
    return await httpClient.get<UserList[]>('/usuarios/tecnicos');
  },

  async getSupervisores(): Promise<ApiResponse<UserList[]>> {
    return await httpClient.get<UserList[]>('/usuarios/supervisores');
  }
};

export default usuariosService;
