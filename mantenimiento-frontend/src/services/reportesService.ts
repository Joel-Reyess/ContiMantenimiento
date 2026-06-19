import httpClient from './httpClient';
import type {
  ReporteFalla,
  ReporteFallaList,
  ReporteFallaCreateRequest,
  CategoriaFalla,
  Evidencia,
  ApiResponse,
  ReporteFallaChecklistItem
} from '@/interfaces';
import type { PaginatedResponse } from './vehiculosService';

export interface ReporteFilters {
  vehiculoId?: number;
  categoriaId?: number;
  prioridad?: number;
  tieneOrdenTrabajo?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export const reportesService = {
  async getAll(filters?: ReporteFilters): Promise<ApiResponse<PaginatedResponse<ReporteFallaList>>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.vehiculoId !== undefined) params.append('vehiculoId', filters.vehiculoId.toString());
      if (filters.categoriaId !== undefined) params.append('categoriaId', filters.categoriaId.toString());
      if (filters.prioridad !== undefined) params.append('prioridad', filters.prioridad.toString());
      if (filters.tieneOrdenTrabajo !== undefined) params.append('tieneOrdenTrabajo', filters.tieneOrdenTrabajo.toString());
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    }

    const queryString = params.toString();
    const endpoint = `/reportes${queryString ? `?${queryString}` : ''}`;

    return await httpClient.get<PaginatedResponse<ReporteFallaList>>(endpoint);
  },

  async getById(id: number): Promise<ApiResponse<ReporteFalla>> {
    return await httpClient.get<ReporteFalla>(`/reportes/${id}`);
  },

  async getReporteWithChecklistItems(id: number): Promise<ApiResponse<ReporteFalla>> {
    // Primero obtenemos el reporte
    const reporteRes = await httpClient.get<ReporteFalla>(`/reportes/${id}`);
    if (!reporteRes.success || !reporteRes.data) {
      return reporteRes;
    }

    // Luego obtenemos los ítems del checklist asociados
    try {
      const checklistRes = await httpClient.get<ReporteFallaChecklistItem[]>(`/reporte-falla-checklist-items/reporte/${id}`);
      if (checklistRes.success && checklistRes.data) {
        reporteRes.data.itemsChecklist = checklistRes.data;
      }
    } catch (error) {
      console.error('Error al cargar ítems del checklist:', error);
      // Continuar sin los ítems del checklist en lugar de fallar completamente
    }

    return reporteRes;
  },

  async getEvidencias(reporteId: number): Promise<ApiResponse<Evidencia[]>> {
    return await httpClient.get<Evidencia[]>(`/reportes/${reporteId}/evidencias`);
  },

  async getByVehiculoCodigo(codigo: string): Promise<ApiResponse<ReporteFallaList[]>> {
    return await httpClient.get<ReporteFallaList[]>(`/reportes/vehiculo/${encodeURIComponent(codigo)}`);
  },

  async getSinAtender(): Promise<ApiResponse<ReporteFallaList[]>> {
    return await httpClient.get<ReporteFallaList[]>('/reportes/sin-atender');
  },

  async create(reporte: ReporteFallaCreateRequest, force: boolean = false): Promise<ApiResponse<ReporteFalla>> {
    const endpoint = `/reportes${force ? '?force=true' : ''}`;
    return await httpClient.post<ReporteFalla>(endpoint, reporte);
  },

  async createWithAutoChecklist(reporte: ReporteFallaCreateRequest, force: boolean = false): Promise<ApiResponse<ReporteFalla>> {
    const endpoint = `/reportes/crear-con-checklist-automatico${force ? '?force=true' : ''}`;
    return await httpClient.post<ReporteFalla>(endpoint, reporte);
  },

  async crearOrdenTrabajo(reporteId: number): Promise<ApiResponse<{ ordenTrabajoId: number }>> {
    const res = await httpClient.post<{ ordenTrabajoId: number }>(`/reportes/${reporteId}/crear-orden`);
    if (res.success) return res;

    // Fallback por si el backend expone la creación de orden en /ordenes con reporteId en el cuerpo
    const msg = res.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      return await httpClient.post<{ ordenTrabajoId: number }>(`/ordenes`, { reporteId });
    }
    return res;
  },

  async uploadEvidencia(
    reporteId: number,
    file: File,
    descripcion?: string,
    tipoEvidencia?: string
  ): Promise<ApiResponse<Evidencia>> {
    const formData = new FormData();
    formData.append('archivo', file, file.name);
    if (descripcion) formData.append('descripcion', descripcion);
    if (tipoEvidencia) formData.append('tipoEvidencia', tipoEvidencia);
    return await httpClient.uploadFile<Evidencia>(`/reportes/${reporteId}/evidencias`, formData);
  },

  async deleteEvidencia(reporteId: number, evidenciaId: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/reportes/${reporteId}/evidencias/${evidenciaId}`);
  },

  // Categorías de Fallas
  async getCategorias(): Promise<ApiResponse<CategoriaFalla[]>> {
    return await httpClient.get<CategoriaFalla[]>('/catalogos/categorias-falla');
  }
};

export default reportesService;
