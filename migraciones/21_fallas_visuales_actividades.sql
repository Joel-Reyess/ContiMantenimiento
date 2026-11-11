-- =============================================================================
-- FV-03 (documento del 11-nov-2026): Fallas visuales = actividades del checklist ubicadas en la foto
--
-- Las actividades se capturan una sola vez, en Configuración → Checklists (título, descripción y costo).
-- En Fallas visuales solo se elige una actividad del tipo de vehículo y se ubica en la foto.
--
-- Agrega:
--   * ChecklistItems.Titulo: título corto del ítem (p. ej. "Rodillos principales"); la descripción sigue en Pregunta.
--   * ImageFaults.ChecklistItemId: marca la falla interna de cada actividad (ya no se capturan fallas a mano).
--
-- Acomoda lo que ya existe:
--   1. Los puntos de la foto sin actividad se ligan solos cuando hay UNA sola coincidencia en el checklist de su tipo:
--      descripción del componente = actividad, nombre = actividad o título, o el nombre está dentro de la actividad
--      (sin distinguir mayúsculas ni acentos). Los que no coinciden quedan "Sin actividad" para ligarlos a mano.
--   2. A las actividades ligadas sin título se les pone el nombre del componente (ej. "ENSAMBLE").
--   3. Cada punto ligado pasa a la falla interna de su actividad (los reportes anteriores no cambian).
--
-- Va DESPUÉS de 19_correcciones_06nov.sql. Idempotente: se puede correr varias veces.
-- Haz un respaldo de la base antes de correrlo.
-- =============================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VehicleImagePoints', 'ChecklistItemId') IS NULL
BEGIN
    RAISERROR('Falta VehicleImagePoints.ChecklistItemId: corre primero 19_correcciones_06nov.sql.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.ChecklistItems', 'Titulo') IS NULL
BEGIN
    ALTER TABLE dbo.ChecklistItems ADD Titulo nvarchar(100) NULL;
    PRINT 'ChecklistItems.Titulo agregada.';
END
GO

IF COL_LENGTH('dbo.ImageFaults', 'ChecklistItemId') IS NULL
BEGIN
    ALTER TABLE dbo.ImageFaults ADD ChecklistItemId int NULL;
    PRINT 'ImageFaults.ChecklistItemId agregada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImageFaults_ChecklistItemId' AND object_id = OBJECT_ID('dbo.ImageFaults'))
    CREATE INDEX IX_ImageFaults_ChecklistItemId ON dbo.ImageFaults (ChecklistItemId);
GO

-- 1. Liga automática de los puntos sin actividad (solo si hay una única coincidencia en el mejor nivel)
;WITH Puntos AS (
    SELECT p.Id AS PuntoId,
           TRY_CONVERT(int, SUBSTRING(p.ImageKey, 6, 20)) AS TipoId,
           LTRIM(RTRIM(f.Name)) AS Nombre,
           LTRIM(RTRIM(ISNULL(f.Description, ''))) AS Descripcion
    FROM dbo.VehicleImagePoints p
    JOIN dbo.ImageFaults f ON f.Id = p.ImageFaultId
    WHERE p.ChecklistItemId IS NULL AND p.ImageKey LIKE 'tipo[_]%'
), Vigentes AS (
    -- El checklist que usan los vehículos de cada tipo: el más reciente si un tipo trae varios
    SELECT Id, TipoVehiculo FROM (
        SELECT t.Id, t.TipoVehiculo,
               ROW_NUMBER() OVER (PARTITION BY t.TipoVehiculo ORDER BY COALESCE(t.UpdatedAt, t.CreatedAt) DESC, t.Id DESC) AS N
        FROM dbo.ChecklistTemplates t
        WHERE t.Activo = 1 AND t.TipoVehiculo IS NOT NULL
    ) x WHERE N = 1
), Actividades AS (
    SELECT i.Id AS ItemId, v.TipoVehiculo AS TipoId,
           LTRIM(RTRIM(i.Pregunta)) AS Pregunta,
           LTRIM(RTRIM(ISNULL(i.Titulo, ''))) AS Titulo
    FROM dbo.ChecklistItems i
    JOIN Vigentes v ON v.Id = i.ChecklistTemplateId
    WHERE i.Activo = 1
), Candidatos AS (
    SELECT p.PuntoId, a.ItemId,
           CASE
               WHEN p.Descripcion <> '' AND p.Descripcion COLLATE Latin1_General_CI_AI = a.Pregunta COLLATE Latin1_General_CI_AI THEN 1
               WHEN p.Nombre COLLATE Latin1_General_CI_AI = a.Pregunta COLLATE Latin1_General_CI_AI THEN 2
               WHEN a.Titulo <> '' AND p.Nombre COLLATE Latin1_General_CI_AI = a.Titulo COLLATE Latin1_General_CI_AI THEN 2
               WHEN LEN(p.Nombre) >= 4 AND CHARINDEX(p.Nombre COLLATE Latin1_General_CI_AI, a.Pregunta COLLATE Latin1_General_CI_AI) > 0 THEN 3
           END AS Nivel
    FROM Puntos p
    JOIN Actividades a ON a.TipoId = p.TipoId
), Mejor AS (
    SELECT PuntoId, MIN(Nivel) AS Nivel FROM Candidatos WHERE Nivel IS NOT NULL GROUP BY PuntoId
), Unica AS (
    SELECT c.PuntoId, MIN(c.ItemId) AS ItemId
    FROM Candidatos c
    JOIN Mejor m ON m.PuntoId = c.PuntoId AND m.Nivel = c.Nivel
    GROUP BY c.PuntoId
    HAVING COUNT(DISTINCT c.ItemId) = 1
)
UPDATE p SET ChecklistItemId = u.ItemId, UpdatedAt = SYSUTCDATETIME()
FROM dbo.VehicleImagePoints p
JOIN Unica u ON u.PuntoId = p.Id;
PRINT CONCAT('Puntos de la foto ligados solos a su actividad: ', @@ROWCOUNT, '.');
GO

