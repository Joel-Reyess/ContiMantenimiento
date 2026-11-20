import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, History, Loader2, Plus, RefreshCcw, Save, SlidersHorizontal, Wallet } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Card, Input, LoadingCard, Modal, ModalFooter, Textarea, useToast } from '@/components/ui';
import { useActualizacion } from '@/hooks/useActualizacion';
import { formatDateTime } from '@/lib/utils';
import type { EmpresaSeleccion } from '@/services/flujoService';
import {
  COLOR_SEMAFORO,
  colorDisponibilidad,
  colorFinanciero,
  moneda,
  presupuestoService,
  type ConfigSeleccion,
  type MovimientoPresupuesto,
  type PresupuestoEmpresas,
} from '@/services/presupuestoService';

const TIPO_MOVIMIENTO: Record<string, string> = {
  Asignacion: 'Asignación',
  Ajuste: 'Ajuste',
  Descuento: 'Descuento (orden de pago)',
  Reversion: 'Reversión',
};

type Ventana = null | { empresa: EmpresaSeleccion; tipo: 'Asignacion' | 'Ajuste' };

/**
 * Presupuesto de Empresas (Reporte 6, PRS-01 a PRS-03): presupuesto asignado, utilizado y saldo de cada empresa
 * proveedora; el saldo se descuenta al generarse cada orden de pago y regresa si la orden se elimina. También los
 * parámetros de la selección automática (saldo mínimo, aviso preventivo y capacidad máxima) y las órdenes que esperan
 * proveedor. Solo Administrador del Sistema y Gerente de Mantenimiento.
 */
