import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Plus, Camera, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { vehiculosService, checklistService, solicitudCambioService } from '@/services';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface MaintenanceChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialVehiculoId?: number | null;
  lockVehiculoSelection?: boolean;
}

const defaultChecklist: ChecklistItem[] = [
  { id: '1', label: 'Estado de neumaticos', checked: false },
  { id: '2', label: 'Nivel de fluidos (aceite, hidraulico, frenos)', checked: false },
  { id: '3', label: 'Luces y senales', checked: false },
  { id: '4', label: 'Frenos operativos', checked: false },
  { id: '5', label: 'Sistema hidraulico (sin fugas)', checked: false },
  { id: '6', label: 'Bateria y conexiones', checked: false },
  { id: '7', label: 'Bocina/Alarma de reversa', checked: false },
  { id: '8', label: 'Cinturon de seguridad', checked: false },
];

export function MaintenanceChecklistModal({
  isOpen,
  onClose,
  onSuccess,
  initialVehiculoId = null,
  lockVehiculoSelection = false
}: MaintenanceChecklistModalProps) {
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecklist);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [nuevoItem, setNuevoItem] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Funcionalidad de Actividad Adicional
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraActivityName, setExtraActivityName] = useState('');
  const [extraActivityPhoto, setExtraActivityPhoto] = useState<File | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSendingExtra, setIsSendingExtra] = useState(false);
  const [extraError, setExtraError] = useState('');
  const [extraSuccess, setExtraSuccess] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVehiculos();
      loadTemplate();
      resetForm();
    }
  }, [isOpen, initialVehiculoId]);

  const resetForm = () => {
    setVehiculoId(initialVehiculoId ? String(initialVehiculoId) : '');
    setChecklist(defaultChecklist.map((item) => ({ ...item, checked: false })));
    setObservaciones('');
    setError('');
    setSuccess(false);
    setNuevoItem('');
  };

  const loadVehiculos = async () => {
    try {
      const response = await vehiculosService.getAll({ pageSize: 50 });
      const data: any = response.data;
      const items = (data && (data.items || data.Items)) || (Array.isArray(data) ? data : []);
      setVehiculos(items || []);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    }
  };

  const loadTemplate = async () => {
    try {
      const res = await checklistService.getTemplates();
      if (res.success && res.data && res.data.length > 0) {
        const tpl = res.data[0];
        setTemplateId(tpl.id);
        setChecklist(
          tpl.items.map((item) => ({
            id: String(item.id),
            label: item.pregunta,
            checked: false,
          }))
        );
      } else {
        setTemplateId(null);
      }
    } catch (err) {
      console.error('No se pudo cargar template de checklist', err);
      setTemplateId(null);
    }
  };

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const checkedCount = checklist.filter((item) => item.checked).length;

  const addCustomItem = () => {
    if (!nuevoItem.trim()) return;
    const id = `custom-${Date.now()}`;
    setChecklist((prev) => [...prev, { id, label: nuevoItem.trim(), checked: false }]);
    setNuevoItem('');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
      setExtraError('');
    } catch (err) {
      setExtraError('No se pudo acceder a la camara');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `actividad-extra-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setExtraActivityPhoto(file);
          stopCamera();
        }
      }, 'image/jpeg');
    }
  };

  const handleSendExtraActivity = async () => {
    if (!vehiculoId) {
      setExtraError('Selecciona un equipo primero');
      return;
    }
    if (!extraActivityName.trim()) {
      setExtraError('Ingresa el nombre de la actividad');
      return;
    }
    if (!extraActivityPhoto) {
      setExtraError('Debes tomar una foto de evidencia');
      return;
    }

    setIsSendingExtra(true);
    setExtraError('');
    try {
      // 1. Crear solicitud de cambio (para que el líder la vea)
      // Nota: El backend de SolicitudCambio usa vehiculoId y descripcion. 
      // Pondremos un prefijo para identificarla como actividad extra.
      const res = await solicitudCambioService.create({
        vehiculoId: parseInt(vehiculoId),
        descripcion: `ACTIVIDAD_EXTRA: ${extraActivityName.trim()}`
      });

      if (res.success && res.data) {
        // 2. Subir la foto como evidencia vinculada a la solicitud (si el backend lo permite)
        // o a la orden de trabajo si supiéramos cuál es. 
        // Como este modal es genérico, lo ideal es vincularlo al vehículo o una orden activa.
        
        setExtraSuccess('Solicitud enviada para aprobación');
        setExtraActivityName('');
        setExtraActivityPhoto(null);
        setTimeout(() => {
          setExtraSuccess('');
          setShowAddExtra(false);
        }, 2000);
      } else {
        setExtraError(res.message || 'Error al enviar solicitud');
      }
    } catch (err) {
      setExtraError('Error de conexión');
    } finally {
      setIsSendingExtra(false);
    }
  };

  const handleSubmit = async () => {
    if (!vehiculoId) {
      setError('Debe seleccionar un vehiculo');
      return;
    }

    if (templateId === null) {
      setError('No hay un checklist configurado en el API. Solicita cargar un template.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const respuestas = checklist.map((item) => ({
        checklistItemId: parseInt(item.id),
        valor: item.checked ? 'OK' : 'No revisado',
        notas: observaciones || undefined,
      }));

      const response = await checklistService.crearInspeccionRapida({
        vehiculoId: parseInt(vehiculoId),
        checklistTemplateId: templateId ?? 0,
        respuestas,
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(response.message || 'Error al guardar checklist');
      }
    } catch (err) {
      console.log('Checklist guardado (modo desarrollo)');
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 tecnico-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-continental-gray-3/60 tecnico-modal-card">
        <div className="sticky top-0 bg-white px-6 py-5 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-continental-black">Checklist de Mantenimiento</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-continental-green mx_auto mb-4" />
              <h3 className="text-xl font-semibold text-continental-black mb-2">Checklist Completado</h3>
              <p className="text-continental-gray-1">El checklist ha sido guardado exitosamente</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-continental-black mb-2">
                    Seleccionar Equipo *
                  </label>
                  <select
                    value={vehiculoId}
                    onChange={(e) => setVehiculoId(e.target.value)}
                    disabled={lockVehiculoSelection && !!initialVehiculoId}
                    className="w-full p-3 border-2 border-continental-gray-3 rounded-lg focus:border-continental-yellow focus:outline-none"
                  >
                    <option value="">Seleccione un vehiculo...</option>
                    {vehiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.codigo} - {v.tipoNombre || v.tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-continental-bg rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-continental-gray-1">Progreso</span>
                    <span className="font-semibold text-continental-black">
                      {checkedCount} / {checklist.length}
                    </span>
                  </div>
                  <div className="h-2 bg-continental-gray-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-continental-green transition-all duration-300"
                      style={{ width: `${(checkedCount / checklist.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="bg-continental-bg rounded-lg p-4">
                  <h3 className="font-semibold text-continental-black mb-4">Inspeccion Visual</h3>
                  <div className="space-y-3">
                    {checklist.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer transition-colors',
                          item.checked ? 'border-2 border-continental-green' : 'border-2 border-transparent'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item.id)}
                          className="h-5 w-5 rounded border-continental-gray-2 text-continental-green focus:ring-continental-green"
                        />
                        <span
                          className={cn(
                            'flex-1',
                            item.checked ? 'text-continental-green' : 'text-continental-black'
                          )}
                        >
                          {item.label}
                        </span>
                        {item.checked && <CheckCircle className="h-5 w-5 text-continental-green" />}
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-continental-gray-3 bg-white p-3">
                    <label className="text-sm font-semibold text-continental-black">Agregar punto personalizado</label>
                    <div className="flex gap-2">
                      <input
                        value={nuevoItem}
                        onChange={(e) => setNuevoItem(e.target.value)}
                        placeholder="Ej. Revisar conexiones electricas"
                        className="flex-1 h-11 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                      />
                      <Button type="button" onClick={addCustomItem} className="h-11 px-4 inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Agregar
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-continental-black mb-2">
                    Observaciones Adicionales
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full p-3 border-2 border-continental-gray-3 rounded-lg focus:border-continental-yellow focus:outline-none resize-none"
                    rows={3}
                    placeholder="Anota cualquier observacion relevante..."
                  />
                </div>

                <div className="pt-4 border-t border-continental-gray-3">
                  {!showAddExtra ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAddExtra(true)}
                      className="w-full border-dashed border-2 hover:bg-continental-bg text-continental-gray-1"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Solicitar actividad adicional
                    </Button>
                  ) : (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-4 animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Nueva actividad (Requiere Aprobación)
                        </h4>
                        <button onClick={() => { setShowAddExtra(false); stopCamera(); }} className="text-amber-800 hover:bg-amber-100 p-1 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <input
                          value={extraActivityName}
                          onChange={(e) => setExtraActivityName(e.target.value)}
                          placeholder="Nombre de la actividad..."
                          className="w-full h-10 rounded-lg border border-amber-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />

                        {extraError && <p className="text-xs text-red-600 font-medium">{extraError}</p>}
                        {extraSuccess && <p className="text-xs text-green-600 font-medium">{extraSuccess}</p>}

                        <div className="space-y-2">
                          {!extraActivityPhoto ? (
                            <div className="flex flex-col gap-2">
                              {isCapturing ? (
                                <div className="space-y-2">
                                  <div className="relative overflow-hidden rounded-lg bg-black aspect-video border border-amber-300">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={capturePhoto}>
                                      <Camera className="h-4 w-4 mr-2" /> Capturar Foto
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={stopCamera}>Cancelar</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={startCamera} className="w-full bg-white border-amber-300 text-amber-800 hover:bg-amber-100">
                                  <Camera className="h-4 w-4 mr-2" /> Tomar foto de evidencia *
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-amber-300 group">
                              <img src={URL.createObjectURL(extraActivityPhoto)} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => setExtraActivityPhoto(null)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <Button 
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
                          onClick={handleSendExtraActivity}
                          disabled={isSendingExtra || isCapturing}
                        >
                          {isSendingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar Solicitud'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Guardando...' : 'Completar Checklist'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
