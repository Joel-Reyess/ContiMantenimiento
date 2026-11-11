import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ListChecks, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, Input, SearchableSelect, Select, useConfirm, useToast } from '@/components/ui';
import type { SearchableSelectOption } from '@/components/ui';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';
import { catalogosService, vehicleImagePointsService } from '@/services';
import { checklistService, type ChecklistItem } from '@/services/checklistService';
import { nombreActividad, sugerirActividad } from '@/lib/componentesActividades';
import type { VehicleImagePoint, VehicleImagePointCreateRequest, VehicleImagePointUpdateRequest } from '@/interfaces';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import { getFullImageUrl } from '@/lib/utils';

import { VolverConfiguracion } from '@/components/configuracion/VolverConfiguracion';
const DEFAULT_RADIUS = 1.8;

const moneda = (n?: number | null) => `$${(Number(n) || 0).toFixed(2)}`;

/**
 * FV-03 (documento del 11-nov): Fallas visuales = actividades del checklist ubicadas en la foto del tipo de vehículo.
 * Las actividades (título, descripción y costo) se capturan una sola vez en Configuración → Checklists; aquí solo se
 * elige una actividad, se ubica en la foto y se ajusta su posición. Los reportes la toman de aquí automáticamente.
 */
export function FallasImagenPage() {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [tiposVehiculo, setTiposVehiculo] = useState<TipoVehiculoItem[]>([]);
  const [vehicleImagePoints, setVehicleImagePoints] = useState<VehicleImagePoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState('');
  // Resultado del editor de puntos: se muestra junto al botón de guardar, donde el usuario está trabajando (13.1)
  const [pointMsg, setPointMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const savingPointRef = useRef(false);

  const [selectedTipoVehiculoId, setSelectedTipoVehiculoId] = useState(searchParams.get('tipo') || '');
  const [imageKey, setImageKey] = useState('');
  const [selectedActividadId, setSelectedActividadId] = useState('');
  // Cambia para limpiar el buscador de actividades después de guardar
  const [buscadorVersion, setBuscadorVersion] = useState(0);

  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [draftXPct, setDraftXPct] = useState('');
  const [draftYPct, setDraftYPct] = useState('');
  const [draftRadiusPct, setDraftRadiusPct] = useState(String(DEFAULT_RADIUS));
  const [fallbackImageUpload, setFallbackImageUpload] = useState<File | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());
  // Actividades del checklist del tipo (null = cargando; [] y sinChecklist = el tipo no tiene checklist)
  const [actividades, setActividades] = useState<ChecklistItem[] | null>(null);
  const [sinChecklist, setSinChecklist] = useState(false);
  // Actividad elegida para ligar cada punto "Sin actividad"
  const [ligarA, setLigarA] = useState<Record<number, string>>({});

  const selectedTipo = useMemo(
    () => tiposVehiculo.find((t) => t.id === Number(selectedTipoVehiculoId)),
    [tiposVehiculo, selectedTipoVehiculoId]
  );
  const selectedImageUrl = useMemo(() => {
    // Solo la imagen de fallas del tipo (imagenFallasUrl); la foto general puede ser de otro modelo
    const path = selectedTipo?.imagenFallasUrl;
    if (!path) return undefined;
    const full = getFullImageUrl(path);
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}v=${imageVersion}`;
  }, [selectedTipo, imageVersion]);

  const listaActividades = actividades ?? [];
  const actividadPorId = useMemo(() => new Map(listaActividades.map((a) => [a.id, a])), [listaActividades]);
  const selectedActividad = actividadPorId.get(Number(selectedActividadId));
  const puntosPorActividad = useMemo(() => {
    const m = new Map<number, number>();
    vehicleImagePoints.forEach((p) => {
      if (!p.sinActividad && p.checklistItemId) m.set(p.checklistItemId, (m.get(p.checklistItemId) ?? 0) + 1);
    });
    return m;
  }, [vehicleImagePoints]);
  const pendientes = vehicleImagePoints.filter((p) => p.sinActividad);
  const sugeridas = pendientes
    .map((p) => ({ punto: p, actividad: sugerirActividad(p, listaActividades) }))
    .filter((x): x is { punto: VehicleImagePoint; actividad: ChecklistItem } => !!x.actividad);
  const sinUbicar = listaActividades.filter((a) => !puntosPorActividad.has(a.id));

  const cargarActividades = useCallback(async (tipoId: number) => {
    setActividades(null);
    setSinChecklist(false);
    try {
      const r = await checklistService.getPorTipo(tipoId);
      const items = r.success && r.data ? r.data.items || [] : [];
      setSinChecklist(!(r.success && r.data));
      setActividades(items);
    } catch (err) {
      console.error(err);
      setActividades([]);
    }
  }, []);

  useEffect(() => {
    const tipoId = Number(selectedTipoVehiculoId);
    setSelectedActividadId('');
    setLigarA({});
    if (!tipoId) {
      setActividades([]);
      setSinChecklist(false);
      return;
    }
    void cargarActividades(tipoId);
  }, [selectedTipoVehiculoId, cargarActividades]);

  const resetPointDraft = () => {
    setEditingPointId(null);
    setDraftXPct('');
    setDraftYPct('');
    setDraftRadiusPct(String(DEFAULT_RADIUS));
    setSelectedActividadId('');
    setBuscadorVersion((v) => v + 1);
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const tiposRes = await catalogosService.getTiposVehiculo();
      if (tiposRes.success && tiposRes.data) setTiposVehiculo(tiposRes.data);
      else setTiposVehiculo([]);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la configuración de fallas visuales.');
    } finally {
      setLoading(false);
    }
  };

  const loadPoints = async (key: string) => {
    if (!key.trim()) {
      setVehicleImagePoints([]);
      return;
    }
    setLoadingPoints(true);
    try {
      const res = await vehicleImagePointsService.getAll({ imageKey: key.trim(), onlyActive: false });
      setVehicleImagePoints(res.success && res.data ? res.data : []);
    } catch (err) {
      console.error(err);
      setVehicleImagePoints([]);
    } finally {
      setLoadingPoints(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTipoVehiculoId) {
      setImageKey('');
      return;
    }
    setImageKey(`tipo_${selectedTipoVehiculoId}`);
    setImageVersion(Date.now());
    resetPointDraft();
    setPointMsg(null);
  }, [selectedTipoVehiculoId]);

  useEffect(() => {
    if (!imageKey) {
      setVehicleImagePoints([]);
      return;
    }
    void loadPoints(imageKey);
  }, [imageKey]);

  const recargar = async () => {
    await loadInitialData();
    if (selectedTipoVehiculoId) await cargarActividades(Number(selectedTipoVehiculoId));
    if (imageKey) await loadPoints(imageKey);
  };

  // Buscador de actividades del checklist del tipo: título, descripción y costo
  const opcionActividad = useCallback(
    (a: ChecklistItem): SearchableSelectOption => {
      const titulo = nombreActividad(a);
      const partes = [titulo !== a.pregunta ? a.pregunta : '', moneda(a.costoEstimado)];
      const veces = puntosPorActividad.get(a.id);
      if (veces) partes.push(`ya en la foto${veces > 1 ? ` (${veces})` : ''}`);
      return { value: a.id, label: titulo, description: partes.filter(Boolean).join(' · ') };
    },
    [puntosPorActividad]
  );
  const buscarActividades = useCallback(
    async (texto: string) => {
      const t = texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
      const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      // Al abrir con una actividad elegida el buscador trae su nombre: se muestran todas
      const filtrar = t && !(selectedActividad && norm(nombreActividad(selectedActividad)) === t);
      return listaActividades
        .filter((a) => !filtrar || norm(`${a.titulo || ''} ${a.pregunta}`).includes(t))
        .map(opcionActividad);
    },
    [listaActividades, opcionActividad, selectedActividad]
  );

  const parsePct = (value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    if (num < 0 || num > 100) return null;
    return Number(num.toFixed(2));
  };

  const draftPointPreview = (() => {
    const x = parsePct(draftXPct);
    const y = parsePct(draftYPct);
    if (x === null || y === null) return null;
    const parsedRadius = parsePct(draftRadiusPct || String(DEFAULT_RADIUS));
    return { xPct: x, yPct: y, radiusPct: parsedRadius === null ? DEFAULT_RADIUS : parsedRadius };
  })();

  const draftPointLabel = selectedActividad ? nombreActividad(selectedActividad) : editingPointId ? 'Punto en edición' : '';

  const handleImageClick = (xPct: number, yPct: number) => {
    setDraftXPct(String(xPct));
    setDraftYPct(String(yPct));
  };

  const nombrePunto = (p: VehicleImagePoint) => p.actividadTitulo || p.imageFaultName || `Punto #${p.id}`;

  const handleSavePoint = async () => {
    if (savingPointRef.current) return;
    setPointMsg(null);
    if (!imageKey.trim()) {
      setPointMsg({ tipo: 'error', texto: 'Selecciona el tipo de vehículo.' });
      return;
    }
    const editando = editingPointId ? vehicleImagePoints.find((p) => p.id === editingPointId) : undefined;
    if (!selectedActividad && !(editando && !editando.sinActividad)) {
      setPointMsg({ tipo: 'error', texto: 'Elige la actividad del checklist que vas a ubicar en la foto.' });
      return;
    }

    const x = parsePct(draftXPct);
    const y = parsePct(draftYPct);
    const r = parsePct(draftRadiusPct || String(DEFAULT_RADIUS));
    if (x === null || y === null || r === null) {
      setPointMsg({ tipo: 'error', texto: 'Haz clic en la imagen para colocar el punto (o escribe X, Y y radio entre 0 y 100).' });
      return;
    }

    // Duplicados y superposición con los puntos ya guardados en esta imagen (13.1)
    const actividadId = selectedActividad?.id ?? editando?.checklistItemId ?? undefined;
    const otros = vehicleImagePoints.filter((p) => p.id !== editingPointId);
    const mismaActividad = otros.filter((p) => !p.sinActividad && p.checklistItemId === actividadId);
    const encimados = otros.filter((p) => Math.hypot(p.xPct - x, p.yPct - y) < r + (p.radiusPct ?? DEFAULT_RADIUS));
    if (mismaActividad.length > 0 || encimados.length > 0) {
      const ok = await confirmar({
        titulo: 'Revisa el punto antes de guardar',
        mensaje: (
          <div className="space-y-2">
            {mismaActividad.length > 0 && <p>Esta actividad ya está ubicada {mismaActividad.length} vez/veces en la foto.</p>}
            {encimados.length > 0 && <p>El punto se encima con: {encimados.map(nombrePunto).join(', ')}.</p>}
            <p>¿Guardarlo de todos modos?</p>
          </div>
        ),
        textoConfirmar: 'Guardar de todos modos',
        tono: 'advertencia'
      });
      if (!ok) return;
    }

    savingPointRef.current = true;
    setSavingPoint(true);
    setError('');
    try {
      if (editingPointId) {
        if (!editando) throw new Error('El punto que estabas editando ya no existe.');
        const payload: VehicleImagePointUpdateRequest = {
          id: editingPointId,
          imageKey: imageKey.trim(),
          xPct: x,
          yPct: y,
          radiusPct: r,
          checklistItemId: selectedActividad?.id,
          // Sin "Desactivar" (13.1.1): al guardar, un punto que estaba oculto vuelve a mostrarse en los reportes
          active: true
        };
        const res = await vehicleImagePointsService.update(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo actualizar el punto.');
        setPointMsg({ tipo: 'ok', texto: 'Punto actualizado correctamente.' });
        toast.exito('Punto actualizado');
      } else {
        const payload: VehicleImagePointCreateRequest = {
          imageKey: imageKey.trim(),
          xPct: x,
          yPct: y,
          radiusPct: r,
          checklistItemId: selectedActividad!.id,
          active: true
        };
        const res = await vehicleImagePointsService.create(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo guardar el punto.');
        setPointMsg({ tipo: 'ok', texto: `"${nombreActividad(selectedActividad!)}" ubicada en la foto.` });
        toast.exito('Actividad ubicada en la foto');
      }
      resetPointDraft();
      await loadPoints(imageKey.trim());
    } catch (err: any) {
      setPointMsg({ tipo: 'error', texto: err.message || 'Error al guardar el punto.' });
    } finally {
      savingPointRef.current = false;
      setSavingPoint(false);
    }
  };

  const ligar = async (point: VehicleImagePoint, actividadId: number, silencioso = false) => {
    const res = await vehicleImagePointsService.ligarActividad(point.id, actividadId);
    if (!res.success) {
      toast.error(res.message || 'No se pudo ligar la actividad');
      return false;
    }
    if (!silencioso) toast.exito(res.message || 'Actividad ligada');
    return true;
  };

  const ligarPendiente = async (point: VehicleImagePoint) => {
    const valor = ligarA[point.id] ?? String(sugerirActividad(point, listaActividades)?.id ?? '');
    if (!valor) {
      toast.error('Elige la actividad para este punto.');
      return;
    }
    if (await ligar(point, Number(valor))) await loadPoints(point.imageKey);
  };

  const ligarSugeridas = async () => {
    const ok = await confirmar({
      titulo: 'Ligar las sugeridas',
      mensaje: (
        <div className="space-y-2">
          <p>Cada punto se ligará con la actividad que se le parece por nombre:</p>
          <ul className="list-disc pl-5 text-sm">
            {sugeridas.map((s) => (
              <li key={s.punto.id}>
                {s.punto.imageFaultName} → {nombreActividad(s.actividad)}
              </li>
            ))}
          </ul>
        </div>
      ),
      textoConfirmar: 'Ligar',
      tono: 'advertencia'
    });
    if (!ok) return;
    let ligados = 0;
    for (const s of sugeridas) if (await ligar(s.punto, s.actividad.id, true)) ligados++;
    toast.exito(`${ligados} punto(s) ligado(s)`);
    await loadPoints(imageKey);
  };

  const handleDeletePoint = async (point: VehicleImagePoint) => {
    const ok = await confirmar({
      titulo: 'Eliminar punto',
      mensaje: `¿Quitar "${nombrePunto(point)}" de la foto? La actividad sigue en el checklist. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    const res = await vehicleImagePointsService.delete(point.id);
    if (!res.success) {
      setPointMsg({ tipo: 'error', texto: res.message || 'No se pudo eliminar el punto.' });
      toast.error(res.message || 'No se pudo eliminar el punto.');
      return;
    }
    if (editingPointId === point.id) resetPointDraft();
    setPointMsg({ tipo: 'ok', texto: 'Punto eliminado.' });
    toast.exito('Punto eliminado');
    await loadPoints(point.imageKey);
  };

  const handleUploadImageFallas = async () => {
    if (!selectedTipo || !fallbackImageUpload) {
      toast.error('Selecciona el tipo de vehículo y el archivo de imagen.');
      return;
    }
    setUploadingImage(true);
    setError('');
    try {
      const res = await catalogosService.uploadImagenFallasTipoVehiculo(selectedTipo.id, fallbackImageUpload);
      if (!res.success) throw new Error(res.message || 'No se pudo subir imagen de fallas.');
      toast.exito('Imagen de fallas subida correctamente');
      setFallbackImageUpload(null);
      setImageVersion(Date.now());
      await loadInitialData();
    } catch (err: any) {
      toast.error(err.message || 'Error al subir imagen de fallas.');
    } finally {
      setUploadingImage(false);
    }
  };

  const tipoListo = !!selectedTipoVehiculoId && actividades !== null;

  return (
    <div className="dashboard-wrapper space-y-5">
      <VolverConfiguracion />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuración visual</p>
          <h1 className="text-3xl font-semibold text-continental-black">Fallas visuales</h1>
          <p className="text-sm text-continental-gray-1" style={{ marginBottom: 0 }}>
            Ubica en la foto de cada tipo de vehículo las actividades de su checklist. Las actividades (título, descripción y
            costo) se crean una sola vez en <Link to="/configuracion/checklists" className="underline">Checklists</Link>.
          </p>
        </div>
        <Button variant="outline" onClick={() => void recargar()} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </Card>
      )}

      {loading ? (
        <Card className="p-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando configuración...
        </Card>
      ) : (
        <Card className="p-5 flex flex-col gap-4" data-testid="editor-hotspots">
          <h2 className="text-lg font-semibold text-continental-black">Editor de hotspots</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Tipo de vehículo"
              value={selectedTipoVehiculoId}
              onChange={(value) => setSelectedTipoVehiculoId(value)}
              options={[{ value: '', label: 'Seleccionar' }, ...tiposVehiculo.map((t) => ({ value: String(t.id), label: t.nombre }))]}
            />
            <div data-testid="selector-actividad">
              <SearchableSelect
                key={`${selectedTipoVehiculoId}-${buscadorVersion}`}
                label="Actividad del checklist"
                placeholder={
                  !selectedTipoVehiculoId
                    ? 'Primero elige el tipo de vehículo'
                    : listaActividades.length === 0
                      ? 'Este tipo no tiene actividades en su checklist'
                      : 'Busca por título o descripción'
                }
                disabled={!tipoListo || listaActividades.length === 0}
                selected={selectedActividad ? opcionActividad(selectedActividad) : null}
                fetchOptions={buscarActividades}
                onSelect={(o) => {
                  setSelectedActividadId(o ? String(o.value) : '');
                  setPointMsg(null);
                }}
                noResultsText="Ninguna actividad del checklist coincide"
              />
            </div>
          </div>

          {selectedTipoVehiculoId && actividades !== null && (sinChecklist || listaActividades.length === 0) && (
            <Alert variant="warning">
              <AlertDescription>
                {selectedTipo?.nombre || 'Este tipo'} no tiene actividades en su checklist. Créalas en{' '}
                <Link to="/configuracion/checklists" className="font-semibold underline">
                  Configuración → Checklists
                </Link>{' '}
                y vuelve aquí para ubicarlas en la foto.
              </AlertDescription>
            </Alert>
          )}

          {selectedActividad && (
            <p className="text-sm text-continental-gray-1" style={{ marginBottom: 0 }} data-testid="actividad-elegida">
              <strong className="text-continental-black">{nombreActividad(selectedActividad)}</strong>
              {nombreActividad(selectedActividad) !== selectedActividad.pregunta && <> · {selectedActividad.pregunta}</>} ·{' '}
              {moneda(selectedActividad.costoEstimado)}. Haz clic en la foto donde está y guarda el punto.
            </p>
          )}

          <div className="rounded-lg border border-continental-gray-3 flex flex-col gap-3 bg-continental-gray-4/40" style={{ padding: 12 }}>
            <p className="text-sm text-continental-gray-1" style={{ marginBottom: 0 }}>
              Imagen usada para fallas visuales:
              <span className="font-medium text-continental-black" style={{ marginLeft: 4 }}>
                {selectedTipo?.imagenFallasUrl ? 'Personalizada (fallas)' : 'No hay imagen de fallas configurada'}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <input type="file" accept="image/*" onChange={(e) => setFallbackImageUpload(e.target.files?.[0] || null)} className="block text-sm" />
              <Button
                onClick={handleUploadImageFallas}
                disabled={!selectedTipoVehiculoId || !fallbackImageUpload || uploadingImage}
                className="flex items-center gap-2"
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Subir imagen de fallas
              </Button>
            </div>
          </div>

          {pendientes.length > 0 && (
            <Alert variant="warning" data-testid="aviso-sin-actividad">
              <AlertDescription>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {pendientes.length} punto(s) <strong>sin actividad</strong>: no aparecen en los reportes hasta que elijas su
                    actividad del checklist (abajo, en la lista de puntos).
                  </span>
                  {sugeridas.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => void ligarSugeridas()}>
                      Ligar sugeridas ({sugeridas.length})
                    </Button>
                  )}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Imagen a la izquierda, puntos a la derecha */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <InteractiveVehicleImage
                imageUrl={selectedImageUrl}
                points={vehicleImagePoints.filter((p) => p.active)}
                selectedPointIds={editingPointId ? [editingPointId] : []}
                onImageClick={handleImageClick}
                draftPoint={draftPointPreview || undefined}
                draftPointLabel={draftPointLabel}
                readonly={false}
                className="w-full"
                emptyMessage="Aún no hay actividades ubicadas en esta imagen."
              />

              <div className="rounded-md border border-blue-200 bg-blue-50 text-xs text-continental-blue-dark" style={{ padding: '8px 12px' }}>
                <p className="font-medium" style={{ marginBottom: 0 }}>
                  Vista previa: X {draftPointPreview?.xPct ?? '--'}% · Y {draftPointPreview?.yPct ?? '--'}% · R{' '}
                  {draftPointPreview?.radiusPct ?? DEFAULT_RADIUS}%
                </p>
                <p className="mt-1 text-continental-gray-1" style={{ marginBottom: 0 }}>Elige la actividad y haz clic en la imagen para colocar o mover el punto.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="X (%)" value={draftXPct} onChange={(e) => setDraftXPct(e.target.value)} />
                <Input label="Y (%)" value={draftYPct} onChange={(e) => setDraftYPct(e.target.value)} />
                <Input label="Radio (%)" value={draftRadiusPct} onChange={(e) => setDraftRadiusPct(e.target.value)} />
                <div className="col-span-full flex flex-wrap items-end justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={handleSavePoint}
                    disabled={savingPoint || loadingPoints || !tipoListo}
                    className="!min-h-10 px-4 py-2 w-full sm:w-auto"
                  >
                    {savingPoint ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPointId ? 'Actualizar punto' : 'Guardar punto'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetPointDraft();
                      setPointMsg(null);
                    }}
                    className="!min-h-10 px-4 py-2 w-full sm:w-auto"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {pointMsg && (
                <div
                  role={pointMsg.tipo === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    pointMsg.tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                  style={{ padding: '8px 12px' }}
                >
                  {pointMsg.tipo === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <span>{pointMsg.texto}</span>
                </div>
              )}

              <div className="rounded-lg border border-continental-gray-3 bg-white" data-testid="puntos-configurados">
                <div className="flex items-center justify-between border-b border-continental-gray-3 bg-continental-gray-4/40" style={{ padding: '8px 12px' }}>
                  <p className="text-sm font-medium text-continental-black" style={{ marginBottom: 0 }}>Actividades en la foto ({vehicleImagePoints.length})</p>
                  {loadingPoints && <Loader2 className="h-4 w-4 animate-spin text-continental-gray-1" />}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {vehicleImagePoints.length === 0 ? (
                    <p className="text-sm text-continental-gray-1" style={{ padding: 12, marginBottom: 0 }}>
                      {selectedTipoVehiculoId ? 'Aún no hay actividades ubicadas en esta imagen.' : 'Elige el tipo de vehículo.'}
                    </p>
                  ) : (
                    vehicleImagePoints.map((point) => {
                      const sugerida = point.sinActividad ? sugerirActividad(point, listaActividades) : undefined;
                      const valorLigar = ligarA[point.id] ?? (sugerida ? String(sugerida.id) : '');
                      return (
                        <div
                          key={point.id}
                          data-testid={`punto-${point.id}`}
                          className={`flex items-start justify-between gap-2 border-b border-continental-gray-3 text-sm last:border-b-0 ${point.sinActividad ? 'bg-amber-50' : ''}`}
                          style={{ padding: '10px 12px' }}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-continental-black" style={{ marginBottom: 2 }}>{nombrePunto(point)}</p>
                            {!point.sinActividad && (
                              <p className="text-xs text-continental-gray-1" style={{ marginBottom: 2 }}>
                                {point.actividadDescripcion && point.actividadDescripcion !== point.actividadTitulo && <>{point.actividadDescripcion} · </>}
                                {moneda(point.actividadCosto)}
                              </p>
                            )}
                            <p className="text-xs text-continental-gray-1" style={{ marginBottom: 0 }}>
                              X: {point.xPct}% · Y: {point.yPct}% · R: {point.radiusPct ?? DEFAULT_RADIUS}%
                              {!point.active && <span className="text-amber-700"> · Oculto (edítalo y guarda para mostrarlo)</span>}
                            </p>
                            {point.sinActividad && (
                              <div className="mt-1 flex flex-col gap-1">
                                <p className="text-xs font-semibold" style={{ color: '#b45309', marginBottom: 0 }}>
                                  Sin actividad: elige la actividad del checklist que corresponde a este punto.
                                </p>
                                {listaActividades.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      aria-label={`Actividad de ${nombrePunto(point)}`}
                                      className="max-w-[260px] rounded border border-continental-gray-3 bg-white text-xs"
                                      style={{ padding: '4px 8px' }}
                                      value={valorLigar}
                                      onChange={(e) => setLigarA((prev) => ({ ...prev, [point.id]: e.target.value }))}
                                    >
                                      <option value="">Elige la actividad…</option>
                                      {listaActividades.map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {nombreActividad(a)}
                                          {sugerida?.id === a.id ? ' (sugerida)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <Button size="sm" variant="outline" disabled={!valorLigar} onClick={() => void ligarPendiente(point)}>
                                      Ligar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPointId(point.id);
                                setSelectedActividadId(!point.sinActividad && point.checklistItemId ? String(point.checklistItemId) : '');
                                setBuscadorVersion((v) => v + 1);
                                setDraftXPct(String(point.xPct));
                                setDraftYPct(String(point.yPct));
                                setDraftRadiusPct(String(point.radiusPct ?? DEFAULT_RADIUS));
                                setPointMsg(null);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              aria-label={`Eliminar punto ${point.id}`}
                              title="Eliminar punto"
                              onClick={() => void handleDeletePoint(point)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {tipoListo && listaActividades.length > 0 && (
                <div className="rounded-lg border border-continental-gray-3 text-xs text-continental-gray-1" style={{ padding: '8px 12px' }} data-testid="sin-ubicar">
                  <p className="flex items-center gap-1 font-medium text-continental-black" style={{ marginBottom: 2 }}>
                    <ListChecks className="h-4 w-4" />
                    Actividades del checklist sin ubicar en la foto: {sinUbicar.length} de {listaActividades.length}
                  </p>
                  {sinUbicar.length > 0 && (
                    <p style={{ marginBottom: 0 }}>
                      {sinUbicar.map(nombreActividad).join(' · ')}. En el reporte salen en "Otras actividades del checklist".
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default FallasImagenPage;
