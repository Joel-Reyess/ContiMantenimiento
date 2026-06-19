import { TipoVehiculo, EstadoVehiculo } from './Api.interface';

export interface Vehiculo {
  id: number;
  codigo: string;
  tipo: TipoVehiculo;
  tipoNombre?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  anio?: number;
  estado: EstadoVehiculo;
  estadoNombre?: string;
  ubicacion?: number;
  ubicacionNombre?: string;
  areaId?: number;
  areaNombre?: string;
  fechaAdquisicion?: string;
  ultimoMantenimiento?: string;
  proximoMantenimiento?: string;
  capacidadCarga?: number;
  horasOperacion?: number;
  kilometraje?: number;
  imagenUrl?: string;
  notas?: string;
  documentacionDibujos?: string;
  documentacionEspecificaciones?: string;
  listaMateriales?: string;
  registroModificaciones?: string;
  activo: boolean;
}

export interface VehiculoList {
  id: number;
  codigo: string;
  tipo: TipoVehiculo;
  tipoNombre?: string;
  marca?: string;
  modelo?: string;
  estado: EstadoVehiculo;
  estadoNombre?: string;
  ubicacion?: number;
  ubicacionNombre?: string;
  areaNombre?: string;
  ultimoMantenimiento?: string;
  totalReportes: number;
  notas?: string;
}

export interface VehiculoCreateRequest {
  codigo: string;
  tipo: TipoVehiculo;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  anio?: number;
  areaId?: number;
  fechaAdquisicion?: string;
  capacidadCarga?: number;
  notas?: string;
  documentacionDibujos?: string;
  documentacionEspecificaciones?: string;
  listaMateriales?: string;
  registroModificaciones?: string;
}

export interface VehiculoUpdateRequest {
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  anio?: number;
  estado?: EstadoVehiculo;
  areaId?: number;
  proximoMantenimiento?: string;
  capacidadCarga?: number;
  horasOperacion?: number;
  kilometraje?: number;
  imagenUrl?: string;
  notas?: string;
  documentacionDibujos?: string;
  documentacionEspecificaciones?: string;
  listaMateriales?: string;
  registroModificaciones?: string;
  activo?: boolean;
}
