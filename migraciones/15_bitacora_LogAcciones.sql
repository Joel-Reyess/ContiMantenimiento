-- =============================================================================
-- Bitácora de eliminaciones (requerimiento 9.3: quién, cuándo y qué folio)
--
-- La tabla LogAcciones viene en la migración inicial de EF, así que lo normal es
-- que YA EXISTA y este script no haga nada. Se deja por si alguna base se creó
-- sin ella: al eliminar reportes, órdenes, áreas o inventario la API escribe
-- aquí, y si la tabla no existe la eliminación falla.
--
-- Idempotente (puedes correrlo varias veces). No toca datos existentes.
--
-- Para consultar quién eliminó qué:
--   SELECT Fecha, NombreUsuario, Entidad, EntidadId, Descripcion
--   FROM dbo.LogAcciones WHERE Accion = 'Eliminar' ORDER BY Fecha DESC;
--   (Fecha está en UTC: en San Luis Potosí son 6 horas menos)
-- =============================================================================
IF OBJECT_ID('dbo.LogAcciones') IS NULL
BEGIN
    CREATE TABLE dbo.LogAcciones (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_LogAcciones PRIMARY KEY,
        UsuarioId       int NULL,
        NombreUsuario   nvarchar(100) NULL,
        Accion          nvarchar(50) NOT NULL,
        Entidad         nvarchar(50) NOT NULL,
        EntidadId       int NULL,
        Descripcion     nvarchar(1000) NULL,
        DatosAnteriores nvarchar(max) NULL,
        DatosNuevos     nvarchar(max) NULL,
        DireccionIp     nvarchar(50) NULL,
        Fecha           datetime2 NOT NULL,
        CONSTRAINT FK_LogAcciones_Users_UsuarioId FOREIGN KEY (UsuarioId) REFERENCES dbo.Users (Id)
    );
    CREATE INDEX IX_LogAcciones_UsuarioId ON dbo.LogAcciones (UsuarioId);
    CREATE INDEX IX_LogAcciones_Entidad_EntidadId ON dbo.LogAcciones (Entidad, EntidadId);
    CREATE INDEX IX_LogAcciones_Fecha ON dbo.LogAcciones (Fecha);
    PRINT 'LogAcciones creada.';
END
ELSE
    PRINT 'LogAcciones ya existe: no se hizo nada.';
GO
