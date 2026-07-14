-- =============================================================================
-- Tablas HUERFANAS: existen en el codigo pero NADIE las crea.
--
-- Ni las migraciones de EF ni los demas scripts de migraciones/ crean estas 3.
-- Las migraciones de EF solo les AGREGAN COLUMNAS (AddColumn), dando por hecho
-- que la tabla ya existe. En la base local existen porque venian en un respaldo
-- viejo, pero en una base LIMPIA (o en produccion) pueden no estar, y entonces
-- la app truena con:
--     SqlException 208: Invalid object name 'OrdenesTrabajoChecklistItems'.
--
-- Definiciones tomadas de los modelos:
--   Models/OrdenTrabajoChecklistItem.cs
--   Models/ReporteFallaChecklistItem.cs
--   Models/VehiculoPrefijoConfig.cs
-- y de la config de EF en Models/MantenimientoDbContext.cs (lineas 329-365).
--
-- Idempotente: cada tabla/FK/indice se crea SOLO si no existe.
-- Corre ANTES de 07 y 08 (esos le agregan columnas a estas mismas tablas).
-- =============================================================================
SET NOCOUNT ON;

-- ---------------------------------------------------------------------------
-- OrdenesTrabajoChecklistItems — items del checklist de una ORDEN DE TRABAJO
-- ---------------------------------------------------------------------------
IF OBJECT_ID('dbo.OrdenesTrabajoChecklistItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrdenesTrabajoChecklistItems (
        Id              int IDENTITY(1,1) NOT NULL,
        OrdenTrabajoId  int NOT NULL,
        ChecklistItemId int NOT NULL,
        FechaAsignacion datetime2 NOT NULL CONSTRAINT DF_OTCI_FechaAsignacion DEFAULT SYSUTCDATETIME(),
        FechaCompletado datetime2 NULL,
        Estado          nvarchar(20) NOT NULL CONSTRAINT DF_OTCI_Estado DEFAULT 'Pendiente',
        Cantidad        decimal(18,2) NULL,
        Notas           nvarchar(500) NULL,
        FotoUrl         nvarchar(500) NULL,
        CONSTRAINT PK_OrdenesTrabajoChecklistItems PRIMARY KEY (Id)
    );
    PRINT 'Tabla OrdenesTrabajoChecklistItems CREADA.';
END
ELSE PRINT 'Tabla OrdenesTrabajoChecklistItems ya existia.';
GO

-- FK a OrdenesTrabajo (Cascade: si borras la orden, se van sus items)
IF OBJECT_ID('dbo.OrdenesTrabajoChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.OrdenesTrabajo','U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_OTCI_OrdenesTrabajo','F') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems
        ADD CONSTRAINT FK_OTCI_OrdenesTrabajo
        FOREIGN KEY (OrdenTrabajoId) REFERENCES dbo.OrdenesTrabajo(Id) ON DELETE CASCADE;
    PRINT 'FK_OTCI_OrdenesTrabajo agregada.';
END
GO

-- FK a ChecklistItems (Restrict: no dejes borrar un item usado por una orden)
IF OBJECT_ID('dbo.OrdenesTrabajoChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.ChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_OTCI_ChecklistItems','F') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems
        ADD CONSTRAINT FK_OTCI_ChecklistItems
        FOREIGN KEY (ChecklistItemId) REFERENCES dbo.ChecklistItems(Id) ON DELETE NO ACTION;
    PRINT 'FK_OTCI_ChecklistItems agregada.';
END
GO

IF OBJECT_ID('dbo.OrdenesTrabajoChecklistItems','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OTCI_OrdenTrabajoId'
                   AND object_id = OBJECT_ID('dbo.OrdenesTrabajoChecklistItems'))
BEGIN
    CREATE INDEX IX_OTCI_OrdenTrabajoId ON dbo.OrdenesTrabajoChecklistItems(OrdenTrabajoId);
    PRINT 'IX_OTCI_OrdenTrabajoId creado.';
END
GO

IF OBJECT_ID('dbo.OrdenesTrabajoChecklistItems','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OTCI_ChecklistItemId'
                   AND object_id = OBJECT_ID('dbo.OrdenesTrabajoChecklistItems'))
BEGIN
    CREATE INDEX IX_OTCI_ChecklistItemId ON dbo.OrdenesTrabajoChecklistItems(ChecklistItemId);
    PRINT 'IX_OTCI_ChecklistItemId creado.';
END
GO

