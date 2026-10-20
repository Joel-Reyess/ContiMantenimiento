/** Pago incluido en una orden de compra (la OC agrupa pagos de un mismo proveedor/técnico) */
export interface OrdenCompraPago {
  id: number;
  ordenTrabajoId: number;
  ordenTrabajoFolio?: string;
  tecnicoNombre?: string;
  montoTotal: number;
  estado: string;
}

export interface OrdenCompra {
  id: number;
  folio: string;
  proveedorId?: number;
  proveedorNombre?: string;
  fechaRegistro: string;
  /** Activa, Completada o Cancelada */
  estado: string;
  total: number;
  numeroExterno?: string;
  pagos: OrdenCompraPago[];
}
