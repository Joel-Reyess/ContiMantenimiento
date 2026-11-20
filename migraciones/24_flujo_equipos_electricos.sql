-- =============================================================================
-- Flujo de mantenimiento para equipos eléctricos (montacargas, tuggers y traspaletas) — versión preliminar del
-- cliente (19-nov-2026, EQE-01 a EQE-12). Coexiste con el flujo de contenedores sin modificarlo.
--
-- Agrega:
--   * TiposVehiculo.FlujoMantenimiento ('Contenedor' | 'Electrico') y HorasPreventivo (5000 h).
--   * Vehiculos.NumeroEconomico, Horometro, HorometroUltimoPreventivo y control de recordatorios.
--   * Empresas.ProveedorElectrico: el proveedor único de los equipos eléctricos.
--   * OrdenesTrabajo: Flujo, Horometro y las fechas de cada etapa del flujo eléctrico (ingreso al taller,
--     inspección previa, pruebas, traslado al área, aprobación del Líder, documento firmado), datos del preventivo
--     (tipo de revisión, código de falla) y control de avisos.
--   * ChecklistPreventivoCategorias / ChecklistPreventivoActividades: checklist jerárquico por tipo de vehículo.
--   * PreventivoResultados: Buen estado / Mal estado de cada actividad en la orden preventiva.
--   * DocumentosEntrega: documento de entrega firmado (JPG/PNG/PDF).
--
-- Carga inicial (solo una vez):
--   * Los tipos cuyo nombre dice Tugger / Carro de arrastre, Montacargas o Transpaleta / Traspaleta quedan con
--     flujo "Equipo eléctrico", preventivo cada 30 días o 5000 horas y piden marca, modelo, serie y año. Si no
--     existe un tipo Transpaleta, se crea (asígnale su prefijo en Configuración → Prefijos).
--   * Checklists del Anexo: carro de arrastre (14 categorías, 70 actividades), montacargas (16, 83) y
--     transpaleta (15, 62).
--   * Próximo preventivo de los equipos eléctricos que no lo tienen = fecha de alta + 30 días.
--
-- DESPUÉS de correrlo: en Empresas Proveedoras marca cuál es el "Proveedor de equipos eléctricos" (y asígnale
-- presupuesto en Presupuesto de Empresas); captura el número económico de cada equipo eléctrico en Flota.
--
-- Va DESPUÉS de 23_roles_administrador.sql y ANTES de publicar la API nueva. Idempotente. Haz un respaldo antes.
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ----- TiposVehiculo ---------------------------------------------------------------
IF COL_LENGTH('dbo.TiposVehiculo', 'FlujoMantenimiento') IS NULL
    ALTER TABLE dbo.TiposVehiculo ADD FlujoMantenimiento nvarchar(20) NOT NULL CONSTRAINT DF_TiposVehiculo_FlujoMantenimiento DEFAULT 'Contenedor';
IF COL_LENGTH('dbo.TiposVehiculo', 'HorasPreventivo') IS NULL
    ALTER TABLE dbo.TiposVehiculo ADD HorasPreventivo int NULL;
GO

-- ----- Vehiculos -------------------------------------------------------------------
IF COL_LENGTH('dbo.Vehiculos', 'NumeroEconomico') IS NULL
    ALTER TABLE dbo.Vehiculos ADD NumeroEconomico nvarchar(30) NULL;
IF COL_LENGTH('dbo.Vehiculos', 'Horometro') IS NULL
    ALTER TABLE dbo.Vehiculos ADD Horometro decimal(10,1) NULL;
IF COL_LENGTH('dbo.Vehiculos', 'HorometroUltimoPreventivo') IS NULL
    ALTER TABLE dbo.Vehiculos ADD HorometroUltimoPreventivo decimal(10,1) NULL;
IF COL_LENGTH('dbo.Vehiculos', 'UltimoAvisoPreventivo') IS NULL
    ALTER TABLE dbo.Vehiculos ADD UltimoAvisoPreventivo datetime2 NULL;
