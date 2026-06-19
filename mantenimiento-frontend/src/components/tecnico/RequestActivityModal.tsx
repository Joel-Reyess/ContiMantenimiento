import { useState, useEffect } from 'react';
import { X, CheckCircle, ClipboardList, Check } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { ordenesService, solicitudActividadAdicionalService, checklistService, vehiculosService } from '@/services';

interface RequestActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  ordenTrabajoId?: number;
  vehiculoId?: number;
  tipoMantenimiento?: string;
}

export function RequestActivityModal({ isOpen, onClose, onSuccess, ordenTrabajoId, vehiculoId, tipoMantenimiento }: RequestActivityModalProps) {
  const [checklistItems, setChecklistItems] = useState<{ id: number; pregunta: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadChecklistItems();
    }
  }, [isOpen, vehiculoId, tipoMantenimiento]);

  const resetForm = () => {
    setSelectedIds([]);
    setChecklistItems([]);
    setError('');
    setSuccess(false);
  };

  const loadChecklistItems = async () => {
    if (!vehiculoId) return;
    setIsLoadingItems(true);
    setChecklistItems([]);
    
    try {
      let items: any[] = [];
      let templateId: number | undefined;

      // 1. Intentar por asignación directa al vehículo
      const asignRes = await checklistService.getAsignaciones(vehiculoId);
      if (asignRes.success && asignRes.data) {
        const listaAsignaciones: any[] = (Array.isArray(asignRes.data) ? asignRes.data : []) as any[];
        if (listaAsignaciones.length > 0) {
          const first = listaAsignaciones[0];
          templateId = first.checklistTemplateId ?? first.ChecklistTemplateId;
        }
      }

      // Si hay template asignado, cargarlo
      if (templateId) {
        const tplById = await checklistService.getTemplateById(templateId);
        if (tplById.success && tplById.data && tplById.data.items) {
          items = tplById.data.items;
        }
      }

      // 2. Si no hay items, intentar por el tipo de vehículo
      if (items.length === 0) {
        // Obtener info del vehículo para saber su tipo
        const ordenRes = await ordenesService.getById(ordenTrabajoId!);
        if (ordenRes.success && ordenRes.data) {
          const vehiculoId = ordenRes.data.vehiculoId;
          const vehRes = await vehiculosService.getById(vehiculoId);
          const tipoVehiculoId = vehRes.data?.tipo;

          if (tipoVehiculoId) {
          const tplRes = await checklistService.getTemplates(tipoVehiculoId, tipoMantenimiento);
          if (tplRes.success && tplRes.data && tplRes.data.length > 0) {
            // Buscar el predeterminado o el primero
            const template = tplRes.data.find((t: any) => t.isDefault || t.predeterminado) || tplRes.data[0];
            items = template.items || [];
          }
        }
      }
      }

      // 3. Si aun no hay, intentar por tipo de mantenimiento genérico
      if (items.length === 0) {
        const tplRes = await checklistService.getTemplates(undefined, tipoMantenimiento);
        if (tplRes.success && tplRes.data && tplRes.data.length > 0) {
          items = tplRes.data[0].items || [];
        }
      }

      // 4. Si aun no hay, usar default
      if (items.length === 0) {
        items = checklistService.getDefaultInspectionChecklist();
      }

      if (items.length > 0) {
        setChecklistItems(items.map(i => ({ id: i.id, pregunta: i.pregunta })));
      } else {
        setError("No se encontraron checklists disponibles.");
      }

    } catch (err) {
      console.error("Error fetching checklist items", err);
      setError("No se pudieron cargar los ítems del checklist.");
    } finally {
      setIsLoadingItems(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!ordenTrabajoId) {
      setError('ID de orden no disponible');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Debe seleccionar al menos un ítem');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Crear una solicitud por cada ítem seleccionado
      const promises = selectedIds.map(id => {
        const item = checklistItems.find(i => i.id === id);
        if (!item) return Promise.resolve(null);
        
        return solicitudActividadAdicionalService.create({
          ordenTrabajoId,
          descripcion: item.pregunta,
          justificacion: '', // Sin justificación como se solicitó
          fotoUrl: ''
        });
      });

      await Promise.all(promises);

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError('Error al enviar solicitudes');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 tecnico-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-continental-gray-3/60 tecnico-modal-card">
        <div className="sticky top-0 bg-white px-6 py-5 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-continental-black">Solicitar Actividad Adicional</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-continental-green mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-continental-black mb-2">
                Solicitud Enviada
              </h3>
              <p className="text-continental-gray-1">
                La solicitud de actividad extra ha sido enviada para aprobación.
              </p>
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
                  <label className="block text-sm font-semibold text-continental-black mb-2">
                    Seleccionar Actividades del Checklist *
                  </label>
                  {isLoadingItems ? (
                    <div className="flex items-center justify-center p-4">
                      <Spinner size="sm" /> <span className="ml-2 text-sm text-continental-gray-1">Cargando ítems...</span>
                    </div>
                  ) : checklistItems.length === 0 ? (
                    <p className="text-sm text-continental-gray-2 p-2 border rounded-lg">
                      No se encontraron ítems de checklist para este vehículo.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-continental-gray-3 rounded-lg p-2 space-y-1 bg-gray-50">
                      {checklistItems.map((item) => (
                        <div 
                          key={item.id} 
                          className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50 border border-blue-200' : 'border border-transparent hover:bg-white'}`}
                          onClick={() => toggleSelection(item.id)}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedIds.includes(item.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'}`}>
                            {selectedIds.includes(item.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-sm text-continental-black leading-tight">{item.pregunta}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-continental-gray-1 mt-2 text-right">
                    {selectedIds.length} ítem(s) seleccionado(s)
                  </p>
                </div>

              </div>

              <div className="flex items-start gap-3 p-4 bg-continental-blue/10 rounded-lg border border-continental-blue/20">
                <ClipboardList className="h-5 w-5 text-continental-blue mt-0.5" />
                <div className="text-sm text-continental-gray-1">
                  <p className="font-medium text-continental-black mb-1">Proceso de Aprobación</p>
                  <p>La actividad adicional requiere validación del supervisor antes de considerarse parte del trabajo oficial.</p>
                </div>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full h-11 text-sm bg-continental-gradient text-white"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Enviando...</span>
                  </div>
                ) : 'Enviar Solicitud'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
