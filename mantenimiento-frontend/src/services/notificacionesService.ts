import httpClient from './httpClient';
import type { ApiResponse, Notificacion, NotificacionesResumen } from '@/interfaces';

/**
 * NOTAS DE INTEGRACION:
 * - El backend (.NET) expone:
 *   GET    /api/notificaciones            (?soloNoLeidas=true|false)
 *   GET    /api/notificaciones/resumen
 *   POST   /api/notificaciones/marcar-leidas        { notificacionIds: number[] }
 *   POST   /api/notificaciones/marcar-todas-leidas  (sin body)
 *   DELETE /api/notificaciones/{id}
 * - No se usan endpoints /leer/{id}; el 404 provenía de rutas incorrectas en el frontend.
 */

export const notificacionesService = {
  async getResumen(): Promise<ApiResponse<NotificacionesResumen>> {
    return await httpClient.get<NotificacionesResumen>('/notificaciones/resumen');
  },

  async getAll(soloNoLeidas = false): Promise<ApiResponse<Notificacion[]>> {
    const endpoint = soloNoLeidas ? '/notificaciones?soloNoLeidas=true' : '/notificaciones';
    return await httpClient.get<Notificacion[]>(endpoint);
  },

  async marcarLeida(id: number): Promise<ApiResponse<void>> {
    return await httpClient.post<void>('/notificaciones/marcar-leidas', { notificacionIds: [id] });
  },

  async marcarTodasLeidas(): Promise<ApiResponse<void>> {
    return await httpClient.post<void>('/notificaciones/marcar-todas-leidas');
  },

  async eliminar(id: number): Promise<ApiResponse<void>> {
    return await httpClient.delete<void>(`/notificaciones/${id}`);
  },
};

export default notificacionesService;
