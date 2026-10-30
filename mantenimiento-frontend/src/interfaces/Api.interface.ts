// Respuesta estándar de la API
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
  errors?: string[];
  errorCode?: string;
  metadata?: any;
}

// Tipos de Enums como constantes
export const TipoVehiculo = {
  Carrito: 1,
  Tugger: 2,
  Montacargas: 3,

  CarroDePolvos: 4,
  CarroLibro: 5,
  CassetteDeCojin: 6,
  CassetteDeCostado: 7,
  CassetteDeBreaker: 8,
  CassetteDeCapa: 9,
  Tambo: 10,
  PinRack: 11,
  Conti: 12,
  JaulaDeCuarentena: 13,
  FlatStorage: 14,
  Circulo: 15,
} as const;
export type TipoVehiculo = typeof TipoVehiculo[keyof typeof TipoVehiculo];

export const EstadoVehiculo = {
  Operativo: 1,
  EnReparacion: 2,
  FueraDeServicio: 3,
  EnEspera: 4
} as const;
export type EstadoVehiculo = typeof EstadoVehiculo[keyof typeof EstadoVehiculo];

export const EstadoOrdenTrabajo = {
  Pendiente: 1,
  Asignada: 2,
  EnProceso: 3,
  EsperandoRefacciones: 4,
  Completada: 5,
  Cancelada: 6,
  Validada: 7
} as const;
export type EstadoOrdenTrabajo = typeof EstadoOrdenTrabajo[keyof typeof EstadoOrdenTrabajo];

export const Prioridad = {
  Baja: 1,
  Media: 2,
  Alta: 3,
  Urgente: 4
} as const;
export type Prioridad = typeof Prioridad[keyof typeof Prioridad];

export const TipoTecnico = {
  Interno: 1,
  Externo: 2
} as const;
export type TipoTecnico = typeof TipoTecnico[keyof typeof TipoTecnico];

export const EstadoPago = {
  Pendiente: 1,
  EnRevision: 2,
  Aprobado: 3,
  Pagado: 4,
  Rechazado: 5
} as const;
export type EstadoPago = typeof EstadoPago[keyof typeof EstadoPago];

// Helper para obtener nombres de enums
export const TipoVehiculoNombres: Record<number, string> = {
  [TipoVehiculo.Carrito]: 'Carrito',
  [TipoVehiculo.Tugger]: 'Tugger',
  [TipoVehiculo.Montacargas]: 'Montacargas',
  [TipoVehiculo.CarroDePolvos]: 'Carro de Polvos',
  [TipoVehiculo.CarroLibro]: 'Carro Libro',
  [TipoVehiculo.CassetteDeCojin]: 'Cassette de Cojin',
  [TipoVehiculo.CassetteDeCostado]: 'Cassette de Costado',
  [TipoVehiculo.CassetteDeBreaker]: 'Cassette de Breaker',
  [TipoVehiculo.CassetteDeCapa]: 'Cassette de Capa',
  [TipoVehiculo.Tambo]: 'Tambo',
  [TipoVehiculo.PinRack]: 'Pin Rack',
  [TipoVehiculo.Conti]: 'Conti',
  [TipoVehiculo.JaulaDeCuarentena]: 'Jaula de Cuarentena',
  [TipoVehiculo.FlatStorage]: 'Flat Storage',
  [TipoVehiculo.Circulo]: 'Círculo'
};

export const EstadoVehiculoNombres: Record<number, string> = {
  [EstadoVehiculo.Operativo]: 'Operativo',
  [EstadoVehiculo.EnReparacion]: 'En Reparación',
  [EstadoVehiculo.FueraDeServicio]: 'Fuera de Servicio',
  [EstadoVehiculo.EnEspera]: 'En Espera'
};

export const EstadoOrdenNombres: Record<number, string> = {
  [EstadoOrdenTrabajo.Pendiente]: 'Pendiente',
  [EstadoOrdenTrabajo.Asignada]: 'Asignada',
  [EstadoOrdenTrabajo.EnProceso]: 'En Proceso',
  [EstadoOrdenTrabajo.EsperandoRefacciones]: 'Esperando Refacciones',
  [EstadoOrdenTrabajo.Completada]: 'Completada',
  [EstadoOrdenTrabajo.Cancelada]: 'Cancelada',
  [EstadoOrdenTrabajo.Validada]: 'Validada'
};

export const PrioridadNombres: Record<number, string> = {
  [Prioridad.Baja]: 'Baja',
  [Prioridad.Media]: 'Media',
  [Prioridad.Alta]: 'Alta',
  [Prioridad.Urgente]: 'Urgente'
};

// Nueva interfaz para tipos de vehículo desde la base de datos
export interface TipoVehiculoBD {
  id: number;
  nombre: string;
  descripcion?: string;
  maxInWorkshop?: number;
  activo: boolean;
}
