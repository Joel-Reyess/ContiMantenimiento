-- =============================================================================
-- Parche: columnas que le faltan a las tablas de checklist de tu BD.
--
-- Sintoma que arregla (500 al CREAR LA ORDEN DE TRABAJO):
--     SqlException 207: Invalid column name 'FotoUrl'.
--     ... en OrdenTrabajoService.CreateAsync (linea ~373)
--
-- Al crear la orden, EF copia el checklist del reporte a OrdenesTrabajoChecklistItems
-- e inserta las 8 columnas del modelo (Cantidad, ChecklistItemId, Estado,
-- FechaAsignacion, FechaCompletado, FotoUrl, Notas, OrdenTrabajoId). Si a tu tabla
-- le falta alguna, el INSERT truena con error 207.
--
-- Este script deja AMBAS tablas de checklist igual que el codigo:
--   dbo.OrdenesTrabajoChecklistItems  (modelo OrdenTrabajoChecklistItem)
--   dbo.ReportesFallaChecklistItems   (modelo ReporteFallaChecklistItem)
--
-- Idempotente: cada columna se crea SOLO si no existe (COL_LENGTH).
-- Puedes correrlo varias veces; no truena ni duplica.
-- Base: MantenimientoEquiposDB.  Respaldo antes por si acaso.
-- =============================================================================
USE MantenimientoEquiposDB;
SET NOCOUNT ON;

-- ---- OrdenesTrabajoChecklistItems -------------------------------------------
IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'FotoUrl') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD FotoUrl nvarchar(500) NULL;
    PRINT 'OrdenesTrabajoChecklistItems.FotoUrl agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.FotoUrl ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'Notas') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD Notas nvarchar(500) NULL;
    PRINT 'OrdenesTrabajoChecklistItems.Notas agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.Notas ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'Cantidad') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD Cantidad decimal(18,2) NULL;
    PRINT 'OrdenesTrabajoChecklistItems.Cantidad agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.Cantidad ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'FechaCompletado') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD FechaCompletado datetime2 NULL;
    PRINT 'OrdenesTrabajoChecklistItems.FechaCompletado agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.FechaCompletado ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'FechaAsignacion') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems
        ADD FechaAsignacion datetime2 NOT NULL
        CONSTRAINT DF_OrdenesTrabajoChecklistItems_FechaAsignacion DEFAULT SYSUTCDATETIME();
    PRINT 'OrdenesTrabajoChecklistItems.FechaAsignacion agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.FechaAsignacion ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'Estado') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems
        ADD Estado nvarchar(20) NOT NULL
        CONSTRAINT DF_OrdenesTrabajoChecklistItems_Estado DEFAULT 'Pendiente';
    PRINT 'OrdenesTrabajoChecklistItems.Estado agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.Estado ya existia.';

-- ---- ReportesFallaChecklistItems --------------------------------------------
IF COL_LENGTH('dbo.ReportesFallaChecklistItems', 'Notas') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems ADD Notas nvarchar(500) NULL;
    PRINT 'ReportesFallaChecklistItems.Notas agregada.';
END ELSE PRINT 'ReportesFallaChecklistItems.Notas ya existia.';

IF COL_LENGTH('dbo.ReportesFallaChecklistItems', 'Cantidad') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems ADD Cantidad decimal(18,2) NULL;
    PRINT 'ReportesFallaChecklistItems.Cantidad agregada.';
END ELSE PRINT 'ReportesFallaChecklistItems.Cantidad ya existia.';

IF COL_LENGTH('dbo.ReportesFallaChecklistItems', 'FechaAsignacion') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems
        ADD FechaAsignacion datetime2 NOT NULL
        CONSTRAINT DF_ReportesFallaChecklistItems_FechaAsignacion DEFAULT SYSUTCDATETIME();
    PRINT 'ReportesFallaChecklistItems.FechaAsignacion agregada.';
END ELSE PRINT 'ReportesFallaChecklistItems.FechaAsignacion ya existia.';

IF COL_LENGTH('dbo.ReportesFallaChecklistItems', 'Estado') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems
        ADD Estado nvarchar(20) NOT NULL
        CONSTRAINT DF_ReportesFallaChecklistItems_Estado DEFAULT 'Pendiente';
    PRINT 'ReportesFallaChecklistItems.Estado agregada.';
END ELSE PRINT 'ReportesFallaChecklistItems.Estado ya existia.';

PRINT '==== Listo. Reinicia la API y vuelve a crear la orden de trabajo. ====';
GO

-- ---- Verificacion (debe listar las 8 columnas de la tabla de la orden) -------
SELECT c.name AS Columna, t.name AS Tipo
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.OrdenesTrabajoChecklistItems')
ORDER BY c.column_id;
GO
