-- =============================================================================
-- Migración: agregar a TiposVehiculo las 8 columnas que faltan en tu base.
--
-- El código (modelo TipoVehiculo) tiene estas columnas, pero tu tabla NO las
-- tiene, así que el backend truena con:
--   SqlException 207: Invalid column name 'ImagenFallasUrl' / 'ProveedorId' / ...
-- al listar vehículos (TipoVehiculoRepository.GetAllAsync). Eso rompía el
-- selector de vehículo en "Reportar falla" (sin vehículo no se detecta el tipo
-- y el botón de componentes queda deshabilitado).
--
-- Estas columnas NO están en ninguna migración de EF (igual que las 3 tablas del
-- feature), por eso hay que agregarlas a mano. Idempotente: usa IF NOT EXISTS.
-- Base: MantenimientoEquiposDB.  ⚠️ Respaldo antes. No toca datos existentes.
-- =============================================================================

-- ImagenUrl NVARCHAR(500) NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ImagenUrl' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ImagenUrl] NVARCHAR(500) NULL;
    PRINT 'Columna ImagenUrl agregada a TiposVehiculo.';
END ELSE PRINT 'ImagenUrl ya existe.';
GO

-- ImagenFallasUrl NVARCHAR(500) NULL  (la que usa el feature para la foto del carro)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ImagenFallasUrl' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ImagenFallasUrl] NVARCHAR(500) NULL;
    PRINT 'Columna ImagenFallasUrl agregada a TiposVehiculo.';
END ELSE PRINT 'ImagenFallasUrl ya existe.';
GO

-- MaxInWorkshop INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'MaxInWorkshop' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [MaxInWorkshop] INT NULL;
    PRINT 'Columna MaxInWorkshop agregada a TiposVehiculo.';
END ELSE PRINT 'MaxInWorkshop ya existe.';
GO

-- FrecuenciaMantenimientoDias INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FrecuenciaMantenimientoDias' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FrecuenciaMantenimientoDias] INT NULL;
    PRINT 'Columna FrecuenciaMantenimientoDias agregada a TiposVehiculo.';
END ELSE PRINT 'FrecuenciaMantenimientoDias ya existe.';
GO

-- FrecuenciaPreventivoMeses INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FrecuenciaPreventivoMeses' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FrecuenciaPreventivoMeses] INT NULL;
    PRINT 'Columna FrecuenciaPreventivoMeses agregada a TiposVehiculo.';
END ELSE PRINT 'FrecuenciaPreventivoMeses ya existe.';
GO

-- ProgramadosPorSemana INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProgramadosPorSemana' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ProgramadosPorSemana] INT NULL;
    PRINT 'Columna ProgramadosPorSemana agregada a TiposVehiculo.';
END ELSE PRINT 'ProgramadosPorSemana ya existe.';
GO

-- FechaProximoMantenimiento DATETIME2(7) NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FechaProximoMantenimiento' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [FechaProximoMantenimiento] DATETIME2(7) NULL;
    PRINT 'Columna FechaProximoMantenimiento agregada a TiposVehiculo.';
END ELSE PRINT 'FechaProximoMantenimiento ya existe.';
GO

-- ProveedorId INT NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo] ADD [ProveedorId] INT NULL;
    PRINT 'Columna ProveedorId agregada a TiposVehiculo.';
END ELSE PRINT 'ProveedorId ya existe.';
GO

-- Índice + FK de ProveedorId -> Users (solo si Users existe y la FK no está aún)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TiposVehiculo_ProveedorId' AND object_id = OBJECT_ID(N'dbo.TiposVehiculo'))
   AND EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_TiposVehiculo_ProveedorId] ON [dbo].[TiposVehiculo] ([ProveedorId] ASC);
    PRINT 'Índice IX_TiposVehiculo_ProveedorId creado.';
END ELSE PRINT 'Índice IX_TiposVehiculo_ProveedorId: ya existe (omitido).';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_TiposVehiculo_Users_ProveedorId')
   AND EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Users') AND type = N'U')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ProveedorId' AND Object_ID = Object_ID(N'dbo.TiposVehiculo'))
BEGIN
    ALTER TABLE [dbo].[TiposVehiculo]
        ADD CONSTRAINT [FK_TiposVehiculo_Users_ProveedorId]
        FOREIGN KEY ([ProveedorId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION;
    PRINT 'FK TiposVehiculo -> Users (ProveedorId) agregada.';
END ELSE PRINT 'FK TiposVehiculo -> Users (ProveedorId): ya existe o falta Users (omitida).';
GO

PRINT '==== Listo. Columnas de TiposVehiculo verificadas/agregadas. ====';
GO
