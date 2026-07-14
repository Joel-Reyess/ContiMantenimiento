-- #############################################################################
-- ##  ContiMantenimiento — SCRIPT UNICO PARA PRODUCCION                      ##
-- ##  Generado desde migraciones/ — ejecutar COMPLETO, de arriba a abajo.    ##
-- #############################################################################
--
--  ANTES DE CORRERLO
--  -----------------
--  1) RESPALDO de la base de produccion. No opcional.
--
--  2) Selecciona la base correcta en SSMS (arriba a la izquierda), o descomenta
--     la linea USE de abajo y pon el nombre real de la base de PRODUCCION.
--     Este script NO trae USE hardcodeado a proposito: si lo corres contra la
--     base equivocada, los cambios se van a otro lado y parece que "no hizo nada".
--
--  3) LOS 12 PNG NO VAN EN EL SQL.  <<< OJO, ESTO SE OLVIDA SIEMPRE
--     La PARTE 4 guarda la RUTA de las fotos, pero los archivos hay que copiarlos
--     al servidor a mano:
--         de:  migraciones/imagenes_carritos/tipo_*.png   (12 archivos)
--         a:   <carpeta de la API>/wwwroot/uploads/tiposvehiculo/
--     Si no los copias, la app muestra "No hay imagen disponible" y los puntos
--     numerados salen sin foto abajo.
--
--  ES SEGURO CORRERLO VARIAS VECES
--  -------------------------------
--  Todo esta protegido con IF NOT EXISTS / COL_LENGTH / OBJECT_ID. Si una tabla
--  o columna ya existe, la salta. No duplica datos ni borra nada.
--
--  QUE NO TRAE
--  -----------
--  · 13_vehiculos_demo.sql  -> vehiculos DEMO-*, son de prueba. NO van a produccion.
--  · 00_TODO_EN_UNO.sql     -> quedo obsoleto, lo reemplaza la PARTE 3.
--
-- #############################################################################

-- USE [NombreDeTuBaseDeProduccion];   -- <-- descomenta y ajusta si hace falta
GO

PRINT '';
PRINT '################################################################';
PRINT '##  ContiMantenimiento — actualizacion de esquema PRODUCCION   ##';
PRINT '################################################################';
PRINT CONCAT('Base de datos: ', DB_NAME(), '   |   Servidor: ', @@SERVERNAME);
PRINT '';
GO

-- #############################################################################
-- ##  PARTE 1 — COLUMNAS QUE LE FALTAN A TABLAS QUE YA EXISTEN
-- #############################################################################
-- Ordenes de trabajo y checklists. Sin esto, crear/enviar una orden truena con
-- error 207 'Invalid column name'.
-- #############################################################################
GO
PRINT '';
PRINT '>>> PARTE 1 — COLUMNAS QUE LE FALTAN A TABLAS QUE YA EXISTEN';
GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/07_columnas_ordenes_y_checklist.sql
-- ---------------------------------------------------------------------------
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

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/08_columnas_checklist_items.sql
-- ---------------------------------------------------------------------------
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
-- (USE removido: usa la base seleccionada en SSMS)
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

GO

-- #############################################################################
-- ##  PARTE 2 — COLUMNAS DE TiposVehiculo
-- #############################################################################
-- Incluye ImagenFallasUrl (la foto del carrito) y ProveedorId (asignacion de
-- proveedor). NO existen en ninguna migracion de EF: van a mano si o si.
-- #############################################################################
GO
PRINT '';
PRINT '>>> PARTE 2 — COLUMNAS DE TiposVehiculo';
GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/02_columnas_TiposVehiculo.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Migración: agregar a TiposVehiculo las 8 columnas que faltan en tu base.
--
-- El código (modelo TipoVehiculo) tiene estas columnas, pero tu tabla NO las
-- tiene, así que el backend truena con:
--   SqlException 207: Invalid column name 'ImagenFallasUrl' / 'ProveedorId' / ...
-- al listar vehículos (TipoVehiculoRepository.GetAllAsync). Eso rompía el
-- selector de vehículo en "Reportar falla" (sin vehículo no se detecta el tipo
-- y el botón de componentes queda deshabilitado).
--
-- Estas columnas NO están en ninguna migración de EF (igual que las 3 tablas del
-- feature), por eso hay que agregarlas a mano. Idempotente: usa IF NOT EXISTS.
-- Base: MantenimientoEquiposDB.  ⚠️ Respaldo antes. No toca datos existentes.
-- =============================================================================

-- ImagenUrl NVARCHAR(500) NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ImagenUrl' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ImagenUrl] NVARCHAR(500) NULL;
    PRINT 'Columna ImagenUrl agregada a TiposVehiculo.';
END ELSE PRINT 'ImagenUrl ya existe.';
GO

-- ImagenFallasUrl NVARCHAR(500) NULL  (la que usa el feature para la foto del carro)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ImagenFallasUrl' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ImagenFallasUrl] NVARCHAR(500) NULL;
    PRINT 'Columna ImagenFallasUrl agregada a TiposVehiculo.';
END ELSE PRINT 'ImagenFallasUrl ya existe.';
GO

-- MaxInWorkshop INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'MaxInWorkshop' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [MaxInWorkshop] INT NULL;
    PRINT 'Columna MaxInWorkshop agregada a TiposVehiculo.';
END ELSE PRINT 'MaxInWorkshop ya existe.';
GO

-- FrecuenciaMantenimientoDias INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FrecuenciaMantenimientoDias' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FrecuenciaMantenimientoDias] INT NULL;
    PRINT 'Columna FrecuenciaMantenimientoDias agregada a TiposVehiculo.';
