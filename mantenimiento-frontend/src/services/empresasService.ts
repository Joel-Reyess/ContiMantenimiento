import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

/** Empresa proveedora (PDF 06-nov, CFG-07) */
export interface Empresa {
  id: number;
  nombre: string;
  /** RFC u otro identificador único */
  identificador: string;
  activo: boolean;
  contacto?: string;
  telefono?: string;
  email?: string;
  createdAt: string;
  /** Técnicos que pertenecen a la empresa */
  tecnicos: number;
  /** Órdenes de pago generadas con sus tarifas */
  ordenesPago: number;
  /** Actividades con tarifa propia */
  tarifas: number;
}

export interface EmpresaRequest {
  nombre: string;
  identificador: string;
  activo: boolean;
  contacto?: string;
  telefono?: string;
  email?: string;
}

/** Precio pactado de una actividad del checklist para la empresa (CFG-08) */
export interface TarifaEmpresa {
  checklistItemId: number;
  costo: number;
}

export const empresasService = {
  /** Con `activas` solo las activas (para asignarlas a técnicos) */
  async getAll(activas = false): Promise<ApiResponse<Empresa[]>> {
    return await httpClient.get<Empresa[]>(`/empresas${activas ? '?activas=true' : ''}`);
  },

  async create(empresa: EmpresaRequest): Promise<ApiResponse<{ id: number; nombre: string }>> {
    return await httpClient.post<{ id: number; nombre: string }>('/empresas', empresa);
  },

  async update(id: number, empresa: EmpresaRequest): Promise<ApiResponse<{ id: number; nombre: string }>> {
    return await httpClient.put<{ id: number; nombre: string }>(`/empresas/${id}`, empresa);
  },

  /** Solo si no tiene técnicos ni órdenes de pago (si los tiene, se desactiva); queda en la bitácora */
  async delete(id: number): Promise<ApiResponse<string>> {
    return await httpClient.delete<string>(`/empresas/${id}`);
  },

  async getTarifas(empresaId: number): Promise<ApiResponse<TarifaEmpresa[]>> {
    return await httpClient.get<TarifaEmpresa[]>(`/empresas/${empresaId}/tarifas`);
  },

  /** `costo: null` = la actividad vuelve a usar el costo base; las actividades que no vienen no cambian */
  async guardarTarifas(empresaId: number, items: { checklistItemId: number; costo: number | null }[]): Promise<ApiResponse<TarifaEmpresa[]>> {
    return await httpClient.put<TarifaEmpresa[]>(`/empresas/${empresaId}/tarifas`, { items });
  }
};

export default empresasService;
