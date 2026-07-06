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
-- El orden respeta las llaves foráneas entre las tablas.
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
        CONSTRAINT [PK_ReportImageFaults] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ReportImageFaults_ReportesFalla_ReporteFallaId]
            FOREIGN KEY ([ReporteFallaId]) REFERENCES [dbo].[ReportesFalla] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ReportImageFaults_ImageFaults_ImageFaultId]
            FOREIGN KEY ([ImageFaultId]) REFERENCES [dbo].[ImageFaults] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ReportImageFaults_VehicleImagePoints_VehicleImagePointId]
            FOREIGN KEY ([VehicleImagePointId]) REFERENCES [dbo].[VehicleImagePoints] ([Id]) ON DELETE SET NULL
    );

    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ReporteFallaId]
        ON [dbo].[ReportImageFaults] ([ReporteFallaId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ImageFaultId]
        ON [dbo].[ReportImageFaults] ([ImageFaultId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_VehicleImagePointId]
        ON [dbo].[ReportImageFaults] ([VehicleImagePointId] ASC);

    PRINT 'Tabla ReportImageFaults creada.';
END
ELSE
BEGIN
    PRINT 'La tabla ReportImageFaults ya existe.';
END
GO

PRINT '==== Listo. Tablas del feature de componentes (tablet) verificadas/creadas. ====';
GO
