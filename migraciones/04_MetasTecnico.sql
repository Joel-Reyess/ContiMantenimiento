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
