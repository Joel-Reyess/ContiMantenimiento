import httpClient from './httpClient';

export interface Consumible {
  id: number;
  codigo: string;
  nombre: string;
  categoria?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo?: number;
  costoUnitario?: number;
  alertaActiva: boolean;
  activo: boolean;
}

export const consumiblesService = {
  getAll(params?: { activo?: boolean; bajoStock?: boolean; q?: string }) {
    const search = new URLSearchParams();
    if (params?.activo !== undefined) search.append('activo', String(params.activo));
    if (params?.bajoStock !== undefined) search.append('bajoStock', String(params.bajoStock));
    if (params?.q) search.append('q', params.q);
    const qs = search.toString();
    return httpClient.get<Consumible[]>(`/consumibles${qs ? `?${qs}` : ''}`);
  },

  getDisponibles() {
    return httpClient.get<Consumible[]>('/consumibles/disponibles');
  },

  create(payload: Partial<Consumible>) {
    return httpClient.post('/consumibles', payload);
  },

  update(id: number, payload: Partial<Consumible>) {
    return httpClient.put(`/consumibles/${id}`, payload);
  },

  ajustar(id: number, tipo: 'ajuste+' | 'ajuste-', cantidad: number, comentario?: string) {
    return httpClient.post(`/consumibles/${id}/ajuste`, { tipo, cantidad, comentario });
  },

  registrarConsumo(id: number, data: { ordenTrabajoId?: number; reporteId?: number; cantidad: number; comentario?: string }) {
    return httpClient.post(`/consumibles/${id}/consumo`, data);
  },

  getAlertas() {
    return httpClient.get<Consumible[]>('/consumibles/alertas');
  }
};

export default consumiblesService;
