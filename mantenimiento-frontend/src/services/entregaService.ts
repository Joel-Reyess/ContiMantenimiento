import httpClient from './httpClient';

export const entregaService = {
  registrarEntrega(ordenId: number, payload: { observaciones?: string; firmaLider?: string; firmaLiderNombre?: string; firmaSupervisor?: string; firmaSupervisorNombre?: string }) {
    return httpClient.post(`/entrega/${ordenId}/entrega`, payload);
  },
  registrarFirmaLider(ordenId: number, payload: { firma: string; nombre?: string; observaciones?: string }) {
    return httpClient.post(`/entrega/${ordenId}/firma-lider`, payload);
  },
  registrarFirmaSupervisor(ordenId: number, payload: { firma: string; nombre?: string; observaciones?: string }) {
    return httpClient.post(`/entrega/${ordenId}/firma-supervisor`, payload);
  },
};

export default entregaService;
