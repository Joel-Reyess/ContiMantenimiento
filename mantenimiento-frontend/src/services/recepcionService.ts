import httpClient from './httpClient';

export const recepcionService = {
  getPendientes() {
    return httpClient.get<any[]>('/recepcion/pendientes');
  },
  checkIn(reporteId: number, diagnostico?: string, tecnicoId?: number, force: boolean = false) {
    return httpClient.post(`/recepcion/${reporteId}/check-in${force ? '?force=true' : ''}`, { diagnostico, tecnicoId });
  },
  registrarDanioExtra(reporteId: number, descripcionExtra: string, requiereRefaccion?: boolean, refaccionNombre?: string) {
    return httpClient.post(`/recepcion/${reporteId}/danios-extra`, {
      descripcionExtra,
      requiereRefaccion: !!requiereRefaccion,
      refaccionNombre,
    });
  },
};

export default recepcionService;
