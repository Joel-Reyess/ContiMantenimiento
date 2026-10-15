import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface ChecklistTemplate {
  id: number;
  nombre: string;
  descripcion?: string;
  tipoVehiculo?: number;
  tipoVehiculoNombre?: string;
  tipoMantenimiento?: string;
  activo: boolean;
  /** Es el checklist que usan los vehículos de su tipo (si el tipo trae varios de antes, solo uno lo es) */
  vigente?: boolean;
  items: ChecklistItem[];
}

/** Datos para crear o editar un checklist: uno por tipo de vehículo, el nombre lo pone el tipo (12.3.1) */
export interface ChecklistTemplateRequest {
  tipoVehiculo: number;
  items: Array<{
    id?: number;
    orden: number;
    pregunta: string;
    tipoRespuesta: number;
    opciones?: string;
    obligatorio?: boolean;
    requiereFoto?: boolean;
    costoEstimado?: number;
  }>;
}

export interface ChecklistItem {
  id: number;
  orden: number;
  pregunta: string;
  tipoRespuesta: number;
  tipoRespuestaNombre?: string;
  opciones?: string;
  obligatorio: boolean;
  requiereFoto: boolean;
  costoEstimado?: number;
}

export interface ChecklistAsignacion {
  id: number;
  vehiculoId: number;
  vehiculoCodigo?: string;
  checklistTemplateId: number;
  checklistNombre?: string;
  fechaAsignacion: string;
  asignadoPorId?: number;
  asignadoPorNombre?: string;
}

export interface ChecklistRespuesta {
  id: number;
  checklistItemId: number;
  pregunta?: string;
  valor?: string;
  fotoUrl?: string;
  notas?: string;
  fechaRespuesta: string;
}

export interface RespuestaItemRequest {
  checklistItemId: number;
  valor?: string;
  fotoUrl?: string;
  notas?: string;
}

export interface GuardarRespuestasRequest {
  ordenTrabajoId: number;
  respuestas: RespuestaItemRequest[];
}

export interface InspeccionRapidaRequest {
  vehiculoId: number;
  checklistTemplateId: number;
  respuestas: RespuestaItemRequest[];
}

export interface AsignarChecklistVehiculoRequest {
  vehiculoId: number;
  checklistTemplateId?: number;
}

export const checklistService = {
  // ===== TEMPLATES =====

  async getTemplates(tipoVehiculo?: number, tipoMantenimiento?: string): Promise<ApiResponse<ChecklistTemplate[]>> {
    const params = new URLSearchParams();
    if (tipoVehiculo !== undefined) params.append('tipoVehiculo', tipoVehiculo.toString());
    if (tipoMantenimiento) params.append('tipoMantenimiento', tipoMantenimiento);

    const queryString = params.toString();
    return await httpClient.get<ChecklistTemplate[]>(`/checklists/templates${queryString ? `?${queryString}` : ''}`);
  },

  async getTemplateById(id: number): Promise<ApiResponse<ChecklistTemplate>> {
    return await httpClient.get<ChecklistTemplate>(`/checklists/templates/${id}`);
  },

  async createTemplate(request: ChecklistTemplateRequest): Promise<ApiResponse<{ id: number; nombre: string }>> {
    return await httpClient.post<{ id: number; nombre: string }>('/checklists/templates', request);
  },

  async updateTemplate(id: number, request: ChecklistTemplateRequest): Promise<ApiResponse<{ id: number; nombre: string }>> {
    return await httpClient.put<{ id: number; nombre: string }>(`/checklists/templates/${id}`, request);
  },

  async deleteTemplate(id: number): Promise<ApiResponse<{ nombre: string; conservadoEnHistorial: boolean }>> {
    return await httpClient.delete<{ nombre: string; conservadoEnHistorial: boolean }>(`/checklists/templates/${id}`);
  },

  /** Checklist del tipo de vehículo (data = null si el tipo no tiene). Requerimiento 12.3. */
  async getPorTipo(tipoVehiculoId: number): Promise<ApiResponse<ChecklistTemplate | null>> {
    return await httpClient.get<ChecklistTemplate | null>(`/checklists/templates/por-tipo/${tipoVehiculoId}`);
  },

  /** Checklist del tipo del vehículo (data = null si su tipo no tiene) */
  async getPorVehiculo(vehiculoId: number): Promise<ApiResponse<ChecklistTemplate | null>> {
    return await httpClient.get<ChecklistTemplate | null>(`/checklists/templates/por-vehiculo/${vehiculoId}`);
  },

  // ===== RESPUESTAS =====

  async getRespuestasByOrden(ordenTrabajoId: number): Promise<ApiResponse<ChecklistRespuesta[]>> {
    return await httpClient.get<ChecklistRespuesta[]>(`/checklists/respuestas/${ordenTrabajoId}`);
  },

  async guardarRespuestas(request: GuardarRespuestasRequest): Promise<ApiResponse<string>> {
    return await httpClient.post<string>('/checklists/respuestas', request);
  },

  async crearInspeccionRapida(request: InspeccionRapidaRequest): Promise<ApiResponse<{ ordenId: number }>> {
    return await httpClient.post<{ ordenId: number }>('/checklists/inspeccion-rapida', request);
  },

  // ===== ASIGNACIONES VEHICULO =====

  async getAsignaciones(vehiculoId?: number): Promise<ApiResponse<ChecklistAsignacion[]>> {
    const params = vehiculoId ? `?vehiculoId=${vehiculoId}` : '';
    return await httpClient.get<ChecklistAsignacion[]>(`/checklists/asignaciones${params}`);
  },

  async asignarChecklistVehiculo(request: AsignarChecklistVehiculoRequest): Promise<ApiResponse<ChecklistAsignacion | null>> {
    return await httpClient.post<ChecklistAsignacion | null>('/checklists/asignaciones', request);
  },

    // ===== CHECKLIST DEFAULT PARA INSPECCION =====

  /**
   * Obtiene un checklist de inspeccion por defecto (usado cuando no hay templates)
   */
  getDefaultInspectionChecklist(): ChecklistItem[] {
    return [
      { id: 1, orden: 1, pregunta: 'Estado de neumaticos', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 2, orden: 2, pregunta: 'Nivel de fluidos (aceite, hidraulico, frenos)', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 3, orden: 3, pregunta: 'Luces y senales', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 4, orden: 4, pregunta: 'Frenos operativos', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 5, orden: 5, pregunta: 'Sistema hidraulico (sin fugas)', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 6, orden: 6, pregunta: 'Bateria y conexiones', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 7, orden: 7, pregunta: 'Bocina/Alarma de reversa', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
      { id: 8, orden: 8, pregunta: 'Cinturon de seguridad', tipoRespuesta: 0, obligatorio: true, requiereFoto: false },
    ];
  }
};

export default checklistService;