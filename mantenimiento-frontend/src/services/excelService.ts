import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Módulos que se pueden importar (los que se exportan son más; ver ExcelExportService en el backend) */
export type EntidadImportable = 'vehiculos' | 'inventario';

export interface ExcelImportError {
  fila: number;
  columna?: string;
  mensaje: string;
}

export interface ExcelImportResult {
  entidad: string;
  hoja?: string;
  totalFilas: number;
  nuevos: number;
  actualizados: number;
  totalErrores: number;
  errores: ExcelImportError[];
  aplicado: boolean;
}

/** Descarga un archivo del backend (con el token) y lo guarda con el nombre que manda el servidor */
async function descargar(endpoint: string, nombrePorDefecto: string): Promise<void> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    let mensaje = `Error ${response.status} al descargar el archivo`;
    if (response.status === 401) mensaje = 'Sesión expirada, vuelve a iniciar sesión';
    try {
      const data = await response.json();
      if (data?.message) mensaje = data.message;
    } catch {
      // la respuesta no era JSON
    }
    throw new Error(mensaje);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const simple = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const nombre = utf8 ? decodeURIComponent(utf8) : simple || nombrePorDefecto;

  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const excelService = {
  exportar(entidad: string): Promise<void> {
    return descargar(`/excel/exportar/${entidad}`, `ContiMantenimiento - ${entidad}.xlsx`);
  },

  exportarTodo(): Promise<void> {
    return descargar('/excel/exportar-todo', 'ContiMantenimiento - Exportacion completa.xlsx');
  },

  descargarPlantilla(entidad: EntidadImportable): Promise<void> {
    return descargar(`/excel/plantilla/${entidad}`, `Plantilla ${entidad}.xlsx`);
  },

  /** Con aplicar=false solo valida; con aplicar=true guarda si el archivo no tiene errores */
  async importar(entidad: EntidadImportable, archivo: File, aplicar: boolean): Promise<ApiResponse<ExcelImportResult>> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return await httpClient.uploadFile<ExcelImportResult>(`/excel/importar/${entidad}?aplicar=${aplicar}`, formData);
  }
};

export default excelService;
