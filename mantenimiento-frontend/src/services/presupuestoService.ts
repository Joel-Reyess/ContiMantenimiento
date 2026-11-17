import httpClient from './httpClient';
import type { EmpresaSeleccion } from './flujoService';

/** Presupuesto de Empresas y selección automática de proveedor (Reporte 6, PRS-01 a PRS-03 y DSH-03) */

export interface ConfigSeleccion {
  /** Una empresa con saldo menor no recibe órdenes nuevas */
  saldoMinimo: number;
  /** % del presupuesto asignado en el que se avisa que está por agotarse */
  umbralPreventivo: number;
  /** Órdenes activas por empresa a la vez */
  capacidadMaxima: number;
}

export interface OrdenSinProveedor {
  ordenId: number;
  ordenFolio: string;
  vehiculoCodigo?: string;
  desde?: string;
}

export interface PresupuestoEmpresas {
  config: ConfigSeleccion;
  empresas: EmpresaSeleccion[];
  sinProveedor: OrdenSinProveedor[];
}

export interface MovimientoPresupuesto {
  id: number;
  empresaId: number;
  empresa?: string;
  /** Asignacion, Ajuste, Descuento, Reversion */
  tipo: string;
  monto: number;
  saldoResultante: number;
  folioPago?: string;
  ordenTrabajoId?: number;
  folioOrden?: string;
  vehiculoCodigo?: string;
  motivo?: string;
  usuario?: string;
  fecha: string;
}

export interface IndicadorEmpresa {
  empresaId: number;
  empresa: string;
  disponibilidad: string;
  motivo?: string;
  ordenesAtendidas: number;
  reparacionesConcluidas: number;
  reparacionesPendientes: number;
  activas: number;
  capacidad: number;
  semaforoCapacidad: 'verde' | 'amarillo' | 'rojo';
  tienePresupuesto: boolean;
  asignado: number;
  utilizado: number;
  saldo: number;
  estadoFinanciero: string;
  costoPromedio: number;
  gastoPorTipo: { tipo: string; reparaciones: number; total: number }[];
}

export interface IndicadoresProveedores {
  ordenesSinProveedor: number;
  capacidadMaxima: number;
  empresas: IndicadorEmpresa[];
}

export const presupuestoService = {
  resumen: () => httpClient.get<PresupuestoEmpresas>('/presupuesto-empresas'),
  movimientos: (empresaId?: number) =>
    httpClient.get<MovimientoPresupuesto[]>(`/presupuesto-empresas/movimientos${empresaId ? `?empresaId=${empresaId}` : ''}`),
  registrar: (empresaId: number, tipo: 'Asignacion' | 'Ajuste', monto: number, motivo?: string) =>
    httpClient.post<{ movimientoId: number; saldo: number; ordenesAsignadas: number }>('/presupuesto-empresas/movimientos', { empresaId, tipo, monto, motivo }),
  guardarConfig: (config: ConfigSeleccion) => httpClient.put<ConfigSeleccion>('/presupuesto-empresas/config', config),
  reintentar: () => httpClient.post<{ asignadas: number; pendientes: number }>('/presupuesto-empresas/reintentar'),
  indicadores: () => httpClient.get<IndicadoresProveedores>('/dashboard/indicadores-proveedores'),
};

export const COLOR_SEMAFORO: Record<'verde' | 'amarillo' | 'rojo', string> = {
  verde: '#2db928',
  amarillo: '#e6a700',
  rojo: '#ff2d37',
};

/** Color del estado financiero */
export function colorFinanciero(estado: string): string {
  if (estado === 'Agotado') return '#ff2d37';
  if (estado === 'Preventivo') return '#e6a700';
  if (estado === 'Sin presupuesto') return '#969696';
  return '#2db928';
}

/** Color de la disponibilidad de la empresa */
export function colorDisponibilidad(d: string): string {
  if (d === 'Disponible') return '#2db928';
  if (d === 'Capacidad máxima') return '#ff2d37';
  if (d === 'Inactiva') return '#969696';
  return '#4b1f6f';
}

export const moneda = (n: number) =>
  (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