END ELSE PRINT 'FrecuenciaMantenimientoDias ya existe.';
GO

-- FrecuenciaPreventivoMeses INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FrecuenciaPreventivoMeses' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FrecuenciaPreventivoMeses] INT NULL;
    PRINT 'Columna FrecuenciaPreventivoMeses agregada a TiposVehiculo.';
END ELSE PRINT 'FrecuenciaPreventivoMeses ya existe.';
GO

-- ProgramadosPorSemana INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProgramadosPorSemana' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ProgramadosPorSemana] INT NULL;
    PRINT 'Columna ProgramadosPorSemana agregada a TiposVehiculo.';
END ELSE PRINT 'ProgramadosPorSemana ya existe.';
GO

-- FechaProximoMantenimiento DATETIME2(7) NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FechaProximoMantenimiento' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FechaProximoMantenimiento] DATETIME2(7) NULL;
    PRINT 'Columna FechaProximoMantenimiento agregada a TiposVehiculo.';
END ELSE PRINT 'FechaProximoMantenimiento ya existe.';
GO

-- ProveedorId INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ProveedorId] INT NULL;
    PRINT 'Columna ProveedorId agregada a TiposVehiculo.';
END ELSE PRINT 'ProveedorId ya existe.';
GO

-- Índice + FK de ProveedorId -> Users (solo si Users existe y la FK no está aún)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TiposVehiculo_ProveedorId' AND object_id = OBJECT_ID(N'dbo.TiposVehiculo'))
   AND EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_TiposVehiculo_ProveedorId] ON [dbo].[TiposVehiculo] ([ProveedorId] ASC);
    PRINT 'Índice IX_TiposVehiculo_ProveedorId creado.';
END ELSE PRINT 'Índice IX_TiposVehiculo_ProveedorId: ya existe (omitido).';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_TiposVehiculo_Users_ProveedorId')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Users') AND type = N'U')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo]
        ADD CONSTRAINT [FK_TiposVehiculo_Users_ProveedorId]
        FOREIGN KEY ([ProveedorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION;
    PRINT 'FK TiposVehiculo -> Users (ProveedorId) agregada.';
END ELSE PRINT 'FK TiposVehiculo -> Users (ProveedorId): ya existe o falta Users (omitida).';
GO

PRINT '==== Listo. Columnas de TiposVehiculo verificadas/agregadas. ====';
GO

GO

-- #############################################################################
-- ##  PARTE 3 — TABLAS NUEVAS (no tienen migracion de EF)
-- #############################################################################
-- ImageFaults / VehicleImagePoints / ReportImageFaults = feature de componentes
-- en tablet. MetasTecnico / SolicitudesActividadAdicional / SolicitudCambios.
-- #############################################################################
GO
PRINT '';
PRINT '>>> PARTE 3 — TABLAS NUEVAS (no tienen migracion de EF)';
GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/00_ComponentesTablet.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Migración: tablas del feature "selección de componentes del carrito" (tablet).
--
-- Crea las 3 tablas que necesita el modal de "Reportar falla" para que los
-- técnicos seleccionen los componentes numerados sobre la foto del carro:
--
--   ImageFaults          = catálogo de componentes/fallas seleccionables.
--   VehicleImagePoints   = puntos numerados (X/Y en %) posicionados sobre la
--                          foto de cada tipo de vehículo (ImageKey = tipo_<id>).
--   ReportImageFaults    = qué componentes eligió cada reporte de falla (join).
--
-- Estas 3 están declaradas en el DbContext pero NO tienen migración de EF, así
-- que 'dotnet ef database update' NO las crea: hay que aplicarlas con este SQL.
--
-- Base: MantenimientoEquiposDB   ·   Idempotente (puedes correrlo varias veces).
-- ⚠️ Haz respaldo antes. Este script NO toca datos existentes.
--
-- IMPORTANTE (robusto): la tabla ReportImageFaults se crea SIN llaves foráneas
-- y luego cada FK se agrega SOLO si la tabla referida existe y la FK aún no está.
-- Así el script NO truena aunque a tu base le falte 'ReportesFalla'. Si esa
-- tabla aparece después (con su nombre correcto), vuelve a correr este script y
-- se agregará la FK que faltaba. Al final imprime un aviso de lo que quedó.
-- =============================================================================

-- ---------- 1) ImageFaults · catálogo de componentes ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[ImageFaults]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[ImageFaults]
    (
        [Id]          INT            IDENTITY (1, 1) NOT NULL,
        [Name]        NVARCHAR (100) NOT NULL,
        [Description] NVARCHAR (500) NULL,
        [Active]      BIT            NOT NULL,
        [CreatedAt]   DATETIME2 (7)  NOT NULL,
        [UpdatedAt]   DATETIME2 (7)  NULL,
        CONSTRAINT [PK_ImageFaults] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    PRINT 'Tabla ImageFaults creada.';
END
ELSE
BEGIN
    PRINT 'La tabla ImageFaults ya existe.';
END
GO

-- ---------- 2) VehicleImagePoints · puntos numerados sobre la foto ----------
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[VehicleImagePoints]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[VehicleImagePoints]
    (
        [Id]           INT            IDENTITY (1, 1) NOT NULL,
        [ImageKey]     NVARCHAR (100) NOT NULL,
        [XPct]         DECIMAL (5, 2) NOT NULL,
        [YPct]         DECIMAL (5, 2) NOT NULL,
        [RadiusPct]    DECIMAL (5, 2) NULL,
        [ImageFaultId] INT            NOT NULL,
        [Active]       BIT            NOT NULL,
        [CreatedAt]    DATETIME2 (7)  NOT NULL,
        [UpdatedAt]    DATETIME2 (7)  NULL,
        CONSTRAINT [PK_VehicleImagePoints] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_VehicleImagePoints_ImageFaults_ImageFaultId]
            FOREIGN KEY ([ImageFaultId]) REFERENCES [dbo].[ImageFaults] ([Id]) ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX [IX_VehicleImagePoints_ImageFaultId]
        ON [dbo].[VehicleImagePoints] ([ImageFaultId] ASC);

    PRINT 'Tabla VehicleImagePoints creada.';
END
ELSE
BEGIN
    PRINT 'La tabla VehicleImagePoints ya existe.';
END
GO

-- ---------- 3) ReportImageFaults · componentes elegidos por cada reporte ----------
-- 3a) La tabla (sin FKs; las agregamos después de forma segura).
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[ReportImageFaults]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[ReportImageFaults]
    (
        [Id]                  INT           IDENTITY (1, 1) NOT NULL,
        [ReporteFallaId]      INT           NOT NULL,
        [ImageFaultId]        INT           NOT NULL,
        [VehicleImagePointId] INT           NULL,
        [CreatedAt]           DATETIME2 (7) NOT NULL,
        CONSTRAINT [PK_ReportImageFaults] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ReporteFallaId]
        ON [dbo].[ReportImageFaults] ([ReporteFallaId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ImageFaultId]
        ON [dbo].[ReportImageFaults] ([ImageFaultId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_VehicleImagePointId]
        ON [dbo].[ReportImageFaults] ([VehicleImagePointId] ASC);

    PRINT 'Tabla ReportImageFaults creada (sin FKs todavia).';
END
ELSE
BEGIN
    PRINT 'La tabla ReportImageFaults ya existe.';
END
GO

-- 3b) FK -> ImageFaults (esta tabla ya la creamos arriba, siempre existe).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ReportImageFaults_ImageFaults_ImageFaultId')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImageFaults]') AND type = N'U')
BEGIN
    ALTER TABLE [dbo].[ReportImageFaults]
        ADD CONSTRAINT [FK_ReportImageFaults_ImageFaults_ImageFaultId]
        FOREIGN KEY ([ImageFaultId]) REFERENCES [dbo].[ImageFaults] ([Id]) ON DELETE NO ACTION;
    PRINT 'FK ReportImageFaults -> ImageFaults agregada.';
