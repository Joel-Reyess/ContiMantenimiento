import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

export const adminService = {
  async resetDatos(): Promise<ApiResponse<string>> {
    return await httpClient.post<string>('/admin/reset-datos');
  }
};

export default adminService;
