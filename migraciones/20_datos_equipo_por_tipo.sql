-- =============================================================================
-- Documento del 11-nov-2026 y mensaje del cliente del mismo día (Flota de Contenedores)
--
-- Agrega:
--   * TiposVehiculo.PideDatosEquipo: al registrar o editar un vehículo de ese tipo se piden Marca, Modelo,
--     Año y Número de serie (aplica a Tuggers y Montacargas; los contenedores no los llevan).
--     Se activa sola en los tipos cuyo nombre contiene "Tugger" o "Montacargas" (también "Tugger Eléctrico").
--     Se puede cambiar en Configuración > Tipos de vehículo.
--
-- PRE-03 (autodetección por prefijo de tipos recién creados) y FLT-10 (pestañas Contenedores/Tuggers)
-- no necesitan cambios en la base.
--
-- Va DESPUÉS de 19_correcciones_06nov.sql. Idempotente: se puede correr varias veces.
-- Haz un respaldo de la base antes de correrlo.
-- =============================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.TiposVehiculo', 'PideDatosEquipo') IS NULL
BEGIN
    ALTER TABLE dbo.TiposVehiculo ADD PideDatosEquipo bit NOT NULL
        CONSTRAINT DF_TiposVehiculo_PideDatosEquipo DEFAULT (0);
    PRINT 'TiposVehiculo.PideDatosEquipo agregada.';

    -- Solo la primera vez: después lo decide el administrador en la pantalla de tipos
    EXEC('UPDATE dbo.TiposVehiculo SET PideDatosEquipo = 1
          WHERE Nombre LIKE ''%tugger%'' OR Nombre LIKE ''%montacarga%''');
    PRINT CONCAT('Tipos que piden marca, modelo, año y número de serie: ', @@ROWCOUNT, '.');
END
GO

PRINT 'Datos de equipo por tipo listos.';