END
ELSE
BEGIN
    PRINT 'FK ReportImageFaults -> ImageFaults: ya existe o falta ImageFaults (omitida).';
END
GO

-- 3c) FK -> VehicleImagePoints (idem, ya existe).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ReportImageFaults_VehicleImagePoints_VehicleImagePointId')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VehicleImagePoints]') AND type = N'U')
BEGIN
    ALTER TABLE [dbo].[ReportImageFaults]
        ADD CONSTRAINT [FK_ReportImageFaults_VehicleImagePoints_VehicleImagePointId]
        FOREIGN KEY ([VehicleImagePointId]) REFERENCES [dbo].[VehicleImagePoints] ([Id]) ON DELETE SET NULL;
    PRINT 'FK ReportImageFaults -> VehicleImagePoints agregada.';
END
ELSE
BEGIN
    PRINT 'FK ReportImageFaults -> VehicleImagePoints: ya existe o falta VehicleImagePoints (omitida).';
END
GO

-- 3d) FK -> ReportesFalla (la que fallaba). Solo se agrega si la tabla existe.
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ReportImageFaults_ReportesFalla_ReporteFallaId')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportesFalla]') AND type = N'U')
BEGIN
    ALTER TABLE [dbo].[ReportImageFaults]
        ADD CONSTRAINT [FK_ReportImageFaults_ReportesFalla_ReporteFallaId]
        FOREIGN KEY ([ReporteFallaId]) REFERENCES [dbo].[ReportesFalla] ([Id]) ON DELETE CASCADE;
    PRINT 'FK ReportImageFaults -> ReportesFalla agregada.';
END
ELSE IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ReportImageFaults_ReportesFalla_ReporteFallaId')
BEGIN
    PRINT 'FK ReportImageFaults -> ReportesFalla: ya existe (omitida).';
END
ELSE
BEGIN
    PRINT '*** AVISO: no se encontro la tabla dbo.ReportesFalla, por lo que la FK';
    PRINT '    ReportImageFaults -> ReportesFalla NO se creo. La tabla ReportImageFaults';
    PRINT '    quedo funcional y el feature de tablet ya sirve; solo falta esa integridad';
    PRINT '    referencial. Verifica el nombre real de tu tabla de reportes con:';
    PRINT '        SELECT name FROM sys.tables WHERE name LIKE ''%eporte%'' OR name LIKE ''%alla%'';';
    PRINT '    y vuelve a correr este script cuando exista dbo.ReportesFalla.';
END
GO

PRINT '==== Listo. Tablas del feature de componentes (tablet) verificadas/creadas. ====';
GO

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/04_MetasTecnico.sql
-- ---------------------------------------------------------------------------
-- ============================================================
-- Tabla: MetasTecnico  (Metas mensuales de mantenimiento por tecnico)
-- Depende de: Users
-- Indice unico por (UsuarioId, Mes, Anio)
-- Idempotente.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MetasTecnico]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[MetasTecnico]
    (
        [Id]                 INT           IDENTITY (1, 1) NOT NULL,
        [UsuarioId]          INT           NOT NULL,
        [Mes]                INT           NOT NULL,
        [Anio]               INT           NOT NULL,
        [MetaMantenimientos] INT           NOT NULL,
        [CreatedAt]          DATETIME2 (7) NOT NULL,
        [CreatedBy]          INT           NULL,
        [UpdatedAt]          DATETIME2 (7) NULL,
        CONSTRAINT [PK_MetasTecnico] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_MetasTecnico_Users_UsuarioId]
            FOREIGN KEY ([UsuarioId]) REFERENCES [dbo].[Users] ([Id])
            ON DELETE CASCADE
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_MetasTecnico_UsuarioId_Mes_Anio]
        ON [dbo].[MetasTecnico] ([UsuarioId] ASC, [Mes] ASC, [Anio] ASC);
    PRINT 'Tabla MetasTecnico creada.';
