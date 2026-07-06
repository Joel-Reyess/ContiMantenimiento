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
