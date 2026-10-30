export { httpClient } from './httpClient';
export { authService } from './authService';
export { vehiculosService } from './vehiculosService';
export { vehiculoDocumentosService } from './vehiculoDocumentosService';
export { reportesService } from './reportesService';
export { ordenesService } from './ordenesService';
export { dashboardService } from './dashboardService';
export { notificacionesService } from './notificacionesService';
export { catalogosService } from './catalogosService';
export { usuariosService } from './usuariosService';
export { pagosService } from './pagosService';
export { refaccionesService } from './refaccionesService';
export { checklistService } from './checklistService';
export { consumiblesService } from './consumiblesService';
export { recepcionService } from './recepcionService';
export { aprobacionesService } from './aprobacionesService';
export { entregaService } from './entregaService';
export { vehiculoPrefijoConfigsService } from './vehiculoPrefijoConfigsService';
export { asignacionesService } from './asignacionesService';
export { ordenTrabajoChecklistItemService } from './ordenTrabajoChecklistItemService';
export { solicitudCambioService } from './solicitudCambioService';
export { solicitudActividadAdicionalService } from './solicitudActividadAdicionalService';
export { ordenesCompraService } from './ordenesCompraService';
export { adminService } from './adminService';
export { imageFaultsService } from './imageFaultsService';
export { vehicleImagePointsService } from './vehicleImagePointsService';

export type { VehiculoFilters, PaginatedResponse } from './vehiculosService';
export type { ReporteFilters } from './reportesService';
export type { OrdenFilters } from './ordenesService';
export type { DashboardFilters } from './dashboardService';
export type { UserFilters } from './usuariosService';
export type { PagoFilters, RegistroPago, CrearPagoRequest } from './pagosService';
export type { SolicitudRefaccion, SolicitudRefaccionCreateRequest } from './refaccionesService';
export type { Consumible } from './consumiblesService';
export type { AprobacionItem } from './aprobacionesService';
export type { ChecklistTemplate, ChecklistItem, ChecklistRespuesta } from './checklistService';
export type {
  TipoVehiculoItem,
  EstadoItem,
  PrioridadItem,
  RolItem,
  TecnicoItem
} from './catalogosService';
export type { VehiculoPrefijoConfig } from './vehiculoPrefijoConfigsService';
