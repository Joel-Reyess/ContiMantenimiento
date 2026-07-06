-- =============================================================================
-- SEED de los 11 carritos restantes (slides 2..12 de la presentacion).
-- Cada carrito carga sus componentes (ImageFaults) y sus puntos numerados
-- (VehicleImagePoints) en su ImageKey = tipo_<enum TipoVehiculoEnum>:
--
--   CARRO COJIN=6  CARRO COSTADO=7  CARRO BRACKER=8  CARRO DE CAPA=9
--   FLAT STORAGE=14  TAMBO APEX=10  PIN RACK=11  CIRCULO=15  CONTI=12
--   JAULA CUARENTENA=13  CARRO DE POLVOS=4
--
-- El CARRO LIBRO (tipo_5) ya se cargo con 10_seed_carro_libro.sql.
-- Numeracion 1..N por orden de insercion (ORDER BY Num).
-- Idempotente: no duplica ImageFaults (por Name) ni puntos (por ImageKey+Fault).
--
-- OJO posiciones: X/Y salen de los numeros de la presentacion cuando existen.
-- CONTI (tipo_12) no traia numeros en la foto -> se distribuyen en cuadricula;
-- revisalos/ajustalos si vas a usar la foto. La LISTA numerada funciona igual.
-- Base: MantenimientoEquiposDB. Respaldo antes (aunque no toca datos existentes).
-- =============================================================================
SET NOCOUNT ON;
GO

