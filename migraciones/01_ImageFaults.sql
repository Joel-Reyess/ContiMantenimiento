-- ============================================================
-- Tabla: ImageFaults  (Catalogo de componentes/fallas seleccionables)
-- Base:  MantenimientoEquiposDB
-- Idempotente: solo crea si no existe.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImageFaults]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[ImageFaults]
    (
        [Id]          INT              IDENTITY (1, 1) NOT NULL,
        [Name]        NVARCHAR (100)   NOT NULL,
        [Description] NVARCHAR (500)   NULL,
        [Active]      BIT              NOT NULL,
        [CreatedAt]   DATETIME2 (7)    NOT NULL,
        [UpdatedAt]   DATETIME2 (7)    NULL,
        CONSTRAINT [PK_ImageFaults] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Tabla ImageFaults creada.';
END
ELSE
    PRINT 'Tabla ImageFaults ya existe, se omite.';
GO
