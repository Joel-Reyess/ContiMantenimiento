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
