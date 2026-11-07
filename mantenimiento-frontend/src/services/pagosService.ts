import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';

export interface RegistroPago {
  id: number;
  /** Folio de la orden de pago (OP-00125) */
  folio?: string;
  ordenTrabajoId: number;
  reporteFolio?: string;
  ordenTrabajoFolio?: string;
  vehiculoCodigo?: string;
  tecnicoId: number;
  tecnicoNombre?: string;
  /** Empresa responsable: la del técnico cuando se generó la orden de pago (PDF 06-nov) */
  empresaId?: number | null;
  empresaNombre?: string | null;
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
  /** 0 = técnicos sin empresa (tarifa base) */
  empresaId?: number;
  estado?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export interface ActividadPago {
  checklistItemId?: number | null;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

/** Refacción o consumible usado: solo informativo en la orden de pago (PDF 06-nov, OT-24), sin costos */
export interface MaterialInformativo {
  codigo: string;
  nombre: string;
  categoria?: string;
  esRefaccion: boolean;
  unidad: string;
  cantidad: number;
}

/** Lo que la orden de pago hereda de la orden de trabajo (PDF 29-oct, 6.1) */
export interface DetalleOrdenPago {
  id: number;
  folio: string;
  estado: string;
  estadoId: number;
  ordenTrabajoId: number;
  ordenTrabajoFolio: string;
  reporteFolio?: string;
  fechaReporte?: string;
  vehiculoCodigo: string;
  tipoVehiculo?: string;
  area?: string;
  tecnicoId: number;
  tecnico?: string;
  /** Empresa responsable (PDF 06-nov, PAG-02) */
  empresaId?: number | null;
  empresa?: string | null;
  empresaIdentificador?: string | null;
  fechaCreacionOrden: string;
  fechaFinalizacionOrden?: string;
  fechaValidacionOrden?: string;
  fechaRegistro: string;
  fechaAprobacion?: string;
  fechaPago?: string;
  numeroFactura?: string;
  aplicaGarantia: boolean;
  actividades: ActividadPago[];
  /** Actividades guardadas al generarse (false = orden de pago anterior, recalculada con el costo base) */
  importesFijos: boolean;
  /** Solo informativos: no suman al total */
  materiales: MaterialInformativo[];
  costoActividades: number;
  /** 0 en las nuevas; solo órdenes de pago aprobadas antes del cambio pueden traer cargo por refacciones */
  costoMateriales: number;
  otrosCostos?: number;
  total: number;
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
      if (filters.empresaId !== undefined) params.append('empresaId', filters.empresaId.toString());
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

  /** Ya no se capturan a mano: se generan al validar la reparación. Esto genera las de órdenes validadas antes del cambio */
  async generarPendientes(): Promise<ApiResponse<{ generadas: number; folios: string[] }>> {
    return await httpClient.post<{ generadas: number; folios: string[] }>('/pagos/generar-pendientes');
  },

  /** Órdenes ya validadas que aún no tienen su orden de pago */
  async sinGenerar(): Promise<ApiResponse<number>> {
    return await httpClient.get<number>('/pagos/sin-generar');
  },

  async detalle(id: number): Promise<ApiResponse<DetalleOrdenPago>> {
    return await httpClient.get<DetalleOrdenPago>(`/pagos/${id}/detalle`);
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
  },

  /** Elimina el pago (si está en una orden de compra, la API pide eliminar primero la OC). Solo administradores; queda en la bitácora. */
  async delete(id: number): Promise<ApiResponse<string>> {
    return await httpClient.delete<string>(`/pagos/${id}`);
  }
};

export default pagosService;
