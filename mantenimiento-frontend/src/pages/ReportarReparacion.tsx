import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Save, Eraser, ClipboardList, AlertCircle } from 'lucide-react';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';
import { catalogosService, vehicleImagePointsService } from '@/services';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import type { VehicleImagePoint } from '@/interfaces';
import { cn, formatCurrency, getFullImageUrl } from '@/lib/utils';

// ---------------------------------------------------------------------------
// FASE 1 - Solo frontend. Los precios son FICTICIOS y viven en el navegador
// (localStorage). En la Fase 2 se conectan al backend (columna CostoUnitario
// en ImageFaults + CostoAplicado en ReportImageFaults) y el IVA a
// ConfiguracionSistema. Nada de esta pantalla toca la base de datos todavia.
// ---------------------------------------------------------------------------

const IVA_RATE = 0.16;
const PRICE_STORAGE_KEY = 'reparacion_precios_ficticios';
const DEFAULT_PRICE = 500;

/** Precios ficticios guardados por actividad (imageFaultId -> precio). */
function loadStoredPrices(): Record<number, number> {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

interface ActivityRow {
  point: VehicleImagePoint;
  numero: number;
  faultId: number;
  nombre: string;
}

export function ReportarReparacionPage() {
  const [tipos, setTipos] = useState<TipoVehiculoItem[]>([]);
  const [selectedTipoId, setSelectedTipoId] = useState<number | null>(null);
  const [points, setPoints] = useState<VehicleImagePoint[]>([]);
  const [selectedPointIds, setSelectedPointIds] = useState<number[]>([]);
  const [prices, setPrices] = useState<Record<number, number>>(loadStoredPrices);
  const [search, setSearch] = useState('');
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [error, setError] = useState('');

  // Cargar los 12 modelos al entrar
  useEffect(() => {
    (async () => {
      setLoadingTipos(true);
      try {
        const res = await catalogosService.getTiposVehiculo();
        if (res.success && res.data) {
          const activos = res.data.filter((t) => t.activo);
          setTipos(activos);
          if (activos.length > 0) setSelectedTipoId(activos[0].id);
        } else {
          setError('No se pudieron cargar los modelos de contenedor.');
        }
      } catch {
        setError('No se pudieron cargar los modelos de contenedor.');
      } finally {
        setLoadingTipos(false);
      }
    })();
  }, []);

  const selectedTipo = useMemo(
    () => tipos.find((t) => t.id === selectedTipoId),
    [tipos, selectedTipoId]
  );

  // Cargar los puntos (actividades) del modelo seleccionado
  useEffect(() => {
    if (!selectedTipoId) {
      setPoints([]);
      return;
    }
    (async () => {
      setLoadingPoints(true);
      setSelectedPointIds([]);
      try {
        const res = await vehicleImagePointsService.getAll({
          imageKey: `tipo_${selectedTipoId}`,
          onlyActive: true,
        });
        setPoints(res.success && res.data ? res.data : []);
      } catch {
        setPoints([]);
      } finally {
        setLoadingPoints(false);
      }
    })();
  }, [selectedTipoId]);

  const imageUrl = useMemo(
    () => (selectedTipo?.imagenFallasUrl ? getFullImageUrl(selectedTipo.imagenFallasUrl) : undefined),
    [selectedTipo]
  );

  // Numeramos los puntos 1..N (en Fase 2 vendra de VehicleImagePoint.Numero)
  const activities = useMemo<ActivityRow[]>(() => {
    return [...points]
      .sort((a, b) => a.id - b.id)
      .map((point, idx) => ({
        point,
        numero: idx + 1,
        faultId: point.imageFaultId,
        nombre: point.imageFaultName || `Actividad #${point.imageFaultId}`,
      }));
  }, [points]);

  const pointNumbers = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    activities.forEach((a) => {
      map[a.point.id] = a.numero;
    });
    return map;
  }, [activities]);

  const priceFor = (faultId: number) => prices[faultId] ?? DEFAULT_PRICE;

  const setPriceFor = (faultId: number, value: number) => {
    setPrices((prev) => {
      const next = { ...prev, [faultId]: value };
      try {
        localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const togglePoint = (point: VehicleImagePoint) => {
    setSelectedPointIds((prev) =>
      prev.includes(point.id) ? prev.filter((id) => id !== point.id) : [...prev, point.id]
    );
  };

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) => a.nombre.toLowerCase().includes(q) || String(a.numero) === q
    );
  }, [activities, search]);

  const selectedActivities = useMemo(
    () => activities.filter((a) => selectedPointIds.includes(a.point.id)),
    [activities, selectedPointIds]
  );

  const subtotal = useMemo(
    () => selectedActivities.reduce((sum, a) => sum + priceFor(a.faultId), 0),
    [selectedActivities, prices]
  );
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  const handleGuardar = () => {
    // FASE 1: aun no persiste. Mostramos el resumen que se enviaria en Fase 2.
    const payload = {
      tipoVehiculoId: selectedTipoId,
      modelo: selectedTipo?.nombre,
      actividades: selectedActivities.map((a) => ({
        imageFaultId: a.faultId,
        vehicleImagePointId: a.point.id,
        numero: a.numero,
        nombre: a.nombre,
        costoAplicado: priceFor(a.faultId),
      })),
      subtotal,
      iva,
      total,
    };
    console.log('[Reparacion] Payload Fase 2 (pendiente conectar backend):', payload);
    alert(
      `Reporte listo (demo Fase 1)\n\n` +
        `Modelo: ${selectedTipo?.nombre ?? '-'}\n` +
        `Actividades: ${selectedActivities.length}\n` +
        `Total: ${formatCurrency(total)}\n\n` +
        `Aun no se guarda en la base. En la Fase 2 se conecta el backend.`
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      {/* Encabezado */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-continental-black">Reportar Falla / Reparación</h1>
        <p className="text-sm text-continental-gray-1">
          Selecciona en el contenedor las actividades que se van a realizar para calcular el costo
          total de la reparación.
        </p>
      </div>

      {/* Selector de modelo */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-continental-black">Modelo de contenedor:</label>
        <select
          className="min-w-[240px] rounded-lg border border-continental-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-continental-blue-dark"
          value={selectedTipoId ?? ''}
          onChange={(e) => setSelectedTipoId(Number(e.target.value))}
          disabled={loadingTipos}
        >
          {loadingTipos && <option>Cargando modelos…</option>}
          {!loadingTipos &&
            tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
        </select>
        <span className="rounded-full bg-continental-gray-4 px-3 py-1 text-xs font-medium text-continental-gray-1">
          Precios ficticios (Fase 1) — editables y se guardan en este navegador
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-continental-red/40 bg-continental-red/10 px-3 py-2 text-sm text-continental-red">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Layout de 3 paneles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr_minmax(300px,380px)]">
        {/* ---------- Panel izquierdo: actividades disponibles ---------- */}
        <section className="rounded-xl border border-continental-gray-3/70 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-continental-gray-1">
            Actividades disponibles
          </h2>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-continental-gray-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar actividad"
              className="w-full rounded-lg border border-continental-gray-3 py-2 pl-9 pr-3 text-sm outline-none focus:border-continental-blue-dark"
            />
          </div>

          <div className="grid grid-cols-[28px_1fr_auto] gap-2 border-b border-continental-gray-3 pb-1 text-[11px] font-semibold uppercase text-continental-gray-2">
            <span>#</span>
            <span>Actividad</span>
            <span className="text-right">Costo</span>
          </div>

          <div className="max-h-[520px] divide-y divide-continental-gray-4 overflow-y-auto">
            {loadingPoints && (
              <p className="py-4 text-sm italic text-continental-gray-1">Cargando actividades…</p>
            )}
            {!loadingPoints && filteredActivities.length === 0 && (
              <p className="py-4 text-sm italic text-continental-gray-1">
                Este modelo aún no tiene actividades configuradas.
              </p>
            )}
            {filteredActivities.map((a) => {
              const selected = selectedPointIds.includes(a.point.id);
              return (
                <button
                  key={a.point.id}
                  onClick={() => togglePoint(a.point)}
                  className={cn(
                    'grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 py-2 text-left text-sm transition-colors',
                    selected ? 'bg-continental-yellow/10' : 'hover:bg-continental-gray-4/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold',
                      selected
                        ? 'bg-continental-yellow text-continental-blue-dark'
                        : 'bg-continental-gray-3/50 text-continental-gray-1'
                    )}
                  >
                    {a.numero}
                  </span>
                  <span className={cn('truncate', selected && 'font-semibold')}>{a.nombre}</span>
                  <span className="whitespace-nowrap text-right font-medium text-continental-gray-1">
                    {formatCurrency(priceFor(a.faultId))}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedPointIds.length > 0 && (
            <button
              onClick={() => setSelectedPointIds([])}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-continental-gray-3 py-2 text-sm text-continental-gray-1 hover:bg-continental-gray-4"
            >
              <Eraser className="h-4 w-4" /> Limpiar selección
            </button>
          )}
        </section>

        {/* ---------- Panel central: imagen interactiva ---------- */}
        <section className="rounded-xl border border-continental-gray-3/70 bg-white p-4">
          <h2 className="text-center text-lg font-bold uppercase tracking-wide text-continental-black">
            {selectedTipo?.nombre ?? 'Contenedor'}
          </h2>
          <p className="mb-2 text-center text-xs text-continental-gray-1">
            Haz clic en un número del contenedor para seleccionar la actividad correspondiente.
          </p>
          <InteractiveVehicleImage
            imageUrl={imageUrl}
            points={points}
            selectedPointIds={selectedPointIds}
            onTogglePoint={togglePoint}
            pointNumbers={pointNumbers}
            showPointLabels={false}
            emptyMessage="Este modelo aún no tiene puntos configurados sobre la imagen."
          />
        </section>

        {/* ---------- Panel derecho: seleccionadas + costos ---------- */}
        <section className="space-y-4">
          {/* Actividades seleccionadas */}
          <div className="rounded-xl border border-continental-gray-3/70 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-continental-gray-1">
              Actividades seleccionadas ({selectedActivities.length})
            </h2>
            {selectedActivities.length === 0 && (
              <p className="py-3 text-sm italic text-continental-gray-1">
                Aún no seleccionas actividades. Haz clic en los números de la imagen o en la lista.
              </p>
            )}
            <div className="space-y-2">
              {selectedActivities.map((a) => (
                <div key={a.point.id} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-continental-yellow text-xs font-bold text-continental-blue-dark">
                    {a.numero}
                  </span>
                  <span className="flex-1 truncate text-sm">{a.nombre}</span>
                  <div className="flex items-center rounded-md border border-continental-gray-3 px-2">
                    <span className="text-xs text-continental-gray-2">$</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={priceFor(a.faultId)}
                      onChange={(e) => setPriceFor(a.faultId, Number(e.target.value) || 0)}
                      className="w-20 py-1 text-right text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    onClick={() => togglePoint(a.point)}
                    title="Quitar"
                    className="text-continental-gray-2 hover:text-continental-red"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen de costos */}
          <div className="rounded-xl border border-continental-gray-3/70 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-continental-gray-1">
              Resumen de costos
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-continental-gray-1">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-continental-gray-1">IVA (16%)</span>
                <span className="font-medium">{formatCurrency(iva)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-continental-yellow/20 px-3 py-2">
                <span className="font-bold text-continental-black">TOTAL</span>
                <span className="text-lg font-bold text-continental-black">
                  {formatCurrency(total)} <span className="text-xs font-medium">MXN</span>
                </span>
              </div>
            </div>
          </div>

          {/* Detalle */}
          {selectedActivities.length > 0 && (
            <div className="rounded-xl border border-continental-gray-3/70 bg-white p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-continental-gray-1">
                Detalle de la reparación
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-continental-gray-1">
                {selectedActivities.map((a) => (
                  <li key={a.point.id}>{a.nombre}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleGuardar}
            disabled={selectedActivities.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-continental-yellow py-3 font-semibold text-continental-blue-dark shadow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-5 w-5" /> Guardar y Reportar
          </button>

          <p className="flex items-start gap-1.5 text-[11px] text-continental-gray-2">
            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Los costos mostrados son estimados (ficticios en Fase 1). Se guardan solo en este
            navegador hasta conectar el backend.
          </p>
        </section>
      </div>
    </div>
  );
}

export default ReportarReparacionPage;
