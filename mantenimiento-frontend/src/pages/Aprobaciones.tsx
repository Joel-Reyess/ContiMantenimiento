import { useEffect, useMemo, useState } from 'react';
import { Package, CheckCircle, XCircle, RefreshCcw, AlertTriangle, Check, Edit3, Eye } from 'lucide-react';
import { Button, Card, LoadingCard, Alert, AlertDescription, Badge, Modal, ModalFooter, Textarea } from '@/components/ui';
import { refaccionesService } from '@/services/refaccionesService';
import { ordenesService } from '@/services/ordenesService';
import type { SolicitudRefaccion, OrdenTrabajo } from '@/interfaces';

const formatDate = (v?: string) => (v ? new Date(v).toLocaleString() : 'N/D');
const currency = (v?: number) => (v !== undefined ? `$${Number(v).toFixed(2)}` : 'N/D');

export function AprobacionesPage() {
  const [items, setItems] = useState<SolicitudRefaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'entregadas'>('pendientes');
  const [ordenesDetalle, setOrdenesDetalle] = useState<Record<number, OrdenTrabajo | undefined>>({});
  
  // Modal state
  const [selectedItem, setSelectedItem] = useState<SolicitudRefaccion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionMode, setActionMode] = useState<'view' | 'reject' | 'changes'>('view');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await refaccionesService.getAll();
      if (resp.success && resp.data) {
        setItems(resp.data);
      } else {
        setItems([]);
        setError(resp.message || 'No se pudieron cargar las solicitudes');
      }
    } catch (err) {
      console.error(err);
      setItems([]);
      setError('No se pudo conectar con el servicio de refacciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendientes = useMemo(
    () => items.filter((i) => !(i.estado || '').toLowerCase().includes('entreg')),
    [items]
  );
  const entregadas = useMemo(
    () => items.filter((i) => (i.estado || '').toLowerCase().includes('entreg')),
    [items]
  );

  const badgeClass = (estado: string) => {
    const e = (estado || '').toLowerCase();
    if (e.includes('rech')) return 'bg-red-100 text-red-700';
    if (e.includes('aprob')) return 'bg-green-100 text-green-700';
    if (e.includes('entreg')) return 'bg-blue-100 text-blue-700';
    return 'bg-continental-gray-4 text-continental-gray-1';
  };

  const handleAction = async (item: SolicitudRefaccion, action: 'aprobar' | 'rechazar' | 'cambios' | 'entregar') => {
    setProcessingId(item.id);
    setError('');
    setMessage('');
    try {
      if (action === 'rechazar' || action === 'cambios') {
        const motivo = window.prompt('Motivo:');
        if (!motivo) {
          setProcessingId(null);
          return;
        }
        await refaccionesService.rechazar(item.id, motivo);
      } else if (action === 'aprobar') {
        await refaccionesService.aprobar(item.id, undefined);
      } else if (action === 'entregar') {
        await refaccionesService.marcarEntregada(item.id);
      }
      setMessage('Accion aplicada');
      await load();
    } catch (err) {
      console.error(err);
      setError('No se pudo aplicar la accion');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <LoadingCard message="Cargando aprobaciones..." />;

  const loadOrdenDetalle = async (ordenId: number) => {
    if (ordenesDetalle[ordenId]) return;
    try {
      const resp = await ordenesService.getById(ordenId);
      if (resp.success && resp.data) {
        const orden = resp.data as OrdenTrabajo;
        setOrdenesDetalle((prev) => ({ ...prev, [ordenId]: orden }));
      }
    } catch (err) {
      console.error('No se pudo cargar la orden', err);
    }
  };

  const openModal = (item: SolicitudRefaccion) => {
    setSelectedItem(item);
    setActionMode('view');
    setReason('');
    setDetailOpen(true);
    void loadOrdenDetalle(item.ordenTrabajoId);
  };

  const handleModalAction = async () => {
    if (!selectedItem) return;
    
    if (actionMode === 'reject' || actionMode === 'changes') {
      if (!reason.trim()) {
        alert('Debes ingresar un motivo o descripcion.');
        return;
      }
      await handleAction(selectedItem, actionMode === 'reject' ? 'rechazar' : 'cambios');
    } else {
        // En modo vista, las acciones directas se manejan con botones especificos
    }
    setDetailOpen(false);
  };

  // Override handleAction to use local state if needed, or keeping it as is but bypassing prompt if reason is provided?
  // Actually, I should update handleAction to use 'reason' state if available, or args.
  // But handleAction currently uses window.prompt. I will modify it to accept reason as arg.
  
  const handleActionWithReason = async (item: SolicitudRefaccion, action: 'aprobar' | 'rechazar' | 'cambios' | 'entregar', motivoInput?: string) => {
      setProcessingId(item.id);
      setError('');
      setMessage('');
      try {
        if (action === 'rechazar' || action === 'cambios') {
          const motivo = motivoInput;
          if (!motivo) {
            setProcessingId(null);
            return;
          }
          await refaccionesService.rechazar(item.id, motivo);
        } else if (action === 'aprobar') {
          await refaccionesService.aprobar(item.id, undefined);
        } else if (action === 'entregar') {
          await refaccionesService.marcarEntregada(item.id);
        }
        setMessage('Accion aplicada');
        await load();
        setDetailOpen(false);
      } catch (err) {
        console.error(err);
        setError('No se pudo aplicar la accion');
      } finally {
        setProcessingId(null);
      }
  };

  const renderCard = (item: SolicitudRefaccion) => {
    return (
      <Card 
        key={item.id} 
        className="px-6 py-5 border border-continental-gray-3/60 cursor-pointer hover:border-continental-yellow transition-colors"
        onClick={() => openModal(item)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-continental-yellow" />
            <div>
                <p className="font-semibold text-continental-black">{item.nombreRefaccion}</p>
                <p className="text-xs text-continental-gray-1">Cantidad: {item.cantidad}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass(item.estado)}`}>{item.estado}</span>
            <Button size="sm" variant="ghost" className="text-continental-gray-2">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="dashboard-wrapper space-y-5">
      <div className="dashboard-card p-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Aprobaciones</p>
          <h1 className="text-2xl font-bold text-continental-black">Solicitudes de refaccion</h1>
          <p className="text-sm text-continental-gray-1">Aprueba y entrega las refacciones solicitadas.</p>
        </div>
        <Button variant="outline" onClick={load} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {message && (
        <Alert variant="default">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="dashboard-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-continental-yellow" />
            <h2 className="text-lg font-semibold text-continental-black">Refacciones</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === 'pendientes' ? 'default' : 'ghost'}
              className={`flex items-center justify-center gap-3 pl-4 pr-4 min-w-[220px] ${activeTab === 'pendientes' ? 'border border-continental-yellow/70' : ''}`}
              onClick={() => setActiveTab('pendientes')}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-continental-yellow" />
                <span className="font-semibold">Pendientes / Aprobadas</span>
              </div>
              <Badge
                variant="secondary"
                className="px-3 py-1 min-w-[2.1rem] text-center leading-none text-sm self-center flex items-center justify-center"
              >
                {pendientes.length}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'entregadas' ? 'default' : 'ghost'}
              className={`flex items-center justify-center gap-3 pl-4 pr-4 min-w-[220px] ${activeTab === 'entregadas' ? 'border border-continental-yellow/70' : ''}`}
              onClick={() => setActiveTab('entregadas')}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-continental-green" />
                <span className="font-semibold">Entregadas</span>
              </div>
              <Badge
                variant="secondary"
                className="px-3 py-1 min-w-[2.1rem] text-center leading-none text-sm self-center flex items-center justify-center"
              >
                {entregadas.length}
              </Badge>
            </Button>
          </div>
        </div>

        {activeTab === 'pendientes' ? (
          pendientes.length === 0 ? (
            <p className="text-sm text-continental-gray-1">No hay solicitudes pendientes o aprobadas.</p>
          ) : (
            <div className="space-y-3">{pendientes.map((item) => renderCard(item))}</div>
          )
        ) : entregadas.length === 0 ? (
          <p className="text-sm text-continental-gray-1">No hay refacciones entregadas.</p>
        ) : (
          <div className="space-y-3">{entregadas.map((item) => renderCard(item))}</div>
        )}
      </div>

      <Modal
        isOpen={detailOpen && !!selectedItem}
        onClose={() => setDetailOpen(false)}
        title={
            actionMode === 'reject' ? 'Rechazar solicitud' : 
            actionMode === 'changes' ? 'Solicitar cambios' : 
            'Detalle de solicitud'
        }
        description={
            actionMode === 'view' ? 'Revisa los detalles y toma una accion.' :
            'Ingresa el motivo o descripcion para continuar.'
        }
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
             {/* Detalle siempre visible en modo vista, o resumen en otros modos */}
             <div className="rounded-lg bg-continental-bg p-4 text-sm space-y-2 border border-continental-gray-3/40">
                <div className="flex justify-between font-semibold text-continental-black">
                    <span>{selectedItem.nombreRefaccion}</span>
                    <span>Cant: {selectedItem.cantidad}</span>
                </div>
                {selectedItem.costoEstimado !== undefined && (
                   <p className="text-continental-gray-1">Costo est.: {currency(selectedItem.costoEstimado)}</p>
                )}
                {selectedItem.justificacion && (
                    <p className="text-continental-gray-1 italic">"{selectedItem.justificacion}"</p>
                )}
                {(() => {
                    const ord = ordenesDetalle[selectedItem.ordenTrabajoId];
                    if (!ord) return <p className="text-xs text-continental-gray-2">Cargando info de orden...</p>;
                    return (
                        <div className="mt-2 pt-2 border-t border-continental-gray-3/20 text-xs text-continental-gray-1 space-y-1">
                            <p>Vehiculo: {ord.vehiculoCodigo} {ord.vehiculoTipo ? `(${ord.vehiculoTipo})` : ''}</p>
                            <p>Orden: {selectedItem.ordenTrabajoFolio || selectedItem.ordenTrabajoId}</p>
                            <p>Solicitado: {formatDate(selectedItem.fechaSolicitud)} por {selectedItem.solicitadoPorNombre || 'N/D'}</p>
                        </div>
                    );
                })()}
             </div>

             {/* Modos de accion */}
             {actionMode === 'view' && (
               <div className="flex flex-col gap-2">
                  {(selectedItem.estado?.toLowerCase().includes('pend') || selectedItem.estado?.toLowerCase().includes('rev')) && (
                      <>
                        <Button 
                            className="w-full justify-center gap-2" 
                            onClick={() => handleActionWithReason(selectedItem, 'aprobar')}
                            disabled={processingId === selectedItem.id}
                        >
                            <CheckCircle className="h-4 w-4" /> Aprobar
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                             <Button 
                                variant="outline" 
                                className="text-red-600 gap-2"
                                onClick={() => setActionMode('reject')}
                             >
                                <XCircle className="h-4 w-4" /> Rechazar
                             </Button>
                             <Button 
                                variant="outline" 
                                className="gap-2"
                                onClick={() => setActionMode('changes')}
                             >
                                <Edit3 className="h-4 w-4" /> Cambios
                             </Button>
                        </div>
                      </>
                  )}
                  {selectedItem.estado?.toLowerCase().includes('aprob') && (
                      <Button 
                        className="w-full justify-center gap-2" 
                        variant="secondary"
                        onClick={() => handleActionWithReason(selectedItem, 'entregar')}
                        disabled={processingId === selectedItem.id}
                      >
                         <Check className="h-4 w-4" /> Entregar refaccion
                      </Button>
                  )}
               </div>
             )}

             {(actionMode === 'reject' || actionMode === 'changes') && (
                 <div className="space-y-4">
                     <Textarea 
                        placeholder={actionMode === 'reject' ? "Motivo del rechazo..." : "Describe los cambios necesarios..."}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="min-h-[100px]"
                     />
                 </div>
             )}
          </div>
        )}
        <ModalFooter>
             {actionMode === 'view' ? (
                 <Button variant="outline" onClick={() => setDetailOpen(false)}>Cerrar</Button>
             ) : (
                 <>
                    <Button variant="ghost" onClick={() => setActionMode('view')}>Cancelar</Button>
                    <Button 
                        variant={actionMode === 'reject' ? 'destructive' : 'default'}
                        onClick={() => handleModalAction()}
                        disabled={processingId === selectedItem?.id}
                    >
                        {actionMode === 'reject' ? 'Confirmar Rechazo' : 'Solicitar Cambios'}
                    </Button>
                 </>
             )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
