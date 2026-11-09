import httpClient from './httpClient';
import type { ApiResponse } from '@/interfaces';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Módulos que se pueden importar (los que se exportan son más; ver ExcelExportService en el backend) */
export type EntidadImportable = 'vehiculos' | 'inventario' | 'areas' | 'prefijos' | 'usuarios';

/** Excel (.xlsx, con hojas) o CSV (un .csv por módulo; "todo" = .zip con un .csv por hoja) */
export type FormatoExport = 'xlsx' | 'csv';

/** Nombre de la hoja de cada módulo: el archivo de "Exportar todo" la trae y la importación la busca por nombre */
export const HOJA_DE: Record<EntidadImportable, string> = {
  vehiculos: 'Vehículos',
  inventario: 'Inventario',
  areas: 'Áreas',
  prefijos: 'Prefijos',
  usuarios: 'Usuarios'
};

export interface ExcelImportError {
  fila: number;
  columna?: string;
  mensaje: string;
}

/** Contraseña temporal de un usuario dado de alta por importación (solo llega una vez, al aplicar) */
export interface ExcelCredencial {
  usuario: string;
  nombre: string;
  contrasena: string;
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
  credenciales?: ExcelCredencial[];
}

/** Importación masiva (Configuración): resultado por hoja */
export interface ExcelImportTodoResult {
  hojas: ExcelImportResult[];
  omitidas: string[];
  totalErrores: number;
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
  exportar(entidad: string, formato: FormatoExport = 'xlsx'): Promise<void> {
    return descargar(`/excel/exportar/${entidad}${formato === 'csv' ? '?formato=csv' : ''}`, `ContiMantenimiento - ${entidad}.${formato}`);
  },

  /** La flota con los mismos filtros de la pantalla ("lo que estoy viendo") */
  exportarFlotaFiltrada(
    filtros: { busqueda?: string; tipo?: number; areaId?: number; prefijo?: string; excluirTipo?: number },
    formato: FormatoExport = 'xlsx'
  ): Promise<void> {
    const params = new URLSearchParams();
    if (formato === 'csv') params.append('formato', 'csv');
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') params.append(clave, String(valor));
    });
    const qs = params.toString();
    return descargar(`/excel/exportar-flota${qs ? `?${qs}` : ''}`, `ContiMantenimiento - Flota filtrada.${formato}`);
  },

  /** Excel: un archivo con una hoja por módulo. CSV: un .zip con un .csv por hoja */
  exportarTodo(formato: FormatoExport = 'xlsx'): Promise<void> {
    return descargar(`/excel/exportar-todo${formato === 'csv' ? '?formato=csv' : ''}`,
      `ContiMantenimiento - Exportacion completa.${formato === 'csv' ? 'zip' : 'xlsx'}`);
  },

  descargarPlantilla(entidad: EntidadImportable, formato: FormatoExport = 'xlsx'): Promise<void> {
    return descargar(`/excel/plantilla/${entidad}${formato === 'csv' ? '?formato=csv' : ''}`, `Plantilla ${entidad}.${formato}`);
  },

  /** Todas las hojas importables del archivo de "Exportar todo" a la vez (todo o nada) */
  async importarTodo(archivo: File, aplicar: boolean): Promise<ApiResponse<ExcelImportTodoResult>> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return await httpClient.uploadFile<ExcelImportTodoResult>(`/excel/importar-todo?aplicar=${aplicar}`, formData);
  },

  /** Con aplicar=false solo valida; con aplicar=true guarda si el archivo no tiene errores */
  async importar(entidad: EntidadImportable, archivo: File, aplicar: boolean): Promise<ApiResponse<ExcelImportResult>> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return await httpClient.uploadFile<ExcelImportResult>(`/excel/importar/${entidad}?aplicar=${aplicar}`, formData);
  }
};

export default excelService;