END
ELSE
    PRINT 'Tabla MetasTecnico ya existe, se omite.';
GO

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/05_SolicitudesActividadAdicional.sql
-- ---------------------------------------------------------------------------
-- ============================================================
-- Tabla: SolicitudesActividadAdicional  (Actividades extra en ordenes de trabajo)
-- Depende de: OrdenesTrabajo, Users
-- Idempotente.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SolicitudesActividadAdicional]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[SolicitudesActividadAdicional]
    (
        [Id]                   INT            IDENTITY (1, 1) NOT NULL,
        [OrdenTrabajoId]       INT            NOT NULL,
        [Descripcion]          NVARCHAR (1000) NOT NULL,
        [Justificacion]        NVARCHAR (1000) NULL,
        [Estado]               NVARCHAR (20)  NOT NULL,
        [SolicitadoPorId]      INT            NOT NULL,
        [FechaSolicitud]       DATETIME2 (7)  NOT NULL,
        [AprobadoPorId]        INT            NULL,
        [FechaRespuesta]       DATETIME2 (7)  NULL,
        [ComentariosResolucion] NVARCHAR (500) NULL,
        [FotoUrl]              NVARCHAR (500) NULL,
        [FechaCompletado]      DATETIME2 (7)  NULL,
        [NotasEjecucion]       NVARCHAR (500) NULL,
        [FotoEjecucionUrl]     NVARCHAR (500) NULL,
        CONSTRAINT [PK_SolicitudesActividadAdicional] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_SolicitudesActividadAdicional_OrdenesTrabajo_OrdenTrabajoId]
            FOREIGN KEY ([OrdenTrabajoId]) REFERENCES [dbo].[OrdenesTrabajo] ([Id])
            ON DELETE CASCADE,
        CONSTRAINT [FK_SolicitudesActividadAdicional_Users_SolicitadoPorId]
            FOREIGN KEY ([SolicitadoPorId]) REFERENCES [dbo].[Users] ([Id])
            ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudesActividadAdicional_Users_AprobadoPorId]
            FOREIGN KEY ([AprobadoPorId]) REFERENCES [dbo].[Users] ([Id])
            ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_OrdenTrabajoId]
        ON [dbo].[SolicitudesActividadAdicional] ([OrdenTrabajoId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_SolicitadoPorId]
        ON [dbo].[SolicitudesActividadAdicional] ([SolicitadoPorId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_AprobadoPorId]
        ON [dbo].[SolicitudesActividadAdicional] ([AprobadoPorId] ASC);
    PRINT 'Tabla SolicitudesActividadAdicional creada.';
END
ELSE
    PRINT 'Tabla SolicitudesActividadAdicional ya existe, se omite.';
GO

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/06_SolicitudCambios.sql
-- ---------------------------------------------------------------------------
-- ============================================================
-- Tabla: SolicitudCambios  (Solicitudes de cambio de vehiculo)
--   OJO: la tabla se llama "SolicitudCambios" (mapeo ToTable en el DbContext),
--   aunque el DbSet sea "SolicitudesCambio".
-- Depende de: Vehiculos, Users
-- Idempotente.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SolicitudCambios]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[SolicitudCambios]
    (
        [Id]                   INT             IDENTITY (1, 1) NOT NULL,
        [VehiculoId]           INT             NOT NULL,
        [Descripcion]          NVARCHAR (1000) NOT NULL,
        [Estado]               INT             NOT NULL,   -- 0 Pendiente, 1 Aprobado, 2 Rechazado
        [SolicitadoPorId]      INT             NOT NULL,
        [FechaSolicitud]       DATETIME2 (7)   NOT NULL,
        [AprobadoPorId]        INT             NULL,
        [FechaRespuesta]       DATETIME2 (7)   NULL,
        [ComentariosRespuesta] NVARCHAR (500)  NULL,
        CONSTRAINT [PK_SolicitudCambios] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_SolicitudCambios_Vehiculos_VehiculoId]
            FOREIGN KEY ([VehiculoId]) REFERENCES [dbo].[Vehiculos] ([Id])
            ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudCambios_Users_SolicitadoPorId]
            FOREIGN KEY ([SolicitadoPorId]) REFERENCES [dbo].[Users] ([Id])
            ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudCambios_Users_AprobadoPorId]
            FOREIGN KEY ([AprobadoPorId]) REFERENCES [dbo].[Users] ([Id])
            ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_VehiculoId]
        ON [dbo].[SolicitudCambios] ([VehiculoId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_SolicitadoPorId]
        ON [dbo].[SolicitudCambios] ([SolicitadoPorId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_AprobadoPorId]
        ON [dbo].[SolicitudCambios] ([AprobadoPorId] ASC);
    PRINT 'Tabla SolicitudCambios creada.';
END
ELSE
    PRINT 'Tabla SolicitudCambios ya existe, se omite.';
GO

GO

-- #############################################################################
-- ##  PARTE 4 — DATOS BASE (catalogo, no es demo)
-- #############################################################################
-- Los 12 carritos con sus componentes numerados y la URL de su foto.
-- Esto es catalogo real de Continental, no datos de prueba.
-- #############################################################################
GO
PRINT '';
PRINT '>>> PARTE 4 — DATOS BASE (catalogo, no es demo)';
GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/10_seed_carro_libro.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- SEED de PRUEBA — 1 carrito: "CARRO LIBRO" (slide 1 de la presentación).
--
-- Carga los 12 componentes numerados del CARRO LIBRO para probar el selector
-- de componentes en tablet. Inserta:
--   · 12 filas en ImageFaults          (el catálogo de componentes)
--   · 12 filas en VehicleImagePoints   (los números 1..12 sobre la foto)
--
-- No necesitas capturar el Id del tipo: el script lo detecta solo (busca un
-- TipoVehiculo cuyo Nombre contenga 'libro'; si no hay, usa el primero).
-- Idempotente: si lo corres de nuevo NO duplica.
--
-- OJO: el número que se muestra (1..12) sale del ORDEN de inserción de los
-- puntos, por eso se insertan en orden 1→12 para que coincida con la presentación.
--
-- La FOTO del carro (ImagenFallasUrl) es opcional: la LISTA numerada de la
-- derecha en el modal ya funciona sin imagen. Si quieres foto, mira el paso 4.
-- =============================================================================
SET NOCOUNT ON;

-- ---------- 1) Componentes + posiciones (X/Y en % sobre la diapositiva) ----------
DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
 ( 1, N'REPARACIÓN DE ESTRUCTURA',                    87.94, 74.94),
 ( 2, N'APLICACIÓN DE SOLDADURA (cambio de postes)',  86.89, 80.00),
 ( 3, N'REPARACIÓN DE BASTIDORES',                    74.67, 14.20),
 ( 4, N'REPARACIÓN DE LÁMINAS DE ALUMINIO, RELLENAR', 88.91, 16.53),
 ( 5, N'REPARACIÓN DE NIVELES, AJUSTAR LEVANTE',      33.87, 63.77),
 ( 6, N'REPARAR GANCHOS TENSORES Y RESORTES',         31.48, 69.44),
 ( 7, N'LIMPIEZA DE LÁMINAS',                         26.03, 56.48),
 ( 8, N'REPARAR O CAMBIAR RUEDAS',                    68.53, 45.77),
 ( 9, N'PINTURA DE CARRO',                            71.04, 64.32),
 (10, N'COLOCAR PORTA ETIQUETA',                      58.63, 56.30),
 (11, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 30.19, 89.74),
 (12, N'LIMPIEZA DE CARROS',                          80.64, 63.83);

-- ---------- 2) Alta de componentes en ImageFaults (solo los que falten) ----------
INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
SELECT c.Nombre, NULL, 1, SYSUTCDATETIME()
FROM @comp c
WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);
PRINT 'ImageFaults: componentes del CARRO LIBRO verificados/insertados.';

