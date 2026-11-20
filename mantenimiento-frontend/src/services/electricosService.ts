import httpClient from './httpClient';
import type { ResultadoFlujo } from './flujoService';

/** Flujo de mantenimiento para equipos eléctricos (montacargas, tuggers y traspaletas; EQE-01 a EQE-12) */

export type EstadoPreventivo = 'Programado' | 'Pendiente' | 'En proceso' | 'Vencido' | 'Completado';

export interface EquipoElectrico {
  vehiculoId: number;
  codigo: string;
  numeroEconomico?: string;
  tipoId: number;
  tipo?: string;
  area?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  /** Operativo o Fuera de servicio */
  estadoEquipo: string;
  /** Pendiente de ingreso, En reparación o En mantenimiento */
  subestadoEquipo?: string;
  ordenId?: number;
  ordenFolio?: string;
  ordenTipo?: string;
  ultimoPreventivo?: string;
  proximoPreventivo?: string;
  estadoPreventivo: EstadoPreventivo;
  diasParaVencer?: number;
  horometro?: number;
  horasDesdePreventivo?: number;
  horasPreventivo?: number;
  periodicidadDias: number;
  /** reportar, iniciarPreventivo, ajustarFecha */
  acciones: string[];
}

export interface EquiposElectricos {
  proveedor?: string;
  proveedorId?: number;
  activas: number;
  capacidad: number;
  equipos: EquipoElectrico[];
}

export interface ActividadChecklist {
  id?: number;
  numero?: string;
  descripcion: string;
}

export interface CategoriaChecklist {
  id?: number;
  numero: number;
  nombre: string;
  actividades: ActividadChecklist[];
}

export interface ChecklistPreventivoTipo {
  tipoVehiculoId: number;
  tipo?: string;
  categorias: CategoriaChecklist[];
}

export interface IndicadoresElectricos {
  totalEquipos: number;
  operativos: number;
  fueraDeServicio: number;
  fueraPorTipo: { tipo: string; correctivo: number; preventivo: number }[];
  horasPromedioFueraServicio?: number;
  preventivosAlDia: number;
  cumplimientoPreventivos: number;
  preventivosVencidos: number;
  preventivosProximos: number;
  activas: number;
  capacidad: number;
  proveedor?: string;
  fallasRecurrentes: { vehiculoId: number; equipo: string; tipo?: string; correctivos: number }[];
}

export const electricosService = {
  listar: () => httpClient.get<EquiposElectricos>('/equipos-electricos'),
  iniciarPreventivo: (vehiculoId: number, horometro: number) =>
    httpClient.post<ResultadoFlujo>('/equipos-electricos/preventivos/iniciar', { vehiculoId, horometro }),
  /** fecha en formato yyyy-mm-dd (día del próximo preventivo) */
  ajustarProximo: (vehiculoId: number, fecha: string) =>
    httpClient.put<EquipoElectrico>(`/equipos-electricos/${vehiculoId}/proximo-preventivo`, { fecha }),
  checklist: (tipoId: number) => httpClient.get<ChecklistPreventivoTipo>(`/equipos-electricos/checklist/${tipoId}`),
  guardarChecklist: (tipoId: number, checklist: ChecklistPreventivoTipo) =>
    httpClient.put<ChecklistPreventivoTipo>(`/equipos-electricos/checklist/${tipoId}`, checklist),
  indicadores: () => httpClient.get<IndicadoresElectricos>('/equipos-electricos/indicadores'),
};

/** Colores del diagrama del preventivo */
export const COLOR_PREVENTIVO: Record<string, string> = {
  Programado: '#1f2d55',
  Pendiente: '#ff8c00',
  'En proceso': '#1f6fd1',
  Completado: '#2db928',
  Vencido: '#4b1f6f',
};

/** Operativo verde; fuera de servicio rojo (pendiente de ingreso naranja) */
export function colorEstadoEquipo(estado: string, subestado?: string): string {
  if (estado === 'Operativo') return '#2db928';
  if (subestado === 'Pendiente de ingreso') return '#ff8c00';
  if (subestado === 'En mantenimiento') return '#1f6fd1';
  return '#ff2d37';
}

/** "2026-12-20T00:00:00" → "20/12/2026" sin mover el día por la zona horaria (son fechas sin hora) */
export function fechaDia(valor?: string): string {
  if (!valor) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export const horas = (n?: number) => (n === undefined || n === null ? '—' : `${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`);
