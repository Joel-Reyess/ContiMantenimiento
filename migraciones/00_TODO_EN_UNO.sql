-- ================================================================
--  TODO EN UNO — Tablas faltantes SIN migracion (Grupo B)
--  Base: MantenimientoEquiposDB
--  Copia TODO y ejecuta (F5) en SQL Server Management Studio.
--  Idempotente: puedes correrlo varias veces sin problema.
--  Orden respeta las llaves foraneas entre tablas.
--
--  ⚠️ Haz respaldo antes.  Este script NO toca datos existentes.
--  (Para LiderTipoVehiculoAsignaciones y OrdenesCompra usa:
--     dotnet ef database update   — ver README.md)
-- ================================================================

-- ---------- 1) ImageFaults ----------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImageFaults]') AND type = N'U')
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
    PRINT 'ImageFaults creada.';
END ELSE PRINT 'ImageFaults ya existe.';
GO

-- ---------- 2) VehicleImagePoints ----------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VehicleImagePoints]') AND type = N'U')
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
    PRINT 'VehicleImagePoints creada.';
END ELSE PRINT 'VehicleImagePoints ya existe.';
GO

-- ---------- 3) ReportImageFaults ----------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportImageFaults]') AND type = N'U')
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
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ReporteFallaId]      ON [dbo].[ReportImageFaults] ([ReporteFallaId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_ImageFaultId]        ON [dbo].[ReportImageFaults] ([ImageFaultId] ASC);
    CREATE NONCLUSTERED INDEX [IX_ReportImageFaults_VehicleImagePointId] ON [dbo].[ReportImageFaults] ([VehicleImagePointId] ASC);
    PRINT 'ReportImageFaults creada.';
END ELSE PRINT 'ReportImageFaults ya existe.';
GO

-- ---------- 4) MetasTecnico ----------
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
            FOREIGN KEY ([UsuarioId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_MetasTecnico_UsuarioId_Mes_Anio]
        ON [dbo].[MetasTecnico] ([UsuarioId] ASC, [Mes] ASC, [Anio] ASC);
    PRINT 'MetasTecnico creada.';
END ELSE PRINT 'MetasTecnico ya existe.';
GO

-- ---------- 5) SolicitudesActividadAdicional ----------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SolicitudesActividadAdicional]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[SolicitudesActividadAdicional]
    (
        [Id]                    INT             IDENTITY (1, 1) NOT NULL,
        [OrdenTrabajoId]        INT             NOT NULL,
        [Descripcion]           NVARCHAR (1000) NOT NULL,
        [Justificacion]         NVARCHAR (1000) NULL,
        [Estado]                NVARCHAR (20)   NOT NULL,
        [SolicitadoPorId]       INT             NOT NULL,
        [FechaSolicitud]        DATETIME2 (7)   NOT NULL,
        [AprobadoPorId]         INT             NULL,
        [FechaRespuesta]        DATETIME2 (7)   NULL,
        [ComentariosResolucion] NVARCHAR (500)  NULL,
        [FotoUrl]               NVARCHAR (500)  NULL,
        [FechaCompletado]       DATETIME2 (7)   NULL,
        [NotasEjecucion]        NVARCHAR (500)  NULL,
        [FotoEjecucionUrl]      NVARCHAR (500)  NULL,
        CONSTRAINT [PK_SolicitudesActividadAdicional] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_SolicitudesActividadAdicional_OrdenesTrabajo_OrdenTrabajoId]
            FOREIGN KEY ([OrdenTrabajoId]) REFERENCES [dbo].[OrdenesTrabajo] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_SolicitudesActividadAdicional_Users_SolicitadoPorId]
            FOREIGN KEY ([SolicitadoPorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudesActividadAdicional_Users_AprobadoPorId]
            FOREIGN KEY ([AprobadoPorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_OrdenTrabajoId]  ON [dbo].[SolicitudesActividadAdicional] ([OrdenTrabajoId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_SolicitadoPorId] ON [dbo].[SolicitudesActividadAdicional] ([SolicitadoPorId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudesActividadAdicional_AprobadoPorId]   ON [dbo].[SolicitudesActividadAdicional] ([AprobadoPorId] ASC);
    PRINT 'SolicitudesActividadAdicional creada.';
END ELSE PRINT 'SolicitudesActividadAdicional ya existe.';
GO

-- ---------- 6) SolicitudCambios ----------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SolicitudCambios]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[SolicitudCambios]
    (
        [Id]                   INT             IDENTITY (1, 1) NOT NULL,
        [VehiculoId]           INT             NOT NULL,
        [Descripcion]          NVARCHAR (1000) NOT NULL,
        [Estado]               INT             NOT NULL,
        [SolicitadoPorId]      INT             NOT NULL,
        [FechaSolicitud]       DATETIME2 (7)   NOT NULL,
        [AprobadoPorId]        INT             NULL,
        [FechaRespuesta]       DATETIME2 (7)   NULL,
        [ComentariosRespuesta] NVARCHAR (500)  NULL,
        CONSTRAINT [PK_SolicitudCambios] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_SolicitudCambios_Vehiculos_VehiculoId]
            FOREIGN KEY ([VehiculoId]) REFERENCES [dbo].[Vehiculos] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudCambios_Users_SolicitadoPorId]
            FOREIGN KEY ([SolicitadoPorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SolicitudCambios_Users_AprobadoPorId]
            FOREIGN KEY ([AprobadoPorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_VehiculoId]      ON [dbo].[SolicitudCambios] ([VehiculoId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_SolicitadoPorId] ON [dbo].[SolicitudCambios] ([SolicitadoPorId] ASC);
    CREATE NONCLUSTERED INDEX [IX_SolicitudCambios_AprobadoPorId]   ON [dbo].[SolicitudCambios] ([AprobadoPorId] ASC);
    PRINT 'SolicitudCambios creada.';
END ELSE PRINT 'SolicitudCambios ya existe.';
GO

PRINT '==== Listo. Tablas del Grupo B verificadas/creadas. ====';
GO
