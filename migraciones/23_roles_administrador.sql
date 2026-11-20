-- =============================================================================
-- USR-03 (Reporte 7, 19-nov-2026): simplificación de roles
--   * El rol Supervisor (Gerente de Mantenimiento) se fusiona con Administrador: todos sus usuarios quedan como
--     Administrador, con todas las funciones y accesos de ambos.
--   * El rol SuperUsuario se elimina: sus usuarios quedan como Administrador.
-- Roles que quedan: Administrador, Líder, Técnico y Operador.
--
-- Va DESPUÉS de 22_seleccion_y_presupuesto_empresas.sql y ANTES de publicar la API nueva (la API nueva ya trata a
-- Supervisor y SuperUsuario como Administrador, así que el orden no rompe sesiones abiertas).
-- Idempotente. Haz un respaldo de la base antes de correrlo.
--
-- Para revisar antes quiénes cambian:
--   SELECT u.Username, u.NombreCompleto, r.Nombre FROM dbo.Users u
--   JOIN dbo.UserRoles ur ON ur.UserId = u.Id JOIN dbo.Roles r ON r.Id = ur.RolesId
--   WHERE r.Nombre IN ('Supervisor', 'SuperUsuario');
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- El rol Administrador debe existir
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Nombre = 'Administrador')
    INSERT INTO dbo.Roles (Nombre, Descripcion, Activo, CreatedAt) VALUES ('Administrador', 'Administrador del sistema y Gerente de Mantenimiento', 1, SYSUTCDATETIME());

DECLARE @admin int = (SELECT TOP 1 Id FROM dbo.Roles WHERE Nombre = 'Administrador');
UPDATE dbo.Roles SET Activo = 1, Descripcion = 'Administrador del sistema y Gerente de Mantenimiento' WHERE Id = @admin;

-- 1) Quien tenía Supervisor o SuperUsuario queda como Administrador
INSERT INTO dbo.UserRoles (UserId, RolesId)
SELECT DISTINCT ur.UserId, @admin
FROM dbo.UserRoles ur
JOIN dbo.Roles r ON r.Id = ur.RolesId
WHERE r.Nombre IN ('Supervisor', 'SuperUsuario')
  AND NOT EXISTS (SELECT 1 FROM dbo.UserRoles x WHERE x.UserId = ur.UserId AND x.RolesId = @admin);
DECLARE @nuevos int = @@ROWCOUNT;

-- 2) Se quitan los roles fusionados de los usuarios
DELETE ur FROM dbo.UserRoles ur
JOIN dbo.Roles r ON r.Id = ur.RolesId
WHERE r.Nombre IN ('Supervisor', 'SuperUsuario');
DECLARE @quitados int = @@ROWCOUNT;

COMMIT TRANSACTION;

-- 3) Se eliminan los roles (si algo más los usara, solo se desactivan)
BEGIN TRY
    DELETE FROM dbo.Roles WHERE Nombre IN ('Supervisor', 'SuperUsuario');
END TRY
BEGIN CATCH
    UPDATE dbo.Roles SET Activo = 0 WHERE Nombre IN ('Supervisor', 'SuperUsuario');
    PRINT 'Los roles Supervisor y SuperUsuario se desactivaron (estaban en uso en otra tabla).';
END CATCH

PRINT CONCAT('Roles fusionados: ', @nuevos, ' usuario(s) pasaron a Administrador; ', @quitados, ' asignación(es) de Supervisor/SuperUsuario quitadas.');
SELECT r.Nombre AS Rol, COUNT(ur.UserId) AS Usuarios
FROM dbo.Roles r LEFT JOIN dbo.UserRoles ur ON ur.RolesId = r.Id
GROUP BY r.Nombre ORDER BY r.Nombre;
GO
