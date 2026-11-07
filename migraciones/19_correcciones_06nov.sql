-- =============================================================================
-- Correcciones del documento del 06-nov-2026 (órdenes de trabajo y reporte de falla)
--
-- Agrega:
--   * VehicleImagePoints.ChecklistItemId: actividad del checklist que genera cada componente de la foto
--     del vehículo al reportarlo ("componente + cantidad" en una sola sección). NULL = se liga sola por nombre.
--   * ReportesFalla.PuedeOperar se recalcula con el tipo de mantenimiento (Correctivo = no puede operar,
--     Preventivo = puede operar) en los reportes que todavía no tienen orden. La prioridad queda informativa.
--
-- El estado "Cancelado" de la inspección (EstadoInspeccion = 3) no necesita cambios: la columna ya es int.
--
-- Va DESPUÉS de 17_materiales_y_ordenes_pago.sql. Idempotente: se puede correr varias veces.
-- Haz un respaldo de la base antes de correrlo.
-- =============================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VehicleImagePoints', 'ChecklistItemId') IS NULL
BEGIN
    ALTER TABLE dbo.VehicleImagePoints ADD ChecklistItemId int NULL;
    PRINT 'VehicleImagePoints.ChecklistItemId agregada.';
END
GO

UPDATE dbo.ReportesFalla
SET PuedeOperar = CASE WHEN TipoMantenimiento = 'Correctivo' THEN 0 ELSE 1 END
WHERE TieneOrdenTrabajo = 0
  AND PuedeOperar <> CASE WHEN TipoMantenimiento = 'Correctivo' THEN 0 ELSE 1 END;
PRINT CONCAT('Reportes sin orden con "puede operar" según el tipo de mantenimiento: ', @@ROWCOUNT, ' ajustado(s).');
GO

PRINT 'Correcciones del 06-nov listas.';
