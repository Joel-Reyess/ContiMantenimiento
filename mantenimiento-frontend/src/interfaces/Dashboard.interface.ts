import type { TipoVehiculo, EstadoOrdenTrabajo } from './Api.interface';
import type { OrdenTrabajoList } from './OrdenTrabajo.interface';

export interface DashboardStats {
  totalVehiculos: number;
  vehiculosOperativos: number;
  vehiculosEnReparacion: number;
  vehiculosFueraServicio: number;
  ordenesPendientes: number;
  ordenesEnProceso: number;
  ordenesCompletadasHoy: number;
  ordenesCompletadasSemana: number;
  reportesNuevosHoy: number;
  reportesSinAtender: number;
  pagosPendientes: number;
  montoPagosPendientes: number;
}

export interface WeeklyComparison {
  semanaActual: number;
  semanaAnterior: number;
  diferencia: number;
  porcentajeCambio: number;
}

export interface KPIs {
  tiempoPromedioResolucion: number;
  porcentajeDisponibilidad: number;
  fallasPorTipo: FallasPorTipo[];
  fallasRecurrentesChecklist: FallasRecurrentesChecklist[];
  matrizUbicacion: UbicacionPorTipoMatriz[];
  ordenesPorEstado: OrdenesPorEstado[];
  costoTotalPeriodo: number;
  costoManoObraPeriodo: number;
  costoRefaccionesPeriodo: number;
  mantenimientosProximos?: number;
  mantenimientosVencidos?: number;
  weeklyComparison?: WeeklyComparison;
}

export interface FallasRecurrentesChecklist {
  checklistItemId: number;
  pregunta: string;
  cantidad: number;
}

export interface UbicacionPorTipoMatriz {
  ubicacion: string;
  statsPorTipo: StatsPorTipoVehiculo[];
}

export interface StatsPorTipoVehiculo {
  tipoVehiculo: string;
  cantidad: number;
  promedioDias: number;
}

export interface FallasPorTipo {
  tipo: TipoVehiculo;
  tipoVehiculo: TipoVehiculo;
  tipoNombre?: string;
  cantidadFallas: number;
}

export interface OrdenesPorEstado {
  estado: EstadoOrdenTrabajo;
  estadoNombre?: string;
  cantidad: number;
}

export interface DashboardTecnico {
  ordenesAsignadas: number;
  ordenesEnProceso: number;
  ordenesCompletadasHoy: number;
  ordenesCompletadasSemana: number;
  ordenesActivas: OrdenTrabajoList[];
  metaMensual: number;
}

export interface Notificacion {
  id: number;
  tipo: number;
  tipoNombre?: string;
  titulo: string;
  mensaje: string;
  urlDestino?: string;
  referenciaId?: number;
  tipoReferencia?: string;
  leida: boolean;
  fechaLectura?: string;
  fechaCreacion: string;
}

export interface NotificacionesResumen {
  totalNoLeidas: number;
  notificacionesRecientes: Notificacion[];
}

export interface Area {
  id: number;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  supervisorId?: number;
  supervisorNombre?: string;
  activa: boolean;
}

export interface DashboardVehiculoResumen {
  id: number;
  codigo: string;
  tipoNombre?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  anio?: number;
  estadoNombre?: string;
  areaNombre?: string;
  ultimoMantenimiento?: string;
  proximoMantenimiento?: string;
  capacidadCarga?: number;
  horasOperacion?: number;
  kilometraje?: number;
  activo: boolean;
  totalReportes: number;
}

export interface DashboardResumen {
  totalVehiculos: number;
  vehiculosOperativos: number;
  vehiculosEnMantenimiento: number;
  vehiculosFueraServicio: number;
  vehiculosEnPiso?: number;
  vehiculosEnTaller?: number;
  vehiculosEnTransicion?: number;
  equipos: DashboardVehiculoResumen[];
  estadosPorTipo?: EstadoPorTipo[];
}

export interface EstadoPorTipo {
  tipo: string;
  total: number;
  operativos: number;
  enMantenimiento: number;
  fueraDeServicio: number;
  piso?: number;
  taller?: number;
  transicion?: number;
}

export interface ReporteAnual {
  mes: number;
  mesNombre: string;
  tipoVehiculo: string;
  cantidad: number;
}

export interface OrdenSinFirma {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  estado: string;
  fechaFinalizacion: string;
  tecnicoNombre: string;
}