-- ---------- 3) Detectar el TipoVehiculo y armar el ImageKey ----------
DECLARE @TipoId INT;
SELECT TOP 1 @TipoId = Id FROM dbo.TiposVehiculo WHERE Nombre LIKE N'%libro%' ORDER BY Id;
IF @TipoId IS NULL
    SELECT TOP 1 @TipoId = Id FROM dbo.TiposVehiculo ORDER BY Id;

IF @TipoId IS NULL
BEGIN
    PRINT '*** No hay filas en TiposVehiculo. Crea al menos un tipo y vuelve a correr este seed.';
    RETURN;
END

DECLARE @ImageKey NVARCHAR(100) = N'tipo_' + CAST(@TipoId AS NVARCHAR(10));
PRINT 'Usando TipoVehiculo Id=' + CAST(@TipoId AS NVARCHAR(10)) + '  ->  ImageKey=' + @ImageKey;
PRINT '(si querías OTRO tipo, cambia el @TipoId arriba o renombra el tipo para que contenga "libro").';

-- ---------- 3b) Alta de los 12 puntos numerados (en orden 1..12) ----------
-- El ORDER BY c.Num garantiza que los Id se asignen en ese orden, así el
-- número que pinta el front (1..N por Id) coincide con el de la presentación.
INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
SELECT @ImageKey, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
FROM @comp c
JOIN dbo.ImageFaults f ON f.Name = c.Nombre
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.VehicleImagePoints p
    WHERE p.ImageKey = @ImageKey AND p.ImageFaultId = f.Id
)
ORDER BY c.Num;
PRINT 'VehicleImagePoints: puntos numerados del CARRO LIBRO verificados/insertados para ' + @ImageKey + '.';

-- ---------- 4) (OPCIONAL) Foto del carro ----------
-- La lista numerada ya funciona sin imagen. Si quieres que además se vea la foto
-- con los números encima, pon aquí la URL/ruta como sirves tus imágenes y descomenta:
--
--   UPDATE dbo.TiposVehiculo SET ImagenFallasUrl = N'<url-de-tu-foto>' WHERE Id = @TipoId;
--
-- (dime cómo subes las imágenes en la app y te dejo esta línea ya lista.)

