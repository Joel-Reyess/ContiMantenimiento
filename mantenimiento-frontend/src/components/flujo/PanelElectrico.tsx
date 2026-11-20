import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ban, CheckCircle, ClipboardCheck, FileSignature, Gauge, Loader2, Printer, Save, Stethoscope, Truck, Upload, XCircle,
} from 'lucide-react';
import { Button, Modal, ModalFooter, Textarea, useConfirm, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import type { ApiResponse } from '@/interfaces';
import type { Flujo, ResultadoFlujo } from '@/services/flujoService';
import { electricoService, type ResultadoChecklist } from '@/services/electricoService';
import { ReportFailureModal } from '@/components/tecnico';
import { useAuth } from '@/contexts/AuthContext';

interface PanelElectricoProps {
  flujo: Flujo;
  /** Recarga el seguimiento y avisa a la pantalla */
  onCambio: () => Promise<void> | void;
}

type Ventana = null | 'inspeccion' | 'pruebas' | 'cancelar' | 'documento';

// index.css anula p-*/space-y-* (reglas sin capa): cajas con estilo en línea
const caja: React.CSSProperties = { padding: 12, border: '1px solid #cdcdcd', borderRadius: 8 };
const COLOR_EQUIPO: Record<string, string> = { Operativo: '#2db928', 'Fuera de servicio': '#ff2d37' };
const EXTENSIONES = ['.jpg', '.jpeg', '.png', '.pdf'];

function Dato({ etiqueta, children, testid }: { etiqueta: string; children: React.ReactNode; testid?: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }} data-testid={testid}>
      <span className="text-xs uppercase tracking-wide text-continental-gray-1">{etiqueta}</span>
      <span className="text-sm font-semibold text-continental-black">{children}</span>
    </div>
  );
}

/**
 * Acciones y datos de una orden del flujo de equipos eléctricos (montacargas, tuggers y traspaletas):
 * correctivo (aceptación › ingreso al taller › inspección previa › reparación › pruebas › traslado al área ›
 * aprobación del Líder › documento firmado) y preventivo (checklist jerárquico Buen/Mal estado con código de falla).
 */
