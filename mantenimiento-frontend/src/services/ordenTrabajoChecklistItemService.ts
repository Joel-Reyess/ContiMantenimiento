import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export interface OrdenTrabajoChecklistItemDto {
  id: number;
  ordenTrabajoId: number;
  checklistItemId: number;
  checklistItemPregunta: string;
  fechaAsignacion: string;
  fechaCompletado?: string;
  estado: string;
  cantidad?: number;
  notas?: string;
  fotoUrl?: string;
  tipo?: 'Checklist' | 'ActividadAdicional';
  solicitudActividadId?: number;
}

export interface UpdateOrdenTrabajoChecklistItemRequest {
  estado?: string;
  notas?: string;
  cantidad?: number;
  fechaCompletado?: string;
  fotoUrl?: string;
  tipo?: 'Checklist' | 'ActividadAdicional';
}

export interface CreateOrdenTrabajoChecklistItemRequest {
  ordenTrabajoId: number;
  checklistItemId: number;
  cantidad?: number;
  notas?: string;
}

export const ordenTrabajoChecklistItemService = {
  async getAllByOrden(ordenId: number): Promise<ApiResponse<OrdenTrabajoChecklistItemDto[]>> {
    return await httpClient.get<OrdenTrabajoChecklistItemDto[]>(`/ordentrabajochecklistitems/orden/${ordenId}`);
  },

  async create(request: CreateOrdenTrabajoChecklistItemRequest): Promise<ApiResponse<OrdenTrabajoChecklistItemDto>> {
    return await httpClient.post<OrdenTrabajoChecklistItemDto>('/ordentrabajochecklistitems', request);
  },

  async update(id: number, request: UpdateOrdenTrabajoChecklistItemRequest): Promise<ApiResponse<void>> {
    return await httpClient.put<void>(`/ordentrabajochecklistitems/${id}`, request);
  }
};

export default ordenTrabajoChecklistItemService;