-- ---------- Resumen ----------
DECLARE @nPts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @ImageKey);
PRINT '==== Seed CARRO LIBRO listo. Puntos para ' + @ImageKey + ': ' + CAST(@nPts AS NVARCHAR(10)) + ' ====';
GO

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/11_seed_carritos_restantes.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- SEED de los 11 carritos restantes (slides 2..12 de la presentacion).
-- Cada carrito carga sus componentes (ImageFaults) y sus puntos numerados
-- (VehicleImagePoints) en su ImageKey = tipo_<enum TipoVehiculoEnum>:
--
--   CARRO COJIN=6  CARRO COSTADO=7  CARRO BRACKER=8  CARRO DE CAPA=9
--   FLAT STORAGE=14  TAMBO APEX=10  PIN RACK=11  CIRCULO=15  CONTI=12
--   JAULA CUARENTENA=13  CARRO DE POLVOS=4
--
-- El CARRO LIBRO (tipo_5) ya se cargo con 10_seed_carro_libro.sql.
-- Numeracion 1..N por orden de insercion (ORDER BY Num).
-- Idempotente: no duplica ImageFaults (por Name) ni puntos (por ImageKey+Fault).
--
-- OJO posiciones: X/Y salen de los numeros de la presentacion cuando existen.
-- CONTI (tipo_12) no traia numeros en la foto -> se distribuyen en cuadricula;
-- revisalos/ajustalos si vas a usar la foto. La LISTA numerada funciona igual.
-- Base: MantenimientoEquiposDB. Respaldo antes (aunque no toca datos existentes).
-- =============================================================================
SET NOCOUNT ON;
GO

-- ================= CARRO COJIN  ->  tipo_6 (enum 6) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 30.71, 92.59),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 30.94, 87.47),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 22.03, 58.02),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 67.17, 9.07),
     ( 5, N'REPARAR SEGUROS MARIPOSA', 79.98, 90.56),
     ( 6, N'REPARAR FRENOS Y PALANCAS', 88.36, 31.91),
     ( 7, N'REPARAR O REEMPLAZAR COPLES', 64.5, 19.2),
     ( 8, N'CAMBIO DE CHUMACERAS', 65.16, 72.41),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 70.76, 71.85),
     (10, N'REPARACIÓN DE CATARINAS Y GUARDAS', 90.78, 6.3),
     (11, N'REPARAR O CAMBIAR RUEDAS', 53.66, 46.9),
     (12, N'PINTURA DE CARRO', 77.17, 38.52),
     (13, N'PRUEBAS DE CENTRADO', 72.0, 86.04),
     (14, N'COLOCAR PORTA ETIQUETA', 58.46, 15.62),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 21.55, 83.83),
     (16, N'LIMPIEZA DE CARROS', 68.77, 39.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_6';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO COJIN (tipo_6): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO COSTADO  ->  tipo_7 (enum 7) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 29.53, 96.3),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 31.42, 88.58),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 25.57, 61.23),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 68.21, 7.1),
     ( 5, N'REPARAR FRENOS Y PALANCAS', 88.29, 33.52),
     ( 6, N'REPARAR O REEMPLAZAR COPLES', 67.83, 18.21),
     ( 7, N'CAMBIO DE CHUMACERAS', 62.45, 65.25),
     ( 8, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 75.42, 65.8),
     ( 9, N'REPARACIÓN DE CATARINAS Y GUARDAS', 92.59, 6.05),
     (10, N'REPARAR O CAMBIAR RUEDAS', 55.96, 43.82),
     (11, N'PINTURA DE CARRO', 68.77, 39.01),
     (12, N'COLOCAR PORTA ETIQUETA', 26.96, 71.85),
     (13, N'COLOCAR GUARDA PARA LINNER (TIRANTES)', 20.92, 81.48),
     (14, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 74.78, 93.77),
     (15, N'LIMPIEZA DE CARROS', 77.17, 38.52);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_7';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO COSTADO (tipo_7): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO BRACKER  ->  tipo_8 (enum 8) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 30.71, 92.59),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 30.94, 87.47),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 22.03, 58.02),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 67.17, 9.07),
     ( 5, N'REPARAR SEGUROS MARIPOSA', 79.98, 90.56),
     ( 6, N'REPARAR FRENOS Y PALANCAS', 88.36, 31.91),
     ( 7, N'REPARAR O REEMPLAZAR COPLES', 64.5, 19.2),
     ( 8, N'CAMBIO DE CHUMACERAS', 65.16, 72.41),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 70.76, 71.85),
     (10, N'REPARACIÓN DE CATARINAS Y GUARDAS', 90.78, 6.3),
     (11, N'REPARAR O CAMBIAR RUEDAS', 53.66, 46.9),
     (12, N'PINTURA DE CARRO', 77.17, 38.52),
     (13, N'PRUEBAS DE CENTRADO', 72.0, 86.04),
     (14, N'COLOCAR PORTA ETIQUETA', 58.46, 15.62),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 21.55, 83.83),
     (16, N'LIMPIEZA DE CARROS', 68.77, 39.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_8';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO BRACKER (tipo_8): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO DE CAPA  ->  tipo_9 (enum 9) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 69.82, 74.46),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 75.14, 74.1),
     ( 3, N'COLOCAR SOLERA LATERAL', 60.07, 92.85),
     ( 4, N'REPAR RODILLOS PRINCIPALES', 77.21, 8.24),
     ( 5, N'REPARAR FRENOS Y PALANCAS', 62.71, 14.47),
     ( 6, N'REPARAR O REEMPLAZAR COPLES', 76.05, 17.45),
     ( 7, N'CAMBIO DE CHUMACERAS', 83.81, 94.83),
     ( 8, N'REPARAR MARTILLOS', 34.77, 70.37),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 10.22, 68.32),
     (10, N'REPARAR O CAMBIAR RUEDAS', 23.53, 96.39),
     (11, N'PINTURA DE CARRO', 24.2, 85.49),
     (12, N'PRUEBAS DE CENTRADO (DISTANCIAS ENTRE RODILLOS)', 25.61, 53.49),
     (13, N'COLOCAR PORTA ETIQUETA', 57.28, 66.24),
     (14, N'COLOCAR GUARDA PARA LINNER (TIRANTES)', 88.35, 69.0),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 74.96, 96.93),
     (16, N'LIMPIEZA DE CARROS', 28.14, 85.44);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_9';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO DE CAPA (tipo_9): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO FLAT STORAGE  ->  tipo_14 (enum 14) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 69.58, 27.7),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 77.09, 27.97),
     ( 3, N'COLOCAR SOLERA LATERAL', 86.53, 45.31),
     ( 4, N'REPARACIÓN DE BASTIDORES', 17.48, 81.23),
     ( 5, N'REPARACIÓN DE NIVELES, AJUSTAR LEVANTE', 77.37, 76.46),
     ( 6, N'REPARACIÓN DE LAMINAS DE LONA-PVC, CAMBIO DE PIJAS', 35.7, 69.83),
     ( 7, N'REPARAR TENSORES Y RESORTES', 65.24, 75.91),
     ( 8, N'REPARAR O CAMBIAR RUEDAS', 68.77, 47.4),
     ( 9, N'PINTURA DE CARRO', 19.54, 53.65),
     (10, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 72.27, 91.6),
     (11, N'LIMPIEZA DE CARROS', 25.29, 56.72);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_14';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO FLAT STORAGE (tipo_14): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= TAMBO APEX  ->  tipo_10 (enum 10) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 81.14, 29.68),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 81.14, 12.01),
     ( 3, N'REPARAR RESORTE Y BASE', 77.67, 62.27),
     ( 4, N'REPARAR O CAMBIAR RUEDAS', 81.0, 20.0),
     ( 5, N'PINTURA DE CARRO', 59.46, 24.25),
     ( 6, N'LIMPIEZA DE CARROS', 59.98, 40.89);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_10';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'TAMBO APEX (tipo_10): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= PIN RACK  ->  tipo_11 (enum 11) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 78.99, 18.15),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 86.43, 18.29),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 92.51, 48.68),
     ( 4, N'PINTURA DE CARRO', 88.82, 38.13),
     ( 5, N'COLOCAR PORTA ETIQUETA', 92.43, 7.59),
     ( 6, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 54.01, 90.42),
     ( 7, N'LIMPIEZA DE CARROS', 83.15, 37.76);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_11';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'PIN RACK (tipo_11): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CIRCULO  ->  tipo_15 (enum 15) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 73.84, 43.55),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 82.02, 40.36),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 70.52, 68.83),
     ( 4, N'PINTURA DE CARRO', 83.0, 48.35),
     ( 5, N'LIMPIEZA DE CARROS', 76.02, 61.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_15';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CIRCULO (tipo_15): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CONTI  ->  tipo_12 (enum 12) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 15.0, 20.0),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 37.0, 20.0),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 59.0, 20.0),
     ( 4, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 81.0, 20.0),
     ( 5, N'LIMPIEZA DE CARROS', 15.0, 38.0);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_12';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CONTI (tipo_12): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= JAULA CUARENTENA  ->  tipo_13 (enum 13) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 55.31, 11.55),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 62.61, 11.7),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 87.21, 52.04),
     ( 4, N'PINTURA DE CARRO', 78.43, 31.05),
     ( 5, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 25.73, 85.62),
     ( 6, N'LIMPIEZA DE CARROS', 71.15, 27.03);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_13';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'JAULA CUARENTENA (tipo_13): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO DE POLVOS  ->  tipo_4 (enum 4) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 59.79, 32.79),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 69.2, 31.86),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 79.14, 95.78),
     ( 4, N'PINTURA DE CARRO', 72.72, 89.03),
     ( 5, N'LIMPIEZA DE CARROS', 82.55, 89.23);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_4';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO DE POLVOS (tipo_4): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