IF COL_LENGTH('dbo.Vehiculos', 'UltimoAvisoPreventivoTipo') IS NULL
    ALTER TABLE dbo.Vehiculos ADD UltimoAvisoPreventivoTipo nvarchar(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vehiculos_NumeroEconomico' AND object_id = OBJECT_ID('dbo.Vehiculos'))
    CREATE UNIQUE INDEX IX_Vehiculos_NumeroEconomico ON dbo.Vehiculos (NumeroEconomico) WHERE NumeroEconomico IS NOT NULL;
GO

-- ----- Empresas ----------------------------------------------------------------------
IF COL_LENGTH('dbo.Empresas', 'ProveedorElectrico') IS NULL
    ALTER TABLE dbo.Empresas ADD ProveedorElectrico bit NOT NULL CONSTRAINT DF_Empresas_ProveedorElectrico DEFAULT 0;
GO

-- ----- OrdenesTrabajo ----------------------------------------------------------------
IF COL_LENGTH('dbo.OrdenesTrabajo', 'Flujo') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD Flujo nvarchar(20) NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'Horometro') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD Horometro decimal(10,1) NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaIngresoTaller') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaIngresoTaller datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaInspeccionPrevia') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaInspeccionPrevia datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaPruebas') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaPruebas datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'ResultadoPruebas') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD ResultadoPruebas nvarchar(1000) NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaTrasladoArea') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaTrasladoArea datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaAprobacionEntrega') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaAprobacionEntrega datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'AprobacionEntregaPorId') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD AprobacionEntregaPorId int NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'FechaDocumentoEntrega') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD FechaDocumentoEntrega datetime2 NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'DocumentoEntregaPorId') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD DocumentoEntregaPorId int NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'TipoRevision') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD TipoRevision nvarchar(20) NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'CodigoFallaEncontrado') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD CodigoFallaEncontrado bit NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'CodigoFalla') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD CodigoFalla nvarchar(60) NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'CodigoFallaResuelto') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD CodigoFallaResuelto bit NULL;
IF COL_LENGTH('dbo.OrdenesTrabajo', 'UltimoAvisoEntrega') IS NULL ALTER TABLE dbo.OrdenesTrabajo ADD UltimoAvisoEntrega datetime2 NULL;
GO

-- ----- Checklist jerárquico, resultados y documentos ------------------------------------
IF OBJECT_ID('dbo.ChecklistPreventivoCategorias') IS NULL
BEGIN
    CREATE TABLE dbo.ChecklistPreventivoCategorias (
        Id             int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChecklistPreventivoCategorias PRIMARY KEY,
        TipoVehiculoId int NOT NULL CONSTRAINT FK_ChecklistPreventivoCategorias_TiposVehiculo REFERENCES dbo.TiposVehiculo (Id) ON DELETE CASCADE,
        Numero         int NOT NULL,
        Nombre         nvarchar(150) NOT NULL,
        Activo         bit NOT NULL CONSTRAINT DF_ChecklistPreventivoCategorias_Activo DEFAULT 1,
        CreatedAt      datetime2 NOT NULL CONSTRAINT DF_ChecklistPreventivoCategorias_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ChecklistPreventivoCategorias_Tipo ON dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero);
END
IF OBJECT_ID('dbo.ChecklistPreventivoActividades') IS NULL
BEGIN
    CREATE TABLE dbo.ChecklistPreventivoActividades (
        Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChecklistPreventivoActividades PRIMARY KEY,
        CategoriaId int NOT NULL CONSTRAINT FK_ChecklistPreventivoActividades_Categorias REFERENCES dbo.ChecklistPreventivoCategorias (Id) ON DELETE CASCADE,
        Numero      nvarchar(10) NOT NULL,
        Descripcion nvarchar(300) NOT NULL,
        Orden       int NOT NULL,
        Activo      bit NOT NULL CONSTRAINT DF_ChecklistPreventivoActividades_Activo DEFAULT 1
    );
    CREATE INDEX IX_ChecklistPreventivoActividades_Categoria ON dbo.ChecklistPreventivoActividades (CategoriaId, Orden);
END
IF OBJECT_ID('dbo.PreventivoResultados') IS NULL
BEGIN
    CREATE TABLE dbo.PreventivoResultados (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PreventivoResultados PRIMARY KEY,
        OrdenTrabajoId  int NOT NULL CONSTRAINT FK_PreventivoResultados_OrdenesTrabajo REFERENCES dbo.OrdenesTrabajo (Id) ON DELETE CASCADE,
        ActividadId     int NULL,
        CategoriaNumero int NOT NULL,
        Categoria       nvarchar(150) NOT NULL,
        Numero          nvarchar(10) NOT NULL,
        Descripcion     nvarchar(300) NOT NULL,
        Orden           int NOT NULL,
        Resultado       nvarchar(10) NULL,
        Observacion     nvarchar(500) NULL
    );
    CREATE INDEX IX_PreventivoResultados_Orden ON dbo.PreventivoResultados (OrdenTrabajoId);
