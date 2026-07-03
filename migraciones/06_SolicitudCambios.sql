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