PRINT '==== Seed de los 11 carritos restantes: listo. ====';
GO

GO

-- ---------------------------------------------------------------------------
-- origen: migraciones/14_imagenes_carritos.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Asigna la FOTO (collage) de cada carrito a su TipoVehiculo -> ImagenFallasUrl.
--
-- Cada imagen es el COLLAGE de la diapositiva (2-3 fotos del carrito juntas) tal
-- como venia en la presentacion. Los puntos numerados que ya cargaste (seeds 10 y
-- 11) tienen coordenadas RELATIVAS A ESA DIAPOSITIVA, por eso caen exactos sobre
-- este collage. Si en su lugar pones una sola foto recortada, los numeros NO
-- cuadran (ese era el "se repite el posicionamiento").
--
-- PASOS (una sola vez):
--   1) git pull  (trae la carpeta migraciones/imagenes_carritos/ con los 12 PNG).
--   2) Copia los 12 archivos  migraciones/imagenes_carritos/tipo_*.png  a:
--         MantenimientoAPI/MantenimientoEquipos/wwwroot/uploads/tiposvehiculo/
--      (si la carpeta no existe, creala; el backend ya la sirve en /uploads).
--   3) Corre este script en MantenimientoEquiposDB.
--   4) Recarga la app. En "Reportar falla" elige el vehiculo del carrito y veras
--      la foto con los numeros encima.
--
-- ImageKey = tipo_<enum>  y  TiposVehiculo.Id == enum, por eso filtro por Id.
-- Idempotente: solo actualiza; puedes correrlo las veces que quieras.
--
-- OJO (2 casos del material original, no del script):
--   * BRACKER (tipo_8) usa la MISMA imagen que COJIN (tipo_6): en el PPTX la
--     diapositiva de BRACKER es copia de la de COJIN. Cuando tengas la foto real
--     de BRACKER, subela en Admin > Fallas por imagen > pestana Hotspots.
--   * CONTI (tipo_12) no traia numeros en la diapositiva: sus puntos se pusieron
--     en cuadricula, asi que no apuntan a partes especificas. Ajustalos en el
--     editor de Hotspots (click en la imagen -> Guardar punto) si vas a usarlos.
-- =============================================================================
SET NOCOUNT ON;

