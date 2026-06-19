import { SolicitudRefaccion } from './OrdenTrabajo.interface';

export interface OrdenCompra {
  id: number;
  folio: string;
  proveedorId?: number;
  proveedor?: any; 
  fechaRegistro: string;
  fechaCreacion?: string; 
  estado: string;
  total: number;
  costoTotal?: number; 
  numeroExterno?: string;
  numeroOrdenExterno?: string; 
  pagos?: any[];
  solicitudes?: SolicitudRefaccion[];
  creadoPorNombre?: string;
}