-- 2. Título de las actividades ligadas: el nombre del componente que ya se usaba (el primer punto)
;WITH Nombres AS (
    SELECT p.ChecklistItemId AS ItemId, LTRIM(RTRIM(f.Name)) AS Nombre,
           ROW_NUMBER() OVER (PARTITION BY p.ChecklistItemId ORDER BY p.Id) AS N
    FROM dbo.VehicleImagePoints p
    JOIN dbo.ImageFaults f ON f.Id = p.ImageFaultId
    WHERE p.ChecklistItemId IS NOT NULL AND f.ChecklistItemId IS NULL
)
UPDATE i SET Titulo = LEFT(n.Nombre, 100)
FROM dbo.ChecklistItems i
JOIN Nombres n ON n.ItemId = i.Id AND n.N = 1
WHERE (i.Titulo IS NULL OR LTRIM(RTRIM(i.Titulo)) = '')
  AND n.Nombre <> ''
  AND n.Nombre COLLATE Latin1_General_CI_AI <> LTRIM(RTRIM(i.Pregunta)) COLLATE Latin1_General_CI_AI;
PRINT CONCAT('Actividades con título tomado del componente: ', @@ROWCOUNT, '.');
GO

-- 3. Falla interna de cada actividad ligada y los puntos pasan a usarla
INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt, ChecklistItemId)
SELECT LEFT(COALESCE(NULLIF(LTRIM(RTRIM(i.Titulo)), ''), i.Pregunta), 100), LEFT(i.Pregunta, 500), 1, SYSUTCDATETIME(), i.Id
FROM dbo.ChecklistItems i
WHERE EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ChecklistItemId = i.Id)
  AND NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.ChecklistItemId = i.Id);
PRINT CONCAT('Fallas internas creadas para actividades: ', @@ROWCOUNT, '.');

UPDATE p SET ImageFaultId = f.Id, UpdatedAt = SYSUTCDATETIME()
FROM dbo.VehicleImagePoints p
JOIN dbo.ImageFaults f ON f.ChecklistItemId = p.ChecklistItemId
WHERE p.ImageFaultId <> f.Id;
PRINT CONCAT('Puntos que ahora usan la actividad: ', @@ROWCOUNT, '.');
GO

;WITH Vigentes AS (
    SELECT Id, TipoVehiculo FROM (
        SELECT t.Id, t.TipoVehiculo,
               ROW_NUMBER() OVER (PARTITION BY t.TipoVehiculo ORDER BY COALESCE(t.UpdatedAt, t.CreatedAt) DESC, t.Id DESC) AS N
        FROM dbo.ChecklistTemplates t
        WHERE t.Activo = 1 AND t.TipoVehiculo IS NOT NULL
    ) x WHERE N = 1
)
SELECT p.Id INTO #Pendientes
FROM dbo.VehicleImagePoints p
WHERE p.Active = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ChecklistItems i JOIN Vigentes v ON v.Id = i.ChecklistTemplateId
                  WHERE i.Id = p.ChecklistItemId AND i.Activo = 1
                    AND (p.ImageKey NOT LIKE 'tipo[_]%' OR v.TipoVehiculo = TRY_CONVERT(int, SUBSTRING(p.ImageKey, 6, 20))));
DECLARE @pendientes int = (SELECT COUNT(*) FROM #Pendientes);
PRINT CONCAT('Puntos que quedan "Sin actividad" (ligarlos en Fallas visuales): ', @pendientes, '.');
DROP TABLE #Pendientes;
PRINT 'FV-03 listo.';
GO
SET NOEXEC OFF;
GO
