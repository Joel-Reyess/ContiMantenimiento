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
  /** FV-03: actividad del checklist ubicada en este punto */
  checklistItemId?: number | null;
  /** FV-03: el punto no tiene una actividad vigente del checklist de su tipo (anterior sin ligar o actividad quitada) */
  sinActividad?: boolean;
  /** Título de la actividad (o su descripción si no tiene título) */
  actividadTitulo?: string | null;
  /** Descripción de la actividad (texto del ítem del checklist) */
  actividadDescripcion?: string | null;
  /** Costo base de la actividad */
  actividadCosto?: number | null;
  active: boolean;
}

/** FV-03: el punto se crea con una actividad del checklist del tipo (ya no con una falla capturada aparte) */
export interface VehicleImagePointCreateRequest {
  imageKey: string;
  xPct: number;
  yPct: number;
  radiusPct?: number;
  checklistItemId: number;
  active?: boolean;
}

export interface VehicleImagePointUpdateRequest {
  id: number;
  imageKey: string;
  xPct: number;
  yPct: number;
  radiusPct?: number;
  /** Si viene, el punto pasa a esa actividad */
  checklistItemId?: number;
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
