# migraciones — Poner tu base de datos al día (SQL manual)

## ⭐ Nuevo (oct-2026): flujo de 7 etapas y capacidad de la Zona de Transición
Corre **`16_flujo_7_etapas.sql`** en la base de producción **antes** de publicar la versión nueva de la API.
- Agrega las columnas de inspección (reportes), traslados y aceptación (órdenes), hallazgos del taller,
  la tabla `HistorialFlujo` y la capacidad de cada zona (15 y 15; se cambia en Configuración → Zona de Transición).
- Acomoda lo que ya existe: reportes con orden = validados; reportes sin orden = pendientes de inspección del Líder;
  órdenes abiertas = ya trasladadas; asignadas o más = aceptadas; completadas = ya entregadas en zona de reparados.
- Se puede correr dos veces sin problema (no duplica ni cambia lo ya migrado). Haz respaldo antes.

Después corre **`17_materiales_y_ordenes_pago.sql`** (también antes de publicar la API):
- Tabla `MaterialesOrdenTrabajo` (refacciones y consumibles que el técnico usó en la orden; se descuentan
  del inventario al terminar la reparación) y la columna `OrdenesTrabajo.AplicaGarantia`.
- Las órdenes de pago se generan solas al validar la reparación. Para las órdenes que ya estaban validadas,
  en Control de Pagos aparece el botón "Generar órdenes de pago pendientes".

## ⭐ Nuevo (nov-2026): empresas proveedoras y tarifas por empresa
Corre **`18_proveedores_y_tarifas.sql`** (después del 17) **antes** de publicar la versión nueva de la API.
- Tablas `Empresas` (nombre, RFC/ID único, activa, contacto) y `TarifasEmpresa` (precio de cada actividad del
  checklist para cada empresa; sin tarifa se usa el costo base). Columnas `Users.EmpresaId` (empresa del técnico) y
  `RegistrosPago.EmpresaId` (empresa con cuyas tarifas se generó la orden de pago). Tabla `RegistroPagoActividades`
  (renglones de cada orden de pago nueva, fijos aunque luego cambien las tarifas).
- Acomoda lo que ya existe una sola vez: con el texto "Empresa externa" de los técnicos crea las empresas
  (identificador `EMP-0001`…, cámbialo por el RFC en **Empresas proveedoras**) y liga a cada técnico con la suya;
  las órdenes de pago existentes quedan a nombre de la empresa de su técnico (sus importes no cambian).
- Las órdenes de pago **Pendientes** (o En revisión) dejan de cobrar refacciones: total = total − refacciones.
  Las aprobadas, pagadas o rechazadas no se tocan.
- Se puede correr dos veces sin problema. Haz respaldo antes.
- Después de publicar: captura las tarifas de cada empresa en **Configuración → Checklists** (selector "Tarifario").

## ⭐ Nuevo (06-nov-2026): correcciones de órdenes de trabajo y reporte de falla
Corre **`19_correcciones_06nov.sql`** (después del 18) **antes** de publicar la API:
- Columna `VehicleImagePoints.ChecklistItemId`: la actividad del checklist que genera cada componente de la
  foto al reportarlo (se configura en Fallas visuales → Editor de hotspots; vacía = se liga sola por nombre).
- Recalcula "puede operar" de los reportes sin orden según el tipo de mantenimiento
  (Correctivo = no puede operar, Preventivo = puede operar).

## ⭐ Nuevo (11-nov-2026): datos de equipo por tipo de vehículo
Corre **`20_datos_equipo_por_tipo.sql`** (después del 19) **antes** de publicar la API:
- Columna `TiposVehiculo.PideDatosEquipo`: los vehículos de ese tipo piden Marca, Modelo, Año y Número de serie
  al registrarlos o editarlos. Se activa sola en los tipos con "Tugger" o "Montacargas" en el nombre; después se
  cambia en Configuración → Tipos de vehículo.

## ⭐ Nuevo (11-nov-2026): Fallas visuales = actividades del checklist (FV-03)
Corre **`21_fallas_visuales_actividades.sql`** (después del 20) **antes** de publicar la API:
- Columna `ChecklistItems.Titulo` (título corto del ítem, p. ej. "Rodillos principales"; la descripción sigue igual)
  y `ImageFaults.ChecklistItemId` (falla interna de cada actividad; ya no se capturan fallas a mano).