export function PanelElectrico({ flujo, onCambio }: PanelElectricoProps) {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const navigate = useNavigate();
  const info = flujo.electrico!;
  const idOrden = flujo.ordenId!;
  const puede = (a: Flujo['acciones'][number]) => flujo.acciones.includes(a);
  const [procesando, setProcesando] = useState(false);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [texto, setTexto] = useState('');
  const [aprobadas, setAprobadas] = useState(true);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [errorVentana, setErrorVentana] = useState('');
  const [reporteCorrectivo, setReporteCorrectivo] = useState(false);

  // ----- Checklist preventivo (estado local editable) -----
  const [resultados, setResultados] = useState<Record<number, ResultadoChecklist>>({});
  const [codigoEncontrado, setCodigoEncontrado] = useState<boolean | null>(null);
  const [codigo, setCodigo] = useState('');
  const [resuelto, setResuelto] = useState<boolean | null>(null);
  const [notas, setNotas] = useState('');
  const [errorChecklist, setErrorChecklist] = useState('');
  const firmaChecklist = JSON.stringify(info.checklist.map((c) => c.actividades.map((a) => [a.id, a.resultado, a.observacion])));
  useEffect(() => {
    const r: Record<number, ResultadoChecklist> = {};
    info.checklist.forEach((c) => c.actividades.forEach((a) => { r[a.id] = { id: a.id, resultado: a.resultado ?? null, observacion: a.observacion ?? '' }; }));
    setResultados(r);
    setCodigoEncontrado(info.codigoFallaEncontrado ?? null);
    setCodigo(info.codigoFalla ?? '');
    setResuelto(info.codigoFallaResuelto ?? null);
    setNotas(info.trabajoRealizado ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaChecklist, info.codigoFallaEncontrado, info.codigoFalla, info.codigoFallaResuelto]);
  const total = useMemo(() => Object.keys(resultados).length, [resultados]);
  const hechas = Object.values(resultados).filter((r) => r.resultado).length;
  const malos = Object.values(resultados).filter((r) => r.resultado === 'Malo').length;
  const editableChecklist = puede('checklistPreventivo');
  const { hasRole } = useAuth();
  // Hallazgos en mal estado: al entregarse el preventivo se ofrece generar el reporte correctivo (el equipo ya está operativo)
  const entregado = flujo.etapas.some((e) => e.clave === 'COMPLETADO' && e.estado === 'completada');
  const ofrecerCorrectivo = info.esPreventivo && entregado && malos > 0 && hasRole(['Administrador', 'Lider', 'Tecnico']);

  const ejecutar = async (fn: () => Promise<ApiResponse<ResultadoFlujo>>, dentroDeVentana = false): Promise<boolean> => {
    setProcesando(true);
    setErrorVentana('');
    try {
      const res = await fn();
      if (!res.success) {
        if (dentroDeVentana) setErrorVentana(res.message || 'No se pudo completar la acción');
        else toast.error(res.message || 'No se pudo completar la acción');
        return false;
      }
      toast.exito(res.data?.mensaje || res.message || 'Listo');
      setVentana(null);
      await onCambio();
      return true;
    } finally {
      setProcesando(false);
    }
  };

  const simple = async (titulo: string, mensaje: string, boton: string, fn: () => Promise<ApiResponse<ResultadoFlujo>>) => {
    if (!(await confirmar({ titulo, mensaje, textoConfirmar: boton, tono: 'info' }))) return;
    await ejecutar(fn);
  };

  const abrir = (v: Ventana) => {
    setTexto('');
    setAprobadas(true);
    setArchivos([]);
    setErrorVentana('');
    setVentana(v);
  };

  const guardarChecklist = async (terminar: boolean) => {
    setErrorChecklist('');
    if (terminar) {
      const faltan = total - hechas;
      if (faltan > 0) return setErrorChecklist(`Faltan ${faltan} actividad(es) por revisar.`);
      const sinObs = Object.values(resultados).filter((r) => r.resultado === 'Malo' && !r.observacion?.trim());
      if (sinObs.length > 0) return setErrorChecklist('Escribe la observación de cada actividad en mal estado.');
      if (codigoEncontrado === null) return setErrorChecklist('Indica si se encontró código de falla.');
      if (codigoEncontrado && (!codigo.trim() || resuelto === null)) return setErrorChecklist('Escribe el código de falla e indica si quedó resuelto.');
      if (!(await confirmar({
        titulo: 'Terminar checklist',
        mensaje: malos > 0
          ? `El checklist tiene ${malos} actividad(es) en mal estado. Al terminar se descuenta el inventario usado y el equipo se lleva a su área. Cuando se entregue podrás generar el reporte correctivo desde esta orden.`
          : 'Todo en buen estado. Al terminar se descuenta el inventario usado y el equipo se lleva a su área.',
        textoConfirmar: 'Terminar checklist', tono: 'info'
      }))) return;
    }
    setProcesando(true);
    try {
      const res = await electricoService.checklist(idOrden, {
        resultados: Object.values(resultados).map((r) => ({ id: r.id, resultado: r.resultado ?? null, observacion: r.observacion?.trim() || undefined })),
        codigoFallaEncontrado: codigoEncontrado,
        codigoFalla: codigo.trim() || undefined,
        codigoFallaResuelto: resuelto,
        notas: notas.trim() || undefined,
      }, terminar);
      if (!res.success) return setErrorChecklist(res.message || 'No se pudo guardar el checklist');
      toast.exito(res.data?.mensaje || res.message || 'Checklist guardado');
      await onCambio();
    } finally {
      setProcesando(false);
    }
  };

  const subirDocumento = () => {
    if (archivos.length === 0) return setErrorVentana('Elige el documento de entrega firmado.');
    if (archivos.length > 3) return setErrorVentana('Puedes subir máximo 3 archivos.');
    const malo = archivos.find((a) => !EXTENSIONES.some((e) => a.name.toLowerCase().endsWith(e)) || a.size > 10 * 1024 * 1024);
    if (malo) return setErrorVentana(`${malo.name}: solo JPG, PNG o PDF de hasta 10 MB.`);
    void ejecutar(() => electricoService.documento(idOrden, archivos), true);
  };

  const radio = (id: number, valor: 'Bueno' | 'Malo', etiqueta: string) => (
    <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0, fontWeight: 500 }}>
      <input
        type="radio"
        name={`res-${id}`}
        disabled={!editableChecklist}
        checked={resultados[id]?.resultado === valor}
        onChange={() => setResultados((p) => ({ ...p, [id]: { ...p[id], resultado: valor } }))}
        style={{ width: 16, height: 16, minHeight: 0, padding: 0 }}
        data-testid={`res-${id}-${valor}`}
      />
      {etiqueta}
    </label>
  );

  return (
    <div className="flex flex-col" style={{ gap: 16 }} data-testid="panel-electrico">
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ ...caja, gap: 12 }}>
        <Dato etiqueta="Estado del equipo" testid="estado-equipo">
          <span style={{ color: COLOR_EQUIPO[info.estadoEquipo] ?? '#333' }}>{info.estadoEquipo}</span>
          {info.subestadoEquipo ? <span className="font-normal text-continental-gray-1"> · {info.subestadoEquipo}</span> : null}
        </Dato>
        <Dato etiqueta={info.esPreventivo ? 'Mantenimiento' : 'Tipo'}>{info.esPreventivo ? `Preventivo ${info.tipoRevision ?? ''}` : 'Correctivo'}</Dato>
        <Dato etiqueta="Número económico">{info.numeroEconomico || '—'}</Dato>
        <Dato etiqueta="Horómetro">{info.horometro != null ? `${info.horometro} h` : '—'}</Dato>
        <Dato etiqueta="Proveedor">{info.empresa || 'Sin proveedor configurado'}</Dato>
        <Dato etiqueta="Técnico responsable">{info.tecnico || 'Por aceptar'}</Dato>
        <Dato etiqueta="Órdenes activas del proveedor">{info.activas} de {info.capacidad}</Dato>
        {info.fechaAprobacionEntrega && <Dato etiqueta="Entrega aprobada">{info.aproboEntrega} · {formatDateTime(info.fechaAprobacionEntrega)}</Dato>}
      </div>

      {(info.diagnostico || info.resultadoPruebas) && !info.esPreventivo && (
        <div className="flex flex-col text-sm" style={{ ...caja, gap: 6 }} data-testid="diagnostico">
          {info.diagnostico && <p style={{ marginBottom: 0 }}><strong>Inspección previa:</strong> {info.diagnostico}</p>}
          {info.resultadoPruebas && <p style={{ marginBottom: 0 }}><strong>Pruebas:</strong> {info.resultadoPruebas}</p>}
        </div>
      )}

      {info.esPreventivo && info.checklist.length > 0 && (
        <div className="flex flex-col" style={{ ...caja, gap: 12 }} data-testid="checklist-preventivo">
          <div className="flex flex-wrap items-center justify-between" style={{ gap: 8 }}>
            <p className="text-base font-semibold text-continental-black" style={{ marginBottom: 0 }}>
              Checklist del preventivo · {hechas} de {total} revisadas{malos > 0 ? ` · ${malos} en mal estado` : ''}
            </p>
            {!editableChecklist && <span className="text-xs text-continental-gray-1">Solo lectura</span>}
          </div>
          {info.checklist.map((c) => (
            <div key={c.numero} className="flex flex-col" style={{ gap: 6 }}>
              <p className="text-sm font-bold text-continental-black" style={{ marginBottom: 0 }}>{c.numero}. {c.nombre}</p>
              {c.actividades.map((a) => {
                const r = resultados[a.id];
                return (
                  <div key={a.id} className="flex flex-col" style={{ gap: 4, paddingLeft: 12, borderLeft: `3px solid ${r?.resultado === 'Malo' ? '#ff2d37' : r?.resultado === 'Bueno' ? '#2db928' : '#cdcdcd'}` }} data-testid={`act-${a.id}`}>
                    <div className="flex flex-wrap items-center justify-between" style={{ gap: 8 }}>
                      <span className="text-sm">{a.numero} {a.descripcion}</span>
                      <div className="flex" style={{ gap: 12 }}>
                        {radio(a.id, 'Bueno', 'Buen estado')}
                        {radio(a.id, 'Malo', 'Mal estado')}
                      </div>
                    </div>
                    {r?.resultado === 'Malo' && (
                      <input
                        type="text"
                        placeholder="Observación (obligatoria)"
                        disabled={!editableChecklist}
                        value={r.observacion ?? ''}
                        maxLength={500}
                        onChange={(e) => setResultados((p) => ({ ...p, [a.id]: { ...p[a.id], observacion: e.target.value } }))}
                        style={{ minHeight: 0, padding: '6px 10px', borderRadius: 8 }}
                        data-testid={`obs-${a.id}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="grid md:grid-cols-3" style={{ gap: 10 }}>
            <label className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0 }}>
              ¿Se encuentra código de falla?
              <select disabled={!editableChecklist} value={codigoEncontrado === null ? '' : codigoEncontrado ? 'si' : 'no'}
                onChange={(e) => setCodigoEncontrado(e.target.value === '' ? null : e.target.value === 'si')} style={{ minHeight: 0, padding: '8px 10px' }} data-testid="codigo-encontrado">
                <option value="">Elige</option><option value="si">Sí</option><option value="no">No</option>
              </select>
            </label>
            {codigoEncontrado && (
              <>
                <label className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0 }}>
                  Código
                  <input disabled={!editableChecklist} value={codigo} maxLength={60} onChange={(e) => setCodigo(e.target.value)} style={{ minHeight: 0, padding: '8px 10px' }} data-testid="codigo-falla" />
                </label>
                <label className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0 }}>
                  ¿Resuelto?
                  <select disabled={!editableChecklist} value={resuelto === null ? '' : resuelto ? 'si' : 'no'}
                    onChange={(e) => setResuelto(e.target.value === '' ? null : e.target.value === 'si')} style={{ minHeight: 0, padding: '8px 10px' }} data-testid="codigo-resuelto">
                    <option value="">Elige</option><option value="si">Sí</option><option value="no">No</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <Textarea label="Notas generales" value={notas} disabled={!editableChecklist} onChange={(e) => setNotas(e.target.value)} data-testid="notas-preventivo" />
          {errorChecklist && <p className="text-sm font-medium text-red-600" style={{ marginBottom: 0 }} data-testid="error-checklist">{errorChecklist}</p>}
          {editableChecklist && (
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              <Button variant="outline" onClick={() => void guardarChecklist(false)} disabled={procesando} className="flex items-center gap-2" data-testid="guardar-checklist">
                <Save className="h-4 w-4" /> Guardar avance
              </Button>
              <Button onClick={() => void guardarChecklist(true)} disabled={procesando} className="flex items-center gap-2" data-testid="terminar-checklist">
                <CheckCircle className="h-4 w-4" /> Terminar checklist
              </Button>
            </div>
          )}
        </div>
      )}

      {info.documentos.length > 0 && (
        <div className="flex flex-col text-sm" style={{ ...caja, gap: 6 }} data-testid="documentos-entrega">
          <p className="font-semibold text-continental-black" style={{ marginBottom: 0 }}>Documento de entrega firmado</p>
          {info.documentos.map((d) => (
            <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="text-continental-blue-dark underline">
              {d.nombreArchivo} <span className="text-continental-gray-1">· {d.subidoPor}, {formatDateTime(d.fecha)}</span>
            </a>
          ))}
        </div>
      )}

      {ofrecerCorrectivo && (
        <div className="flex flex-wrap items-center rounded-lg border border-amber-300 bg-amber-50 text-sm" style={{ padding: 12, gap: 10 }} data-testid="ofrecer-correctivo">
          <span>El preventivo tuvo {malos} actividad(es) en mal estado.</span>
          <Button size="sm" onClick={() => setReporteCorrectivo(true)}>Generar reporte correctivo</Button>
        </div>
      )}

      {flujo.acciones.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="acciones-electrico">
          {puede('aceptarElectrico') && (
            <Button onClick={() => void simple('Aceptar orden', `Quedarás como responsable de la orden ${flujo.ordenFolio}. Recoge el equipo ${flujo.vehiculoCodigo} en su área.`, 'Aceptar orden', () => electricoService.aceptar(idOrden))}
              disabled={procesando} className="flex items-center gap-2" data-testid="aceptar-electrico">
              <ClipboardCheck className="h-4 w-4" /> Aceptar orden
            </Button>
          )}
          {puede('confirmarIngresoTaller') && (
            <Button onClick={() => void simple('Ya está en taller', `¿El equipo ${flujo.vehiculoCodigo} ya está en el taller? Quedará fuera de servicio (${info.esPreventivo ? 'en mantenimiento' : 'en reparación'}).`, 'Ya está en taller', () => electricoService.ingresoTaller(idOrden))}
              disabled={procesando} className="flex items-center gap-2" data-testid="ingreso-taller">
              <Truck className="h-4 w-4" /> Ya está en taller
            </Button>
          )}
          {puede('inspeccionPrevia') && (
            <Button onClick={() => abrir('inspeccion')} disabled={procesando} className="flex items-center gap-2" data-testid="inspeccion-previa">
              <Stethoscope className="h-4 w-4" /> Inspección previa
            </Button>
          )}
          {puede('registrarPruebas') && (
            <Button onClick={() => abrir('pruebas')} disabled={procesando} className="flex items-center gap-2" data-testid="registrar-pruebas">
              <Gauge className="h-4 w-4" /> Registrar pruebas
            </Button>
          )}
          {puede('confirmarTrasladoArea') && (
            <Button onClick={() => void simple('Equipo en su área', `¿El equipo ${flujo.vehiculoCodigo} ya está en su área de origen? El Líder deberá aprobar la entrega en el sistema.`, 'Confirmar', () => electricoService.trasladoArea(idOrden))}
              disabled={procesando} className="flex items-center gap-2" data-testid="traslado-area">
              <Truck className="h-4 w-4" /> Equipo en su área
            </Button>
          )}
          {puede('aprobarEntrega') && (
            <Button variant="success" onClick={() => void simple('Aprobar entrega', `Confirma que recibes el equipo ${flujo.vehiculoCodigo} en tu área. Después firma el formato de entrega.`, 'Aprobar entrega', () => electricoService.aprobarEntrega(idOrden))}
              disabled={procesando} className="flex items-center gap-2" data-testid="aprobar-entrega">
              <CheckCircle className="h-4 w-4" /> Aprobar entrega
            </Button>
          )}
          {puede('subirDocumentoEntrega') && (
            <Button onClick={() => abrir('documento')} disabled={procesando} className="flex items-center gap-2" data-testid="subir-documento">
              <Upload className="h-4 w-4" /> Subir documento firmado
            </Button>
          )}
          {puede('imprimirFormatoEntrega') && (
            <Button variant="outline" onClick={() => window.open(`/formato-entrega/${idOrden}`, '_blank')} className="flex items-center gap-2" data-testid="formato-entrega">
              <Printer className="h-4 w-4" /> Formato de entrega
            </Button>
          )}
          {puede('cancelarElectrico') && (
            <Button variant="ghost" onClick={() => abrir('cancelar')} disabled={procesando} className="flex items-center gap-2 text-red-600" data-testid="cancelar-electrico">
              <Ban className="h-4 w-4" /> Cancelar orden
            </Button>
          )}
          {procesando && <Loader2 className="h-5 w-5 animate-spin self-center text-continental-gray-1" />}
        </div>
      )}

      <Modal isOpen={ventana === 'inspeccion'} onClose={() => setVentana(null)} title="Inspección previa"
        description="Diagnóstico de la falla y trabajo a realizar. Después de registrarla, la orden ya no se puede cancelar." size="md">
        <Textarea label="Diagnóstico" value={texto} onChange={(e) => { setTexto(e.target.value); setErrorVentana(''); }} data-testid="diagnostico-texto" />
        {errorVentana && <p className="mt-2 text-sm font-medium text-red-600">{errorVentana}</p>}
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button onClick={() => texto.trim() ? void ejecutar(() => electricoService.inspeccionPrevia(idOrden, texto.trim()), true) : setErrorVentana('Escribe el diagnóstico.')}
            disabled={procesando} data-testid="guardar-inspeccion">Registrar inspección</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'pruebas'} onClose={() => setVentana(null)} title="Pruebas operativas"
        description="Verifica que la falla quedó corregida. Si no se aprueban, la orden sigue en reparación." size="md">
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex" style={{ gap: 16 }}>
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
              <input type="radio" checked={aprobadas} onChange={() => setAprobadas(true)} style={{ width: 16, height: 16, minHeight: 0, padding: 0 }} data-testid="pruebas-si" /> Aprobadas
            </label>
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
              <input type="radio" checked={!aprobadas} onChange={() => setAprobadas(false)} style={{ width: 16, height: 16, minHeight: 0, padding: 0 }} data-testid="pruebas-no" /> No aprobadas
            </label>
          </div>
          <Textarea label={aprobadas ? 'Calibración y parámetros (opcional)' : 'Qué falló (obligatorio)'} value={texto}
            onChange={(e) => { setTexto(e.target.value); setErrorVentana(''); }} data-testid="pruebas-texto" />
          {errorVentana && <p className="text-sm font-medium text-red-600" style={{ marginBottom: 0 }}>{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button variant={aprobadas ? 'success' : 'destructive'} disabled={procesando} data-testid="guardar-pruebas"
            onClick={() => !aprobadas && !texto.trim() ? setErrorVentana('Escribe qué falló en las pruebas.') : void ejecutar(() => electricoService.pruebas(idOrden, aprobadas, texto.trim() || undefined), true)}>
            {aprobadas ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {aprobadas ? 'Pruebas aprobadas' : 'Regresar a reparación'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'cancelar'} onClose={() => setVentana(null)} title="Cancelar orden"
        description="Solo antes de la inspección previa. El equipo regresa a Operativo." size="md">
        <Textarea label="Motivo de la cancelación" value={texto} onChange={(e) => { setTexto(e.target.value); setErrorVentana(''); }} data-testid="motivo-cancelar-electrico" />
        {errorVentana && <p className="mt-2 text-sm font-medium text-red-600">{errorVentana}</p>}
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Volver</Button>
          <Button variant="destructive" disabled={procesando} data-testid="confirmar-cancelar-electrico"
            onClick={() => texto.trim() ? void ejecutar(() => electricoService.cancelar(idOrden, texto.trim()), true) : setErrorVentana('Escribe el motivo de la cancelación.')}>
            Cancelar orden
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana === 'documento'} onClose={() => setVentana(null)} title="Documento de entrega firmado"
        description="JPG, PNG o PDF; hasta 3 archivos de 10 MB. Una vez cargado no se puede modificar y la orden se cierra." size="md">
        <div className="flex flex-col" style={{ gap: 10 }}>
          <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" data-testid="archivos-entrega"
            onChange={(e) => { setArchivos(Array.from(e.target.files ?? [])); setErrorVentana(''); }} />
          {archivos.length > 0 && (
            <ul className="text-sm text-continental-gray-1">
              {archivos.map((a) => <li key={a.name}>{a.name} · {(a.size / 1024 / 1024).toFixed(2)} MB</li>)}
            </ul>
          )}
          {errorVentana && <p className="text-sm font-medium text-red-600" style={{ marginBottom: 0 }}>{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={procesando}>Cancelar</Button>
          <Button onClick={subirDocumento} disabled={procesando} className="flex items-center gap-2" data-testid="confirmar-documento">
            <FileSignature className="h-4 w-4" /> Subir y cerrar la orden
          </Button>
        </ModalFooter>
      </Modal>

      <ReportFailureModal
        isOpen={reporteCorrectivo}
        onClose={() => setReporteCorrectivo(false)}
        initialVehiculoCodigo={flujo.vehiculoCodigo}
        onSuccess={(reporteId) => { setReporteCorrectivo(false); if (reporteId) navigate(`/reportes/${reporteId}`); }}
      />
    </div>
  );
}
