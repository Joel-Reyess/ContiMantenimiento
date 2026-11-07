export interface ImageFault {
  id: number;
  name: string;
  description?: string;
  active: boolean;
}

export interface ImageFaultCreateRequest {
  name: string;
  description?: string;
  active?: boolean;
}

export interface ImageFaultUpdateRequest {
  id: number;
  name: string;
  description?: string;
  active: boolean;
}

export interface VehicleImagePoint {
  id: number;
  imageKey: string;
  xPct: number;
  yPct: number;
  radiusPct?: number;
  imageFaultId: number;
  imageFaultName?: string;
  /** Descripción del componente: se muestra debajo del nombre al elegir fallas (PDF 06-nov) */
  imageFaultDescription?: string;
  /** Actividad del checklist ligada a mano; sin valor se liga por nombre */
  checklistItemId?: number | null;
  active: boolean;
}

export interface VehicleImagePointCreateRequest {
  imageKey: string;
  xPct: number;
  yPct: number;
  radiusPct?: number;
  imageFaultId: number;
  active?: boolean;
}

export interface VehicleImagePointUpdateRequest {
  id: number;
  imageKey: string;
  xPct: number;
  yPct: number;
  radiusPct?: number;
  imageFaultId: number;
  active: boolean;
}

export interface ReportImageFault {
  id: number;
  reporteFallaId: number;
  imageFaultId: number;
  imageFaultName?: string;
  vehicleImagePointId?: number;
  xPct?: number;
  yPct?: number;
}

export interface ReportImageFaultCreateRequest {
  imageFaultId: number;
  vehicleImagePointId?: number;
}
