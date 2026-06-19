import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';

export interface RegistroPago {
  id: number;
  ordenTrabajoId: number;
  ordenTrabajoFolio?: string;
  vehiculoCodigo?: string;
  tecnicoId: number;
  tecnicoNombre?: string;
  estado: number;
  estadoNombre?: string;
  montoManoObra: number;
  montoRefacciones: number;
  montoTotal: number;
  fechaRegistro: string;
  fechaAprobacion?: string;
  fechaPago?: string;
  numeroFactura?: string;
  notas?: string;
  ordenTrabajo?: any; // Consider typing this properly with OrdenTrabajo interface if possible
  ordenCompraId?: number;
  ordenCompraFolio?: string;
}

export interface PagoFilters {
  tecnicoId?: number;
  estado?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export interface CrearPagoRequest {
  ordenTrabajoId: number;
  tecnicoId: number;
  montoManoObra: number;
  montoRefacciones?: number;
  notas?: string;
}

export interface ActualizarPagoRequest {
  montoManoObra: number;
  montoRefacciones?: number;
  notas?: string;
}

export const pagosService = {
  async getAll(filters?: PagoFilters): Promise<ApiResponse<PaginatedResponse<RegistroPago>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.tecnicoId !== undefined) params.append('tecnicoId', filters.tecnicoId.toString());
      if (filters.estado !== undefined) params.append('estado', filters.estado.toString());
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/pagos${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<PaginatedResponse<RegistroPago>>(endpoint);
  },

  async getById(id: number): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.get<RegistroPago>(`/pagos/${id}`);
  },

  async getPendientes(): Promise<ApiResponse<RegistroPago[]>> {
    return await httpClient.get<RegistroPago[]>('/pagos/pendientes');
  },

  async getByTecnico(tecnicoId: number): Promise<ApiResponse<RegistroPago[]>> {
    return await httpClient.get<RegistroPago[]>(`/pagos/tecnico/${tecnicoId}`);
  },

  async create(pago: CrearPagoRequest): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.post<RegistroPago>('/pagos', pago);
  },

  async update(id: number, pago: ActualizarPagoRequest): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.put<RegistroPago>(`/pagos/${id}`, pago);
  },

  async aprobar(id: number): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.post<RegistroPago>(`/pagos/${id}/aprobar`);
  },

  async rechazar(id: number, motivo: string): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.post<RegistroPago>(`/pagos/${id}/rechazar`, { motivo });
  },

  async marcarPagado(id: number, numeroFactura?: string): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.post<RegistroPago>(`/pagos/${id}/pagar`, { numeroFactura });
  },

  async revertir(id: number): Promise<ApiResponse<RegistroPago>> {
    return await httpClient.post<RegistroPago>(`/pagos/${id}/revertir`);
  },

  async getResumenPorTecnico(fechaDesde?: string, fechaHasta?: string): Promise<ApiResponse<{
    tecnicoId: number;
    tecnicoNombre: string;
    totalOrdenes: number;
    montoPendiente: number;
    montoPagado: number;
  }[]>> {
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fechaDesde', fechaDesde);
    if (fechaHasta) params.append('fechaHasta', fechaHasta);

    const queryString = params.toString();
    const endpoint = `/pagos/resumen-tecnicos${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get(endpoint);
  }
};

export default pagosService;
