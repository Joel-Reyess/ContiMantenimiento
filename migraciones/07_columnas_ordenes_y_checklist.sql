-- =============================================================================
-- Parche: columnas/tabla que le faltan a tu BD de OrdenesTrabajo y checklists.
--
-- Tu base esta atrasada respecto a DOS migraciones de EF que quedaron sin aplicar
-- (o a medias). Por eso al ENVIAR un reporte truena con:
--     SqlException 207: Invalid column name 'EstadoAprobacionLider' / ...
-- El flujo "crear-con-checklist-automatico" lee esas columnas de OrdenesTrabajo y
-- escribe en los checklists, y si no existen, da 500.
--
-- Cubre las migraciones:
--   20260112155128_AddChecklistQtyAndApprovalAndLeaderAssignment
--   20260112170838_AddCantidadToReporteFallaChecklistItem
--
-- Idempotente: cada columna/tabla se crea SOLO si no existe (COL_LENGTH / OBJECT_ID).
-- Puedes correrlo aunque ya tengas algunas; no truena ni duplica.
-- Base: MantenimientoEquiposDB.  Respaldo antes por si acaso.
-- =============================================================================
SET NOCOUNT ON;

-- ---- OrdenesTrabajoChecklistItems.Cantidad -----------------------------------
IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'Cantidad') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD Cantidad decimal(18,2) NULL;
    PRINT 'OrdenesTrabajoChecklistItems.Cantidad agregada.';
END ELSE PRINT 'OrdenesTrabajoChecklistItems.Cantidad ya existia.';

-- ---- OrdenesTrabajo: columnas de aprobacion/firma ----------------------------
IF COL_LENGTH('dbo.OrdenesTrabajo', 'ComentariosAprobacionLider') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD ComentariosAprobacionLider nvarchar(500) NULL;
    PRINT 'OrdenesTrabajo.ComentariosAprobacionLider agregada.';
END ELSE PRINT 'OrdenesTrabajo.ComentariosAprobacionLider ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'ComentariosAprobacionSupervisor') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD ComentariosAprobacionSupervisor nvarchar(500) NULL;
    PRINT 'OrdenesTrabajo.ComentariosAprobacionSupervisor agregada.';
END ELSE PRINT 'OrdenesTrabajo.ComentariosAprobacionSupervisor ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'EstadoAprobacionLider') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD EstadoAprobacionLider int NOT NULL CONSTRAINT DF_OrdenesTrabajo_EstadoAprobacionLider DEFAULT 0;
    PRINT 'OrdenesTrabajo.EstadoAprobacionLider agregada.';
END ELSE PRINT 'OrdenesTrabajo.EstadoAprobacionLider ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'EstadoAprobacionSupervisor') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD EstadoAprobacionSupervisor int NOT NULL CONSTRAINT DF_OrdenesTrabajo_EstadoAprobacionSupervisor DEFAULT 0;
    PRINT 'OrdenesTrabajo.EstadoAprobacionSupervisor agregada.';
END ELSE PRINT 'OrdenesTrabajo.EstadoAprobacionSupervisor ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaLider') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaLider nvarchar(500) NULL;
    PRINT 'OrdenesTrabajo.FirmaLider agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaLider ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaLiderFecha') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaLiderFecha datetime2 NULL;
    PRINT 'OrdenesTrabajo.FirmaLiderFecha agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaLiderFecha ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaLiderNombre') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaLiderNombre nvarchar(200) NULL;
    PRINT 'OrdenesTrabajo.FirmaLiderNombre agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaLiderNombre ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaSupervisor') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaSupervisor nvarchar(500) NULL;
    PRINT 'OrdenesTrabajo.FirmaSupervisor agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaSupervisor ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaSupervisorFecha') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaSupervisorFecha datetime2 NULL;
    PRINT 'OrdenesTrabajo.FirmaSupervisorFecha agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaSupervisorFecha ya existia.';

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FirmaSupervisorNombre') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FirmaSupervisorNombre nvarchar(200) NULL;
    PRINT 'OrdenesTrabajo.FirmaSupervisorNombre agregada.';
END ELSE PRINT 'OrdenesTrabajo.FirmaSupervisorNombre ya existia.';

-- ---- ChecklistRespuestas.Cantidad -------------------------------------------
IF COL_LENGTH('dbo.ChecklistRespuestas', 'Cantidad') IS NULL
BEGIN
    ALTER TABLE dbo.ChecklistRespuestas ADD Cantidad decimal(18,2) NOT NULL CONSTRAINT DF_ChecklistRespuestas_Cantidad DEFAULT 0;
    PRINT 'ChecklistRespuestas.Cantidad agregada.';
END ELSE PRINT 'ChecklistRespuestas.Cantidad ya existia.';

-- ---- ReportesFallaChecklistItems.Cantidad -----------------------------------
IF COL_LENGTH('dbo.ReportesFallaChecklistItems', 'Cantidad') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems ADD Cantidad decimal(18,2) NULL;
    PRINT 'ReportesFallaChecklistItems.Cantidad agregada.';
END ELSE PRINT 'ReportesFallaChecklistItems.Cantidad ya existia.';

-- ---- Tabla LiderTipoVehiculoAsignaciones ------------------------------------
IF OBJECT_ID(N'[dbo].[LiderTipoVehiculoAsignaciones]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LiderTipoVehiculoAsignaciones (
        Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_LiderTipoVehiculoAsignaciones PRIMARY KEY,
        UsuarioId   int NOT NULL,
        TipoVehiculo int NOT NULL,
        CreatedAt   datetime2 NOT NULL,
        CONSTRAINT FK_LiderTipoVehiculoAsignaciones_Users_UsuarioId
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_LiderTipoVehiculoAsignaciones_UsuarioId
        ON dbo.LiderTipoVehiculoAsignaciones (UsuarioId);
    PRINT 'Tabla LiderTipoVehiculoAsignaciones creada.';
END ELSE PRINT 'Tabla LiderTipoVehiculoAsignaciones ya existia.';

-- ---- (Opcional) marcar estas migraciones como aplicadas en el historial de EF
-- Solo sirve si algun dia corres "dotnet ef database update": evita que EF intente
-- re-aplicarlas y truene porque las columnas ya existen. Si no usas EF, ignoralo.
IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'20260112155128_AddChecklistQtyAndApprovalAndLeaderAssignment')
        INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion)
        VALUES (N'20260112155128_AddChecklistQtyAndApprovalAndLeaderAssignment', N'9.0.7');
    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'20260112170838_AddCantidadToReporteFallaChecklistItem')
        INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion)
        VALUES (N'20260112170838_AddCantidadToReporteFallaChecklistItem', N'9.0.7');
    PRINT 'Historial de EF actualizado (si hacia falta).';
END

PRINT '==== Listo. Reinicia/recarga la API y vuelve a enviar el reporte. ====';
GO
