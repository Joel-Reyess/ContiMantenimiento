import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
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

const DEFAULT_RADIUS = 1.8;

type TabType = 'catalogo' | 'hotspots';

export function FallasImagenPage() {
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

  const handleSaveFault = async () => {
    if (!faultName.trim()) {
      setError('El nombre de la falla es obligatorio.');
      return;
    }
    setSavingFault(true);
    setError('');
    setMessage('');
    try {
      if (editingFaultId) {
        const payload: ImageFaultUpdateRequest = {
          id: editingFaultId,
          name: faultName.trim(),
          description: faultDescription.trim() || undefined,
          active: imageFaults.find((f) => f.id === editingFaultId)?.active ?? true,
        };
        const res = await imageFaultsService.update(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo actualizar la falla.');
        setMessage('Falla de imagen actualizada.');
      } else {
        const payload: ImageFaultCreateRequest = {
          name: faultName.trim(),
          description: faultDescription.trim() || undefined,
          active: true,
        };
        const res = await imageFaultsService.create(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo crear la falla.');
        setMessage('Falla de imagen creada.');
      }
      resetFaultForm();
      const faultsRes = await imageFaultsService.getAll(false);
      if (faultsRes.success && faultsRes.data) setImageFaults(faultsRes.data);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la falla.');
    } finally {
      setSavingFault(false);
    }
  };

  const toggleFaultActive = async (fault: ImageFault) => {
    const payload: ImageFaultUpdateRequest = {
      id: fault.id,
      name: fault.name,
      description: fault.description,
      active: !fault.active,
    };
    const res = await imageFaultsService.update(payload);
    if (!res.success) {
      setError(res.message || 'No se pudo cambiar el estado de la falla.');
      return;
    }
    const faultsRes = await imageFaultsService.getAll(false);
    if (faultsRes.success && faultsRes.data) setImageFaults(faultsRes.data);
  };

  const handleDeleteFault = async (fault: ImageFault) => {
    if (!window.confirm(`¿Eliminar la falla "${fault.name}"?`)) return;
    const res = await imageFaultsService.delete(fault.id);
    if (!res.success) {
      setError(res.message || 'No se pudo eliminar la falla.');
      return;
    }
    setMessage('Falla eliminada.');
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
    if (!imageKey.trim()) {
      setError('El ImageKey es obligatorio.');
      return;
    }
    if (!selectedFaultId) {
      setError('Selecciona una falla para guardar el punto.');
      return;
    }

    const x = parsePct(draftXPct);
    const y = parsePct(draftYPct);
    const r = parsePct(draftRadiusPct || String(DEFAULT_RADIUS));
    if (x === null || y === null || r === null) {
      setError('Coordenadas inválidas. Usa valores entre 0 y 100.');
      return;
    }

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
          active: current?.active ?? true,
        };
        const res = await vehicleImagePointsService.update(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo actualizar el punto.');
        setMessage('Punto actualizado.');
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
        setMessage('Punto creado.');
      }
      resetPointDraft();
      await loadPoints(imageKey.trim());
    } catch (err: any) {
      setError(err.message || 'Error al guardar el punto.');
    } finally {
      setSavingPoint(false);
    }
  };

  const togglePointActive = async (point: VehicleImagePoint) => {
    const payload: VehicleImagePointUpdateRequest = {
      id: point.id,
      imageKey: point.imageKey,
      xPct: point.xPct,
      yPct: point.yPct,
      radiusPct: point.radiusPct,
      imageFaultId: point.imageFaultId,
      active: !point.active,
    };
    const res = await vehicleImagePointsService.update(payload);
    if (!res.success) {
      setError(res.message || 'No se pudo cambiar estado del punto.');
      return;
    }
    await loadPoints(point.imageKey);
  };

  const handleDeletePoint = async (point: VehicleImagePoint) => {
    if (!window.confirm(`¿Eliminar el punto #${point.id}?`)) return;
    const res = await vehicleImagePointsService.delete(point.id);
    if (!res.success) {
      setError(res.message || 'No se pudo eliminar el punto.');
      return;
    }
    await loadPoints(point.imageKey);
  };

  const handleUploadImageFallas = async () => {
    if (!selectedTipo || !fallbackImageUpload) {
      setError('Selecciona tipo de vehículo y archivo de imagen.');
      return;
    }

    setUploadingImage(true);
    setError('');
    setMessage('');
    try {
      const res = await catalogosService.uploadImagenFallasTipoVehiculo(selectedTipo.id, fallbackImageUpload);
      if (!res.success) throw new Error(res.message || 'No se pudo subir imagen de fallas.');

      setMessage('Imagen de fallas subida correctamente.');
      setFallbackImageUpload(null);
      setImageVersion(Date.now());
      await loadInitialData();
    } catch (err: any) {
      setError(err.message || 'Error al subir imagen de fallas.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="dashboard-wrapper space-y-5">
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

              <Input label="Nombre" value={faultName} onChange={(e) => setFaultName(e.target.value)} />
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
                        <p className="text-xs mt-1">
                          Estado: <span className={fault.active ? 'text-green-700' : 'text-gray-500'}>{fault.active ? 'Activo' : 'Inactivo'}</span>
                        </p>
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
                        <Button size="sm" variant="outline" onClick={() => void toggleFaultActive(fault)}>
                          {fault.active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void handleDeleteFault(fault)}>
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
                      onClick={resetPointDraft}
                      className="!min-h-10 px-4 py-2 w-full sm:w-auto"
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>

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
                              X: {point.xPct}% · Y: {point.yPct}% · R: {point.radiusPct ?? DEFAULT_RADIUS}% · {point.active ? 'Activo' : 'Inactivo'}
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
                            <Button size="sm" variant="outline" onClick={() => void togglePointActive(point)}>
                              {point.active ? 'Desactivar' : 'Activar'}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleDeletePoint(point)}>
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
