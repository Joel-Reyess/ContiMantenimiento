import httpClient from './httpClient';
import type { User, LoginRequest, LoginResponse, ChangePasswordRequest, ApiResponse } from '@/interfaces';

export const authService = {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await httpClient.post<LoginResponse>('/auth/login', credentials, true);

    if (response.success && response.data) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.usuario));
    }

    return response;
  },

  async logout(): Promise<void> {
    try {
      await httpClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  async changePassword(request: ChangePasswordRequest): Promise<ApiResponse<unknown>> {
    return await httpClient.post('/auth/cambiar-password', request);
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch {
        return null;
      }
    }
    return null;
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  hasRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    return roles.includes(user.rolNombre || '');
  }
};

export default authService;
