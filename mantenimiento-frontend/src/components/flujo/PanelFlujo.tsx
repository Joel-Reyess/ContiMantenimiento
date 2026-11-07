import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle, ClipboardCheck, History, Loader2, PlayCircle, Plus, Search, Truck, XCircle, Edit3, Info } from 'lucide-react';
import { Button, Modal, ModalFooter, Textarea, useConfirm, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { PrioridadNombres } from '@/interfaces/Api.interface';
import { checklistService, type ChecklistItem } from '@/services/checklistService';
import { ordenesService } from '@/services/ordenesService';
import {
  flujoService,
  type AlertaCapacidad,
  type Flujo,
  type ItemReporte,
  type MotivoRechazo,
  type ResultadoFlujo,
} from '@/services/flujoService';
import type { ApiResponse } from '@/interfaces';
import { FlujoEtapas } from './FlujoEtapas';
import { AlertaCapacidadModal } from './CapacidadZonas';
import { useActualizacion } from '@/hooks/useActualizacion';

interface PanelFlujoProps {
  ordenId?: number;
  reporteId?: number;
  /** Abre la ventana "Terminar reparación" de la pantalla de órdenes (consumibles, evidencias) */
  onTerminar?: () => void;
  /** Avisa a la pantalla que algo cambió para que recargue su detalle */
  onCambio?: () => void;
  /** Cambia cuando la pantalla recarga, para volver a consultar el flujo */
  version?: string | number;
  /** Por qué todavía no se puede terminar la reparación (PDF 06-nov: checklist completo con evidencias) */
  bloqueoTerminar?: string;
}

type Ventana = null | 'rechazarReporte' | 'cancelarReporte' | 'corregirReporte' | 'agregarHallazgo' | 'rechazarReparacion';

/** Historial con los nombres del documento (PDF 06-nov): "INSPECCIÓN – Rechazada", "TALLER – Hallazgo adicional"... */
const ETAPA_HISTORIAL: Record<string, string> = {
  REPORTE: 'INSPECCIÓN',
  INSPECCION: 'INSPECCIÓN',
  TALLER: 'TALLER',
  VALIDACION: 'VALIDACIÓN FINAL',
  ORDEN: 'ORDEN DE TRABAJO'
};
const ACCION_HISTORIAL: Record<string, string> = {
  Rechazado: 'Rechazada',
  Cancelado: 'Cancelado',
  Cancelada: 'Cancelada',
  Corregido: 'Corrección del reporte',
  Reenviado: 'Corregido y reenviado',
  Hallazgo: 'Hallazgo adicional',
  Validado: 'Validada con observaciones'
};

/**
 * Seguimiento del flujo de 7 etapas con las acciones que le tocan al usuario en este momento
 * (PDF 23-oct-2026). Se usa en el detalle de la orden y en el del reporte.
 */
export function PanelFlujo({ ordenId, reporteId, onTerminar, onCambio, version, bloqueoTerminar }: PanelFlujoProps) {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [errorVentana, setErrorVentana] = useState('');
  const [alerta, setAlerta] = useState<AlertaCapacidad | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  // Campos de las ventanas
  const [observacion, setObservacion] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [plantilla, setPlantilla] = useState<ChecklistItem[] | null>(null);
  const [elegidos, setElegidos] = useState<Record<number, number>>({});
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<number>(2);
  const [tipoMantenimiento, setTipoMantenimiento] = useState('Correctivo');

  const cargar = useCallback(async () => {
    const res = ordenId ? await flujoService.deOrden(ordenId) : reporteId ? await flujoService.deReporte(reporteId) : null;
    if (!res) return;
    if (res.success && res.data) {
      setFlujo(res.data);
      setError('');
    } else setError(res.message || 'No se pudo cargar el seguimiento');
  }, [ordenId, reporteId]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);
  // Si otro usuario avanza la orden (traslado, validación...), las etapas se actualizan solas
  useActualizacion(cargar);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!flujo) return <p className="text-sm text-continental-gray-1">Cargando seguimiento...</p>;

  const puede = (a: Flujo['acciones'][number]) => flujo.acciones.includes(a);
  const idOrden = flujo.ordenId;
  const idReporte = flujo.reporteId;

  /** Ejecuta una acción: aviso de éxito, ventana de capacidad si aplica y recarga */
  const ejecutar = async (fn: () => Promise<ApiResponse<ResultadoFlujo>>, dentroDeVentana = false): Promise<boolean> => {
    setProcesando(true);
    setErrorVentana('');
    try {
      const res = await fn();
      if (!res.success) {
        if (res.errors?.includes('SinEspacio')) {
          setVentana(null);
          setAlerta({ zona: 'danados', nivel: 'saturada', mensaje: res.message || 'Zona de Transición sin espacio disponible.', ocupados: 0, capacidad: 0 });
        } else if (dentroDeVentana) setErrorVentana(res.message || 'No se pudo completar la acción');
        else toast.error(res.message || 'No se pudo completar la acción');
        await cargar();
        return false;
      }
      toast.exito(res.data?.mensaje || res.message || 'Listo');
      setVentana(null);
      await cargar();
      if (res.data?.alerta) setAlerta(res.data.alerta); // onCambio al cerrarla
      else onCambio?.();
      return true;
    } finally {
      setProcesando(false);
    }
  };

  const abrir = (v: Ventana) => {
    setErrorVentana('');
    setObservacion('');
    setMarcados([]);
    setVentana(v);
    if (v === 'corregirReporte') {
      setDescripcion(flujo.reporteDescripcion || '');
      setPrioridad(flujo.reportePrioridad || 2);
      setTipoMantenimiento(flujo.reporteTipoMantenimiento === 'Preventivo' ? 'Preventivo' : 'Correctivo');
      const actuales: Record<number, number> = {};
      flujo.items.filter((i) => i.tipo === 'checklist' && i.checklistItemId).forEach((i) => { actuales[i.checklistItemId!] = Number(i.cantidad) || 1; });
      setElegidos(actuales);
    }
    if (v === 'agregarHallazgo') setElegidos({});
    if ((v === 'corregirReporte' || v === 'agregarHallazgo') && plantilla === null && flujo.vehiculoId) {
      void checklistService.getPorVehiculo(flujo.vehiculoId).then((r) => setPlantilla(r.success && r.data ? r.data.items || [] : []));
    }
  };

  const motivos = (): MotivoRechazo[] =>
    marcados.map((m) => {
      const [tipo, id] = m.split(':');
      return { tipo: tipo as MotivoRechazo['tipo'], id: Number(id) };
    });

  const rechazar = (deReporte: boolean) => {
    if (flujo.items.length > 0 && marcados.length === 0) return setErrorVentana('Marca en la lista qué hay que corregir.');
    if (flujo.items.length === 0 && !observacion.trim()) return setErrorVentana('Escribe qué hay que corregir.');
    void ejecutar(
      () => deReporte
        ? flujoService.rechazarReporte(idReporte!, motivos(), observacion.trim() || undefined)
        : flujoService.validarReparacion(idOrden!, false, motivos(), observacion.trim() || undefined),
      true
    );
  };

  const confirmarSimple = async (titulo: string, mensaje: string, textoConfirmar: string, fn: () => Promise<ApiResponse<ResultadoFlujo>>) => {
    if (!(await confirmar({ titulo, mensaje, textoConfirmar, tono: 'info' }))) return;
    await ejecutar(fn);
  };

  /** Termina la revisión de recepción: la orden pasa a "En proceso" (PDF 06-nov: sin pedir diagnóstico) */
  const iniciar = () =>
    void confirmarSimple('Iniciar reparación', 'La orden pasa a "En proceso" y se habilita el registro de avances del checklist.', 'Iniciar reparación', async () => {
      const res = await ordenesService.iniciarTrabajo(idOrden!, {});
      return { ...res, data: res.success ? { mensaje: 'Reparación iniciada' } : undefined } as ApiResponse<ResultadoFlujo>;
    });

  const cancelarReporte = () => {
    if (!observacion.trim()) return setErrorVentana('Escribe el motivo de la cancelación.');
    void ejecutar(() => flujoService.cancelarReporte(idReporte!, observacion.trim()), true);
  };

  const itemsElegidos = (): ItemReporte[] =>
    Object.entries(elegidos).map(([id, cantidad]) => ({
      checklistItemId: Number(id),
      cantidad,
      // conserva la nota que ya traía el trabajo en el reporte
      notas: flujo.items.find((i) => i.tipo === 'checklist' && i.checklistItemId === Number(id))?.notas,
    }));

  const guardarCorreccion = () => {
    if (!descripcion.trim()) return setErrorVentana('La descripción no puede quedar vacía.');
    void ejecutar(
      () => flujoService.corregirReporte(idReporte!, {
        descripcion: descripcion.trim(),
        prioridad,
        tipoMantenimiento,
        items: plantilla && plantilla.length > 0 ? itemsElegidos() : undefined,
        observaciones: observacion.trim() || undefined,
      }),
      true
    );
  };

  const guardarHallazgos = () => {
    if (Object.keys(elegidos).length === 0) return setErrorVentana('Elige al menos un trabajo.');
    const notas = observacion.trim() || undefined;
    void ejecutar(() => flujoService.hallazgos(idOrden!, itemsElegidos().map((i) => ({ ...i, notas }))), true);
  };

  const delUsuario = flujo.items.filter((i) => !i.reportadoPorTaller);
  const delTaller = flujo.items.filter((i) => i.reportadoPorTaller);
  const yaEnOrden = new Set(flujo.items.map((i) => i.checklistItemId));
  const rechazado = flujo.etapas.find((e) => e.clave === 'INSPECCION')?.estado === 'rechazada';

  const listaMarcable = (
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-continental-gray-3/60 p-3" data-testid="motivos-rechazo">
      {flujo.items.map((i) => {
        const clave = `${i.tipo}:${i.id}`;
        return (
          <label key={clave} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-red-600"
              checked={marcados.includes(clave)}
              onChange={(e) => setMarcados((prev) => (e.target.checked ? [...prev, clave] : prev.filter((x) => x !== clave)))}
            />
            <span>
              {i.nombre}
              {i.tipo === 'componente' && <span className="text-continental-gray-2"> (componente)</span>}
              {i.reportadoPorTaller && <span className="text-continental-gray-2"> (hallazgo del taller)</span>}
            </span>
          </label>
        );
      })}
    </div>
  );

  const selectorTrabajos = (excluir?: Set<number | undefined>) =>
    plantilla === null ? (
      <p className="text-sm text-continental-gray-1">Cargando trabajos del checklist...</p>
    ) : plantilla.length === 0 ? (
      <p className="text-sm text-continental-gray-1">El tipo de este vehículo no tiene checklist configurado.</p>
    ) : plantilla.every((p) => excluir?.has(p.id)) ? (
      <p className="text-sm text-continental-gray-1">Todos los trabajos del checklist de este vehículo ya están en la orden.</p>
    ) : (
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-continental-gray-3/60 p-3" data-testid="selector-trabajos">
        {plantilla.filter((p) => !excluir?.has(p.id)).map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <label className="flex flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-orange-500"
                checked={elegidos[p.id] !== undefined}
                onChange={(e) =>
                  setElegidos((prev) => {
                    const n = { ...prev };
                    if (e.target.checked) n[p.id] = 1;
                    else delete n[p.id];
                    return n;
                  })
                }
              />
              {p.pregunta}
            </label>
            {elegidos[p.id] !== undefined && (
              <input
                type="number"
                min={1}
                aria-label={`Cantidad de ${p.pregunta}`}
                className="w-16 rounded border border-continental-gray-3 px-2 py-1"
                value={elegidos[p.id]}
                onChange={(e) => setElegidos((prev) => ({ ...prev, [p.id]: Math.max(1, Number(e.target.value) || 1) }))}
              />
            )}
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-4" data-testid="panel-flujo">
      <FlujoEtapas etapas={flujo.etapas} />

      {flujo.bloqueo && (
        <div className="flex items-start gap-2 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: '#004eaf', backgroundColor: '#eef4fc', color: '#00387d' }}>
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{flujo.bloqueo}</span>
        </div>
      )}

      {flujo.ultimoRechazo && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" data-testid="ultimo-rechazo">
          <p className="font-semibold">
            {flujo.ultimoRechazo.etapa === 'VALIDACION' ? 'Validación rechazada' : 'Inspección rechazada'} por {flujo.ultimoRechazo.usuario}
            {flujo.ultimoRechazo.rol ? ` (${flujo.ultimoRechazo.rol})` : ''} · {formatDateTime(flujo.ultimoRechazo.fecha)}
          </p>
          {flujo.ultimoRechazo.motivos.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {flujo.ultimoRechazo.motivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          {flujo.ultimoRechazo.detalle && <p className="mt-1">Observación: {flujo.ultimoRechazo.detalle}</p>}
        </div>
      )}

      {flujo.items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2" data-testid="items-flujo">
          <div className="rounded-lg border border-continental-gray-3/60 p-3">
            <p className="mb-2 text-sm font-semibold text-continental-black">Reportado por {flujo.reportadoPorNombre || 'el usuario'}</p>
            <ul className="space-y-1 text-sm">
              {delUsuario.map((i) => (
                <li key={`${i.tipo}-${i.id}`} className="flex gap-2"><span className="font-bold text-continental-yellow">X</span>{i.nombre}</li>
              ))}
              {delUsuario.length === 0 && <li className="text-continental-gray-2">Sin trabajos</li>}
            </ul>
          </div>
          <div className="rounded-lg border border-continental-gray-3/60 p-3" data-testid="reportado-por-taller">
            <p className="mb-2 text-sm font-semibold text-continental-black">Reportado por Taller</p>
            <ul className="space-y-1 text-sm">
              {delTaller.map((i) => (
                <li key={`${i.tipo}-${i.id}`} className="flex gap-2">
                  <span className="font-bold text-continental-yellow">X</span>
                  <span>{i.nombre}{i.notas ? <span className="text-continental-gray-2"> — {i.notas}</span> : null}</span>
                </li>
              ))}
              {delTaller.length === 0 && <li className="text-continental-gray-2">Sin hallazgos adicionales</li>}
            </ul>
          </div>
        </div>
      )}

      {flujo.acciones.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="acciones-flujo">
          {puede('validarReporte') && (
            <Button
              onClick={() => void confirmarSimple('Validar reporte',
                'Verifica que la falla corresponde a la condición real del vehículo. Al validar se genera la orden de trabajo.',
                'Validar y generar orden', () => flujoService.validarReporte(idReporte!))}
              disabled={procesando}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" /> Validar reporte
            </Button>
          )}
          {puede('rechazarReporte') && (
            <Button variant="outline" onClick={() => abrir('rechazarReporte')} disabled={procesando} className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" /> Rechazar reporte
            </Button>
          )}
          {puede('corregirReporte') && (
            <Button variant={rechazado ? 'default' : 'outline'} onClick={() => abrir('corregirReporte')} disabled={procesando} className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" /> {rechazado ? 'Corregir y reenviar' : 'Corregir reporte'}
            </Button>
          )}
          {puede('cancelarReporte') && (
            <Button variant="ghost" onClick={() => abrir('cancelarReporte')} disabled={procesando} className="flex items-center gap-2 text-red-600">
              <Ban className="h-4 w-4" /> Cancelar reporte
            </Button>
          )}
          {puede('confirmarTraslado') && (
            <Button
              onClick={() => void confirmarSimple('Confirmar entrega en Zona de Transición',
                `¿La unidad ${flujo.vehiculoCodigo} ya se entregó físicamente en la Zona de Transición (dañados)?`,
                'Confirmar entrega', () => flujoService.confirmarTraslado(idOrden!))}
              disabled={procesando}
              className="flex items-center gap-2"
            >
              <Truck className="h-4 w-4" /> Confirmar entrega en Zona de Transición
            </Button>
          )}
          {puede('aceptarOrden') && (
            <Button
              onClick={() => void confirmarSimple('Aceptar orden de trabajo',
                `La unidad ${flujo.vehiculoCodigo} pasará al taller para su revisión técnica de recepción.`,
                'Aceptar orden', () => flujoService.aceptar(idOrden!))}
              disabled={procesando}
              className="flex items-center gap-2"
            >
              <ClipboardCheck className="h-4 w-4" /> Aceptar orden
            </Button>
          )}
          {puede('iniciarReparacion') && (
            <Button onClick={iniciar} disabled={procesando} className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" /> Iniciar reparación
            </Button>
          )}
          {puede('agregarHallazgo') && (
            <Button variant="outline" onClick={() => abrir('agregarHallazgo')} disabled={procesando} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Agregar hallazgo
            </Button>
          )}
          {puede('terminarReparacion') && onTerminar && (
            <Button onClick={onTerminar} disabled={procesando || !!bloqueoTerminar} title={bloqueoTerminar} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Terminar reparación
            </Button>
          )}
          {puede('confirmarRetorno') && (
            <Button
              onClick={() => void confirmarSimple('Entregar unidad reparada',
                `¿La unidad ${flujo.vehiculoCodigo} ya se entregó en la Zona de Transición (reparados) para su validación?`,
                'Confirmar entrega', () => flujoService.confirmarRetorno(idOrden!))}
              disabled={procesando}
              className="flex items-center gap-2"
            >
              <Truck className="h-4 w-4" /> Confirmar entrega en Zona de Transición
            </Button>
          )}
          {puede('validarReparacion') && (
            <>
              <Button
                variant="success"
                onClick={() => void confirmarSimple('Validar reparación',
                  `Confirma que la falla de la unidad ${flujo.vehiculoCodigo} fue corregida. La unidad quedará disponible para operar.`,
                  'Validar y liberar unidad', () => flujoService.validarReparacion(idOrden!, true, []))}
                disabled={procesando}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" /> Validar reparación
              </Button>
              <Button variant="outline" onClick={() => abrir('rechazarReparacion')} disabled={procesando} className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" /> Rechazar validación
              </Button>
            </>
          )}
          {procesando && <Loader2 className="h-5 w-5 animate-spin self-center text-continental-gray-1" />}
        </div>
      )}
      {puede('terminarReparacion') && onTerminar && bloqueoTerminar && (
        <p className="text-sm text-continental-gray-1" data-testid="bloqueo-terminar" style={{ marginBottom: 0 }}>{bloqueoTerminar}</p>
      )}

      {flujo.historial.length > 0 && (
        <div>
          <button type="button" className="flex items-center gap-1 text-sm font-medium text-continental-blue-dark" onClick={() => setVerHistorial((v) => !v)}>
            <History className="h-4 w-4" /> {verHistorial ? 'Ocultar historial' : `Ver historial (${flujo.historial.length})`}
          </button>
          {verHistorial && (
            <ol className="mt-2 space-y-2 border-l-2 border-continental-gray-3 pl-4 text-sm" data-testid="historial-flujo">
              {[...flujo.historial].reverse().map((h, i) => {
                const conObservacion = h.accion === 'Rechazado' || h.accion === 'Cancelado' || h.accion === 'Cancelada' || h.accion === 'Validado';
                return (
                  <li key={i}>
                    <p className="font-medium text-continental-black">
                      {ETAPA_HISTORIAL[h.etapa] ?? h.etapa} – {ACCION_HISTORIAL[h.accion] ?? h.accion}
                      <span className="font-normal text-continental-gray-1"> · {h.usuario}{h.rol ? ` (${h.rol})` : ''}, {formatDateTime(h.fecha)}</span>
                    </p>
                    {h.motivos.length > 0 && h.accion !== 'Hallazgo' && <p className="text-continental-gray-1">Puntos: {h.motivos.join(', ')}</p>}
                    {h.detalle && <p className="text-continental-gray-1">{conObservacion ? `Observación: ${h.detalle}` : h.detalle}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* ----- Ventanas ----- */}
      <Modal isOpen={ventana === 'cancelarReporte'} onClose={() => setVentana(null)} title="Cancelar reporte"
        description="El reporte deja el flujo y no genera orden de trabajo. Solo se puede cancelar en la etapa INSPECCIÓN." size="md">
        <Textarea label="Motivo de la cancelación" value={observacion} onChange={(e) => { setObservacion(e.target.value); setErrorVentana(''); }}
          placeholder="Por qué se cancela el reporte" />
        {errorVentana && <p className="mt-2 text-sm font-medium text-red-600">{errorVentana}</p>}
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Volver</Button>
          <Button variant="destructive" onClick={cancelarReporte} disabled={procesando}>Cancelar reporte</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'rechazarReporte' || ventana === 'rechazarReparacion'} onClose={() => setVentana(null)}
        title={ventana === 'rechazarReporte' ? 'Rechazar reporte' : 'Rechazar validación'}
        description={flujo.items.length > 0 ? 'Marca lo que hay que corregir (obligatorio) y, si quieres, agrega una observación.' : 'Escribe qué hay que corregir.'}
        size="md">
        <div className="space-y-3">
          {flujo.items.length > 0 && listaMarcable}
          <Textarea label={flujo.items.length > 0 ? 'Observación (opcional)' : 'Qué hay que corregir'} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button variant="destructive" onClick={() => rechazar(ventana === 'rechazarReporte')} disabled={procesando}>Confirmar rechazo</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'corregirReporte'} onClose={() => setVentana(null)} title={rechazado ? 'Corregir y reenviar reporte' : 'Corregir reporte'}
        description={rechazado ? 'Al reenviarlo, el flujo vuelve a empezar en REPORTE y queda pendiente de inspección. El reporte original queda en el historial.' : 'Complementa o corrige los datos antes de validarlo.'}
        size="lg">
        <div className="space-y-3">
          <Textarea label="Descripción de la falla" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Prioridad
              <select className="rounded-lg border border-continental-gray-3 px-3 py-2" value={prioridad} onChange={(e) => setPrioridad(Number(e.target.value))}>
                {Object.entries(PrioridadNombres).filter(([v]) => ['1', '2', '3'].includes(v) || Number(v) === prioridad).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Tipo de mantenimiento
              <select className="rounded-lg border border-continental-gray-3 px-3 py-2" value={tipoMantenimiento} onChange={(e) => setTipoMantenimiento(e.target.value)}>
                <option value="Correctivo">Correctivo</option>
                <option value="Preventivo">Preventivo</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-continental-gray-1" style={{ marginBottom: 0 }}>
            {tipoMantenimiento === 'Correctivo' ? 'Correctivo: el vehículo no puede operar.' : 'Preventivo: el vehículo puede continuar operando.'} La prioridad solo es informativa.
          </p>
          <p className="text-sm font-semibold text-continental-black">Trabajos del reporte</p>
          {selectorTrabajos()}
          <Textarea label="Observaciones (opcional)" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button onClick={guardarCorreccion} disabled={procesando}>{rechazado ? 'Guardar y reenviar' : 'Guardar corrección'}</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'agregarHallazgo'} onClose={() => setVentana(null)} title="Agregar hallazgo del taller"
        description='Fallas que no se detectaron en la inspección. Se agregan a la orden como "Reportado por Taller" sin detener el flujo.' size="lg">
        <div className="space-y-3">
          {selectorTrabajos(yaEnOrden)}
          <Textarea label="Notas (opcional)" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          <p className="flex items-center gap-1 text-xs text-continental-gray-2"><Search className="h-3 w-3" /> La foto de evidencia se sube en la actividad del checklist.</p>
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button onClick={guardarHallazgos} disabled={procesando}>Agregar a la orden</Button>
        </ModalFooter>
      </Modal>

      <AlertaCapacidadModal alerta={alerta} onClose={() => { setAlerta(null); onCambio?.(); }} />
    </div>
  );
}
