-- =============================================================================
-- Asigna la FOTO (collage) de cada carrito a su TipoVehiculo -> ImagenFallasUrl.
--
-- Cada imagen es el COLLAGE de la diapositiva (2-3 fotos del carrito juntas) tal
-- como venia en la presentacion. Los puntos numerados que ya cargaste (seeds 10 y
-- 11) tienen coordenadas RELATIVAS A ESA DIAPOSITIVA, por eso caen exactos sobre
-- este collage. Si en su lugar pones una sola foto recortada, los numeros NO
-- cuadran (ese era el "se repite el posicionamiento").
--
-- PASOS (una sola vez):
--   1) git pull  (trae la carpeta migraciones/imagenes_carritos/ con los 12 PNG).
--   2) Copia los 12 archivos  migraciones/imagenes_carritos/tipo_*.png  a:
--         MantenimientoAPI/MantenimientoEquipos/wwwroot/uploads/tiposvehiculo/
--      (si la carpeta no existe, creala; el backend ya la sirve en /uploads).
--   3) Corre este script en MantenimientoEquiposDB.
--   4) Recarga la app. En "Reportar falla" elige el vehiculo del carrito y veras
--      la foto con los numeros encima.
--
-- ImageKey = tipo_<enum>  y  TiposVehiculo.Id == enum, por eso filtro por Id.
-- Idempotente: solo actualiza; puedes correrlo las veces que quieras.
--
-- OJO (2 casos del material original, no del script):
--   * BRACKER (tipo_8) usa la MISMA imagen que COJIN (tipo_6): en el PPTX la
--     diapositiva de BRACKER es copia de la de COJIN. Cuando tengas la foto real
--     de BRACKER, subela en Admin > Fallas por imagen > pestana Hotspots.
--   * CONTI (tipo_12) no traia numeros en la diapositiva: sus puntos se pusieron
--     en cuadricula, asi que no apuntan a partes especificas. Ajustalos en el
--     editor de Hotspots (click en la imagen -> Guardar punto) si vas a usarlos.
-- =============================================================================
SET NOCOUNT ON;

DECLARE @img TABLE (Id INT PRIMARY KEY, Archivo NVARCHAR(200));
INSERT INTO @img (Id, Archivo) VALUES
 ( 4, N'/uploads/tiposvehiculo/tipo_4.png'),   -- CARRO DE POLVOS
 ( 5, N'/uploads/tiposvehiculo/tipo_5.png'),   -- CARRO LIBRO
 ( 6, N'/uploads/tiposvehiculo/tipo_6.png'),   -- CARRO COJIN
 ( 7, N'/uploads/tiposvehiculo/tipo_7.png'),   -- CARRO COSTADO
 ( 8, N'/uploads/tiposvehiculo/tipo_8.png'),   -- CARRO BRACKER (== COJIN por ahora)
 ( 9, N'/uploads/tiposvehiculo/tipo_9.png'),   -- CARRO DE CAPA
 (10, N'/uploads/tiposvehiculo/tipo_10.png'),  -- TAMBO APEX
 (11, N'/uploads/tiposvehiculo/tipo_11.png'),  -- PIN RACK
 (12, N'/uploads/tiposvehiculo/tipo_12.png'),  -- CONTI (numeros en cuadricula)
 (13, N'/uploads/tiposvehiculo/tipo_13.png'),  -- JAULA CUARENTENA
 (14, N'/uploads/tiposvehiculo/tipo_14.png'),  -- FLAT STORAGE
 (15, N'/uploads/tiposvehiculo/tipo_15.png');  -- CIRCULO

UPDATE t
   SET t.ImagenFallasUrl = i.Archivo
FROM dbo.TiposVehiculo t
JOIN @img i ON i.Id = t.Id;

DECLARE @n INT = (SELECT COUNT(*) FROM dbo.TiposVehiculo t JOIN @img i ON i.Id = t.Id);
PRINT 'ImagenFallasUrl asignada a ' + CAST(@n AS NVARCHAR(10)) + ' tipos de vehiculo.';

-- Aviso si algun tipo esperado no existe en tu tabla:
DECLARE @faltan NVARCHAR(MAX) = N'';
SELECT @faltan = @faltan + CAST(i.Id AS NVARCHAR(10)) + N' '
FROM @img i WHERE NOT EXISTS (SELECT 1 FROM dbo.TiposVehiculo t WHERE t.Id = i.Id);
IF LEN(@faltan) > 0
    PRINT '*** AVISO: estos Id de TiposVehiculo NO existen (no se asigno imagen): ' + @faltan;

PRINT '==== Listo. Copia los PNG a wwwroot/uploads/tiposvehiculo/ y recarga la app. ====';
GO
