import { useEffect, useState } from 'react';
import { CheckCircle, ClipboardList, Plus } from 'lucide-react';
import { Button, LoadingCard, Modal, SearchableSelect, type SearchableSelectOption, Badge } from '@/components/ui';
import { recepcionService, checklistService, reportesService } from '@/services';
import { consumiblesService } from '@/services/consumiblesService';
import { refaccionesService } from '@/services/refaccionesService';
import type { ChecklistItem } from '@/services/checklistService';

interface Pendiente {
  id: number;
  folio: string;
  descripcion: string;
  fechaReporte: string;
  vehiculoId: number;
  vehiculoCodigo: string;
  vehiculoTipo: string;
  evidencias?: { urlImagen: string; descripcion?: string }[];
  categoriaNombre?: string;
  ubicacion?: string;
  itemsChecklist?: { checklistItemId: number; pregunta: string; estado?: string; cantidad?: number }[];
}

type RefaccionOption = SearchableSelectOption<{ stock: number }>;

export function RecepcionPage() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnostico] = useState('');
  const [extra, setExtra] = useState('');
  const [refItems, setRefItems] = useState<
    Array<{ nombre: string; cantidad: string; justificacion: string; seleccion?: SearchableSelectOption | null }>
  >([{ nombre: '', cantidad: '1', justificacion: '', seleccion: null }]);
  const [refaccionesCache, setRefaccionesCache] = useState<RefaccionOption[]>([]);
  const [selected, setSelected] = useState<Pendiente | null>(null);
  const [selectedDetalle, setSelectedDetalle] = useState<Pendiente | null>(null);
  const [checklistNombre, setChecklistNombre] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistFuente, setChecklistFuente] = useState<'reporte' | 'asignacion' | 'fallback'>('fallback');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [fifoActivo, setFifoActivo] = useState(true);
  const [ordenIdActual, setOrdenIdActual] = useState<number | null>(null);
  const [accionesModalOpen, setAccionesModalOpen] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<'checkin' | 'danio' | 'refacciones'>('checkin');
  const [showDuplicateOrderModal, setShowDuplicateOrderModal] = useState(false);
  const [duplicateOrderMsg, setDuplicateOrderMsg] = useState('');

  const fetchRefacciones = async (q?: string): Promise<RefaccionOption[]> => {
    try {
      const res = await consumiblesService.getAll({ q: q?.trim() || undefined });
      if (res.success && res.data) {
        const lista = (res.data as any[]).filter((c) => (c.categoria || '').toLowerCase().includes('refac'));
        return lista.map((r) => ({
          value: r.id,
          label: `${r.nombre} (${r.codigo})`,
          description: `Stock: ${r.stockActual ?? 0}`,
          meta: { stock: r.stockActual ?? 0 }
        }));
      }
    } catch (err) {
      console.error('No se pudieron cargar refacciones', err);
    }
    return refaccionesCache;
  };

  const buildEvidenceUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_URL || '';
    const base = apiBase && apiBase.includes('http') ? apiBase.replace(/\/api\/?$/, '') : '';
    if (base) return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    try {
      const current = new URL(window.location.origin);
      if (current.port === '5173') current.port = '5110';
      return `${current.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const resp = await recepcionService.getPendientes();
      if (resp.success && resp.data !== undefined && resp.data !== null) {
        const data: any = resp.data;
        const list = (data as any).items || (data as any).Items || (Array.isArray(data) ? data : []);
        const ordenados = (list as Pendiente[]).sort(
          (a, b) => new Date(a.fechaReporte).getTime() - new Date(b.fechaReporte).getTime()
        );
        setItems(ordenados);
        if (fifoActivo && ordenados.length > 0) {
          setSelected(ordenados[0]);
        }
      } else {
        setItems([]);
      }
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    consumiblesService.getAll({ q: undefined }).then((res) => {
      if (res.success && res.data) {
        const lista = (res.data as any[]).filter((c) => (c.categoria || '').toLowerCase().includes('refac'));
        setRefaccionesCache(
          lista.map((r) => ({
            value: r.id,
            label: `${r.nombre} (${r.codigo})`,
            description: `Stock: ${r.stockActual ?? 0}`,
            meta: { stock: r.stockActual ?? 0 }
          }))
        );
      }
    });
  }, []);

  useEffect(() => {
    if (fifoActivo && items.length > 0) {
      setSelected(items[0]);
    }
  }, [fifoActivo, items]);

  useEffect(() => {
    if (!selected) setAccionesModalOpen(false);
    setSelectedDetalle(null);
  }, [selected]);

  useEffect(() => {
    const loadDetalle = async () => {
      if (!selected) {
        setSelectedDetalle(null);
        return;
      }
      try {
        const resp = await reportesService.getById(selected.id);
        if (resp.success && resp.data) {
          const data: any = resp.data;
          const evidRes = await reportesService.getEvidencias(selected.id);
          const evidencias = evidRes.success && evidRes.data ? evidRes.data : [];
          setSelectedDetalle({
            ...selected,
            vehiculoCodigo: data.vehiculoCodigo || selected.vehiculoCodigo,
            vehiculoTipo: data.vehiculoTipo || selected.vehiculoTipo,
            categoriaNombre: data.categoriaNombre || selected.categoriaNombre,
            ubicacion: data.ubicacion || selected.ubicacion,
            descripcion: data.descripcion || selected.descripcion,
            evidencias: evidencias.length ? evidencias : selected.evidencias
          });
          return;
        }
      } catch (err) {
        console.error('No se pudo cargar detalle del reporte', err);
      }
      setSelectedDetalle(selected);
    };

    loadDetalle();
  }, [selected]);

  useEffect(() => {
    const loadChecklist = async (sel: Pendiente | null) => {
      setChecklistItems([]);
      setChecklistNombre('');
      setChecklistFuente('fallback');
      if (!sel || !sel.vehiculoId) {
        setChecklistItems(checklistService.getDefaultInspectionChecklist());
        setChecklistNombre('Checklist de inspeccion rapida');
        setChecklistFuente('fallback');
        return;
      }

      // Usar los items capturados en el reporte (solo los seleccionados al crear la falla)
      if (sel.itemsChecklist && sel.itemsChecklist.length > 0) {
        const mapped = sel.itemsChecklist.map((it, idx) => ({
          id: it.checklistItemId || idx + 1,
          orden: idx + 1,
          pregunta: it.pregunta,
          tipoRespuesta: 0,
          obligatorio: true,
          requiereFoto: false,
          costoEstimado: (it as any).cantidad // Truco temporal para pasar la cantidad al renderizador de abajo si no queremos tocar el interface ChecklistItem
        }));
        setChecklistItems(mapped);
        setChecklistNombre('Checklist del reporte');
        setChecklistFuente('reporte');
        return;
      }

      setChecklistLoading(true);
      try {
        const asignRes = await checklistService.getAsignaciones(sel.vehiculoId);
        const asignaciones = (asignRes as any).data || asignRes;
        const asign = Array.isArray(asignaciones) ? asignaciones[0] : null;
        if (asign && asign.checklistTemplateId) {
          const tplRes = await checklistService.getTemplateById(asign.checklistTemplateId);
          if ((tplRes as any).items || (tplRes as any).data?.items) {
            const tplData: any = (tplRes as any).data || tplRes;
            setChecklistItems(tplData.items || []);
            setChecklistNombre(tplData.nombre || asign.checklistNombre || 'Checklist asignado');
            setChecklistFuente('asignacion');
            return;
          }
        }
      } catch (err) {
        console.error('No se pudo cargar checklist asignado', err);
      } finally {
        setChecklistLoading(false);
      }

      // Fallback: checklist rapido por defecto
      const fallback = checklistService.getDefaultInspectionChecklist();
      setChecklistItems(fallback);
      setChecklistNombre('Checklist de inspeccion rapida');
      setChecklistFuente('fallback');
    };

    loadChecklist(selected);
  }, [selected]);

  const doCheckIn = async (force: boolean = false) => {
    if (!selected) return;
    setProcessing(true);
    setError('');
    setMessage('');
    setShowDuplicateOrderModal(false);

    try {
      const resp = await recepcionService.checkIn(
        selected.id,
        diagnostico,
        undefined,
        force
      );

      if (resp.success) {
        const oid = (resp.data as any)?.ordenId;
        if (oid) setOrdenIdActual(oid);
        setMessage('Check-in registrado. Orden creada/activada.');
        // Cargar datos de nuevo para reflejar cambios y cerrar modal tras un breve delay para mostrar mensaje de éxito
        setTimeout(() => {
          setAccionesModalOpen(false);
          load();
        }, 1500);
      } else {
        const isDuplicate = resp.errors?.includes('DuplicateActiveOrder') || resp.errorCode === 'DuplicateActiveOrder';
        if (isDuplicate) {
          setDuplicateOrderMsg(resp.message || 'Este vehículo ya tiene una orden activa.');
          setShowDuplicateOrderModal(true);
        } else {
          setError(resp.message || 'No se pudo registrar check-in');
        }
      }
    } catch (err: any) {
      // Manejar el caso de Conflict (409) si no viene como error en resp.success
      if (err?.response?.status === 409 && err?.response?.data?.errorCode === 'DuplicateActiveOrder') {
        setDuplicateOrderMsg(err.response.data.message || 'Este vehículo ya tiene una orden activa.');
        setShowDuplicateOrderModal(true);
      } else {
        setError('Error al registrar check-in');
      }
    } finally {
      setProcessing(false);
    }
  };

  const doDanioExtra = async () => {
    if (!selected) return;
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const descripcion = extra.trim() || 'Dano extra detectado en recepcion';
      const resp = await recepcionService.registrarDanioExtra(selected.id, descripcion, false, undefined);
      if (resp.success) {
        const oid = (resp.data as any)?.ordenId;
        if (oid) setOrdenIdActual(oid);
        setMessage('Dano extra enviado para aprobacion');
      }
      else setError(resp.message || 'No se pudo enviar dano extra');
    } catch (err) {
      setError('Error al enviar dano extra');
    } finally {
      setProcessing(false);
    }
  };

  const ensureOrdenId = async () => {
    if (ordenIdActual) return ordenIdActual;
    if (!selected) throw new Error('Selecciona un reporte');
    const resp = await recepcionService.checkIn(selected.id, diagnostico, undefined);
    if (resp.success && (resp.data as any)?.ordenId) {
      const oid = (resp.data as any).ordenId as number;
      setOrdenIdActual(oid);
      return oid;
    }
    throw new Error(resp.message || 'No se pudo generar la orden');
  };

  const doRefaccionExtra = async () => {
    if (!selected) {
      setError('Selecciona un reporte para asociar la orden');
      return;
    }
    const validItems = refItems
      .map((it) => ({
        nombreRefaccion: it.nombre.trim(),
        cantidad: Number(it.cantidad) || 1,
        justificacion: it.justificacion.trim() || extra.trim() || 'Refaccion solicitada en recepcion'
      }))
      .filter((it) => it.nombreRefaccion.length > 0 && it.cantidad > 0);
    if (validItems.length === 0) {
      setError('Captura al menos una refaccion');
      return;
    }
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const oid = await ensureOrdenId();
      const payloads = validItems.map((it) => ({ ...it, ordenTrabajoId: oid }));
      if (payloads.length === 1) {
        const resp = await refaccionesService.create(payloads[0]);
        if (!resp.success) throw new Error(resp.message || 'No se pudo solicitar la refaccion');
      } else {
        const resp = await refaccionesService.createBatch({ solicitudes: payloads });
        if (!resp.success) throw new Error(resp.message || 'No se pudo solicitar las refacciones');
      }
      setMessage('Refacciones solicitadas');
      setRefItems([{ nombre: '', cantidad: '1', justificacion: '' }]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al solicitar refaccion');
    } finally {
      setProcessing(false);
    }
  };

  const renderSelectedDetails = () => {
    const detail = selectedDetalle || selected;
    if (!detail) return null;
    return (
        <div className="list-detail-tile rounded-2xl border border-continental-gray-3/60 bg-continental-bg space-y-6">
          <div className="flex items-center justify-between text-xs text-continental-gray-2 detail-line">
            <span>{new Date(detail.fechaReporte).toLocaleString()}</span>
          </div>
          <div className="text-xs text-continental-gray-1 leading-6 detail-line">
            <span className="font-semibold text-continental-black">Vehiculo:</span>{' '}
            {detail.vehiculoCodigo || 'N/D'} {detail.vehiculoTipo ? `(${detail.vehiculoTipo})` : ''}
          </div>
          {detail.ubicacion && <p className="text-xs text-continental-gray-1 leading-6 detail-line">Ubicacion: {detail.ubicacion}</p>}
          {detail.descripcion && <p className="text-sm text-continental-black whitespace-pre-line leading-7 detail-text">{detail.descripcion}</p>}
          {detail.evidencias && detail.evidencias.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {detail.evidencias.slice(0, 4).map((ev, idx) => (
                <div key={idx} className="rounded-lg overflow-hidden border border-continental-gray-3/60 bg-white">
                  <img src={buildEvidenceUrl(ev.urlImagen)} alt={ev.descripcion || 'Evidencia'} className="h-20 w-full object-cover" />
                  {ev.descripcion && <div className="px-2 py-1 text-[11px] text-continental-gray-2 truncate">{ev.descripcion}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
    );
  };

  if (loading) return <LoadingCard message="Cargando pendientes de recepcion..." />;

  return (
    <div className="dashboard-wrapper space-y-5">
      <div className="dashboard-card p-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Zona de Transición</p>
        <h1 className="text-2xl font-bold text-continental-black">Zona de Transición</h1>
        <p className="text-sm text-continental-gray-1">
          Gestione el ingreso de contenedores al taller. Realice el check-in inicial y registre cualquier daño adicional detectado antes de iniciar los trabajos.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="dashboard-card p-4 md:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <h2 className="text-lg font-semibold text-continental-black flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Pendientes ({items.length})
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-continental-gray-1">
                <input type="checkbox" checked={fifoActivo} onChange={(e) => setFifoActivo(e.target.checked)} />
                FIFO (orden llegada)
              </label>
              {fifoActivo && <span className="text-xs text-continental-gray-2 hidden sm:inline">Solo el 1ro</span>}
              <Button variant="outline" size="sm" onClick={load}>
                Actualizar
              </Button>
            </div>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-4 pl-2 pt-2 pb-2">
            {items.map((p) => (
              <div
                key={p.id}
                className="list-tile border border-continental-gray-3/60 rounded-2xl cursor-pointer hover:border-continental-yellow/80 space-y-3 p-4 md:p-6"
                onClick={() => {
                  if (fifoActivo && items[0]?.id !== p.id) return;
                  setSelected(p);
                  setMessage('');
                  setError('');
                  setAccionesModalOpen(true);
                }}
              >
                <div className="flex flex-wrap justify-between text-sm text-continental-gray-1 gap-2">
                  <span className="font-medium">{p.folio}</span>
                  <span className="text-xs">{new Date(p.fechaReporte).toLocaleString()}</span>
                </div>
                <div className="font-semibold text-continental-black mt-1 leading-7">
                  {p.vehiculoCodigo} - {p.vehiculoTipo}
                </div>
                <p className="text-xs text-continental-gray-1">
                  {p.ubicacion ? `Ubicacion: ${p.ubicacion}` : ''}
                </p>
                <p className="text-sm text-continental-gray-1 whitespace-pre-line leading-6">{p.descripcion}</p>
                {p.evidencias && p.evidencias.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {p.evidencias.slice(0, 2).map((ev, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-continental-gray-3/60 bg-continental-bg">
                        <img src={buildEvidenceUrl(ev.urlImagen)} alt={ev.descripcion || 'Evidencia'} className="h-24 w-full object-cover" />
                        {ev.descripcion && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[11px] text-white px-2 py-1 truncate">
                            {ev.descripcion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-continental-gray-1 py-10">
                <CheckCircle className="h-8 w-8 text-continental-green mx-auto mb-2" />
                Sin pendientes de recepcion
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={accionesModalOpen && Boolean(selected)}
        onClose={() => setAccionesModalOpen(false)}
        title="Gestionar acciones"
        description={
          selected
            ? 'Trabaja cada paso con mas espacio y contexto antes de registrar las acciones.'
            : 'Selecciona un reporte para continuar.'
        }
        size="xl"
      >
        {!selected ? (
          <p className="text-sm text-continental-gray-1">Selecciona un reporte pendiente para continuar.</p>
        ) : (
          <div className="space-y-8">
            {renderSelectedDetails()}

      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeActionTab === 'checkin'
              ? 'border-continental-yellow text-continental-black bg-continental-yellow/5'
              : 'border-transparent text-continental-gray-2 hover:text-continental-gray-1 hover:bg-gray-50'
          }`}
          onClick={() => setActiveActionTab('checkin')}
        >
          Registrar Check-in
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeActionTab === 'danio'
              ? 'border-continental-yellow text-continental-black bg-continental-yellow/5'
              : 'border-transparent text-continental-gray-2 hover:text-continental-gray-1 hover:bg-gray-50'
          }`}
          onClick={() => setActiveActionTab('danio')}
        >
          Daños Extra
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeActionTab === 'refacciones'
              ? 'border-continental-yellow text-continental-black bg-continental-yellow/5'
              : 'border-transparent text-continental-gray-2 hover:text-continental-gray-1 hover:bg-gray-50'
          }`}
          onClick={() => setActiveActionTab('refacciones')}
        >
          Solicitar Refacciones
        </button>
      </div>

            {(message || error) && (
              <div className="space-y-2">
                {message && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{message}</div>}
                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              </div>
            )}

            {activeActionTab === 'checkin' && (
              <div className="space-y-6">
                <section
                  className="rounded-2xl border border-continental-gray-3/70 bg-white p-6 md:p-10 space-y-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-continental-black">Checklist a realizar</p>
                    <p className="text-xs text-continental-gray-2">
                      Lista de verificaciones seleccionadas en el reporte. Si no existen, se usa el checklist asignado al vehiculo o el de inspeccion rapida.
                    </p>
                  </div>
                  <div className="text-xs text-continental-gray-1">
                    {checklistLoading ? (
                      <p>Cargando checklist...</p>
                    ) : checklistItems.length === 0 ? (
                      <p>Sin items de checklist configurados.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-continental-black">
                          {checklistNombre || 'Checklist'}{' '}
                          <span className="text-continental-gray-2 text-[11px]">
                            {checklistFuente === 'reporte'
                              ? '(del reporte)'
                              : checklistFuente === 'asignacion'
                                ? '(asignado al vehiculo)'
                                : '(inspeccion rapida)'}
                          </span>
                        </p>
                        <ul className="space-y-1">
                          {checklistItems.map((item) => (
                            <li key={item.id ?? item.orden} className="flex gap-2 items-center">
                              <span className="text-continental-gray-2">#{item.orden}</span>
                              <span className="text-continental-black flex-1">{item.pregunta}</span>
                              {((item as any).cantidad !== undefined || (item as any).costoEstimado !== undefined) && (
                                <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-100 py-0 h-5">
                                  Cant: {(item as any).cantidad ?? (item as any).costoEstimado}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                <section
                  className="rounded-2xl border border-continental-gray-3/70 bg-white p-6 md:p-10 space-y-4 shadow-sm"
                >
                  <Button className="w-full" onClick={() => void doCheckIn(false)} disabled={processing}>
                    {processing ? 'Guardando...' : 'Registrar check-in'}
                  </Button>
                </section>
              </div>
            )}

            {activeActionTab === 'danio' && (
              <section
                className="rounded-2xl border border-continental-gray-3/70 bg-white p-6 md:p-10 space-y-4 shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-continental-black">Dano extra (opcional)</p>
                  <p className="text-xs text-continental-gray-2">Describe hallazgos adicionales y envialos para aprobacion.</p>
                </div>
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="w-full h-24 rounded-xl border border-continental-gray-3 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                  placeholder="Describe danos adicionales"
                />
                <Button variant="outline" onClick={doDanioExtra} disabled={processing}>
                  Enviar dano extra
                </Button>
                <p className="text-xs text-continental-gray-2">Solo registra la observacion; las refacciones se capturan en la siguiente seccion.</p>
              </section>
            )}

            {activeActionTab === 'refacciones' && (
              <section
                className="rounded-2xl border border-continental-gray-3/70 bg-white p-6 md:p-10 space-y-5 shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-continental-black">Solicitar refaccion (opcional)</p>
                  <p className="text-xs text-continental-gray-2">Agrega varias refacciones con cantidades y justificacion.</p>
                </div>
                <div className="space-y-3">
                  {refItems.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-continental-gray-3/70 bg-continental-bg/70 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold text-continental-black">Refaccion #{idx + 1}</p>
                        {refItems.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setRefItems((prev) => prev.filter((_, i) => i !== idx))}>
                            Quitar
                          </Button>
                        )}
                      </div>
                      <SearchableSelect
                        placeholder="Buscar refaccion disponible"
                        selected={item.seleccion || null}
                        onSelect={(opt) =>
                          setRefItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, seleccion: opt, nombre: opt?.label || '' } : it))
                          )
                        }
                        fetchOptions={fetchRefacciones}
                        noResultsText="Sin refacciones"
                      />
                      <input
                        value={item.nombre}
                        onChange={(e) => setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, nombre: e.target.value } : it)))}
                        placeholder="Nombre / codigo de la refaccion"
                        className="w-full h-11 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={item.cantidad}
                          onChange={(e) =>
                            setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, cantidad: e.target.value } : it)))
                          }
                          type="number"
                          min="1"
                          className="w-full h-11 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                          placeholder="Cantidad"
                        />
                        <input
                          value={item.justificacion}
                          onChange={(e) =>
                            setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, justificacion: e.target.value } : it)))
                          }
                          className="w-full h-11 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                          placeholder="Justificacion (opcional)"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRefItems((prev) => [...prev, { nombre: '', cantidad: '1', justificacion: '' }])}
                    className="flex items-center gap-2 justify-center"
                  >
                    <Plus className="h-4 w-4" /> Agregar refaccion
                  </Button>
                </div>
                <Button variant="outline" onClick={doRefaccionExtra} disabled={processing}>
                  Solicitar refacciones
                </Button>
                <p className="text-xs text-continental-gray-2">
                  Si aun no existe la orden, se hara check-in automaticamente y se asociaran todas las refacciones capturadas.
                </p>
              </section>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showDuplicateOrderModal}
        onClose={() => setShowDuplicateOrderModal(false)}
        title="Orden de trabajo activa detectada"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-continental-gray-1">{duplicateOrderMsg}</p>
          <p className="text-sm font-semibold text-continental-black">
            ¿Deseas proceder y crear una nueva orden de todos modos?
          </p>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowDuplicateOrderModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void doCheckIn(true)} disabled={processing}>
              {processing ? 'Procesando...' : 'Sí, proceder'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