END
IF OBJECT_ID('dbo.DocumentosEntrega') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosEntrega (
        Id              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DocumentosEntrega PRIMARY KEY,
        OrdenTrabajoId  int NOT NULL CONSTRAINT FK_DocumentosEntrega_OrdenesTrabajo REFERENCES dbo.OrdenesTrabajo (Id) ON DELETE CASCADE,
        Url             nvarchar(500) NOT NULL,
        NombreArchivo   nvarchar(200) NOT NULL,
        TipoContenido   nvarchar(100) NULL,
        Tamano          bigint NOT NULL,
        SubidoPorId     int NULL,
        SubidoPorNombre nvarchar(150) NULL,
        Fecha           datetime2 NOT NULL CONSTRAINT DF_DocumentosEntrega_Fecha DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_DocumentosEntrega_Orden ON dbo.DocumentosEntrega (OrdenTrabajoId);
END
GO

-- ----- Tipos eléctricos (solo la primera vez: si ya hay alguno marcado, se respeta lo configurado) ------------
IF NOT EXISTS (SELECT 1 FROM dbo.TiposVehiculo WHERE FlujoMantenimiento = 'Electrico')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.TiposVehiculo WHERE Nombre LIKE '%transpaleta%' OR Nombre LIKE '%traspaleta%')
        INSERT INTO dbo.TiposVehiculo (Nombre, Descripcion, Activo, CreatedAt) VALUES ('Transpaleta', 'Transpaleta eléctrica', 1, SYSUTCDATETIME());
    UPDATE dbo.TiposVehiculo
    SET FlujoMantenimiento = 'Electrico',
        FrecuenciaMantenimientoDias = ISNULL(FrecuenciaMantenimientoDias, 30),
        HorasPreventivo = ISNULL(HorasPreventivo, 5000),
        PideDatosEquipo = 1
    WHERE Nombre LIKE '%tugger%' OR Nombre LIKE '%arrastre%' OR Nombre LIKE '%montacarga%'
       OR Nombre LIKE '%transpaleta%' OR Nombre LIKE '%traspaleta%';
    PRINT CONCAT('Tipos con flujo de equipos eléctricos: ', (SELECT COUNT(*) FROM dbo.TiposVehiculo WHERE FlujoMantenimiento = 'Electrico'), '.');
END
GO

-- ----- Checklists del Anexo -------------------------------------------------------------
DECLARE @tipo int, @cat int;


-- arrastre: 14 categorías, 70 actividades (a cada tipo que coincida y aún no tenga checklist)
DECLARE c_arrastre CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id FROM dbo.TiposVehiculo t WHERE (Nombre LIKE '%tugger%' OR Nombre LIKE '%arrastre%') AND t.FlujoMantenimiento = 'Electrico'
      AND NOT EXISTS (SELECT 1 FROM dbo.ChecklistPreventivoCategorias c WHERE c.TipoVehiculoId = t.Id);