-- ================= CARRO COJIN  ->  tipo_6 (enum 6) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 30.71, 92.59),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 30.94, 87.47),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 22.03, 58.02),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 67.17, 9.07),
     ( 5, N'REPARAR SEGUROS MARIPOSA', 79.98, 90.56),
     ( 6, N'REPARAR FRENOS Y PALANCAS', 88.36, 31.91),
     ( 7, N'REPARAR O REEMPLAZAR COPLES', 64.5, 19.2),
     ( 8, N'CAMBIO DE CHUMACERAS', 65.16, 72.41),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 70.76, 71.85),
     (10, N'REPARACIÓN DE CATARINAS Y GUARDAS', 90.78, 6.3),
     (11, N'REPARAR O CAMBIAR RUEDAS', 53.66, 46.9),
     (12, N'PINTURA DE CARRO', 77.17, 38.52),
     (13, N'PRUEBAS DE CENTRADO', 72.0, 86.04),
     (14, N'COLOCAR PORTA ETIQUETA', 58.46, 15.62),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 21.55, 83.83),
     (16, N'LIMPIEZA DE CARROS', 68.77, 39.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_6';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO COJIN (tipo_6): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO COSTADO  ->  tipo_7 (enum 7) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 29.53, 96.3),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 31.42, 88.58),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 25.57, 61.23),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 68.21, 7.1),
     ( 5, N'REPARAR FRENOS Y PALANCAS', 88.29, 33.52),
     ( 6, N'REPARAR O REEMPLAZAR COPLES', 67.83, 18.21),
     ( 7, N'CAMBIO DE CHUMACERAS', 62.45, 65.25),
     ( 8, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 75.42, 65.8),
     ( 9, N'REPARACIÓN DE CATARINAS Y GUARDAS', 92.59, 6.05),
     (10, N'REPARAR O CAMBIAR RUEDAS', 55.96, 43.82),
     (11, N'PINTURA DE CARRO', 68.77, 39.01),
     (12, N'COLOCAR PORTA ETIQUETA', 26.96, 71.85),
     (13, N'COLOCAR GUARDA PARA LINNER (TIRANTES)', 20.92, 81.48),
     (14, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 74.78, 93.77),
     (15, N'LIMPIEZA DE CARROS', 77.17, 38.52);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_7';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO COSTADO (tipo_7): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO BRACKER  ->  tipo_8 (enum 8) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 30.71, 92.59),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 30.94, 87.47),
     ( 3, N'REPAR RODILLOS PRINCIPALES', 22.03, 58.02),
     ( 4, N'REPARAR TAPAS DE FIBRA DE VIDRIO', 67.17, 9.07),
     ( 5, N'REPARAR SEGUROS MARIPOSA', 79.98, 90.56),
     ( 6, N'REPARAR FRENOS Y PALANCAS', 88.36, 31.91),
     ( 7, N'REPARAR O REEMPLAZAR COPLES', 64.5, 19.2),
     ( 8, N'CAMBIO DE CHUMACERAS', 65.16, 72.41),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 70.76, 71.85),
     (10, N'REPARACIÓN DE CATARINAS Y GUARDAS', 90.78, 6.3),
     (11, N'REPARAR O CAMBIAR RUEDAS', 53.66, 46.9),
     (12, N'PINTURA DE CARRO', 77.17, 38.52),
     (13, N'PRUEBAS DE CENTRADO', 72.0, 86.04),
     (14, N'COLOCAR PORTA ETIQUETA', 58.46, 15.62),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 21.55, 83.83),
     (16, N'LIMPIEZA DE CARROS', 68.77, 39.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_8';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO BRACKER (tipo_8): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO DE CAPA  ->  tipo_9 (enum 9) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 69.82, 74.46),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 75.14, 74.1),
     ( 3, N'COLOCAR SOLERA LATERAL', 60.07, 92.85),
     ( 4, N'REPAR RODILLOS PRINCIPALES', 77.21, 8.24),
     ( 5, N'REPARAR FRENOS Y PALANCAS', 62.71, 14.47),
     ( 6, N'REPARAR O REEMPLAZAR COPLES', 76.05, 17.45),
     ( 7, N'CAMBIO DE CHUMACERAS', 83.81, 94.83),
     ( 8, N'REPARAR MARTILLOS', 34.77, 70.37),
     ( 9, N'REPARAR/REEMPLAZAR RODILLOS AUXILIARES', 10.22, 68.32),
     (10, N'REPARAR O CAMBIAR RUEDAS', 23.53, 96.39),
     (11, N'PINTURA DE CARRO', 24.2, 85.49),
     (12, N'PRUEBAS DE CENTRADO (DISTANCIAS ENTRE RODILLOS)', 25.61, 53.49),
     (13, N'COLOCAR PORTA ETIQUETA', 57.28, 66.24),
     (14, N'COLOCAR GUARDA PARA LINNER (TIRANTES)', 88.35, 69.0),
     (15, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 74.96, 96.93),
     (16, N'LIMPIEZA DE CARROS', 28.14, 85.44);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_9';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO DE CAPA (tipo_9): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO FLAT STORAGE  ->  tipo_14 (enum 14) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 69.58, 27.7),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio postes)', 77.09, 27.97),
     ( 3, N'COLOCAR SOLERA LATERAL', 86.53, 45.31),
     ( 4, N'REPARACIÓN DE BASTIDORES', 17.48, 81.23),
     ( 5, N'REPARACIÓN DE NIVELES, AJUSTAR LEVANTE', 77.37, 76.46),
     ( 6, N'REPARACIÓN DE LAMINAS DE LONA-PVC, CAMBIO DE PIJAS', 35.7, 69.83),
     ( 7, N'REPARAR TENSORES Y RESORTES', 65.24, 75.91),
     ( 8, N'REPARAR O CAMBIAR RUEDAS', 68.77, 47.4),
     ( 9, N'PINTURA DE CARRO', 19.54, 53.65),
     (10, N'REPARACION/REPOSICION DE OJAL DE ARRASTRE', 72.27, 91.6),
     (11, N'LIMPIEZA DE CARROS', 25.29, 56.72);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_14';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO FLAT STORAGE (tipo_14): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= TAMBO APEX  ->  tipo_10 (enum 10) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 81.14, 29.68),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 81.14, 12.01),
     ( 3, N'REPARAR RESORTE Y BASE', 77.67, 62.27),
     ( 4, N'REPARAR O CAMBIAR RUEDAS', 81.0, 20.0),
     ( 5, N'PINTURA DE CARRO', 59.46, 24.25),
     ( 6, N'LIMPIEZA DE CARROS', 59.98, 40.89);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_10';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'TAMBO APEX (tipo_10): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= PIN RACK  ->  tipo_11 (enum 11) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 78.99, 18.15),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 86.43, 18.29),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 92.51, 48.68),
     ( 4, N'PINTURA DE CARRO', 88.82, 38.13),
     ( 5, N'COLOCAR PORTA ETIQUETA', 92.43, 7.59),
     ( 6, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 54.01, 90.42),
     ( 7, N'LIMPIEZA DE CARROS', 83.15, 37.76);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_11';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'PIN RACK (tipo_11): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CIRCULO  ->  tipo_15 (enum 15) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 73.84, 43.55),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 82.02, 40.36),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 70.52, 68.83),
     ( 4, N'PINTURA DE CARRO', 83.0, 48.35),
     ( 5, N'LIMPIEZA DE CARROS', 76.02, 61.01);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_15';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CIRCULO (tipo_15): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CONTI  ->  tipo_12 (enum 12) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 15.0, 20.0),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 37.0, 20.0),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 59.0, 20.0),
     ( 4, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 81.0, 20.0),
     ( 5, N'LIMPIEZA DE CARROS', 15.0, 38.0);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_12';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CONTI (tipo_12): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= JAULA CUARENTENA  ->  tipo_13 (enum 13) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 55.31, 11.55),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 62.61, 11.7),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 87.21, 52.04),
     ( 4, N'PINTURA DE CARRO', 78.43, 31.05),
     ( 5, N'REPARACIÓN / REPOSICIÓN DE OJAL DE ARRASTRE', 25.73, 85.62),
     ( 6, N'LIMPIEZA DE CARROS', 71.15, 27.03);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_13';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'JAULA CUARENTENA (tipo_13): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

