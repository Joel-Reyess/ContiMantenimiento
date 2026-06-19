import httpClient from './httpClient';

export interface AprobacionItem {
  id: number;
  nombreRefaccion: string;
  justificacion?: string;
  cantidad?: number;
  estado: string;
  fechaSolicitud?: string;
  ordenTrabajoId?: number;
  ordenFolio?: string;
}

export const aprobacionesService = {
  getPendientes() {
    return httpClient.get<AprobacionItem[]>('/aprobaciones/pendientes');
  },
  aprobar(id: number, costoReal?: number) {
    return httpClient.post(`/aprobaciones/${id}/aprobar`, costoReal !== undefined ? { costoReal } : undefined);
  },
  entregar(id: number, costoReal?: number) {
    return httpClient.post(`/aprobaciones/${id}/entregar`, costoReal !== undefined ? { costoReal } : undefined);
  },
  rechazar(id: number, motivo: string) {
    return httpClient.post(`/aprobaciones/${id}/rechazar`, { motivo });
  },
  solicitarCambios(id: number, motivo: string) {
    return httpClient.post(`/aprobaciones/${id}/cambios`, { motivo });
  },
};

export default aprobacionesService;