DECLARE @img TABLE (Id INT PRIMARY KEY, Archivo NVARCHAR(200));
INSERT INTO @img (Id, Archivo) VALUES
 ( 4, N'/uploads/tiposvehiculo/tipo_4.png'),   -- CARRO DE POLVOS
 ( 5, N'/uploads/tiposvehiculo/tipo_5.png'),   -- CARRO LIBRO
 ( 6, N'/uploads/tiposvehiculo/tipo_6.png'),   -- CARRO COJIN
 ( 7, N'/uploads/tiposvehiculo/tipo_7.png'),   -- CARRO COSTADO
 ( 8, N'/uploads/tiposvehiculo/tipo_8.png'),   -- CARRO BRACKER (== COJIN por ahora)
 ( 9, N'/uploads/tiposvehiculo/tipo_9.png'),   -- CARRO DE CAPA
 (10, N'/uploads/tiposvehiculo/tipo_10.png'),  -- TAMBO APEX
 (11, N'/uploads/tiposvehiculo/tipo_11.png'),  -- PIN RACK
 (12, N'/uploads/tiposvehiculo/tipo_12.png'),  -- CONTI (numeros en cuadricula)
 (13, N'/uploads/tiposvehiculo/tipo_13.png'),  -- JAULA CUARENTENA
 (14, N'/uploads/tiposvehiculo/tipo_14.png'),  -- FLAT STORAGE
 (15, N'/uploads/tiposvehiculo/tipo_15.png');  -- CIRCULO

UPDATE t
   SET t.ImagenFallasUrl = i.Archivo
FROM dbo.TiposVehiculo t
JOIN @img i ON i.Id = t.Id;

DECLARE @n INT = (SELECT COUNT(*) FROM dbo.TiposVehiculo t JOIN @img i ON i.Id = t.Id);
PRINT 'ImagenFallasUrl asignada a ' + CAST(@n AS NVARCHAR(10)) + ' tipos de vehiculo.';

-- Aviso si algun tipo esperado no existe en tu tabla:
DECLARE @faltan NVARCHAR(MAX) = N'';
SELECT @faltan = @faltan + CAST(i.Id AS NVARCHAR(10)) + N' '
FROM @img i WHERE NOT EXISTS (SELECT 1 FROM dbo.TiposVehiculo t WHERE t.Id = i.Id);
IF LEN(@faltan) > 0
    PRINT '*** AVISO: estos Id de TiposVehiculo NO existen (no se asigno imagen): ' + @faltan;

PRINT '==== Listo. Copia los PNG a wwwroot/uploads/tiposvehiculo/ y recarga la app. ====';
GO

GO

-- #############################################################################
-- ##  VERIFICACION FINAL — todo debe decir OK
-- #############################################################################
GO
PRINT '';
PRINT '>>> VERIFICACION';
GO

SELECT 'Tabla ' + t.n AS Objeto,
       CASE WHEN OBJECT_ID('dbo.' + t.n) IS NULL THEN '*** FALTA ***' ELSE 'OK' END AS Estado
FROM (VALUES ('ImageFaults'), ('VehicleImagePoints'), ('ReportImageFaults'),
             ('MetasTecnico'), ('SolicitudesActividadAdicional'), ('SolicitudCambios')) t(n)
UNION ALL
SELECT 'Columna ' + c.t + '.' + c.n,
       CASE WHEN COL_LENGTH('dbo.' + c.t, c.n) IS NULL THEN '*** FALTA ***' ELSE 'OK' END
FROM (VALUES ('TiposVehiculo','ImagenFallasUrl'), ('TiposVehiculo','ProveedorId'),
             ('OrdenesTrabajo','EstadoAprobacionLider'), ('OrdenesTrabajo','EstadoAprobacionSupervisor'),
             ('OrdenesTrabajoChecklistItems','FotoUrl'), ('OrdenesTrabajoChecklistItems','Cantidad'),
             ('ReportesFallaChecklistItems','Cantidad')) c(t,n)
UNION ALL
SELECT 'Datos: componentes (ImageFaults)',
       CASE WHEN (SELECT COUNT(*) FROM dbo.ImageFaults) = 0 THEN '*** VACIO ***'
            ELSE CONCAT('OK (', (SELECT COUNT(*) FROM dbo.ImageFaults), ' filas)') END
UNION ALL
SELECT 'Datos: puntos (VehicleImagePoints)',
       CASE WHEN (SELECT COUNT(*) FROM dbo.VehicleImagePoints) = 0 THEN '*** VACIO ***'
            ELSE CONCAT('OK (', (SELECT COUNT(*) FROM dbo.VehicleImagePoints), ' filas)') END
UNION ALL
SELECT 'Datos: tipos con foto asignada',
       CASE WHEN (SELECT COUNT(*) FROM dbo.TiposVehiculo WHERE ImagenFallasUrl IS NOT NULL) = 0 THEN '*** VACIO ***'
            ELSE CONCAT('OK (', (SELECT COUNT(*) FROM dbo.TiposVehiculo WHERE ImagenFallasUrl IS NOT NULL), ' tipos)') END;
GO

PRINT '';
PRINT '################################################################';
PRINT '##  LISTO. Si algo dice FALTA, mandame la captura.            ##';
PRINT '##  RECUERDA: copiar los 12 PNG a wwwroot/uploads/tiposvehiculo/ ##';
PRINT '##  y reiniciar la API.                                        ##';
PRINT '################################################################';
GO