-- ================= CARRO DE POLVOS  ->  tipo_4 (enum 4) =================
BEGIN
    DECLARE @comp TABLE (Num INT PRIMARY KEY, Nombre NVARCHAR(100), XPct DECIMAL(5,2), YPct DECIMAL(5,2));
    INSERT INTO @comp (Num, Nombre, XPct, YPct) VALUES
     ( 1, N'REPARACION DE ESTRUCTURA', 59.79, 32.79),
     ( 2, N'APLICACIÓN DE SOLDADURA (Cambio de postes)', 69.2, 31.86),
     ( 3, N'REPARAR O CAMBIAR RUEDAS', 79.14, 95.78),
     ( 4, N'PINTURA DE CARRO', 72.72, 89.03),
     ( 5, N'LIMPIEZA DE CARROS', 82.55, 89.23);

    INSERT INTO dbo.ImageFaults (Name, Description, Active, CreatedAt)
    SELECT c.Nombre, NULL, 1, SYSUTCDATETIME() FROM @comp c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ImageFaults f WHERE f.Name = c.Nombre);

    DECLARE @key NVARCHAR(100) = N'tipo_4';
    INSERT INTO dbo.VehicleImagePoints (ImageKey, XPct, YPct, RadiusPct, ImageFaultId, Active, CreatedAt)
    SELECT @key, c.XPct, c.YPct, NULL, f.Id, 1, SYSUTCDATETIME()
    FROM @comp c JOIN dbo.ImageFaults f ON f.Name = c.Nombre
    WHERE NOT EXISTS (SELECT 1 FROM dbo.VehicleImagePoints p WHERE p.ImageKey = @key AND p.ImageFaultId = f.Id)
    ORDER BY c.Num;
    DECLARE @cnt INT = (SELECT COUNT(*) FROM @comp);
    DECLARE @pts INT = (SELECT COUNT(*) FROM dbo.VehicleImagePoints WHERE ImageKey = @key);
    PRINT 'CARRO DE POLVOS (tipo_4): ' + CAST(@cnt AS NVARCHAR(10)) + ' componentes; puntos ahora: ' + CAST(@pts AS NVARCHAR(10));
END
GO

PRINT '==== Seed de los 11 carritos restantes: listo. ====';
GO
