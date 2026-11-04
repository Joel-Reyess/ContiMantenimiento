-- =============================================================================
-- Inventario en la orden de trabajo y orden de pago automática (PDF 29-oct-2026, 5.1 y 6.1)
--
-- Agrega:
--   * MaterialesOrdenTrabajo: refacciones y consumibles que el técnico usó en cada orden. Se descuentan
--     del inventario al terminar la reparación y pasan a la orden de pago.
--   * OrdenesTrabajo.AplicaGarantia: mantenimiento a menos de 6 meses (las refacciones no tienen costo).
--
-- Va DESPUÉS de 16_flujo_7_etapas.sql. Idempotente: se puede correr varias veces.
-- Haz un respaldo de la base antes de correrlo.
-- =============================================================================
SET NOCOUNT ON;

IF OBJECT_ID('dbo.MaterialesOrdenTrabajo') IS NULL
BEGIN
    CREATE TABLE dbo.MaterialesOrdenTrabajo (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MaterialesOrdenTrabajo PRIMARY KEY,
        OrdenTrabajoId  int NOT NULL CONSTRAINT FK_MaterialesOrdenTrabajo_OrdenesTrabajo_OrdenTrabajoId REFERENCES dbo.OrdenesTrabajo (Id),
        ConsumibleId    int NOT NULL CONSTRAINT FK_MaterialesOrdenTrabajo_Consumibles_ConsumibleId REFERENCES dbo.Consumibles (Id),
        Cantidad        decimal(12,2) NOT NULL,
        CostoUnitario   decimal(12,2) NOT NULL,
        RegistradoPorId int NULL,
        FechaRegistro   datetime2 NOT NULL,
        Descontado      bit NOT NULL,
        FechaDescuento  datetime2 NULL
    );
    CREATE INDEX IX_MaterialesOrdenTrabajo_OrdenTrabajoId ON dbo.MaterialesOrdenTrabajo (OrdenTrabajoId);
    CREATE INDEX IX_MaterialesOrdenTrabajo_ConsumibleId ON dbo.MaterialesOrdenTrabajo (ConsumibleId);
    PRINT 'MaterialesOrdenTrabajo creada.';
END
GO

IF COL_LENGTH('dbo.OrdenesTrabajo', 'AplicaGarantia') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD AplicaGarantia bit NOT NULL CONSTRAINT DF_OrdenesTrabajo_AplicaGarantia DEFAULT 0;
    PRINT 'OrdenesTrabajo.AplicaGarantia agregada.';
END
GO

PRINT 'Materiales y órdenes de pago listos.';
