import httpClient from './httpClient';
import type {
  DashboardStats,
  KPIs,
  DashboardTecnico,
  DashboardResumen,
  ApiResponse
} from '@/interfaces';

export interface DashboardFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  areaId?: number;
}

export interface ReporteAnual {
  mes: number;
  mesNombre: string;
  tipoVehiculo: string;
  cantidad: number;
}

export interface OrdenSinFirma {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  estado: string;
  fechaFinalizacion: string;
  tecnicoNombre: string;
}

export interface VehiculoEnTaller {
  vehiculoId: number;
  codigo: string;
  tipo: string;
  tipoMantenimiento: string;
  tecnicoNombre: string;
  fechaIngreso: string;
  diasEnTaller: number;
  estadoOrden: string;
  folioOrden: string;
  ordenId: number;
}

export interface OrdenSinPago {
  ordenId: number;
  folio: string;
  vehiculo: string;
  tecnico: string;
  fechaFinalizacion: string;
  costoTotal: number;
  estadoPago: string;
}

/** Dashboard financiero por proveedor (PDF 06-nov, DSH-02) */
export type Periodicidad = 'semanal' | 'quincenal' | 'mensual';

export interface GastoProveedorFila {
  /** null = técnicos sin empresa (tarifa base) */
  empresaId: number | null;
  empresa: string;
  reparaciones: number;
  costoTotal: number;
  costoPromedio: number;
}

export interface GastoPeriodo {
  clave: string;
  /** "Septiembre 2026", "1–15 sep 2026", "3–9 nov 2026" */
  etiqueta: string;
  desde: string;
  hasta: string;
  proveedores: GastoProveedorFila[];
  reparaciones: number;
  costoTotal: number;
  costoPromedio: number;
}

export interface GastoProveedores {
  periodicidad: Periodicidad;
  empresaId?: number | null;
  /** Del más reciente al más antiguo */
  periodos: GastoPeriodo[];
}

export const dashboardService = {
  /** Periodos cortados en la hora local del navegador; empresaId 0 = sin empresa, sin empresaId = todas */
  async getGastoProveedores(periodicidad: Periodicidad, periodos = 6, empresaId?: number): Promise<ApiResponse<GastoProveedores>> {
    const params = new URLSearchParams({ periodicidad, periodos: String(periodos), zona: String(new Date().getTimezoneOffset()) });
    if (empresaId !== undefined) params.append('empresaId', String(empresaId));
    return await httpClient.get<GastoProveedores>(`/dashboard/gasto-proveedores?${params.toString()}`);
  },

  async getStats(): Promise<ApiResponse<DashboardStats>> {
    return await httpClient.get<DashboardStats>('/dashboard/stats');
  },

  async getKPIs(filters?: DashboardFilters): Promise<ApiResponse<KPIs>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.areaId !== undefined) params.append('areaId', filters.areaId.toString());
    }

    const queryString = params.toString();
    const endpoint = `/dashboard/kpis${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<KPIs>(endpoint);
  },

  async getDashboardTecnico(): Promise<ApiResponse<DashboardTecnico>> {
    return await httpClient.get<DashboardTecnico>('/dashboard/tecnico');
  },

  async getResumenSemanal(areaId?: number): Promise<ApiResponse<{
    ordenesCreadas: number;
    ordenesCompletadas: number;
    tiempoPromedioResolucion: number;
    reportesNuevos: number;
    vehiculosAtendidos: number;
  }>> {
    const endpoint = areaId
      ? `/dashboard/resumen-semanal?areaId=${areaId}`
      : '/dashboard/resumen-semanal';
    return await httpClient.get(endpoint);
  },

  async getGraficoOrdenesPorDia(dias: number = 7): Promise<ApiResponse<{
    fecha: string;
    creadas: number;
    completadas: number;
  }[]>> {
    return await httpClient.get(`/dashboard/ordenes-por-dia?dias=${dias}`);
  },

  async getTopVehiculosConFallas(limit: number = 5): Promise<ApiResponse<{
    vehiculoId: number;
    vehiculoCodigo: string;
    tipoNombre: string;
    cantidadFallas: number;
  }[]>> {
    return await httpClient.get(`/dashboard/top-vehiculos-fallas?limit=${limit}`);
  },

  async getTiempoPromedioPorTipo(): Promise<ApiResponse<{
    tipoMantenimiento: string;
    tiempoPromedio: number;
    cantidadOrdenes: number;
  }[]>> {
    return await httpClient.get('/dashboard/tiempo-promedio-tipo');
  },

  async getResumen(): Promise<ApiResponse<DashboardResumen>> {
    return await httpClient.get<DashboardResumen>('/dashboard/resumen');
  },

  async getReporteAnual(anio?: number): Promise<ApiResponse<ReporteAnual[]>> {
    const query = anio ? `?anio=${anio}` : '';
    return await httpClient.get<ReporteAnual[]>(`/dashboard/reporte-anual${query}`);
  },

  async getOrdenesSinFirma(): Promise<ApiResponse<OrdenSinFirma[]>> {
    return await httpClient.get<OrdenSinFirma[]>('/dashboard/sin-firma');
  },

  async getVehiculosEnTaller(): Promise<ApiResponse<VehiculoEnTaller[]>> {
    return await httpClient.get<VehiculoEnTaller[]>('/dashboard/taller');
  },

  async getOrdenesSinPago(): Promise<ApiResponse<OrdenSinPago[]>> {
    return await httpClient.get<OrdenSinPago[]>('/dashboard/ordenes-sin-pago');
  },

  async getProgramacionPreventiva(): Promise<ApiResponse<{
    vehiculoId: number;
    vehiculoCodigo: string;
    tipoVehiculo: string;
    ultimaFecha?: string;
    proximaFecha: string;
    diasRestantes: number;
    estado: string;
  }[]>> {
    return await httpClient.get('/dashboard/programacion-preventiva');
  }
};

export default dashboardService;
