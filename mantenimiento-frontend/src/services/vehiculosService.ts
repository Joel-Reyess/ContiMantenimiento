import httpClient from './httpClient';
import type {
  Vehiculo,
  VehiculoFoto,
  ValidacionCodigoVehiculo,
  VehiculoList,
  VehiculoCreateRequest,
  VehiculoUpdateRequest,
  ApiResponse
} from '@/interfaces';

export interface HistorialVehiculoFiltros {
  desde?: string;
  hasta?: string;
  tipoMantenimiento?: string;
  componente?: string;
  empresaId?: string;
  tecnicoId?: string;
  estado?: string;
}

export interface ConteoHistorial { id?: number | null; nombre: string; eventos: number; importe?: number | null }
export interface PeriodoCosto { periodo: string; importe: number; intervenciones: number; promedio: number; variacionPct?: number | null }
export interface OpcionFiltroHistorial { valor: string; nombre: string; activo: boolean }

export interface IntervencionHistorial {
  reporteId?: number | null;
  reporteFolio?: string | null;
  ordenId?: number | null;
  ordenFolio?: string | null;
  fecha: string;
  fechaConclusion?: string | null;
  tipoMantenimiento: string;
  descripcionFalla?: string | null;
  fallasReportadas: string[];
  componentes: string[];
  actividades: { nombre: string; cantidad: number; completada: boolean; hallazgo: boolean }[];
  materiales: { nombre: string; cantidad: number }[];
  tecnicoId?: number | null;
  tecnico?: string | null;
  tecnicoActivo: boolean;
  empresaId?: number | null;
  empresa?: string | null;
  importe?: number | null;
  pagoFolio?: string | null;
  estado: string;
  estadoNombre: string;
}

export interface HistorialVehiculo {
  vehiculoId: number;
  vehiculoCodigo: string;
  vehiculoTipo?: string | null;
  verCostos: boolean;
  hayFiltros: boolean;
  resumen: {
    totalReportes: number;
    totalOrdenes: number;
    totalActividades: number;
    importeAcumulado?: number | null;
    fechaUltimoMantenimiento?: string | null;
    fechaUltimoReporte?: string | null;
    empresaMayorParticipacion?: ConteoHistorial | null;
    costoPromedio?: number | null;
  };
  intervenciones: IntervencionHistorial[];
  estadisticas: {
    actividadesFrecuentes: ConteoHistorial[];
    componentesFrecuentes: ConteoHistorial[];
    fallasRecurrentes: ConteoHistorial[];
    tiposMantenimiento: ConteoHistorial[];
    tipoPredominante?: string | null;
  };
  economico?: {
    total: number;
    intervencionesConCosto: number;
    promedio: number;
    porActividad: ConteoHistorial[];
    porProveedor: ConteoHistorial[];
    porPeriodo: PeriodoCosto[];
    comparativo: PeriodoCosto[];
  } | null;
  filtros: {
    tiposMantenimiento: OpcionFiltroHistorial[];
    componentes: OpcionFiltroHistorial[];
    empresas: OpcionFiltroHistorial[];
    tecnicos: OpcionFiltroHistorial[];
    estados: OpcionFiltroHistorial[];
  };
}

export interface VehiculoFilters {
  tipo?: number;
  estado?: number;
  ubicacion?: number;
  areaId?: number;
  busqueda?: string;
  soloActivos?: boolean;
  /** La pestaña "Contenedores" deja fuera a los Tuggers */
  excluirTipo?: number;
  /** Prefijo del código (catálogo de prefijos) */
  prefijo?: string;
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

export interface EliminarVehiculosResult {
  vehiculosEliminados: number;
  reportesEliminados: number;
  ordenesEliminadas: number;
}

/** Filtros de la pantalla Flota de Contenedores con los que se elimina por filtro */
export interface FiltrosEliminacionVehiculos {
  busqueda?: string;
  tipo?: number;
  areaId?: number;
  prefijo?: string;
  excluirTipo?: number;
}

export interface VistaPreviaEliminacionVehiculos {
  total: number;
  /** Con reportes u órdenes: también se borra ese historial */
  conHistorial: number;
  /** Los primeros códigos, para mostrarlos al confirmar */
  codigos: string[];
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
      if (filters.excluirTipo !== undefined) params.append('excluirTipo', filters.excluirTipo.toString());
      if (filters.prefijo) params.append('prefijo', filters.prefijo);
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

  async validarCodigo(codigo: string): Promise<ApiResponse<ValidacionCodigoVehiculo>> {
    return await httpClient.get<ValidacionCodigoVehiculo>(`/vehiculos/validar-codigo?codigo=${encodeURIComponent(codigo)}`);
  },

  async create(vehiculo: VehiculoCreateRequest): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.post<Vehiculo>('/vehiculos', vehiculo);
  },

  async update(id: number, vehiculo: VehiculoUpdateRequest): Promise<ApiResponse<Vehiculo>> {
    return await httpClient.put<Vehiculo>(`/vehiculos/${id}`, vehiculo);
  },

  async delete(id: number): Promise<ApiResponse<EliminarVehiculosResult>> {
    return await httpClient.delete<EliminarVehiculosResult>(`/vehiculos/${id}`);
  },

  async deleteMany(ids: number[]): Promise<ApiResponse<EliminarVehiculosResult>> {
    return await httpClient.post<EliminarVehiculosResult>('/vehiculos/eliminar', { ids });
  },

  /** Cuántos y cuáles vehículos se eliminarían con estos filtros (no borra nada) */
  async vistaPreviaEliminarPorFiltro(filtros: FiltrosEliminacionVehiculos): Promise<ApiResponse<VistaPreviaEliminacionVehiculos>> {
    return await httpClient.post<VistaPreviaEliminacionVehiculos>('/vehiculos/eliminar-filtro', { ...filtros, soloContar: true });
  },

  /** Elimina los vehículos de los filtros; totalConfirmado es lo que vio el usuario (si cambió, no borra nada) */
  async eliminarPorFiltro(filtros: FiltrosEliminacionVehiculos, totalConfirmado: number): Promise<ApiResponse<EliminarVehiculosResult>> {
    return await httpClient.post<EliminarVehiculosResult>('/vehiculos/eliminar-filtro', { ...filtros, totalConfirmado });
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

  /** Historial de mantenimiento individual con resumen, estadísticas y costos (Reporte 6, FLT-11 a FLT-16) */
  async getHistorialMantenimiento(id: number, filtros: HistorialVehiculoFiltros = {}): Promise<ApiResponse<HistorialVehiculo>> {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    return await httpClient.get<HistorialVehiculo>(`/vehiculos/${id}/historial-mantenimiento${qs ? `?${qs}` : ''}`);
  },

  async uploadFoto(id: number, file: File): Promise<ApiResponse<VehiculoFoto>> {
    const formData = new FormData();
    formData.append('archivo', file);
    return await httpClient.uploadFile<VehiculoFoto>(`/vehiculos/${id}/fotos`, formData);
  },

  async deleteFoto(id: number, fotoId: number): Promise<ApiResponse<string>> {
    return await httpClient.delete<string>(`/vehiculos/${id}/fotos/${fotoId}`);
  },

  async uploadImagen(id: number, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('imagen', file);
    return await httpClient.uploadFile<{ url: string }>(`/vehiculos/${id}/imagen`, formData);
  }
};

export default vehiculosService;
