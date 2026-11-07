-- =============================================================================
-- Empresas proveedoras y tarifas diferenciadas por empresa (PDF 06-nov-2026:
-- GEN-05, CFG-07, USR-02, CFG-08, PAG-03, PAG-04, DSH-02, PAG-02 y la parte de pagos de OT-24)
--
-- Agrega:
--   * Empresas:                empresas proveedoras (nombre, RFC/ID único, activa, contacto opcional).
--   * TarifasEmpresa:          precio de cada actividad del checklist para cada empresa
--                              (sin tarifa de la empresa se usa el costo base del checklist).
--   * Users.EmpresaId:         empresa del técnico (define su tarifario).
--   * RegistrosPago.EmpresaId: empresa con cuyas tarifas se generó la orden de pago.
--   * RegistroPagoActividades: renglones de actividades de cada orden de pago nueva, fijos desde que se generó.
--
-- Acomoda lo que ya existe UNA sola vez, al crear cada columna:
--   * Con el texto libre "EmpresaExterna" de los técnicos se crean las empresas (una por nombre distinto, con un
--     identificador EMP-0001, EMP-0002… que se puede cambiar por el RFC) y cada técnico queda ligado a la suya.
--   * Las órdenes de pago existentes quedan a nombre de la empresa de su técnico (para el dashboard por proveedor).
--     Sus importes NO cambian.
-- Y en cada corrida:
--   * Las órdenes de pago aún Pendientes (o En revisión) dejan de cobrar refacciones: el costo de la actividad ya
--     contempla materiales y mano de obra (OT-24). Total = total anterior - refacciones; refacciones = 0.
--     Las aprobadas, pagadas o rechazadas no se tocan.
--
-- Va DESPUÉS de 17_materiales_y_ordenes_pago.sql y ANTES de publicar la API nueva.
-- Idempotente: se puede correr varias veces sin duplicar ni cambiar lo ya migrado.
-- Haz un respaldo de la base antes de correrlo.
--
-- Para revisar antes de correrlo qué empresas se van a crear:
--   SELECT DISTINCT LTRIM(RTRIM(u.EmpresaExterna)) FROM dbo.Users u
--   JOIN dbo.UserRoles ur ON ur.UserId = u.Id JOIN dbo.Roles r ON r.Id = ur.RolesId
--   WHERE r.Nombre = 'Tecnico' AND LTRIM(RTRIM(ISNULL(u.EmpresaExterna, ''))) <> '';
-- =============================================================================
SET NOCOUNT ON;
-- Si algo falla dentro de una transacción, se deshace completa
SET XACT_ABORT ON;

-- ----- Empresas --------------------------------------------------------------
IF OBJECT_ID('dbo.Empresas') IS NULL
BEGIN
    CREATE TABLE dbo.Empresas (
        Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Empresas PRIMARY KEY,
        Nombre        nvarchar(150) NOT NULL,
        Identificador nvarchar(30)  NOT NULL,
        Activo        bit           NOT NULL CONSTRAINT DF_Empresas_Activo DEFAULT 1,
        Contacto      nvarchar(100) NULL,
        Telefono      nvarchar(20)  NULL,
        Email         nvarchar(100) NULL,
        CreatedAt     datetime2     NOT NULL CONSTRAINT DF_Empresas_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt     datetime2     NULL
    );
    CREATE UNIQUE INDEX IX_Empresas_Identificador ON dbo.Empresas (Identificador);
    PRINT 'Empresas creada.';
END
GO

-- ----- TarifasEmpresa --------------------------------------------------------
IF OBJECT_ID('dbo.TarifasEmpresa') IS NULL
BEGIN
    CREATE TABLE dbo.TarifasEmpresa (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_TarifasEmpresa PRIMARY KEY,
        EmpresaId       int NOT NULL CONSTRAINT FK_TarifasEmpresa_Empresas_EmpresaId
                            REFERENCES dbo.Empresas (Id) ON DELETE CASCADE,
        -- Al quitar una actividad del checklist se van sus tarifas
        ChecklistItemId int NOT NULL CONSTRAINT FK_TarifasEmpresa_ChecklistItems_ChecklistItemId
                            REFERENCES dbo.ChecklistItems (Id) ON DELETE CASCADE,
        Costo           decimal(12,2) NOT NULL,
        UpdatedAt       datetime2 NULL
    );
    CREATE UNIQUE INDEX IX_TarifasEmpresa_EmpresaId_ChecklistItemId ON dbo.TarifasEmpresa (EmpresaId, ChecklistItemId);
    CREATE INDEX IX_TarifasEmpresa_ChecklistItemId ON dbo.TarifasEmpresa (ChecklistItemId);
    PRINT 'TarifasEmpresa creada.';
END
GO

