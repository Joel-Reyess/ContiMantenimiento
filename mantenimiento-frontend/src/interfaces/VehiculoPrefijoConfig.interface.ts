export interface VehiculoPrefijoConfig {
  id: number;
  prefijoCodigo: string;
  tipoVehiculoId: number;
  tipoVehiculoNombre?: string;
  descripcion?: string;
  activo: boolean;
  createdAt: string;
  updatedAt?: string;
}
