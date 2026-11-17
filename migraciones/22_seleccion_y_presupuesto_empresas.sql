-- =============================================================================
-- Selección automática de empresa proveedora y presupuesto de empresas
-- (Reporte 6, 13-nov-2026: OT-28 a OT-34, PRS-01 a PRS-03, DSH-03)
--
-- Agrega:
--   * OrdenesTrabajo.EmpresaId:                empresa proveedora que atiende la orden (etapa SELECCIÓN).
--   * OrdenesTrabajo.FechaSeleccion:           cuándo quedó asignada la empresa.
--   * OrdenesTrabajo.FechaSinProveedor:        desde cuándo espera porque ninguna empresa es elegible.
--   * OrdenesTrabajo.FechaAceptacionBloqueada: primer intento de aceptar con la empresa a su capacidad máxima.
--   * MovimientosPresupuesto:                  libro del presupuesto de cada empresa (asignaciones, ajustes,
--                                              descuentos por orden de pago y reversiones por eliminación).
--
-- Acomoda lo que ya existe UNA sola vez, al crear la columna EmpresaId:
--   * Las órdenes que ya tienen orden de pago quedan con la empresa de su orden de pago.
--   * Las demás órdenes con técnico quedan con la empresa de su técnico (si tiene).
--   * Las órdenes que ya están en la Zona de Transición SIN técnico se asignan solas en cuanto haya una empresa
--     elegible (al asignar presupuesto o con "Reintentar asignación" en Presupuesto de Empresas).
--
-- IMPORTANTE después de correrlo: las empresas empiezan SIN presupuesto. Mientras ninguna tenga saldo, las órdenes
-- nuevas se quedan en SELECCIÓN "Sin disponibilidad". Asigna el presupuesto de cada empresa en
-- Presupuesto de Empresas (Administrador o Gerente de Mantenimiento).
-- Las órdenes de pago generadas ANTES de este script no descuentan presupuesto.
--
-- Va DESPUÉS de 21_fallas_visuales_actividades.sql y ANTES de publicar la API nueva.
-- Idempotente: se puede correr varias veces sin duplicar nada. Haz un respaldo de la base antes de correrlo.
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ----- OrdenesTrabajo: empresa y fechas de la selección -------------------------
IF COL_LENGTH('dbo.OrdenesTrabajo', 'EmpresaId') IS NULL
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dbo.OrdenesTrabajo ADD EmpresaId int NULL
        CONSTRAINT FK_OrdenesTrabajo_Empresas_EmpresaId REFERENCES dbo.Empresas (Id);
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaSeleccion datetime2 NULL;
    CREATE INDEX IX_OrdenesTrabajo_EmpresaId ON dbo.OrdenesTrabajo (EmpresaId);

    EXEC('
        -- 1) La empresa con la que se generó su orden de pago
        UPDATE o SET EmpresaId = p.EmpresaId
        FROM dbo.OrdenesTrabajo o
        JOIN dbo.RegistrosPago p ON p.OrdenTrabajoId = o.Id
        WHERE o.EmpresaId IS NULL AND p.EmpresaId IS NOT NULL;

        -- 2) La empresa de su técnico
        UPDATE o SET EmpresaId = u.EmpresaId
        FROM dbo.OrdenesTrabajo o
        JOIN dbo.Users u ON u.Id = o.TecnicoAsignadoId
        WHERE o.EmpresaId IS NULL AND u.EmpresaId IS NOT NULL;

        UPDATE dbo.OrdenesTrabajo
        SET FechaSeleccion = COALESCE(FechaAsignacion, FechaAceptacion, FechaTrasladoIngreso, FechaCreacion)
        WHERE EmpresaId IS NOT NULL AND FechaSeleccion IS NULL;

        DECLARE @n int = (SELECT COUNT(*) FROM dbo.OrdenesTrabajo WHERE EmpresaId IS NOT NULL);
        PRINT CONCAT(''OrdenesTrabajo.EmpresaId agregada: '', @n, '' orden(es) quedaron con la empresa de su pago o de su técnico.'');
    ');
    COMMIT TRANSACTION;
END
GO

IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaSeleccion') IS NULL
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaSeleccion datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaSinProveedor') IS NULL
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaSinProveedor datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaAceptacionBloqueada') IS NULL
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaAceptacionBloqueada datetime2 NULL;
GO

-- ----- MovimientosPresupuesto -------------------------------------------------
IF OBJECT_ID('dbo.MovimientosPresupuesto') IS NULL
BEGIN
    CREATE TABLE dbo.MovimientosPresupuesto (
        Id               int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MovimientosPresupuesto PRIMARY KEY,
        EmpresaId        int NOT NULL CONSTRAINT FK_MovimientosPresupuesto_Empresas_EmpresaId REFERENCES dbo.Empresas (Id),
        -- Asignacion, Ajuste, Descuento, Reversion
        Tipo             nvarchar(20)  NOT NULL,
        Monto            decimal(14,2) NOT NULL,
        SaldoResultante  decimal(14,2) NOT NULL,
        -- Sin llaves foráneas: el movimiento se conserva aunque se eliminen la orden o el pago
        RegistroPagoId   int NULL,
        FolioPago        nvarchar(20)  NULL,
        OrdenTrabajoId   int NULL,
        FolioOrden       nvarchar(20)  NULL,
        VehiculoId       int NULL,
        VehiculoCodigo   nvarchar(50)  NULL,
        Motivo           nvarchar(500) NULL,
        UsuarioId        int NULL,
        NombreUsuario    nvarchar(150) NULL,
        Fecha            datetime2     NOT NULL CONSTRAINT DF_MovimientosPresupuesto_Fecha DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_MovimientosPresupuesto_EmpresaId_Fecha ON dbo.MovimientosPresupuesto (EmpresaId, Fecha);
    CREATE INDEX IX_MovimientosPresupuesto_RegistroPagoId ON dbo.MovimientosPresupuesto (RegistroPagoId);
    PRINT 'MovimientosPresupuesto creada. Asigna el presupuesto de cada empresa en Presupuesto de Empresas.';
END
GO

-- ----- Resumen ------------------------------------------------------------------
DECLARE @sinEmpresa int = (
    SELECT COUNT(*) FROM dbo.OrdenesTrabajo
    WHERE EmpresaId IS NULL AND FechaTrasladoIngreso IS NOT NULL AND FechaAceptacion IS NULL AND Estado IN (1, 2));
IF @sinEmpresa > 0
    PRINT CONCAT(@sinEmpresa, ' orden(es) en la Zona de Transición esperan empresa: se asignan al dar presupuesto o con "Reintentar asignación".');
GO
