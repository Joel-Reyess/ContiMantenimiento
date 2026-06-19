import type { ApiResponse } from '@/interfaces';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return data as ApiResponse<T>;
    }

    if (!response.ok) {
      return {
        success: false,
        message: `Error ${response.status}: ${response.statusText}`,
        data: null as T
      };
    }

    return {
      success: true,
      message: 'Operación exitosa',
      data: null as T
    };
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (!skipAuth) {
      const token = this.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      method,
      headers: requestHeaders
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error('Error en la petición:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error de conexión',
        data: null as T
      };
    }
  }

  async get<T>(endpoint: string, skipAuth = false): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', skipAuth });
  }

  async post<T>(endpoint: string, body?: unknown, skipAuth = false): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, skipAuth });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData
      });
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const parsed = await response.json();
        // Si el backend no envía ApiResponse, envolvemos
        if (parsed && typeof parsed === 'object' && parsed.success !== undefined) {
          return parsed as ApiResponse<T>;
        }
        if (response.ok) {
          return { success: true, message: 'OK', data: parsed as T };
        }
        return { success: false, message: 'Error al subir archivo', data: null as T };
      }

      if (!response.ok) {
        return { success: false, message: `Error ${response.status}: ${response.statusText}`, data: null as T };
      }

      return { success: true, message: 'OK', data: null as T };
    } catch (error) {
      console.error('Error al subir archivo:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al subir archivo',
        data: null as T
      };
    }
  }
}

export const httpClient = new HttpClient(API_BASE_URL);
export default httpClient;
