-- ============================================================
-- Tabla: VehicleImagePoints  (Puntos numerados X/Y sobre la foto del carro)
-- Depende de: ImageFaults  (correr 01 primero)
-- Idempotente.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VehicleImagePoints]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[VehicleImagePoints]
    (
        [Id]           INT              IDENTITY (1, 1) NOT NULL,
        [ImageKey]     NVARCHAR (100)   NOT NULL,     -- ej: tipo_5
        [XPct]         DECIMAL (5, 2)   NOT NULL,     -- posicion horizontal %
        [YPct]         DECIMAL (5, 2)   NOT NULL,     -- posicion vertical %
        [RadiusPct]    DECIMAL (5, 2)   NULL,         -- radio del punto % (opcional)
        [ImageFaultId] INT              NOT NULL,
        [Active]       BIT              NOT NULL,
        [CreatedAt]    DATETIME2 (7)    NOT NULL,
        [UpdatedAt]    DATETIME2 (7)    NULL,
        CONSTRAINT [PK_VehicleImagePoints] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_VehicleImagePoints_ImageFaults_ImageFaultId]
            FOREIGN KEY ([ImageFaultId]) REFERENCES [dbo].[ImageFaults] ([Id])
            ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX [IX_VehicleImagePoints_ImageFaultId]
        ON [dbo].[VehicleImagePoints] ([ImageFaultId] ASC);
    PRINT 'Tabla VehicleImagePoints creada.';
END
ELSE
    PRINT 'Tabla VehicleImagePoints ya existe, se omite.';
GO