-- ---------------------------------------------------------------------------
-- ReportesFallaChecklistItems — items del checklist de un REPORTE DE FALLA
-- ---------------------------------------------------------------------------
IF OBJECT_ID('dbo.ReportesFallaChecklistItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReportesFallaChecklistItems (
        Id              int IDENTITY(1,1) NOT NULL,
        ReporteFallaId  int NOT NULL,
        ChecklistItemId int NOT NULL,
        FechaAsignacion datetime2 NOT NULL CONSTRAINT DF_RFCI_FechaAsignacion DEFAULT SYSUTCDATETIME(),
        Estado          nvarchar(20) NOT NULL CONSTRAINT DF_RFCI_Estado DEFAULT 'Pendiente',
        Cantidad        decimal(18,2) NULL,
        Notas           nvarchar(500) NULL,
        CONSTRAINT PK_ReportesFallaChecklistItems PRIMARY KEY (Id)
    );
    PRINT 'Tabla ReportesFallaChecklistItems CREADA.';
END
ELSE PRINT 'Tabla ReportesFallaChecklistItems ya existia.';
GO

IF OBJECT_ID('dbo.ReportesFallaChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.ReportesFalla','U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_RFCI_ReportesFalla','F') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems
        ADD CONSTRAINT FK_RFCI_ReportesFalla
        FOREIGN KEY (ReporteFallaId) REFERENCES dbo.ReportesFalla(Id) ON DELETE CASCADE;
    PRINT 'FK_RFCI_ReportesFalla agregada.';
END
GO

IF OBJECT_ID('dbo.ReportesFallaChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.ChecklistItems','U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_RFCI_ChecklistItems','F') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFallaChecklistItems
        ADD CONSTRAINT FK_RFCI_ChecklistItems
        FOREIGN KEY (ChecklistItemId) REFERENCES dbo.ChecklistItems(Id) ON DELETE NO ACTION;
    PRINT 'FK_RFCI_ChecklistItems agregada.';
END
GO

IF OBJECT_ID('dbo.ReportesFallaChecklistItems','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RFCI_ReporteFallaId'
                   AND object_id = OBJECT_ID('dbo.ReportesFallaChecklistItems'))
BEGIN
    CREATE INDEX IX_RFCI_ReporteFallaId ON dbo.ReportesFallaChecklistItems(ReporteFallaId);
    PRINT 'IX_RFCI_ReporteFallaId creado.';
END
GO

IF OBJECT_ID('dbo.ReportesFallaChecklistItems','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RFCI_ChecklistItemId'
                   AND object_id = OBJECT_ID('dbo.ReportesFallaChecklistItems'))
BEGIN
    CREATE INDEX IX_RFCI_ChecklistItemId ON dbo.ReportesFallaChecklistItems(ChecklistItemId);
    PRINT 'IX_RFCI_ChecklistItemId creado.';
END
GO

-- ---------------------------------------------------------------------------
-- VehiculoPrefijoConfigs — prefijo de codigo -> tipo de vehiculo
-- (autoseleccion del checklist segun el prefijo del codigo del carrito)
-- ---------------------------------------------------------------------------
IF OBJECT_ID('dbo.VehiculoPrefijoConfigs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VehiculoPrefijoConfigs (
        Id             int IDENTITY(1,1) NOT NULL,
        PrefijoCodigo  nvarchar(20) NOT NULL,
        TipoVehiculoId int NOT NULL,
        Descripcion    nvarchar(100) NULL,
        Activo         bit NOT NULL CONSTRAINT DF_VPC_Activo DEFAULT 1,
        CreatedAt      datetime2 NOT NULL CONSTRAINT DF_VPC_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy      int NULL,
        UpdatedAt      datetime2 NULL,
        UpdatedBy      int NULL,
        CONSTRAINT PK_VehiculoPrefijoConfigs PRIMARY KEY (Id)
    );
    PRINT 'Tabla VehiculoPrefijoConfigs CREADA.';
END
ELSE PRINT 'Tabla VehiculoPrefijoConfigs ya existia.';
GO

IF OBJECT_ID('dbo.VehiculoPrefijoConfigs','U') IS NOT NULL
   AND OBJECT_ID('dbo.TiposVehiculo','U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_VPC_TiposVehiculo','F') IS NULL
BEGIN
    ALTER TABLE dbo.VehiculoPrefijoConfigs
        ADD CONSTRAINT FK_VPC_TiposVehiculo
        FOREIGN KEY (TipoVehiculoId) REFERENCES dbo.TiposVehiculo(Id) ON DELETE NO ACTION;
    PRINT 'FK_VPC_TiposVehiculo agregada.';
END
GO

IF OBJECT_ID('dbo.VehiculoPrefijoConfigs','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VPC_TipoVehiculoId'
                   AND object_id = OBJECT_ID('dbo.VehiculoPrefijoConfigs'))
BEGIN
    CREATE INDEX IX_VPC_TipoVehiculoId ON dbo.VehiculoPrefijoConfigs(TipoVehiculoId);
    PRINT 'IX_VPC_TipoVehiculoId creado.';
END
GO

PRINT '==== Tablas huerfanas listas. ====';
GO
