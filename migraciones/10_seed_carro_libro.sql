-- =============================================================================
-- SEED de PRUEBA — 1 carrito: "CARRO LIBRO" (slide 1 de la presentación).
--
-- Carga los 12 componentes numerados del CARRO LIBRO para probar el selector
-- de componentes en tablet. Inserta:
--   · 12 filas en ImageFaults          (el catálogo de componentes)
--   · 12 filas en VehicleImagePoints   (los números 1..12 sobre la foto)
--
-- No necesitas capturar el Id del tipo: el script lo detecta solo (busca un
-- TipoVehiculo cuyo Nombre contenga 'libro'; si no hay, usa el primero).
-- Idempotente: si lo corres de nuevo NO duplica.
--
-- OJO: el número que se muestra (1..12) sale del ORDEN de inserción de los
-- puntos, por eso se insertan en orden 1→12 para que coincida con la presentación.
--
-- La FOTO del carro (ImagenFallasUrl) es opcional: la LISTA numerada de la
-- derecha en el modal ya funciona sin imagen. Si quieres foto, mira el paso 4.
-- =============================================================================
SET NOCOUNT ON;

-- ---------- 1) Componentes + posiciones (X/Y en % sobre la diapositiva) ----------
DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
 ( 1, N'REPARACIÓN DE ESTRUCTURA',                    87.94, 74.94),
 ( 2, N'APLICACIÓN DE SOLDADURA (cambio de postes)',  86.89, 80.00),
 ( 3, N'REPARACIÓN DE BASTIDORES',                    74.67, 14.20),
 ( 4, N'REPARACIÓN DE LÁMINAS DE ALUMINIO, RELLENAR', 88.91, 16.53),
 ( 5, N'REPARACIÓN DE NIVELES, AJUSTAR LEVANTE',      33.87, 63.77),
 ( 6, N'REPARAR GANCHOS TENSORES Y RESORTES',         31.48, 69.44),
 ( 7, N'LIMPIEZA DE LÁMINAS',                         26.03, 56.48),
 ( 8, N'REPARAR O CAMBIAR RUEDAS',                    68.53, 45.77),
 ( 9, N'PINTURA DE CARRO',                            71.04, 64.32),
 (10, N'COLOCAR PORTA ETIQUETA',                      58.63, 56.30),
 (11, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 30.19, 89.74),
 (12, N'LIMPIEZA DE CARROS',                          80.64, 63.83);

-- ---------- 2) Alta de componentes en ImageFaults (solo los que falten) ----------
INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
SELECT c.Nombre, NULL, 1, SYSUTCDATETIME()
FROM @comp c
WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);
PRINT 'ImageFaults: componentes del CARRO LIBRO verificados/insertados.';

-- ---------- 3) Detectar el TipoVehiculo y armar el ImageKey ----------
DECLARE @TipoId INT;
SELECT TOP 1 @TipoId = Id FROM dbo.TiposVehiculo WHERE Nombre LIKE N'%libro%' ORDER BY Id;
IF @TipoId IS NULL
    SELECT TOP 1 @TipoId = Id FROM dbo.TiposVehiculo ORDER BY Id;

IF @TipoId IS NULL
BEGIN
    PRINT '*** No hay filas en TiposVehiculo. Crea al menos un tipo y vuelve a correr este seed.';
    RETURN;
END

DECLARE @ImageKey NVARCHAR(100) = N'tipo_' + CAST(@TipoId AS NVARCHAR(10));
PRINT 'Usando TipoVehiculo Id=' + CAST(@TipoId AS NVARCHAR(10)) + '  ->  ImageKey=' + @ImageKey;
PRINT '(si querías OTRO tipo, cambia el @TipoId arriba o renombra el tipo para que contenga "libro").';

-- ---------- 3b) Alta de los 12 puntos numerados (en orden 1..12) ----------
-- El ORDER BY c.Num garantiza que los Id se asignen en ese orden, así el
-- número que pinta el front (1..N por Id) coincide con el de la presentación.
INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
SELECT @ImageKey, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
FROM @comp c
JOIN dbo.ImageFaults f ON f.Name = c.Nombre
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.VehicleImagePoints p
    WHERE p.ImageKey = @ImageKey AND p.ImageFaultId = f.Id
)
ORDER BY c.Num;
PRINT 'VehicleImagePoints: puntos numerados del CARRO LIBRO verificados/insertados para ' + @ImageKey + '.';

-- ---------- 4) (OPCIONAL) Foto del carro ----------
-- La lista numerada ya funciona sin imagen. Si quieres que además se vea la foto
-- con los números encima, pon aquí la URL/ruta como sirves tus imágenes y descomenta:
--
--   UPDATE dbo.TiposVehiculo SET ImagenFallasUrl = N'<url-de-tu-foto>' WHERE Id = @TipoId;
--
-- (dime cómo subes las imágenes en la app y te dejo esta línea ya lista.)

-- ---------- Resumen ----------
DECLARE @nPts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @ImageKey);
PRINT '==== Seed CARRO LIBRO listo. Puntos para ' + @ImageKey + ': ' + CAST(@nPts AS NVARCHAR(10)) + ' ====';
GO
