import { useState, useEffect } from 'react';
import { X, CheckCircle, Package, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui';
import { ordenesService, refaccionesService, consumiblesService } from '@/services';

interface RequestPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestPartsModal({ isOpen, onClose, onSuccess }: RequestPartsModalProps) {
  const [ordenId, setOrdenId] = useState<string>('');
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [consumibles, setConsumibles] = useState<any[]>([]);
  const [consumibleId, setConsumibleId] = useState<string>('');
  const [refaccionNombre, setRefaccionNombre] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [prioridad, setPrioridad] = useState<'Baja' | 'Media' | 'Alta' | 'Urgente'>('Media');
  const [justificacion, setJustificacion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const refaccionesStock = consumibles.filter(
    (c) => (c.categoria || '').toLowerCase().includes('refac') && c.stockActual > 0
  );
  const handleSelectRefaccionStock = (value: string) => {
    setConsumibleId(value);
    if (!value) return;
    const found = refaccionesStock.find((c) => String(c.id) === value);
    if (found) setRefaccionNombre(found.nombre);
    else setRefaccionNombre('');
  };

  useEffect(() => {
    if (isOpen) {
      loadOrdenes();
      loadConsumibles();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (ordenes.length === 1) {
      setOrdenId(String(ordenes[0].id));
    }
  }, [ordenes]);

  const resetForm = () => {
    setOrdenId('');
    setConsumibleId('');
    setRefaccionNombre('');
    setCantidad(1);
    setPrioridad('Media');
    setJustificacion('');
    setError('');
    setSuccess(false);
  };

  const loadOrdenes = async () => {
    try {
      const response = await ordenesService.getMisOrdenes();
      const items = (response.data as any) || [];
      setOrdenes(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Error loading ordenes asignadas:', err);
      setOrdenes([]);
    }
  };

  const loadConsumibles = async () => {
    try {
      const response = await consumiblesService.getDisponibles();
      const items: any[] = (response.data as any) || [];
      setConsumibles(items);
    } catch (err) {
      console.error('Error loading consumibles:', err);
    }
  };

  const hasOrdenSeleccionada = !!ordenId;

  const handleSubmit = async () => {
    if (!ordenId) {
      setError('Debe seleccionar una orden asignada');
      return;
    }
    if (!consumibleId) {
      setError('Debe seleccionar una refaccion en stock');
      return;
    }
    if (!justificacion.trim()) {
      setError('Debe proporcionar una justificacion');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const ordenTrabajoId = parseInt(ordenId);
      const refaccion = refaccionesStock.find((c) => String(c.id) === consumibleId);
      if (!refaccion) {
        setError('La refaccion seleccionada ya no esta disponible.');
        setIsSubmitting(false);
        return;
      }

      // 1) Si se selecciono consumible, registrar el consumo contra la orden
      if (consumibleId) {
        const consumoResp = await consumiblesService.registrarConsumo(parseInt(consumibleId), {
          ordenTrabajoId,
          cantidad,
          comentario: `Consumo para refaccion ${refaccionNombre}`
        });
        if (!consumoResp.success) {
          setError(consumoResp.message || 'No se pudo registrar consumo de almacen');
          setIsSubmitting(false);
          return;
        }
      }

      // 2) Crear la solicitud de refaccion ligada a la orden usando el endpoint /refacciones (requiere OrdenTrabajoId)
      const solicitudResp = await refaccionesService.create({
        ordenTrabajoId,
        nombreRefaccion: refaccion.nombre,
        cantidad,
        justificacion,
      });

      if (solicitudResp.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(solicitudResp.message || 'Error al enviar solicitud');
      }
    } catch (err) {
      setError('Error al enviar solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 tecnico-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-continental-gray-3/60 tecnico-modal-card">
        <div className="sticky top-0 bg-white px-6 py-5 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-continental-black">Solicitar Refacciones</h2>
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
                Tu solicitud ha sido enviada para aprobacion
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
                    Orden de trabajo para la refaccion *
                  </label>
                  <select
                    value={ordenId}
                    onChange={(e) => setOrdenId(e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-2 text-sm font-medium text-continental-black shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent"
                  >
                    <option value="">Seleccione una orden...</option>
                    {ordenes.length === 0 ? (
                      <option value="" disabled>
                        No tienes ordenes asignadas
                      </option>
                    ) : (
                      ordenes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.folio || `OT ${o.id}`} - {o.vehiculoCodigo || 'Vehiculo'} ({o.estadoNombre || 'Estado'})
                        </option>
                      ))
                    )}
                  </select>
                  {!ordenId && (
                    <p className="mt-2 text-xs text-continental-gray-2">
                      Selecciona la orden a la que asignaras la refaccion para habilitar el resto del formulario.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-continental-gray-3/60 bg-continental-bg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-continental-black">
                    <Warehouse className="h-4 w-4" />
                    <span>Refaccion en stock (obligatorio)</span>
                  </div>
                  <p className="text-xs text-continental-gray-1">
                    Selecciona solo refacciones disponibles en almacen para tu orden.
                  </p>
                  <select
                    value={consumibleId}
                    onChange={(e) => handleSelectRefaccionStock(e.target.value)}
                    disabled={!hasOrdenSeleccionada}
                    className="flex h-11 w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-2 text-sm font-medium text-continental-black shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent"
                  >
                    <option value="">Seleccione una refaccion en stock...</option>
                    {refaccionesStock.length === 0 ? (
                      <option value="" disabled>
                        No hay refacciones con stock
                      </option>
                    ) : (
                      refaccionesStock.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nombre} (Disp: {c.stockActual} {c.unidad})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-continental-black mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    disabled={!hasOrdenSeleccionada}
                    className="flex h-11 w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-2 text-sm font-medium text-continental-black shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-continental-black mb-2">
                    Prioridad
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as any)}
                    disabled={!hasOrdenSeleccionada}
                    className="flex h-11 w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-2 text-sm font-medium text-continental-black shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent"
                  >
                    <option value="Baja">Baja - Mantenimiento preventivo</option>
                    <option value="Media">Media - Reparacion programada</option>
                    <option value="Alta">Alta - Equipo detenido</option>
                    <option value="Urgente">Urgente - Produccion afectada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-continental-black mb-2">
                    Justificacion *
                  </label>
                  <textarea
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Describe por que se necesita esta refaccion..."
                    disabled={!hasOrdenSeleccionada}
                    className="flex min-h-[110px] w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-3 text-sm font-medium text-continental-black shadow-sm transition-all placeholder:text-continental-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-continental-blue/10 rounded-lg border border-continental-blue/20">
                <Package className="h-5 w-5 text-continental-blue mt-0.5" />
                <div className="text-sm text-continental-gray-1">
                  <p className="font-medium text-continental-black mb-1">Proceso de Aprobacion</p>
                  <p>Tu solicitud sera enviada al supervisor para su aprobacion antes de proceder con el pedido.</p>
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={isSubmitting || !hasOrdenSeleccionada} className="w-full h-11 text-sm">
                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
