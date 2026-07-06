-- =============================================================================
-- Vehículos DEMO para PROBAR los carritos que no tienen vehículos.
--
-- En "Reportar falla" el carrito se detecta del VEHÍCULO que eliges. Solo tienes
-- vehículos de tipos 1, 2, 3 y 5, por eso no puedes ver Cojín/Costado/etc.
-- Este script crea 1 vehículo de prueba por cada tipo faltante para que aparezcan
-- en el dropdown y puedas ver su lista de componentes.
--
-- Estado=1 (Operativo), Ubicacion=1 (Piso). Idempotente por Código.
-- ⚠️ Son de PRUEBA. Para borrarlos luego:  (ver el bloque comentado al final)
-- Base: MantenimientoEquiposDB.
-- =============================================================================
SET NOCOUNT ON;

DECLARE @demo TABLE (Codigo NVARCHAR(50), Tipo INT);
INSERT INTO @demo (Codigo, Tipo) VALUES
 (N'DEMO-POLVOS',      4),   -- Carro de Polvos
 (N'DEMO-COJIN',       6),   -- Carro Cojín
 (N'DEMO-COSTADO',     7),   -- Carro Costado
 (N'DEMO-BRACKER',     8),   -- Carro Bracker
 (N'DEMO-CAPA',        9),   -- Carro de Capa
 (N'DEMO-TAMBO',      10),   -- Tambo Apex
 (N'DEMO-PINRACK',    11),   -- Pin Rack
 (N'DEMO-CONTI',      12),   -- Conti
 (N'DEMO-JAULA',      13),   -- Jaula Cuarentena
 (N'DEMO-FLATSTORAGE',14),   -- Flat Storage
 (N'DEMO-CIRCULO',    15);   -- Círculo

INSERT INTO dbo.Vehiculos (Codigo, Tipo, Estado, Ubicacion, Activo, CreatedAt)
SELECT d.Codigo, d.Tipo, 1, 1, 1, SYSUTCDATETIME()
FROM @demo d
WHERE NOT EXISTS (SELECT 1 FROM dbo.Vehiculos v WHERE v.Codigo = d.Codigo);

DECLARE @n INT = (SELECT COUNT(*) FROM dbo.Vehiculos v JOIN @demo d ON d.Codigo = v.Codigo);
PRINT 'Vehículos DEMO existentes ahora: ' + CAST(@n AS NVARCHAR(10)) + ' de 11.';
PRINT 'Codigos: DEMO-POLVOS, DEMO-COJIN, DEMO-COSTADO, DEMO-BRACKER, DEMO-CAPA,';
PRINT '         DEMO-TAMBO, DEMO-PINRACK, DEMO-CONTI, DEMO-JAULA, DEMO-FLATSTORAGE, DEMO-CIRCULO.';
PRINT 'En "Reportar falla" busca cualquiera de esos codigos para ver su carrito.';
GO

-- =============================================================================
-- PARA BORRAR los vehículos DEMO cuando ya no los necesites (descomenta y corre):
--
-- DELETE FROM dbo.Vehiculos
-- WHERE Codigo IN (N'DEMO-POLVOS',N'DEMO-COJIN',N'DEMO-COSTADO',N'DEMO-BRACKER',
--                  N'DEMO-CAPA',N'DEMO-TAMBO',N'DEMO-PINRACK',N'DEMO-CONTI',
--                  N'DEMO-JAULA',N'DEMO-FLATSTORAGE',N'DEMO-CIRCULO');
-- =============================================================================
