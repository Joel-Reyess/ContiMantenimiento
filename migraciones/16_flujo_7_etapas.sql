-- =============================================================================
-- Flujo de 7 etapas y capacidad de la Zona de Transición (PDF 23-oct-2026)
--
--   REPORTE › INSPECCIÓN › TRASLADO › TALLER › TRASLADO › VALIDACIÓN › DISPONIBLE
--
-- Agrega:
--   * ReportesFalla:   estado de la inspección del Líder (validado / rechazado),
--                      quién y cuándo, observaciones y quién lo reenvió.
--   * OrdenesTrabajo:  confirmación de los dos traslados a Zona de Transición y la
--                      aceptación del técnico.
--   * OrdenesTrabajoChecklistItems.ReportadoPorTaller: hallazgos del técnico.
--   * HistorialFlujo:  trazabilidad (rechazos con sus motivos, ediciones, traslados).
--   * ConfiguracionSistema: capacidad de cada zona (15 y 15; se puede cambiar).
--
-- Los datos que ya existen se acomodan UNA sola vez, al crear cada columna:
--   * Reportes que ya tienen orden          -> inspección validada.
--   * Reportes sin orden (pendientes)        -> pendientes de inspección del Líder.
--   * Órdenes existentes                     -> el primer traslado se da por hecho.
--   * Órdenes asignadas / en proceso / más   -> aceptadas por el técnico.
--   * Órdenes completadas / validadas        -> ya entregadas en zona de reparados.
--
-- Idempotente: se puede correr varias veces sin duplicar ni cambiar lo ya migrado.
-- Haz un respaldo de la base antes de correrlo.
--
-- Antes de migrar conviene ver cuántas órdenes quedarán en cada zona (capacidad 15 y 15):
--   SELECT Estado, TipoMantenimiento, COUNT(*) FROM dbo.OrdenesTrabajo GROUP BY Estado, TipoMantenimiento;
--   (1 Pendiente/2 Asignada = zona de dañados; 5 Completada = zona de reparados, pendientes de validar)
-- Si alguna zona queda arriba de su capacidad, valida o cancela esas órdenes antes de recibir unidades nuevas.
-- =============================================================================
SET NOCOUNT ON;

