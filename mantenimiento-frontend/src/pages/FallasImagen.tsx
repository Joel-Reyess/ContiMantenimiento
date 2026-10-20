import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Button, Card, Input, Select, useConfirm, useToast } from '@/components/ui';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';
import { catalogosService, imageFaultsService, vehicleImagePointsService } from '@/services';
import type {
  ImageFault,
  ImageFaultCreateRequest,
  ImageFaultUpdateRequest,
  VehicleImagePoint,
  VehicleImagePointCreateRequest,
  VehicleImagePointUpdateRequest,
} from '@/interfaces';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import { getFullImageUrl } from '@/lib/utils';

import { VolverConfiguracion } from '@/components/configuracion/VolverConfiguracion';
const DEFAULT_RADIUS = 1.8;

type TabType = 'catalogo' | 'hotspots';

export function FallasImagenPage() {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('catalogo');
  const [tiposVehiculo, setTiposVehiculo] = useState<TipoVehiculoItem[]>([]);
  const [imageFaults, setImageFaults] = useState<ImageFault[]>([]);
  const [vehicleImagePoints, setVehicleImagePoints] = useState<VehicleImagePoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [savingFault, setSavingFault] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Resultado del editor de puntos: se muestra junto al botón de guardar, donde el usuario está trabajando (13.1)
  const [pointMsg, setPointMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const savingPointRef = useRef(false);

  const [selectedTipoVehiculoId, setSelectedTipoVehiculoId] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [selectedFaultId, setSelectedFaultId] = useState('');

  const [faultName, setFaultName] = useState('');
  const [faultDescription, setFaultDescription] = useState('');
  const [editingFaultId, setEditingFaultId] = useState<number | null>(null);

  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [draftXPct, setDraftXPct] = useState('');
  const [draftYPct, setDraftYPct] = useState('');
  const [draftRadiusPct, setDraftRadiusPct] = useState(String(DEFAULT_RADIUS));
  const [fallbackImageUpload, setFallbackImageUpload] = useState<File | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());

  const selectedTipo = useMemo(
    () => tiposVehiculo.find((t) => t.id === Number(selectedTipoVehiculoId)),
    [tiposVehiculo, selectedTipoVehiculoId]
  );
  const selectedImageUrl = useMemo(() => {
    // Only use the specific failure container image (imagenFallasUrl)
    // Do NOT fall back to imagenUrl since some models have different associated images
    const path = selectedTipo?.imagenFallasUrl;
    if (!path) return undefined;
    const full = getFullImageUrl(path);
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}v=${imageVersion}`;
  }, [selectedTipo, imageVersion]);

  const resetFaultForm = () => {
    setFaultNameError('');
    setFaultName('');
    setFaultDescription('');
    setEditingFaultId(null);
  };

  const resetPointDraft = () => {
    setEditingPointId(null);
    setDraftXPct('');
    setDraftYPct('');
    setDraftRadiusPct(String(DEFAULT_RADIUS));
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [tiposRes, faultsRes] = await Promise.all([
        catalogosService.getTiposVehiculo(),
        imageFaultsService.getAll(false),
      ]);

      if (tiposRes.success && tiposRes.data) setTiposVehiculo(tiposRes.data);
      else setTiposVehiculo([]);

      if (faultsRes.success && faultsRes.data) setImageFaults(faultsRes.data);
      else setImageFaults([]);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la configuración de fallas por imagen.');
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
      if (res.success && res.data) {
        setVehicleImagePoints(res.data);
      } else {
        setVehicleImagePoints([]);
      }
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
    if (!selectedTipoVehiculoId) return;
    setImageKey(`tipo_${selectedTipoVehiculoId}`);
    setImageVersion(Date.now());
  }, [selectedTipoVehiculoId]);

  useEffect(() => {
    if (!imageKey) {
      setVehicleImagePoints([]);
      return;
    }
    void loadPoints(imageKey);
  }, [imageKey]);

  // Error bajo el campo "Nombre" del catálogo de fallas (antes salía en el aviso de arriba de la página)
  const [faultNameError, setFaultNameError] = useState('');

  const handleSaveFault = async () => {
    if (!faultName.trim()) {
      setFaultNameError('Escribe el nombre de la falla.');
      return;
    }
    setFaultNameError('');
    setSavingFault(true);
    setError('');
    setMessage('');
    try {
      if (editingFaultId) {
        const payload: ImageFaultUpdateRequest = {
          id: editingFaultId,
          name: faultName.trim(),
          description: faultDescription.trim() || undefined,
          // "Desactivar" se quitó (13.1.1): al guardar, una falla que estaba oculta vuelve a estar disponible
          active: true,
        };
        const res = await imageFaultsService.update(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo actualizar la falla.');
        toast.exito('Falla de imagen actualizada');
      } else {
        const payload: ImageFaultCreateRequest = {
          name: faultName.trim(),
          description: faultDescription.trim() || undefined,
          active: true,
        };
        const res = await imageFaultsService.create(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo crear la falla.');
        toast.exito('Falla de imagen creada');
      }
      resetFaultForm();
      const faultsRes = await imageFaultsService.getAll(false);
      if (faultsRes.success && faultsRes.data) setImageFaults(faultsRes.data);
    } catch (err: any) {
      // Junto al formulario: "ya existe" va bajo el nombre; el resto en un aviso visible
      const mensaje = err.message || 'Error al guardar la falla.';
      if (/existe|duplicad|repetid/i.test(mensaje)) setFaultNameError(mensaje);
      else toast.error(mensaje);
    } finally {
      setSavingFault(false);
    }
  };

  const handleDeleteFault = async (fault: ImageFault) => {
    const ok = await confirmar({
      titulo: 'Eliminar falla',
      mensaje: `¿Eliminar la falla "${fault.name}" del catálogo? También se eliminarán sus puntos en las imágenes. Si ya se usó en reportes no se podrá eliminar (para conservar el historial).`,
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    const res = await imageFaultsService.delete(fault.id);
    if (!res.success) {
      toast.error(res.message || 'No se pudo eliminar la falla.');
      return;
    }
    toast.exito(`Falla "${fault.name}" eliminada`);
    const faultsRes = await imageFaultsService.getAll(false);
    if (faultsRes.success && faultsRes.data) setImageFaults(faultsRes.data);
  };

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
    return {
      xPct: x,
      yPct: y,
      radiusPct: parsedRadius === null ? DEFAULT_RADIUS : parsedRadius,
    };
  })();

  const draftPointLabel = (() => {
    if (editingPointId) return 'Punto en edicion';
    const selectedFault = imageFaults.find((fault) => fault.id === Number(selectedFaultId));
    return selectedFault?.name || '';
  })();

  const handleImageClick = (xPct: number, yPct: number) => {
    setDraftXPct(String(xPct));
    setDraftYPct(String(yPct));
  };

  const handleSavePoint = async () => {
    if (savingPointRef.current) return;
    setPointMsg(null);
    if (!imageKey.trim()) {
      setPointMsg({ tipo: 'error', texto: 'Selecciona el tipo de vehículo.' });
      return;
    }
    if (!selectedFaultId) {
      setPointMsg({ tipo: 'error', texto: 'Selecciona la falla asociada al punto.' });
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
    const otros = vehicleImagePoints.filter((p) => p.id !== editingPointId);
    const mismaFalla = otros.filter((p) => p.imageFaultId === Number(selectedFaultId));
    const encimados = otros.filter(
      (p) => Math.hypot(p.xPct - x, p.yPct - y) < r + (p.radiusPct ?? DEFAULT_RADIUS)
    );
    if (mismaFalla.length > 0 || encimados.length > 0) {
      const nombre = (p: VehicleImagePoint) => p.imageFaultName || `Falla #${p.imageFaultId}`;
      const ok = await confirmar({
        titulo: 'Revisa el punto antes de guardar',
        mensaje: (
          <div className="space-y-2">
            {mismaFalla.length > 0 && <p>Esta falla ya tiene {mismaFalla.length} punto(s) en la imagen.</p>}
            {encimados.length > 0 && <p>El punto se encima con: {encimados.map(nombre).join(', ')}.</p>}
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
    setMessage('');
    try {
      if (editingPointId) {
        const current = vehicleImagePoints.find((p) => p.id === editingPointId);
        const payload: VehicleImagePointUpdateRequest = {
          id: editingPointId,
          imageKey: imageKey.trim(),
          xPct: x,
          yPct: y,
          radiusPct: r,
          imageFaultId: Number(selectedFaultId),
          // Sin "Desactivar" (13.1.1): al guardar, un punto que estaba oculto vuelve a mostrarse en los reportes
          active: true,
        };
        if (!current) throw new Error('El punto que estabas editando ya no existe.');
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
          imageFaultId: Number(selectedFaultId),
          active: true,
        };
        const res = await vehicleImagePointsService.create(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo crear el punto.');
        setPointMsg({ tipo: 'ok', texto: 'Punto guardado correctamente.' });
        toast.exito('Punto guardado');
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

  const handleDeletePoint = async (point: VehicleImagePoint) => {
    const ok = await confirmar({
      titulo: 'Eliminar punto',
      mensaje: `¿Eliminar el punto de "${point.imageFaultName || `Falla #${point.imageFaultId}`}" de la imagen? Esta acción no se puede deshacer.`,
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
    setMessage('');
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

  return (
    <div className="dashboard-wrapper space-y-5">
      <VolverConfiguracion />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuración visual</p>
          <h1 className="text-3xl font-semibold text-continental-black">Fallas por imagen</h1>
        </div>
        <Button variant="outline" onClick={loadInitialData} className="flex items-center gap-2">
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
      {message && <Card className="border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</Card>}

      {loading ? (
        <Card className="p-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando configuración...
        </Card>
      ) : (
        <div className="grid gap-5">
          {/* Tabs */}
          <div className="flex border-b border-continental-gray-3/50">
            <button
              type="button"
              onClick={() => setActiveTab('catalogo')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'catalogo'
                  ? 'border-continental-blue-dark text-continental-blue-dark'
                  : 'border-transparent text-continental-gray-1 hover:text-continental-black hover:border-continental-gray-3'
              }`}
            >
              Catálogo de fallas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hotspots')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'hotspots'
                  ? 'border-continental-blue-dark text-continental-blue-dark'
                  : 'border-transparent text-continental-gray-1 hover:text-continental-black hover:border-continental-gray-3'
              }`}
            >
              Editor de hotspots
            </button>
          </div>

          {/* Tab Content */}
          {/* Catálogo de fallas - Solo visible cuando está activa la pestaña */}
          {activeTab === 'catalogo' && (
            <Card className="p-5 space-y-4">
              <h2 className="text-lg font-semibold text-continental-black">Catálogo de fallas</h2>

              <Input
                label="Nombre"
                value={faultName}
                onChange={(e) => {
                  setFaultName(e.target.value);
                  if (faultNameError) setFaultNameError('');
                }}
                error={faultNameError || undefined}
              />
              <Input
                label="Descripción"
                value={faultDescription}
                onChange={(e) => setFaultDescription(e.target.value)}
                placeholder="Opcional"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveFault} disabled={savingFault} className="flex items-center gap-2">
                  {savingFault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editingFaultId ? 'Actualizar' : 'Crear'}
                </Button>
                {editingFaultId && (
                  <Button variant="outline" onClick={resetFaultForm}>
                    Cancelar
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {imageFaults.map((fault) => (
                  <div key={fault.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-continental-black">{fault.name}</p>
                        <p className="text-xs text-continental-gray-1">{fault.description || 'Sin descripción'}</p>
                        {!fault.active && (
                          <p className="text-xs mt-1 text-amber-700">Oculta en reportes (desactivada antes). Edítala y guarda para mostrarla, o elimínala.</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFaultId(fault.id);
                            setFaultName(fault.name);
                            setFaultDescription(fault.description || '');
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`Eliminar falla ${fault.name}`}
                          title="Eliminar falla"
                          onClick={() => void handleDeleteFault(fault)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Editor de hotspots - Solo visible cuando está activa la pestaña */}
          {activeTab === 'hotspots' && (
            <Card className="p-5 space-y-4">
              <h2 className="text-lg font-semibold text-continental-black">Editor visual de hotspots</h2>

              <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Tipo de vehículo"
                value={selectedTipoVehiculoId}
                onChange={(value) => setSelectedTipoVehiculoId(value)}
                options={[{ value: '', label: 'Seleccionar' }, ...tiposVehiculo.map((t) => ({ value: t.id, label: t.nombre }))]}
              />
              <Select
                label="Falla asociada"
                value={selectedFaultId}
                onChange={(value) => setSelectedFaultId(value)}
                options={[{ value: '', label: 'Seleccionar' }, ...imageFaults.map((f) => ({ value: f.id, label: f.name }))]}
              />
            </div>

              <div className="rounded-lg border border-continental-gray-3/60 p-3 space-y-3 bg-continental-gray-5/30">
                <p className="text-sm text-continental-gray-1">
                  Imagen usada para fallas visuales:
                  <span className="ml-1 font-medium text-continental-black">
                    {selectedTipo?.imagenFallasUrl ? 'Personalizada (fallas)' : 'No hay imagen de fallas configurada'}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFallbackImageUpload(e.target.files?.[0] || null)}
                    className="block text-sm"
                  />
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

            {/* Side-by-side layout: Image on left, Points config on right */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left side: Image */}
              <div className="space-y-3">
                <InteractiveVehicleImage
                  imageUrl={selectedImageUrl}
                  points={vehicleImagePoints.filter((p) => p.active)}
                  selectedPointIds={editingPointId ? [editingPointId] : []}
                  onImageClick={handleImageClick}
                  draftPoint={draftPointPreview || undefined}
                  draftPointLabel={draftPointLabel}
                  readonly={false}
                  className="w-full"
                  emptyMessage="No hay puntos activos en esta imagen."
                />

                <div className="rounded-md border border-continental-blue-dark/20 bg-continental-blue-dark/5 px-3 py-2 text-xs text-continental-blue-dark">
                  <p className="font-medium">
                    Vista previa: X {draftPointPreview?.xPct ?? '--'}% · Y {draftPointPreview?.yPct ?? '--'}% · R{' '}
                    {draftPointPreview?.radiusPct ?? DEFAULT_RADIUS}%
                  </p>
                  <p className="mt-1 text-continental-gray-1">Haz click en la imagen para colocar o mover el punto visualmente.</p>
                </div>
              </div>

              {/* Right side: Points configuration */}
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Input label="X (%)" value={draftXPct} onChange={(e) => setDraftXPct(e.target.value)} />
                  <Input label="Y (%)" value={draftYPct} onChange={(e) => setDraftYPct(e.target.value)} />
                  <Input label="Radio (%)" value={draftRadiusPct} onChange={(e) => setDraftRadiusPct(e.target.value)} />
                  <div className="col-span-full flex flex-wrap items-end justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={handleSavePoint}
                      disabled={savingPoint || loadingPoints}
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
                  >
                    {pointMsg.tipo === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                    <span>{pointMsg.texto}</span>
                  </div>
                )}

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-medium text-continental-black">Puntos configurados ({vehicleImagePoints.length})</p>
                    {loadingPoints && <Loader2 className="h-4 w-4 animate-spin text-continental-gray-1" />}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {vehicleImagePoints.length === 0 ? (
                      <p className="p-3 text-sm text-continental-gray-1">No hay puntos para el `imageKey` seleccionado.</p>
                    ) : (
                      vehicleImagePoints.map((point) => (
                        <div key={point.id} className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                          <div>
                            <p className="font-medium text-continental-black">{point.imageFaultName || `Falla #${point.imageFaultId}`}</p>
                            <p className="text-xs text-continental-gray-1">
                              X: {point.xPct}% · Y: {point.yPct}% · R: {point.radiusPct ?? DEFAULT_RADIUS}%
                              {!point.active && <span className="text-amber-700"> · Oculto (edítalo y guarda para mostrarlo)</span>}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPointId(point.id);
                                setSelectedFaultId(String(point.imageFaultId));
                                setDraftXPct(String(point.xPct));
                                setDraftYPct(String(point.yPct));
                                setDraftRadiusPct(String(point.radiusPct ?? DEFAULT_RADIUS));
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
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default FallasImagenPage;
