import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export const adminService = {
  async resetDatos(claveMaestra: string): Promise<ApiResponse<string>> {
    return await httpClient.post<string>('/admin/reset-datos', { claveMaestra });
  }
};

export default adminService;