OPEN c_arrastre;
FETCH NEXT FROM c_arrastre INTO @tipo;
WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 1, N'DAÑOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'1.1', N'Inspeccionar tirón y maneral de arrastre.', 1),
        (@cat, N'1.2', N'Verificar puerta o tapa del compartimiento de batería.', 2),
        (@cat, N'1.3', N'Inspeccionar chapas, tapas delantera y trasera.', 3),
        (@cat, N'1.4', N'Verificar estado general de las llantas.', 4),
        (@cat, N'1.5', N'Evaluar condición de los rines.', 5),
        (@cat, N'1.6', N'Verificar conector de batería.', 6),
        (@cat, N'1.7', N'Comprobar base y condición del extintor.', 7),
        (@cat, N'1.8', N'Inspeccionar daños estructurales visibles.', 8),
        (@cat, N'1.9', N'Verificar etiquetas de seguridad legibles.', 9),
        (@cat, N'1.10', N'Registrar daños adicionales.', 10);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 2, N'PUNTOS DE SEGURIDAD'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'2.1', N'Verificar cinturón de seguridad.', 1),
        (@cat, N'2.2', N'Comprobar nivel de carga e indicador de batería.', 2),
        (@cat, N'2.3', N'Probar interruptor de encendido.', 3),
        (@cat, N'2.4', N'Verificar claxon.', 4),
        (@cat, N'2.5', N'Probar paro de emergencia.', 5),
        (@cat, N'2.6', N'Comprobar sensor de presencia del operador.', 6),
        (@cat, N'2.7', N'Verificar alarma de reversa.', 7),
        (@cat, N'2.8', N'Comprobar funcionamiento de luces (delanteras y luz azul).', 8),
        (@cat, N'2.9', N'Verificar torreta.', 9),
        (@cat, N'2.10', N'Comprobar extintor vigente y recargado.', 10),
        (@cat, N'2.11', N'Inspeccionar banda o cadena antiestática.', 11),
        (@cat, N'2.12', N'Verificar velocidad programada del equipo.', 12);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 3, N'CONTROLES'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'3.1', N'Probar funcionamiento de palancas.', 1),
        (@cat, N'3.2', N'Verificar botones y controles.', 2),
        (@cat, N'3.3', N'Comprobar pedal o perilla del acelerador.', 3),
        (@cat, N'3.4', N'Realizar prueba de conducción.', 4);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 4, N'PANTALLA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'4.1', N'Verificar indicadores del tablero.', 1),
        (@cat, N'4.2', N'Comprobar funcionamiento del display.', 2),
        (@cat, N'4.3', N'Revisar códigos de falla o errores activos.', 3),
        (@cat, N'4.4', N'Confirmar aviso de mantenimiento.', 4);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 5, N'TRACCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'5.1', N'Verificar arranque suave.', 1),
        (@cat, N'5.2', N'Comprobar ausencia de ruidos anormales.', 2),
        (@cat, N'5.3', N'Evaluar jaloneos o vibraciones.', 3),
        (@cat, N'5.4', N'Verificar avance y reversa.', 4);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 6, N'DIRECCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'6.1', N'Comprobar dirección suave y sin ruidos.', 1),
        (@cat, N'6.2', N'Verificar estado del volante.', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 7, N'FRENOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'7.1', N'Comprobar freno de servicio.', 1),
        (@cat, N'7.2', N'Verificar freno regenerativo.', 2),
        (@cat, N'7.3', N'Verificar freno de estacionamiento.', 3),
        (@cat, N'7.4', N'Comprobar condición y nivel del líquido de frenos (si aplica).', 4);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 8, N'BATERÍA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'8.1', N'Verificar fijación de la batería.', 1),
        (@cat, N'8.2', N'Inspeccionar caja o cajón de batería.', 2),
        (@cat, N'8.3', N'Comprobar cables de potencia y comunicación.', 3),
        (@cat, N'8.4', N'Verificar conectores y sistema poka-yoke.', 4),
        (@cat, N'8.5', N'Comprobar display o monitor de batería.', 5),
        (@cat, N'8.6', N'Verificar ausencia de corrosión o sobrecalentamiento.', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 9, N'CHASIS, TAPAS Y CABINA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'9.1', N'Verificar tapas, chapas y bisagras.', 1),
        (@cat, N'9.2', N'Inspeccionar placa de datos y número económico.', 2),
        (@cat, N'9.3', N'Confirmar capacidad de carga visible.', 3),
        (@cat, N'9.4', N'Verificar etiqueta de identificación del modelo.', 4),
        (@cat, N'9.5', N'Comprobar tornillería.', 5),
        (@cat, N'9.6', N'Verificar asiento y piso del operador.', 6),
        (@cat, N'9.7', N'Inspeccionar chasis en busca de fisuras.', 7),
        (@cat, N'9.8', N'Verificar limpieza general de cabina.', 8);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 10, N'LLANTAS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'10.1', N'Evaluar desgaste.', 1),
        (@cat, N'10.2', N'Verificar birlos y tuercas.', 2),
        (@cat, N'10.3', N'Comprobar ausencia de material atorado.', 3),
        (@cat, N'10.4', N'Verificar lubricación de ruedas traseras.', 4);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 11, N'NIVELES DE ACEITE'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'11.1', N'Verificar condición y nivel del aceite de transmisión.', 1),
        (@cat, N'11.2', N'Confirmar si requiere cambio de aceite.', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 12, N'REVISIÓN INTERNA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'12.1', N'Inspeccionar fijación de componentes.', 1),
        (@cat, N'12.2', N'Verificar fusibles.', 2),
        (@cat, N'12.3', N'Comprobar cables, arneses y bornes.', 3),
        (@cat, N'12.4', N'Verificar ventiladores.', 4),
        (@cat, N'12.5', N'Inspeccionar fugas de fluidos.', 5),
        (@cat, N'12.6', N'Verificar limpieza interna.', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 13, N'LIMPIEZA EXTERIOR'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'13.1', N'Realizar soplado del equipo.', 1),
        (@cat, N'13.2', N'Aplicar protector para superficies (Armor All o equivalente).', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 14, N'OTROS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'14.1', N'Probar sensor de impacto y verificar el parámetro de sensibilidad.', 1),
        (@cat, N'14.2', N'Verificar funcionamiento del cargador, base de carga y comunicación con el Fleet Manager (sincronización y transferencia de datos).', 2);
    PRINT CONCAT('Checklist preventivo (arrastre) cargado en el tipo ', @tipo, '.');
    FETCH NEXT FROM c_arrastre INTO @tipo;
END
CLOSE c_arrastre; DEALLOCATE c_arrastre;

-- montacargas: 16 categorías, 83 actividades (a cada tipo que coincida y aún no tenga checklist)
DECLARE c_montacargas CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id FROM dbo.TiposVehiculo t WHERE (Nombre LIKE '%montacarga%') AND t.FlujoMantenimiento = 'Electrico'
      AND NOT EXISTS (SELECT 1 FROM dbo.ChecklistPreventivoCategorias c WHERE c.TipoVehiculoId = t.Id);
OPEN c_montacargas;
FETCH NEXT FROM c_montacargas INTO @tipo;
WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 1, N'DAÑOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'1.1', N'Inspeccionar jalón de arrastre.', 1),
        (@cat, N'1.2', N'Verificar respaldo de carga.', 2),
        (@cat, N'1.3', N'Comprobar puertas, chapas y tapas del equipo.', 3),
        (@cat, N'1.4', N'Inspeccionar mangueras hidráulicas.', 4),
        (@cat, N'1.5', N'Verificar cilindros hidráulicos.', 5),
        (@cat, N'1.6', N'Comprobar estado de las horquillas.', 6),
        (@cat, N'1.7', N'Inspeccionar extintor y su base.', 7),
        (@cat, N'1.8', N'Registrar daños estructurales visibles.', 8);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 2, N'PUNTOS DE SEGURIDAD'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'2.1', N'Verificar cinturón de seguridad.', 1),
        (@cat, N'2.2', N'Comprobar indicador y nivel de carga de la batería.', 2),
        (@cat, N'2.3', N'Probar interruptor de encendido.', 3),
        (@cat, N'2.4', N'Verificar funcionamiento del claxon.', 4),
        (@cat, N'2.5', N'Comprobar funcionamiento de todas las luces (trabajo, reversa, stop, direccionales, arco, laterales y luz azul).', 5),
        (@cat, N'2.6', N'Verificar alarma de reversa.', 6),
        (@cat, N'2.7', N'Comprobar torreta.', 7),
        (@cat, N'2.8', N'Probar paro de emergencia.', 8),
        (@cat, N'2.9', N'Verificar sensor de presencia del operador.', 9),
        (@cat, N'2.10', N'Comprobar espejo retrovisor.', 10),
        (@cat, N'2.11', N'Verificar velocidad programada del equipo.', 11),
        (@cat, N'2.12', N'Inspeccionar banda o cadena antiestática.', 12),
        (@cat, N'2.13', N'Verificar extintor vigente y recargado.', 13),
        (@cat, N'2.14', N'Comprobar seguros de las horquillas.', 14);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 3, N'CONTROLES'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'3.1', N'Verificar funcionamiento de palancas y botones.', 1),
        (@cat, N'3.2', N'Realizar prueba de conducción.', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 4, N'PANTALLA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'4.1', N'Verificar funcionamiento y condición del display e indicadores.', 1),
        (@cat, N'4.2', N'Comprobar códigos de falla activos.', 2),
        (@cat, N'4.3', N'Confirmar aviso o intervalo de mantenimiento.', 3);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 5, N'TRACCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'5.1', N'Verificar funcionamiento de la tracción (arranque, ruidos, jaloneos y cambio de marcha).', 1);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 6, N'SISTEMA HIDRÁULICO'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'6.1', N'Probar elevación y descenso.', 1),
        (@cat, N'6.2', N'Probar inclinación hacia adelante y atrás.', 2),
        (@cat, N'6.3', N'Probar desplazamiento lateral.', 3),
        (@cat, N'6.4', N'Verificar ausencia de ruidos anormales.', 4),
        (@cat, N'6.5', N'Comprobar bloqueo de válvulas.', 5),
        (@cat, N'6.6', N'Verificar motor y bomba hidráulica.', 6),
        (@cat, N'6.7', N'Inspeccionar empaques, sellos y gomas.', 7);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 7, N'DIRECCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'7.1', N'Verificar funcionamiento del sistema de dirección.', 1);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 8, N'FRENOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'8.1', N'Verificar freno de servicio.', 1),
        (@cat, N'8.2', N'Comprobar funcionamiento del freno regenerativo.', 2),
        (@cat, N'8.3', N'Verificar freno de estacionamiento.', 3),
        (@cat, N'8.4', N'Comprobar altura del pedal.', 4),
        (@cat, N'8.5', N'Verificar condición y nivel del líquido de frenos.', 5);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 9, N'MÁSTIL'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'9.1', N'Verificar ruidos o vibraciones anormales.', 1),
        (@cat, N'9.2', N'Inspeccionar desgaste de canales y rodamientos.', 2),
        (@cat, N'9.3', N'Verificar ajuste de canales y carro porta-horquillas.', 3),
        (@cat, N'9.4', N'Comprobar condición de los cilindros (principal, secundarios e inclinación).', 4),
        (@cat, N'9.5', N'Inspeccionar mangueras, conexiones, poleas y abrazaderas; verificar que no existan fugas.', 5),
        (@cat, N'9.6', N'Verificar cableado, arneses, conectores, tensores y cables de control.', 6),
        (@cat, N'9.7', N'Lubricar cadenas, poleas y deslizadores (block-slides).', 7),
        (@cat, N'9.8', N'Realizar limpieza y engrase del mástil.', 8),
        (@cat, N'9.9', N'Verificar estado de las horquillas.', 9);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 10, N'BATERÍA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'10.1', N'Verificar fijación de la batería.', 1),
        (@cat, N'10.2', N'Inspeccionar caja o cajón de batería.', 2),
        (@cat, N'10.3', N'Verificar conector de batería.', 3),
        (@cat, N'10.4', N'Comprobar cables de potencia y comunicación.', 4),
        (@cat, N'10.5', N'Verificar sistema poka-yoke.', 5),
        (@cat, N'10.6', N'Comprobar display de la batería.', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 11, N'CHASIS, TAPAS Y CABINA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'11.1', N'Verificar tapas, chapas y bisagras.', 1),
        (@cat, N'11.2', N'Inspeccionar puerta del compartimiento de batería.', 2),
        (@cat, N'11.3', N'Comprobar placa de datos y número económico.', 3),
        (@cat, N'11.4', N'Verificar capacidad de carga y etiqueta de identificación.', 4),
        (@cat, N'11.5', N'Inspeccionar tornillería.', 5),
        (@cat, N'11.6', N'Verificar asiento del operador.', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 12, N'LLANTAS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'12.1', N'Verificar desgaste de llantas.', 1),
        (@cat, N'12.2', N'Inspeccionar condición de los rines.', 2),
        (@cat, N'12.3', N'Comprobar birlos y tuercas.', 3);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 13, N'NIVELES DE ACEITE'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'13.1', N'Verificar nivel y condición del aceite hidráulico.', 1),
        (@cat, N'13.2', N'Verificar nivel y condición del aceite de transmisión.', 2),
        (@cat, N'13.3', N'Comprobar estado de los filtros.', 3);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 14, N'REVISIÓN INTERNA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'14.1', N'Verificar fijación de componentes.', 1),
        (@cat, N'14.2', N'Inspeccionar fusibles.', 2),
        (@cat, N'14.3', N'Comprobar cableado, bornes y arneses eléctricos.', 3),
        (@cat, N'14.4', N'Verificar ventiladores.', 4),
        (@cat, N'14.5', N'Inspeccionar fugas de fluidos.', 5),
        (@cat, N'14.6', N'Comprobar limpieza interna.', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 15, N'LIMPIEZA EXTERIOR'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'15.1', N'Realizar soplado general del equipo.', 1),
        (@cat, N'15.2', N'Aplicar protector para superficies (Armor All o equivalente).', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 16, N'OTROS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'16.1', N'Verificar funcionamiento del sensor de impacto.', 1),
        (@cat, N'16.2', N'Comprobar parámetro de sensibilidad.', 2),
        (@cat, N'16.3', N'Verificar funcionamiento del Fleet Manager y lector de tarjetas.', 3),
        (@cat, N'16.4', N'Comprobar sincronización y transferencia de datos.', 4),
        (@cat, N'16.5', N'Inspeccionar estado de la pintura.', 5),
        (@cat, N'16.6', N'Verificar funcionamiento del cargador.', 6),
        (@cat, N'16.7', N'Comprobar estado de la base del cargador.', 7);
    PRINT CONCAT('Checklist preventivo (montacargas) cargado en el tipo ', @tipo, '.');
    FETCH NEXT FROM c_montacargas INTO @tipo;
END
CLOSE c_montacargas; DEALLOCATE c_montacargas;

-- transpaleta: 15 categorías, 62 actividades (a cada tipo que coincida y aún no tenga checklist)
DECLARE c_transpaleta CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id FROM dbo.TiposVehiculo t WHERE (Nombre LIKE '%transpaleta%' OR Nombre LIKE '%traspaleta%') AND t.FlujoMantenimiento = 'Electrico'
      AND NOT EXISTS (SELECT 1 FROM dbo.ChecklistPreventivoCategorias c WHERE c.TipoVehiculoId = t.Id);
OPEN c_transpaleta;
FETCH NEXT FROM c_transpaleta INTO @tipo;
WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 1, N'DAÑOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'1.1', N'Inspeccionar golpes o daños en el chasis', 1),
        (@cat, N'1.2', N'Registrar observaciones adicionales', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 2, N'PUNTOS DE SEGURIDAD'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'2.1', N'Inspeccionar extintor y su base', 1),
        (@cat, N'2.2', N'Comprobar indicador y nivel de carga de la batería', 2),
        (@cat, N'2.3', N'Probar interruptor de encendido', 3),
        (@cat, N'2.4', N'Verificar funcionamiento del claxon', 4),
        (@cat, N'2.5', N'Comprobar sensor de presencia', 5),
        (@cat, N'2.6', N'Verificar luz trasera', 6),
        (@cat, N'2.7', N'Comprobar torreta', 7),
        (@cat, N'2.8', N'Probar paro de emergencia', 8),
        (@cat, N'2.9', N'Inspeccionar banda o cadena antiestática', 9),
        (@cat, N'2.10', N'Verificar respaldo de carga', 10),
        (@cat, N'2.11', N'Comprobar extintor vigente y recargado', 11),
        (@cat, N'2.12', N'Verificar velocidad programada del equipo', 12);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 3, N'CONTROLES'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'3.1', N'Verificar funcionamiento de la perilla del acelerador', 1),
        (@cat, N'3.2', N'Comprobar funcionamiento de los botones', 2),
        (@cat, N'3.3', N'Realizar prueba de conducción', 3);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 4, N'PANTALLA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'4.1', N'Verificar funcionamiento y condición del display e indicadores', 1),
        (@cat, N'4.2', N'Comprobar códigos de falla activos', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 5, N'TRACCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'5.1', N'Verificar funcionamiento de la tracción (arranque, ruidos, jaloneos y cambio de marcha)', 1);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 6, N'HIDRÁULICO'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'6.1', N'Probar elevación y descenso', 1),
        (@cat, N'6.2', N'Verificar ausencia de ruidos anormales en el sistema hidráulico', 2),
        (@cat, N'6.3', N'Comprobar bloqueo de válvulas', 3),
        (@cat, N'6.4', N'Verificar motor y bomba hidráulica', 4),
        (@cat, N'6.5', N'Inspeccionar mangueras, conexiones, empaques, sellos y gomas', 5);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 7, N'DIRECCIÓN'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'7.1', N'Verificar funcionamiento del sistema de dirección', 1),
        (@cat, N'7.2', N'Comprobar giro libre de la rueda motriz', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 8, N'FRENOS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'8.1', N'Verificar freno de servicio', 1),
        (@cat, N'8.2', N'Comprobar funcionamiento del freno regenerativo', 2),
        (@cat, N'8.3', N'Verificar freno de estacionamiento', 3);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 9, N'BATERÍA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'9.1', N'Verificar fijación de la batería', 1),
        (@cat, N'9.2', N'Inspeccionar caja o cajón de batería', 2),
        (@cat, N'9.3', N'Verificar conector de batería', 3),
        (@cat, N'9.4', N'Comprobar cables de potencia y comunicación', 4),
        (@cat, N'9.5', N'Verificar sistema poka-yoke', 5),
        (@cat, N'9.6', N'Comprobar display de la batería', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 10, N'CHASIS, TAPAS Y CABINA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'10.1', N'Verificar estado de las horquillas', 1),
        (@cat, N'10.2', N'Inspeccionar tapas, chapas y bisagras', 2),
        (@cat, N'10.3', N'Comprobar puerta y sensor del compartimiento de batería', 3),
        (@cat, N'10.4', N'Verificar placa de datos y número económico', 4),
        (@cat, N'10.5', N'Confirmar capacidad de carga y etiqueta de identificación', 5),
        (@cat, N'10.6', N'Inspeccionar tornillería', 6),
        (@cat, N'10.7', N'Verificar piso del operador', 7);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 11, N'LLANTAS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'11.1', N'Verificar desgaste, condición y lubricación de llantas, pernos y baleros', 1);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 12, N'NIVELES DE ACEITE'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'12.1', N'Verificar condición y nivel del aceite de transmisión', 1),
        (@cat, N'12.2', N'Confirmar necesidad de cambio de aceite', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 13, N'REVISIÓN INTERNA'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'13.1', N'Inspeccionar fijación de componentes', 1),
        (@cat, N'13.2', N'Verificar fusibles', 2),
        (@cat, N'13.3', N'Comprobar cables, bornes y arneses', 3),
        (@cat, N'13.4', N'Verificar ventiladores', 4),
        (@cat, N'13.5', N'Inspeccionar fugas de fluidos', 5),
        (@cat, N'13.6', N'Comprobar limpieza interna', 6);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 14, N'LIMPIEZA EXTERIOR'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'14.1', N'Realizar soplado general del equipo', 1),
        (@cat, N'14.2', N'Aplicar protector para superficies (Armor All o equivalente)', 2);
    INSERT INTO dbo.ChecklistPreventivoCategorias (TipoVehiculoId, Numero, Nombre) VALUES (@tipo, 15, N'OTROS'); SET @cat = SCOPE_IDENTITY();
    INSERT INTO dbo.ChecklistPreventivoActividades (CategoriaId, Numero, Descripcion, Orden) VALUES
        (@cat, N'15.1', N'Confirmar aviso o intervalo de mantenimiento', 1),
        (@cat, N'15.2', N'Verificar funcionamiento del sensor de impacto', 2),
        (@cat, N'15.3', N'Comprobar parámetro de sensibilidad', 3),
        (@cat, N'15.4', N'Verificar funcionamiento del Fleet Manager y lector de tarjetas', 4),
        (@cat, N'15.5', N'Comprobar sincronización y transferencia de datos', 5),
        (@cat, N'15.6', N'Inspeccionar estado de la pintura', 6),
        (@cat, N'15.7', N'Verificar funcionamiento del cargador', 7),
        (@cat, N'15.8', N'Comprobar estado de la base del cargador en sitio', 8);
    PRINT CONCAT('Checklist preventivo (transpaleta) cargado en el tipo ', @tipo, '.');
    FETCH NEXT FROM c_transpaleta INTO @tipo;
END
CLOSE c_transpaleta; DEALLOCATE c_transpaleta;
GO

-- ----- Primer preventivo de los equipos eléctricos: fecha de alta + periodicidad (el Administrador lo ajusta) -----
UPDATE v SET ProximoMantenimiento = CAST(DATEADD(DAY, ISNULL(t.FrecuenciaMantenimientoDias, 30), ISNULL(v.UltimoMantenimiento, v.CreatedAt)) AS date)
FROM dbo.Vehiculos v
JOIN dbo.TiposVehiculo t ON t.Id = v.Tipo
WHERE t.FlujoMantenimiento = 'Electrico' AND v.ProximoMantenimiento IS NULL;
PRINT CONCAT('Equipos eléctricos con próximo preventivo calculado: ', @@ROWCOUNT, '.');
GO