export function PresupuestoEmpresasPage() {
  const toast = useToast();
  const [datos, setDatos] = useState<PresupuestoEmpresas | null>(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<ConfigSeleccion | null>(null);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [errorConfig, setErrorConfig] = useState('');
  const [movimientos, setMovimientos] = useState<MovimientoPresupuesto[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<number | ''>('');
  const [ventana, setVentana] = useState<Ventana>(null);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorVentana, setErrorVentana] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [reintentando, setReintentando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await presupuestoService.resumen();
    if (res.success && res.data) {
      setDatos(res.data);
      setError('');
      setConfig((c) => c ?? res.data!.config);
    } else setError(res.message || 'No se pudo cargar el presupuesto de empresas');
  }, []);

  const cargarMovimientos = useCallback(async () => {
    const res = await presupuestoService.movimientos(filtroEmpresa || undefined);
    if (res.success && res.data) setMovimientos(res.data);
  }, [filtroEmpresa]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { void cargarMovimientos(); }, [cargarMovimientos]);
  useActualizacion(cargar);

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!datos || !config) return <LoadingCard message="Cargando presupuesto de empresas..." />;

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    setErrorConfig('');
    try {
      const res = await presupuestoService.guardarConfig({
        saldoMinimo: Number(config.saldoMinimo) || 0,
        umbralPreventivo: Number(config.umbralPreventivo) || 0,
        capacidadMaxima: Number(config.capacidadMaxima) || 0,
      });
      if (!res.success) return setErrorConfig(res.message || 'No se pudieron guardar los parámetros');
      toast.exito(res.message || 'Parámetros guardados');
      if (res.data) setConfig(res.data);
      await cargar();
    } finally {
      setGuardandoConfig(false);
    }
  };

  const abrir = (empresa: EmpresaSeleccion, tipo: 'Asignacion' | 'Ajuste') => {
    setVentana({ empresa, tipo });
    setMonto('');
    setMotivo('');
    setErrorVentana('');
  };

  const registrar = async () => {
    if (!ventana) return;
    const n = Number(String(monto).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n) || n === 0 || (ventana.tipo === 'Asignacion' && n <= 0))
      return setErrorVentana(ventana.tipo === 'Asignacion' ? 'Escribe el monto a asignar (mayor a $0).' : 'Escribe el monto del ajuste (negativo para restar).');
    if (ventana.tipo === 'Ajuste' && !motivo.trim()) return setErrorVentana('Escribe el motivo del ajuste.');
    setGuardando(true);
    setErrorVentana('');
    try {
      const res = await presupuestoService.registrar(ventana.empresa.id, ventana.tipo, n, motivo.trim() || undefined);
      if (!res.success) return setErrorVentana(res.message || 'No se pudo registrar');
      const asignadas = res.data?.ordenesAsignadas ?? 0;
      toast.exito(`${res.message || 'Listo'}${asignadas > 0 ? `. ${asignadas} orden(es) en espera quedaron asignadas` : ''}`);
      setVentana(null);
      await Promise.all([cargar(), cargarMovimientos()]);
    } finally {
      setGuardando(false);
    }
  };

  const reintentar = async () => {
    setReintentando(true);
    try {
      const res = await presupuestoService.reintentar();
      if (res.success) toast.exito(res.message || 'Listo');
      else toast.error(res.message || 'No se pudo reintentar');
      await cargar();
    } finally {
      setReintentando(false);
    }
  };

  const numero = (k: keyof ConfigSeleccion) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig({ ...config, [k]: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) });

  return (
    <div className="dashboard-wrapper flex flex-col gap-4" data-testid="pagina-presupuesto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Empresas proveedoras</p>
          <h1 className="text-3xl font-semibold text-continental-black">Presupuesto de Empresas</h1>
          <p className="text-continental-gray-1">
            El saldo de cada empresa se descuenta al generarse su orden de pago. Sin saldo, sin capacidad o inactiva, la empresa no recibe órdenes nuevas.
          </p>
        </div>
        <Button variant="outline" onClick={() => { void cargar(); void cargarMovimientos(); }} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {datos.sinProveedor.length > 0 && (
        <div className="flex flex-col rounded-2xl text-sm md:flex-row md:items-center md:justify-between"
          style={{ backgroundColor: '#f1ebf6', color: '#4b1f6f', padding: '14px 18px', gap: 10, border: '1px solid #4b1f6f' }}
          data-testid="sin-proveedor-lista">
          <div>
            <p className="font-semibold">{datos.sinProveedor.length} orden(es) esperan empresa proveedora (SELECCIÓN · Sin disponibilidad)</p>
            <p>
              {datos.sinProveedor.map((o, i) => (
                <span key={o.ordenId}>
                  {i > 0 ? ', ' : ''}
                  <Link className="font-medium underline" to={`/ordenes/${o.ordenId}`}>{o.ordenFolio}</Link>
                  {o.vehiculoCodigo ? ` (${o.vehiculoCodigo})` : ''}
                </span>
              ))}
            </p>
          </div>
          <Button size="sm" onClick={() => void reintentar()} disabled={reintentando} className="flex items-center gap-2" data-testid="reintentar">
            {reintentando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Reintentar asignación
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="empresas-presupuesto">
        {datos.empresas.map((e) => {
          const usado = e.asignado > 0 ? Math.min(100, Math.max(0, (e.utilizado / e.asignado) * 100)) : 0;
          return (
            <Card key={e.id} className="flex flex-col" style={{ padding: 18, gap: 12 }} data-testid={`empresa-presupuesto-${e.id}`}>
              <div className="flex items-start justify-between" style={{ gap: 8 }}>
                <div>
                  <p className="flex items-center text-lg font-semibold text-continental-black" style={{ gap: 6 }}>
                    <Building2 className="h-5 w-5" /> {e.nombre}
                  </p>
                  <p className="text-xs text-continental-gray-1">{e.identificador} · {e.tecnicos.length} técnico(s) activo(s)</p>
                </div>
                <span className="rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorDisponibilidad(e.disponibilidad), padding: '2px 10px' }}
                  data-testid="disponibilidad">
                  {e.disponibilidad}
                </span>
              </div>
              <div className="grid grid-cols-3 text-sm" style={{ gap: 8 }}>
                <div><p className="text-xs text-continental-gray-1">Asignado</p><p className="font-semibold" data-testid="asignado">{moneda(e.asignado)}</p></div>
                <div><p className="text-xs text-continental-gray-1">Utilizado</p><p className="font-semibold" data-testid="utilizado">{moneda(e.utilizado)}</p></div>
                <div><p className="text-xs text-continental-gray-1">Saldo</p><p className="font-semibold" style={{ color: colorFinanciero(e.estadoFinanciero) }} data-testid="saldo">{moneda(e.saldo)}</p></div>
              </div>
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-continental-gray-4">
                  <div className="h-full rounded-full" style={{ width: `${usado}%`, backgroundColor: colorFinanciero(e.estadoFinanciero) }} />
                </div>
                <p className="text-xs text-continental-gray-1" style={{ marginTop: 4 }} data-testid="estado-financiero">
                  {e.estadoFinanciero}{e.tienePresupuesto && e.asignado > 0 ? ` · ${Math.round(usado)}% utilizado` : ''}
                </p>
              </div>
              <p className="flex items-center text-sm" style={{ gap: 6 }} data-testid="activas">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_SEMAFORO[e.semaforoCapacidad] }} />
                Órdenes activas: <strong>{e.activas} de {e.capacidad}</strong>
              </p>
              {e.motivo && <p className="text-xs font-medium" style={{ color: colorDisponibilidad(e.disponibilidad) }}>{e.motivo}</p>}
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                <Button size="sm" onClick={() => abrir(e, 'Asignacion')} className="flex items-center gap-2" data-testid={`asignar-${e.id}`}>
                  <Plus className="h-4 w-4" /> Asignar presupuesto
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrir(e, 'Ajuste')} className="flex items-center gap-2" data-testid={`ajustar-${e.id}`}>
                  <SlidersHorizontal className="h-4 w-4" /> Ajustar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFiltroEmpresa(e.id)} className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Movimientos
                </Button>
              </div>
            </Card>
          );
        })}
        {datos.empresas.length === 0 && (
          <p className="text-sm text-continental-gray-1">No hay empresas proveedoras registradas. Regístralas en Empresas Proveedoras.</p>
        )}
      </div>

      <Card className="flex flex-col" style={{ padding: 18, gap: 12 }} data-testid="config-seleccion">
        <div>
          <p className="flex items-center text-lg font-semibold text-continental-black" style={{ gap: 6 }}><Wallet className="h-5 w-5" /> Parámetros de asignación</p>
          <p className="text-sm text-continental-gray-1">Las órdenes se reparten por turnos entre las empresas activas con saldo y con capacidad.</p>
        </div>
        <div className="grid md:grid-cols-3" style={{ gap: 12 }}>
          <Input label="Saldo mínimo para recibir órdenes ($)" type="number" min={0} step="0.01" value={config.saldoMinimo}
            onChange={numero('saldoMinimo')} data-testid="config-saldo-minimo" />
          <Input label="Aviso preventivo al quedar (% del presupuesto)" type="number" min={1} max={99} value={config.umbralPreventivo}
            onChange={numero('umbralPreventivo')} data-testid="config-umbral" />
          <Input label="Órdenes activas máximas por empresa" type="number" min={1} max={500} value={config.capacidadMaxima}
            onChange={numero('capacidadMaxima')} data-testid="config-capacidad" />
        </div>
        {errorConfig && <p className="text-sm font-medium text-red-600">{errorConfig}</p>}
        <div>
          <Button onClick={() => void guardarConfig()} disabled={guardandoConfig} className="flex items-center gap-2" data-testid="guardar-config">
            {guardandoConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar parámetros
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col" style={{ padding: 18, gap: 12 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between" style={{ gap: 8 }}>
          <p className="flex items-center text-lg font-semibold text-continental-black" style={{ gap: 6 }}><History className="h-5 w-5" /> Historial de movimientos</p>
          <select className="rounded-lg border border-continental-gray-3 text-sm" style={{ padding: '8px 10px' }} value={filtroEmpresa}
            data-testid="filtro-movimientos" onChange={(e) => setFiltroEmpresa(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todas las empresas</option>
            {datos.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tabla-movimientos">
            <thead>
              <tr className="text-left text-xs uppercase text-continental-gray-1">
                {['Fecha', 'Empresa', 'Movimiento', 'Importe', 'Saldo', 'Orden', 'Motivo', 'Usuario'].map((h) => (
                  <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const resta = m.tipo === 'Descuento' || (m.tipo === 'Ajuste' && m.monto < 0);
                return (
                  <tr key={m.id} className="border-t border-continental-gray-3/60" data-tipo={m.tipo}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{formatDateTime(m.fecha)}</td>
                    <td style={{ padding: '6px 8px' }}>{m.empresa}</td>
                    <td style={{ padding: '6px 8px' }}><Badge variant="secondary">{TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</Badge></td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: resta ? '#c0392b' : '#057855' }} className="font-semibold">
                      {resta ? '−' : '+'}{moneda(Math.abs(m.monto))}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{moneda(m.saldoResultante)}</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {m.folioOrden ?? ''}{m.folioPago ? ` · ${m.folioPago}` : ''}{m.vehiculoCodigo ? ` · ${m.vehiculoCodigo}` : ''}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{m.motivo}</td>
                    <td style={{ padding: '6px 8px' }}>{m.usuario}</td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '10px 8px' }} className="text-continental-gray-1">Sin movimientos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={ventana !== null} onClose={() => setVentana(null)} size="md"
        title={ventana ? `${ventana.tipo === 'Asignacion' ? 'Asignar presupuesto' : 'Ajustar presupuesto'} · ${ventana.empresa.nombre}` : ''}
        description={ventana?.tipo === 'Asignacion' ? 'El monto se suma al presupuesto asignado de la empresa.' : 'Positivo suma y negativo resta al presupuesto asignado. El motivo es obligatorio.'}>
        <div className="flex flex-col" style={{ gap: 10 }} data-testid="ventana-movimiento">
          {ventana && (
            <p className="text-sm text-continental-gray-1">
              Asignado {moneda(ventana.empresa.asignado)} · utilizado {moneda(ventana.empresa.utilizado)} · saldo {moneda(ventana.empresa.saldo)}
            </p>
          )}
          <Input label="Monto ($)" type="number" step="0.01" value={monto} onChange={(e) => { setMonto(e.target.value); setErrorVentana(''); }} data-testid="mov-monto" />
          <Textarea label={ventana?.tipo === 'Ajuste' ? 'Motivo' : 'Motivo (opcional)'}
            value={motivo} onChange={(e) => { setMotivo(e.target.value); setErrorVentana(''); }} data-testid="mov-motivo"
            placeholder={ventana?.tipo === 'Asignacion' ? 'Ej. Presupuesto de noviembre' : 'Por qué se ajusta'} />
          {errorVentana && <p className="text-sm font-medium text-red-600">{errorVentana}</p>}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setVentana(null)} disabled={guardando}>Cancelar</Button>
          <Button onClick={() => void registrar()} disabled={guardando} data-testid="mov-guardar">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
