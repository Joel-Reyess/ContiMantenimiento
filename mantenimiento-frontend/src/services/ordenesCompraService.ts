import httpClient from './httpClient';
import type { ApiResponse, OrdenCompra } from '@/interfaces';

export interface CreateOrdenCompraRequest {
  pagoIds: number[];
  numeroExterno?: string;
}

export interface UpdateOrdenCompraRequest {
  numeroExterno?: string;
  estado?: string;
}

export const ordenesCompraService = {
  async getAll(): Promise<ApiResponse<OrdenCompra[]>> {
    return await httpClient.get<OrdenCompra[]>("/ordencompra");
  },

  async getById(id: number): Promise<ApiResponse<OrdenCompra>> {
    return await httpClient.get<OrdenCompra>(`/ordencompra/${id}`);
  },

  async create(request: CreateOrdenCompraRequest): Promise<ApiResponse<OrdenCompra>> {
    return await httpClient.post<OrdenCompra>("/ordencompra", request);
  },

  async update(id: number, request: UpdateOrdenCompraRequest): Promise<ApiResponse<OrdenCompra>> {
    return await httpClient.put<OrdenCompra>(`/ordencompra/${id}`, request);
  }
};

export default ordenesCompraService;
