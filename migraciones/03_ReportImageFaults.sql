-- ============================================================
-- Tabla: ReportImageFaults  (Componentes/fallas que eligio cada reporte)
-- Depende de: ReportesFalla, ImageFaults, VehicleImagePoints (correr 01 y 02 primero)
-- Idempotente.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportImageFaults]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[ReportImageFaults]
    (
        [Id]                   INT           IDENTITY (1, 1) NOT NULL,
        [ReporteFallaId]       INT           NOT NULL,
        [ImageFaultId]         INT           NOT NULL,
        [VehicleImagePointId]  INT           NULL,
        [CreatedAt]            DATETIME2 (7) NOT NULL,
        CONSTRAINT [PK_ReportImageFaults] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ReportImageFaults_ReportesFalla_ReporteFallaId]
            FOREIGN KEY ([ReporteFallaId]) REFERENCES [dbo].[ReportesFalla] ([Id])
            ON DELETE CASCADE,
        CONSTRAINT [FK_ReportImageFaults_ImageFaults_ImageFaultId]
            FOREIGN KEY ([ImageFaultId]) REFERENCES [dbo].[ImageFaults] ([Id])
            ON DELETE NO ACTION,
        CONSTRAINT [FK_ReportImageFaults_VehicleImagePoints_VehicleImagePointId]
            FOREIGN KEY ([VehicleImagePointId]) REFERENCES [dbo].[VehicleImagePoints] ([Id])
            ON DELETE SET NULL
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
    PRINT 'Tabla ReportImageFaults ya existe, se omite.';
GO