- Liga sola cada punto de la foto con su actividad cuando hay una única coincidencia en el checklist de su tipo
  (la descripción del componente es la actividad, el nombre es la actividad o su título, o el nombre está dentro de
  la actividad). A esas actividades sin título les pone el nombre del componente.
- Al final imprime cuántos puntos quedan **"Sin actividad"**: no aparecen en los reportes hasta ligarlos en
  **Configuración → Fallas visuales** (cada uno trae un selector con la actividad sugerida y "Ligar sugeridas").
- Se puede correr dos veces sin problema. Haz respaldo antes.

---


Tu base `MantenimientoEquiposDB` está **atrasada** respecto al código del repo.
Le faltan **8 tablas**. Se dividen en dos grupos por la forma correcta de aplicarlas.

> ⚠️ **Haz un respaldo de la base antes de correr cualquier cosa.**

---

## Grupo A — Tablas que SÍ tienen migración de Entity Framework
Estas NO se deben crear a mano, porque sus migraciones también agregan **columnas**
a otras tablas (aprobaciones en `OrdenesTrabajo`, `Cantidad` en `OrdenesTrabajoChecklistItems`, etc.).
Si las creas solo con SQL, tu BD quedaría incompleta y el historial de EF se descuadra.

- `LiderTipoVehiculoAsignaciones`
- `OrdenesCompra`

**Forma correcta (1 comando, en tu máquina):**
```bash
cd MantenimientoAPI/MantenimientoEquipos
dotnet ef database update
```
Esto aplica TODAS las migraciones pendientes y deja tu BD igualita al código.
Ya corres la API en tu local, así que tienes el SDK para esto.

---

## Grupo B — Tablas SIN migración (aquí van las del feature de componentes) ⭐
Estas 6 tablas están declaradas en el código (`DbContext`) pero **nadie generó su migración**,
así que ni `dotnet ef database update` las crea. Estas SÍ hay que crearlas a mano con el SQL de aquí:

| Archivo | Tabla | Para qué |
|---|---|---|
| `01_ImageFaults.sql` | `ImageFaults` | ⭐ Catálogo de componentes/fallas seleccionables |
| `02_VehicleImagePoints.sql` | `VehicleImagePoints` | ⭐ Puntos numerados (X/Y) sobre la foto del carro |
| `03_ReportImageFaults.sql` | `ReportImageFaults` | ⭐ Componentes que eligió cada reporte |
| `04_MetasTecnico.sql` | `MetasTecnico` | Metas mensuales por técnico |
| `05_SolicitudesActividadAdicional.sql` | `SolicitudesActividadAdicional` | Actividades extra en órdenes |
| `06_SolicitudCambios.sql` | `SolicitudCambios` | Solicitudes de cambio de vehículo |

Las 3 marcadas con ⭐ son las que necesita la interfaz de selección de componentes para tablet.

### Cómo aplicarlas
Abre SQL Server Management Studio, selecciona la base `MantenimientoEquiposDB` y:

- **Rápido:** abre `00_TODO_EN_UNO.sql`, cópialo completo y ejecútalo (F5). Crea las 6 en orden correcto.
- **O una por una:** ejecuta del `01` al `06` en ese orden (hay llaves foráneas entre ellas).

Todos los scripts son **idempotentes**: usan `IF NOT EXISTS`, así que si los vuelves a correr no truena ni duplica nada.

---

## Orden recomendado
1. **Respaldo** de la base. ✅ (ya lo estás gestionando)
2. Grupo A → `dotnet ef database update`
3. Grupo B → `00_TODO_EN_UNO.sql`
4. Avísame y sigo con la interfaz de selección de componentes + la carga de los 12 carros.

> Nota técnica: lo ideal a futuro es convertir el Grupo B en una migración de EF de verdad
> (para que el historial quede limpio). Cuando armemos el feature lo dejo bien hecho; este SQL
> es el atajo para que ya puedas avanzar en tu local mientras tanto.
