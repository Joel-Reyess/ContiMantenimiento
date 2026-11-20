import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Gauge, Loader2, PlayCircle, RefreshCcw, Zap } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, Input, LoadingCard, Modal, ModalFooter, SearchInput, Select, useToast } from '@/components/ui';
import { ReportFailureModal } from '@/components/tecnico';
import { useAuth } from '@/contexts/AuthContext';
import { useActualizacion } from '@/hooks/useActualizacion';
import {
  COLOR_PREVENTIVO,
  colorEstadoEquipo,
  electricosService,
  fechaDia,
  horas,
  type EquipoElectrico,
  type EquiposElectricos,
} from '@/services/electricosService';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Distintivo({ color, texto, testid }: { color: string; texto: string; testid?: string }) {
  return (
    <span className="inline-flex items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: color, padding: '2px 10px' }} data-testid={testid}>
      {texto}
    </span>
  );
}

function diasTexto(e: EquipoElectrico): string {
  if (e.estadoPreventivo === 'En proceso') return 'en proceso';
  if (e.diasParaVencer === undefined || e.diasParaVencer === null) return '';
  if (e.diasParaVencer < 0) return `vencido hace ${-e.diasParaVencer} día(s)`;
  if (e.diasParaVencer === 0) return 'vence hoy';
  return `en ${e.diasParaVencer} día(s)`;
}

type Ventana = null | { tipo: 'preventivo' | 'fecha'; equipo: EquipoElectrico };

/**
 * Equipos eléctricos (montacargas, tuggers y traspaletas): estado operativo (Operativo / Fuera de servicio con su
 * subestado), orden abierta, preventivo programado (Programado, Pendiente, En proceso, Vencido) con próxima fecha y
 * horas, y el tope de órdenes activas del proveedor. Acciones según el rol: el Líder y el Técnico reportan fallas, solo
 * los Técnicos del proveedor inician el preventivo y el Administrador ajusta la fecha. El Operador solo consulta.
 */
