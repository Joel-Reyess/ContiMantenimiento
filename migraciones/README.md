# migraciones — Poner tu base de datos al día (SQL manual)

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