-- ----- ReportesFalla ---------------------------------------------------------
IF COL_LENGTH('dbo.ReportesFalla', 'EstadoInspeccion') IS NULL
BEGIN
    ALTER TABLE dbo.ReportesFalla ADD EstadoInspeccion int NOT NULL CONSTRAINT DF_ReportesFalla_EstadoInspeccion DEFAULT 0;
    EXEC('UPDATE r SET EstadoInspeccion = 1
          FROM dbo.ReportesFalla r
          WHERE r.TieneOrdenTrabajo = 1 OR EXISTS (SELECT 1 FROM dbo.OrdenesTrabajo o WHERE o.ReporteFallaId = r.Id)');
    PRINT 'ReportesFalla.EstadoInspeccion agregada (reportes con orden = validados).';
END
IF COL_LENGTH('dbo.ReportesFalla', 'InspeccionadoPorId') IS NULL
    ALTER TABLE dbo.ReportesFalla ADD InspeccionadoPorId int NULL
        CONSTRAINT FK_ReportesFalla_Users_InspeccionadoPorId REFERENCES dbo.Users (Id);
IF COL_LENGTH('dbo.ReportesFalla', 'FechaInspeccion') IS NULL
    ALTER TABLE dbo.ReportesFalla ADD FechaInspeccion datetime2 NULL;
IF COL_LENGTH('dbo.ReportesFalla', 'ObservacionesInspeccion') IS NULL
    ALTER TABLE dbo.ReportesFalla ADD ObservacionesInspeccion nvarchar(1000) NULL;
IF COL_LENGTH('dbo.ReportesFalla', 'ReenviadoPorId') IS NULL
    ALTER TABLE dbo.ReportesFalla ADD ReenviadoPorId int NULL
        CONSTRAINT FK_ReportesFalla_Users_ReenviadoPorId REFERENCES dbo.Users (Id);
IF COL_LENGTH('dbo.ReportesFalla', 'FechaReenvio') IS NULL
    ALTER TABLE dbo.ReportesFalla ADD FechaReenvio datetime2 NULL;
GO

-- ----- OrdenesTrabajo --------------------------------------------------------
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaTrasladoIngreso') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaTrasladoIngreso datetime2 NULL;
    EXEC('UPDATE dbo.OrdenesTrabajo SET FechaTrasladoIngreso = FechaCreacion');
    PRINT 'OrdenesTrabajo.FechaTrasladoIngreso agregada (órdenes existentes: traslado hecho).';
END
IF COL_LENGTH('dbo.OrdenesTrabajo', 'TrasladoIngresoPorId') IS NULL
    ALTER TABLE dbo.OrdenesTrabajo ADD TrasladoIngresoPorId int NULL
        CONSTRAINT FK_OrdenesTrabajo_Users_TrasladoIngresoPorId REFERENCES dbo.Users (Id);
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaAceptacion') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaAceptacion datetime2 NULL;
    -- 2 Asignada, 3 EnProceso, 4 EsperandoRefacciones, 5 Completada, 7 Validada, 8 Entregado
    EXEC('UPDATE dbo.OrdenesTrabajo SET FechaAceptacion = COALESCE(FechaInicio, FechaAsignacion, FechaCreacion)
          WHERE Estado IN (2, 3, 4, 5, 7, 8)');
    PRINT 'OrdenesTrabajo.FechaAceptacion agregada (asignadas o más: aceptadas).';
END
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaTrasladoRetorno') IS NULL
BEGIN
    ALTER TABLE dbo.OrdenesTrabajo ADD FechaTrasladoRetorno datetime2 NULL;
    EXEC('UPDATE dbo.OrdenesTrabajo SET FechaTrasladoRetorno = COALESCE(FechaFinalizacion, UpdatedAt, FechaCreacion)
          WHERE Estado IN (5, 7, 8)');
    PRINT 'OrdenesTrabajo.FechaTrasladoRetorno agregada (completadas: ya en zona de reparados).';
END
IF COL_LENGTH('dbo.OrdenesTrabajo', 'TrasladoRetornoPorId') IS NULL
    ALTER TABLE dbo.OrdenesTrabajo ADD TrasladoRetornoPorId int NULL
        CONSTRAINT FK_OrdenesTrabajo_Users_TrasladoRetornoPorId REFERENCES dbo.Users (Id);
GO

-- ----- Correcciones que se pueden repetir (por si el sistema anterior movió órdenes entre que se corrió
--        este script y se publicó la API nueva) --------------------------------------------------
-- Inspecciones rápidas: no son reparaciones; quedan cerradas para no ocupar la zona de reparados
UPDATE dbo.OrdenesTrabajo
   SET Estado = 7, FechaValidacion = COALESCE(FechaValidacion, FechaFinalizacion, UpdatedAt, FechaCreacion)
 WHERE Estado = 5 AND TipoMantenimiento IN (N'Inspección', N'Inspeccion');
-- En proceso o terminada = el técnico ya la aceptó; aceptada = ya se había trasladado
UPDATE dbo.OrdenesTrabajo SET FechaAceptacion = COALESCE(FechaInicio, FechaAsignacion, FechaCreacion)
 WHERE FechaAceptacion IS NULL AND Estado IN (3, 4, 5);
UPDATE dbo.OrdenesTrabajo SET FechaTrasladoIngreso = COALESCE(FechaAceptacion, FechaCreacion)
 WHERE FechaTrasladoIngreso IS NULL AND FechaAceptacion IS NOT NULL;
GO

-- ----- Hallazgos del taller --------------------------------------------------
IF COL_LENGTH('dbo.OrdenesTrabajoChecklistItems', 'ReportadoPorTaller') IS NULL
    ALTER TABLE dbo.OrdenesTrabajoChecklistItems ADD ReportadoPorTaller bit NOT NULL
        CONSTRAINT DF_OrdenesTrabajoChecklistItems_ReportadoPorTaller DEFAULT 0;
GO

-- ----- Historial del flujo ---------------------------------------------------
IF OBJECT_ID('dbo.HistorialFlujo') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialFlujo (
        Id             int IDENTITY(1,1) NOT NULL CONSTRAINT PK_HistorialFlujo PRIMARY KEY,
        ReporteFallaId int NULL,
        OrdenTrabajoId int NULL,
        Etapa          nvarchar(30) NOT NULL,
        Accion         nvarchar(50) NOT NULL,
        UsuarioId      int NULL,
        NombreUsuario  nvarchar(150) NULL,
        RolUsuario     nvarchar(30) NULL,
        Detalle        nvarchar(2000) NULL,
        DatosJson      nvarchar(max) NULL,
        Fecha          datetime2 NOT NULL
    );
    CREATE INDEX IX_HistorialFlujo_ReporteFallaId ON dbo.HistorialFlujo (ReporteFallaId);
    CREATE INDEX IX_HistorialFlujo_OrdenTrabajoId ON dbo.HistorialFlujo (OrdenTrabajoId);
    PRINT 'HistorialFlujo creada.';
END
GO

-- ----- Capacidad de la Zona de Transición ------------------------------------
IF OBJECT_ID('dbo.ConfiguracionSistema') IS NULL
BEGIN
    CREATE TABLE dbo.ConfiguracionSistema (
        Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ConfiguracionSistema PRIMARY KEY,
        Clave       nvarchar(50) NOT NULL,
        Valor       nvarchar(500) NULL,
        Descripcion nvarchar(200) NULL,
        TipoDato    nvarchar(20) NOT NULL,
        UpdatedAt   datetime2 NOT NULL,
        UpdatedBy   int NULL
    );
    PRINT 'ConfiguracionSistema creada.';
END
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionSistema WHERE Clave = 'ZonaTransicion.CapacidadDanados')
    INSERT INTO dbo.ConfiguracionSistema (Clave, Valor, Descripcion, TipoDato, UpdatedAt)
    VALUES ('ZonaTransicion.CapacidadDanados', '15', 'Vehículos dañados pendientes de reparación que caben en la Zona de Transición', 'int', SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionSistema WHERE Clave = 'ZonaTransicion.CapacidadReparados')
    INSERT INTO dbo.ConfiguracionSistema (Clave, Valor, Descripcion, TipoDato, UpdatedAt)
    VALUES ('ZonaTransicion.CapacidadReparados', '15', 'Vehículos reparados pendientes de validación que caben en la Zona de Transición', 'int', SYSUTCDATETIME());
GO

PRINT 'Flujo de 7 etapas listo.';