-- ----- Users.EmpresaId (y empresas a partir de EmpresaExterna) ----------------
IF COL_LENGTH('dbo.Users', 'EmpresaId') IS NULL
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dbo.Users ADD EmpresaId int NULL
        CONSTRAINT FK_Users_Empresas_EmpresaId REFERENCES dbo.Empresas (Id);
    CREATE INDEX IX_Users_EmpresaId ON dbo.Users (EmpresaId);

    -- Una empresa por cada nombre distinto (sin importar mayúsculas ni acentos) de los técnicos
    EXEC('
        INSERT INTO dbo.Empresas (Nombre, Identificador, Activo, CreatedAt)
        SELECT n.Nombre, CONCAT(''MIG-'', LEFT(CONVERT(varchar(36), NEWID()), 18)), 1, SYSUTCDATETIME()
        FROM (
            SELECT MIN(LEFT(LTRIM(RTRIM(u.EmpresaExterna)), 150)) AS Nombre
            FROM dbo.Users u
            WHERE LTRIM(RTRIM(ISNULL(u.EmpresaExterna, ''''))) <> ''''
              AND EXISTS (SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.Id = ur.RolesId
                          WHERE ur.UserId = u.Id AND r.Nombre = ''Tecnico'')
            GROUP BY LTRIM(RTRIM(u.EmpresaExterna)) COLLATE SQL_Latin1_General_CP1_CI_AI
        ) n
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Empresas e
                          WHERE e.Nombre COLLATE SQL_Latin1_General_CP1_CI_AI = n.Nombre COLLATE SQL_Latin1_General_CP1_CI_AI);

        -- Identificador generado (EMP-0001…): se cambia por el RFC en Empresas proveedoras
        UPDATE e SET Identificador = CONCAT(''EMP-'', FORMAT(e.Id, ''0000''))
        FROM dbo.Empresas e
        WHERE e.Identificador LIKE ''MIG-%''
          AND NOT EXISTS (SELECT 1 FROM dbo.Empresas x WHERE x.Identificador = CONCAT(''EMP-'', FORMAT(e.Id, ''0000'')));

        UPDATE u SET EmpresaId = e.Id
        FROM dbo.Users u
        JOIN dbo.Empresas e
          ON e.Nombre COLLATE SQL_Latin1_General_CP1_CI_AI = LEFT(LTRIM(RTRIM(u.EmpresaExterna)), 150) COLLATE SQL_Latin1_General_CP1_CI_AI
        WHERE EXISTS (SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.Id = ur.RolesId
                      WHERE ur.UserId = u.Id AND r.Nombre = ''Tecnico'');

        DECLARE @empresas int = (SELECT COUNT(*) FROM dbo.Empresas);
        DECLARE @tecnicos int = (SELECT COUNT(*) FROM dbo.Users WHERE EmpresaId IS NOT NULL);
        PRINT CONCAT(''Users.EmpresaId agregada: '', @empresas, '' empresa(s) creadas desde EmpresaExterna, '', @tecnicos, '' técnico(s) ligados.'');
    ');
    COMMIT TRANSACTION;
END
GO

-- ----- RegistrosPago.EmpresaId -----------------------------------------------
IF COL_LENGTH('dbo.RegistrosPago', 'EmpresaId') IS NULL
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dbo.RegistrosPago ADD EmpresaId int NULL
        CONSTRAINT FK_RegistrosPago_Empresas_EmpresaId REFERENCES dbo.Empresas (Id);
    CREATE INDEX IX_RegistrosPago_EmpresaId ON dbo.RegistrosPago (EmpresaId);
    -- Las órdenes de pago existentes quedan a nombre de la empresa de su técnico; sus importes no cambian
    EXEC('
        UPDATE p SET EmpresaId = u.EmpresaId
        FROM dbo.RegistrosPago p
        JOIN dbo.Users u ON u.Id = p.TecnicoId
        WHERE u.EmpresaId IS NOT NULL;
        PRINT CONCAT(''RegistrosPago.EmpresaId agregada: '', @@ROWCOUNT, '' orden(es) de pago a nombre de la empresa de su técnico.'');
    ');
    COMMIT TRANSACTION;
END
GO

-- ----- RegistroPagoActividades -----------------------------------------------
IF OBJECT_ID('dbo.RegistroPagoActividades') IS NULL
BEGIN
    CREATE TABLE dbo.RegistroPagoActividades (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RegistroPagoActividades PRIMARY KEY,
        RegistroPagoId  int NOT NULL CONSTRAINT FK_RegistroPagoActividades_RegistrosPago_RegistroPagoId
                            REFERENCES dbo.RegistrosPago (Id) ON DELETE CASCADE,
        -- Copia: sin llave foránea al checklist
        ChecklistItemId int NULL,
        Orden           int NOT NULL,
        Descripcion     nvarchar(200) NOT NULL,
        Cantidad        decimal(12,2) NOT NULL,
        CostoUnitario   decimal(12,2) NOT NULL,
        Subtotal        decimal(12,2) NOT NULL
    );
    CREATE INDEX IX_RegistroPagoActividades_RegistroPagoId ON dbo.RegistroPagoActividades (RegistroPagoId);
    PRINT 'RegistroPagoActividades creada.';
END
GO

-- ----- Órdenes de pago pendientes: sin cobro de refacciones (OT-24) ------------
-- 1 Pendiente, 2 En revisión. Aprobadas (3), pagadas (4) y rechazadas (5) se quedan como están.
UPDATE dbo.RegistrosPago
SET MontoTotal = MontoTotal - CostoRefacciones,
    CostoRefacciones = 0
WHERE Estado IN (1, 2) AND CostoRefacciones <> 0;
PRINT CONCAT('Órdenes de pago pendientes recalculadas sin refacciones: ', @@ROWCOUNT, '.');
GO

PRINT 'Empresas proveedoras y tarifas listas.';