export function EquiposElectricosPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [datos, setDatos] = useState<EquiposElectricos | null>(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPreventivo, setFiltroPreventivo] = useState('');
  const [ventana, setVentana] = useState<Ventana>(null);
  const [horometro, setHorometro] = useState('');
  const [fecha, setFecha] = useState('');
  const [errorVentana, setErrorVentana] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [reportar, setReportar] = useState<EquipoElectrico | null>(null);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof electricosService.listar>>) => {
    if (r.success && r.data) {
      setDatos(r.data);
      setError('');
    } else setError(r.message || 'No se pudieron cargar los equipos eléctricos');
  }, []);
  const cargar = useCallback(async () => aplicar(await electricosService.listar()), [aplicar]);

  useEffect(() => {
    let vigente = true;
    void electricosService.listar().then((r) => { if (vigente) aplicar(r); });
    return () => { vigente = false; };
  }, [aplicar]);
  useActualizacion(cargar);

  const tipos = useMemo(() => [...new Set((datos?.equipos ?? []).map((e) => e.tipo).filter(Boolean) as string[])].sort(), [datos]);

  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    return (datos?.equipos ?? []).filter((e) => {
      if (filtroTipo && e.tipo !== filtroTipo) return false;
      if (filtroEstado && e.estadoEquipo !== filtroEstado) return false;
      if (filtroPreventivo && e.estadoPreventivo !== filtroPreventivo) return false;
      if (!q) return true;
      return [e.codigo, e.numeroEconomico, e.tipo, e.area, e.marca, e.modelo, e.numeroSerie, e.ordenFolio]
        .some((x) => x && sinAcentos(x).includes(q));
    });
  }, [datos, busqueda, filtroTipo, filtroEstado, filtroPreventivo]);

  if (error && !datos) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!datos) return <LoadingCard message="Cargando equipos eléctricos..." />;

  const abrir = (tipo: 'preventivo' | 'fecha', equipo: EquipoElectrico) => {
    setVentana({ tipo, equipo });
    setErrorVentana('');
    setHorometro('');
    setFecha(equipo.proximoPreventivo ? equipo.proximoPreventivo.slice(0, 10) : '');
  };

  const iniciarPreventivo = async () => {
    if (!ventana) return;
    const h = Number(horometro);
    if (!horometro.trim() || !Number.isFinite(h) || h <= 0) return setErrorVentana('Captura el horómetro actual del equipo.');
    setGuardando(true);
    setErrorVentana('');
    try {
      const r = await electricosService.iniciarPreventivo(ventana.equipo.vehiculoId, h);
      if (!r.success || !r.data) return setErrorVentana(r.message || 'No se pudo iniciar el preventivo');
      toast.exito(r.data.mensaje || r.message || 'Preventivo iniciado');
      setVentana(null);
      if (r.data.ordenId) navigate(`/ordenes/${r.data.ordenId}`);
      else await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const ajustarFecha = async () => {
    if (!ventana) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setErrorVentana('Elige la fecha del próximo preventivo.');
    setGuardando(true);
    setErrorVentana('');
    try {
      const r = await electricosService.ajustarProximo(ventana.equipo.vehiculoId, fecha);
      if (!r.success) return setErrorVentana(r.message || 'No se pudo ajustar la fecha');
      toast.exito(r.message || 'Fecha actualizada');
      setVentana(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const soloLectura = !hasRole(['Administrador', 'Lider', 'Tecnico']);
  const tope = datos.capacidad > 0 ? datos.activas / datos.capacidad : 0;
  const colorTope = datos.activas >= datos.capacidad ? '#ff2d37' : tope >= 0.7 ? '#e6a700' : '#2db928';
  const fuera = datos.equipos.filter((e) => e.estadoEquipo !== 'Operativo').length;
  const vencidos = datos.equipos.filter((e) => e.estadoPreventivo === 'Vencido').length;
  const pendientes = datos.equipos.filter((e) => e.estadoPreventivo === 'Pendiente').length;

  return (
    <div className="dashboard-wrapper flex flex-col gap-4" data-testid="pagina-equipos-electricos">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Montacargas, tuggers y traspaletas</p>
          <h1 className="text-3xl font-semibold text-continental-black">Equipos eléctricos</h1>
          <p className="text-continental-gray-1">
            Estado de cada equipo y su mantenimiento preventivo (cada {datos.equipos[0]?.periodicidadDias ?? 30} días o por horas de uso, lo que ocurra primero).
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }} data-testid="resumen-electricos">
        <Card style={{ padding: 14 }}>
          <p className="text-xs uppercase text-continental-gray-1">Equipos</p>
          <p className="text-2xl font-semibold text-continental-black">{datos.equipos.length}</p>
        </Card>
        <Card style={{ padding: 14 }}>
          <p className="text-xs uppercase text-continental-gray-1">Fuera de servicio</p>
          <p className="text-2xl font-semibold" style={{ color: fuera > 0 ? '#ff2d37' : undefined }}>{fuera}</p>
        </Card>
        <Card style={{ padding: 14 }}>
          <p className="text-xs uppercase text-continental-gray-1">Preventivos vencidos / pendientes</p>
          <p className="text-2xl font-semibold"><span style={{ color: COLOR_PREVENTIVO.Vencido }}>{vencidos}</span> / <span style={{ color: COLOR_PREVENTIVO.Pendiente }}>{pendientes}</span></p>
        </Card>
        <Card style={{ padding: 14 }} data-testid="tope-proveedor">
          <p className="text-xs uppercase text-continental-gray-1">{datos.proveedor ? `Órdenes activas · ${datos.proveedor}` : 'Proveedor eléctrico'}</p>
          {datos.proveedor ? (
            <p className="flex items-center text-2xl font-semibold" style={{ gap: 8 }}>
              <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorTope }} />
              {datos.activas} de {datos.capacidad}
            </p>
          ) : (
            <p className="text-sm font-medium" style={{ color: '#9a6700' }}>Sin proveedor configurado (Empresas Proveedoras)</p>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-4" style={{ gap: 12 }}>
        <SearchInput placeholder="Buscar por número económico, código, área, serie..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)} data-testid="buscar-equipo" />
        <Select value={filtroTipo} onChange={setFiltroTipo} data-testid="filtro-tipo"
          options={[{ value: '', label: 'Todos los tipos' }, ...tipos.map((t) => ({ value: t, label: t }))]} />
        <Select value={filtroEstado} onChange={setFiltroEstado} data-testid="filtro-estado"
          options={[{ value: '', label: 'Todos los estados' }, { value: 'Operativo', label: 'Operativo' }, { value: 'Fuera de servicio', label: 'Fuera de servicio' }]} />
        <Select value={filtroPreventivo} onChange={setFiltroPreventivo} data-testid="filtro-preventivo"
          options={[{ value: '', label: 'Todos los preventivos' }, ...['Programado', 'Pendiente', 'En proceso', 'Vencido'].map((x) => ({ value: x, label: x }))]} />
      </div>

      {soloLectura && (
        <p className="text-sm text-continental-gray-1" data-testid="solo-lectura">
          Consulta de solo lectura. Si un equipo falla, avisa al Líder de tu área para que lo reporte.
        </p>
      )}

      {datos.equipos.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <p className="text-sm text-continental-gray-1">
            No hay equipos eléctricos registrados. Un tipo de vehículo se vuelve eléctrico en Configuración → Tipos de vehículo (Flujo de mantenimiento).
          </p>
        </Card>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-continental-gray-1">No hay equipos con esos filtros.</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3" style={{ gap: 16 }} data-testid="lista-equipos">
          {visibles.map((e) => (
            <Card key={e.vehiculoId} className="flex flex-col" style={{ padding: 16, gap: 10 }} data-testid={`equipo-${e.vehiculoId}`}>
              <div className="flex items-start justify-between" style={{ gap: 8 }}>
                <div className="min-w-0">
                  <p className="flex items-center text-lg font-semibold text-continental-black" style={{ gap: 6 }}>
                    <Zap className="h-5 w-5 flex-shrink-0" style={{ color: '#ff8c00' }} />
                    <span className="truncate">{e.numeroEconomico || e.codigo}</span>
                  </p>
                  <p className="text-xs text-continental-gray-1">
                    {e.tipo} · {e.codigo}{e.area ? ` · ${e.area}` : ''}
                  </p>
                  {(e.marca || e.modelo || e.numeroSerie) && (
                    <p className="text-xs text-continental-gray-1">{[e.marca, e.modelo, e.numeroSerie && `S/N ${e.numeroSerie}`].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <div className="flex flex-col items-end" style={{ gap: 4 }}>
                  <Distintivo color={colorEstadoEquipo(e.estadoEquipo, e.subestadoEquipo)} texto={e.estadoEquipo} testid="estado-equipo" />
                  {e.subestadoEquipo && <span className="text-xs font-medium text-continental-gray-1" data-testid="subestado-equipo">{e.subestadoEquipo}</span>}
                </div>
              </div>

              {e.ordenId && (
                <p className="text-sm" data-testid="orden-abierta">
                  Orden {e.ordenTipo === 'Preventivo' ? 'preventiva' : 'correctiva'}:{' '}
                  <Link to={`/ordenes/${e.ordenId}`} className="font-semibold text-continental-blue-dark underline">{e.ordenFolio}</Link>
                </p>
              )}

              <div className="rounded-lg border border-continental-gray-3/70 text-sm" style={{ padding: 10 }}>
                <div className="flex flex-wrap items-center justify-between" style={{ gap: 6 }}>
                  <span className="flex items-center font-semibold text-continental-black" style={{ gap: 6 }}>
                    <CalendarClock className="h-4 w-4" /> Preventivo
                  </span>
                  <Distintivo color={COLOR_PREVENTIVO[e.estadoPreventivo] ?? '#969696'} texto={e.estadoPreventivo} testid="estado-preventivo" />
                </div>
                <p className="text-continental-gray-1" style={{ marginTop: 4 }} data-testid="proximo-preventivo">
                  Próximo: <strong className="text-continental-black">{fechaDia(e.proximoPreventivo)}</strong>
                  {diasTexto(e) ? ` (${diasTexto(e)})` : ''}
                </p>
                <p className="text-continental-gray-1">Último: {e.ultimoPreventivo ? new Date(e.ultimoPreventivo).toLocaleDateString('es-MX') : 'sin registro'}</p>
                <p className="flex items-center text-continental-gray-1" style={{ gap: 6 }} data-testid="horas-equipo">
                  <Gauge className="h-4 w-4" /> Horómetro: {horas(e.horometro)}
                  {e.horasPreventivo ? ` · ${e.horasDesdePreventivo !== undefined && e.horasDesdePreventivo !== null ? horas(e.horasDesdePreventivo) : '—'} de ${horas(e.horasPreventivo)}` : ''}
                </p>
              </div>

              {e.acciones.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {e.acciones.includes('reportar') && (
                    <Button size="sm" variant="outline" onClick={() => setReportar(e)} className="flex items-center gap-2" data-testid="reportar-falla">
                      <AlertTriangle className="h-4 w-4" /> Reportar falla
                    </Button>
                  )}
                  {e.acciones.includes('iniciarPreventivo') && (
                    <Button size="sm" onClick={() => abrir('preventivo', e)} className="flex items-center gap-2" data-testid="iniciar-preventivo">
                      <PlayCircle className="h-4 w-4" /> Iniciar preventivo
                    </Button>
                  )}
                  {e.acciones.includes('ajustarFecha') && (
                    <Button size="sm" variant="ghost" onClick={() => abrir('fecha', e)} className="flex items-center gap-2" data-testid="ajustar-fecha">
                      <CalendarClock className="h-4 w-4" /> Ajustar fecha
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={ventana?.tipo === 'preventivo'} onClose={() => setVentana(null)} size="md"
        title={`Iniciar preventivo · ${ventana?.equipo.numeroEconomico || ventana?.equipo.codigo || ''}`}
        description="Al iniciarlo aceptas la orden: recoge el equipo y confirma su ingreso al taller.">
        <div className="flex flex-col" style={{ gap: 10 }} data-testid="ventana-preventivo">
          {ventana && (
            <p className="text-sm text-continental-gray-1">
              Estado: <strong>{ventana.equipo.estadoPreventivo}</strong> · próximo {fechaDia(ventana.equipo.proximoPreventivo)}.
              {ventana.equipo.estadoPreventivo === 'Programado' && ventana.equipo.horasPreventivo
                ? ` Aún no abre la ventana de ${7} días: solo se puede iniciar si el equipo ya llegó a ${horas(ventana.equipo.horasPreventivo)} desde el último preventivo.`
                : ''}
            </p>
          )}
          <Input label="Horómetro actual (horas)" type="number" min={0} step="0.1" value={horometro}
            onChange={(ev) => { setHorometro(ev.target.value); setErrorVentana(''); }} data-testid="horometro-preventivo"
            hint={ventana?.equipo.horometro ? `Último registrado: ${horas(ventana.equipo.horometro)}` : undefined} />
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={guardando}>Cancelar</Button>
          <Button onClick={() => void iniciarPreventivo()} disabled={guardando} data-testid="confirmar-preventivo">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Iniciar y aceptar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={ventana?.tipo === 'fecha'} onClose={() => setVentana(null)} size="sm"
        title={`Próximo preventivo · ${ventana?.equipo.numeroEconomico || ventana?.equipo.codigo || ''}`}
        description="El sistema la calcula sola al completar cada preventivo; aquí la ajusta el Administrador.">
        <div className="flex flex-col" style={{ gap: 10 }} data-testid="ventana-fecha">
          <Input label="Fecha" type="date" value={fecha} onChange={(ev) => { setFecha(ev.target.value); setErrorVentana(''); }} data-testid="fecha-preventivo" />
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={guardando}>Cancelar</Button>
          <Button onClick={() => void ajustarFecha()} disabled={guardando} data-testid="guardar-fecha">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <ReportFailureModal
        isOpen={reportar !== null}
        onClose={() => setReportar(null)}
        initialVehiculoCodigo={reportar?.codigo ?? null}
        forceFormStep
        onSuccess={() => { setReportar(null); void cargar(); }}
      />
    </div>
  );
}
