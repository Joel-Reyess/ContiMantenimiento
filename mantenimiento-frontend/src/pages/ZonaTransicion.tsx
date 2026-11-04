import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, RefreshCcw, Search, ShieldCheck, Truck, Wrench } from 'lucide-react';
import { Badge, Button, LoadingCard, useConfirm, useToast } from '@/components/ui';
import { AlertaCapacidadModal, CapacidadZonas } from '@/components/flujo';
import { useActualizacion } from '@/hooks/useActualizacion';
import { flujoService, type AlertaCapacidad, type ReportePorInspeccionar, type UnidadZona, type ZonaTransicion } from '@/services/flujoService';
import { formatDateTime } from '@/lib/utils';
import { PrioridadNombres } from '@/interfaces/Api.interface';

/**
 * Zona de Transición (PDF 23-oct-2026): capacidad de cada zona, filas de espera y las unidades
 * de cada etapa con la acción que le toca a cada rol.
 */
export function ZonaTransicionPage() {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [zona, setZona] = useState<ZonaTransicion | null>(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState<number | null>(null);
  const [alerta, setAlerta] = useState<AlertaCapacidad | null>(null);

  const cargar = useCallback(async () => {
    const res = await flujoService.zona();
    if (res.success && res.data) {
      setZona(res.data);
      setError('');
    } else setError(res.message || 'No se pudo cargar la Zona de Transición');
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  // Ocupación y filas de espera al momento: se actualizan solas cada 20 s
  useActualizacion(cargar);

  const accion = async (u: UnidadZona, tipo: 'confirmarTraslado' | 'aceptarOrden' | 'confirmarRetorno') => {
    const textos = {
      confirmarTraslado: ['Confirmar entrega en Zona de Transición', `¿La unidad ${u.vehiculoCodigo} ya se entregó físicamente en la zona de dañados?`, 'Confirmar entrega'],
      aceptarOrden: ['Aceptar orden de trabajo', `La unidad ${u.vehiculoCodigo} (${u.ordenFolio}) pasará al taller para su revisión técnica de recepción.`, 'Aceptar orden'],
      confirmarRetorno: ['Entregar unidad reparada', `¿La unidad ${u.vehiculoCodigo} ya se entregó en la zona de reparados para su validación?`, 'Confirmar entrega'],
    }[tipo];
    if (!(await confirmar({ titulo: textos[0], mensaje: textos[1], textoConfirmar: textos[2], tono: 'info' }))) return;
    setProcesando(u.ordenId);
    try {
      const res = tipo === 'confirmarTraslado'
        ? await flujoService.confirmarTraslado(u.ordenId)
        : tipo === 'aceptarOrden'
          ? await flujoService.aceptar(u.ordenId)
          : await flujoService.confirmarRetorno(u.ordenId);
      if (!res.success) {
        if (res.errors?.includes('SinEspacio'))
          setAlerta({ zona: tipo === 'confirmarRetorno' ? 'reparados' : 'danados', nivel: 'saturada', mensaje: res.message || 'Sin espacio disponible.', ocupados: 0, capacidad: 0 });
        else toast.error(res.message || 'No se pudo completar la acción');
      } else {
        toast.exito(res.data?.mensaje || 'Listo');
        if (res.data?.alerta) setAlerta(res.data.alerta);
      }
      await cargar();
    } finally {
      setProcesando(null);
    }
  };

  if (error) return <div className="dashboard-wrapper"><p className="text-red-600">{error}</p></div>;
  if (!zona) return <LoadingCard message="Cargando Zona de Transición..." />;

  const tarjeta = (u: UnidadZona, extra?: React.ReactNode) => (
    <div key={u.ordenId} className="list-tile space-y-2 rounded-2xl border border-continental-gray-3/60 p-4" data-testid={`unidad-${u.ordenId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-continental-black">
            {u.vehiculoCodigo}{u.vehiculoTipo ? ` · ${u.vehiculoTipo}` : ''}
          </p>
          <p className="text-xs text-continental-gray-1">
            <Link to={`/ordenes/${u.ordenId}`} className="font-medium text-continental-blue-dark underline-offset-2 hover:underline">{u.ordenFolio}</Link>
            {u.reporteFolio ? ` · ${u.reporteFolio}` : ''} · Prioridad {PrioridadNombres[u.prioridad] ?? u.prioridad} · desde {formatDateTime(u.desde)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {u.posicionFila !== undefined && u.posicionFila !== null && (
            <Badge variant="secondary">Fila: lugar {u.posicionFila}</Badge>
          )}
          {u.sinEspacio && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: '#004eaf' }}>Sin espacio</span>
          )}
        </div>
      </div>
      {u.descripcion && <p className="line-clamp-2 text-sm text-continental-gray-1">{u.descripcion}</p>}
      {u.tecnico && <p className="text-xs text-continental-gray-1">Técnico: {u.tecnico}</p>}
      {extra}
    </div>
  );

  const boton = (u: UnidadZona, tipo: 'confirmarTraslado' | 'aceptarOrden' | 'confirmarRetorno', texto: string) =>
    u.acciones.includes(tipo) && (
      <Button size="sm" onClick={() => void accion(u, tipo)} disabled={procesando !== null} className="flex items-center gap-2">
        {tipo === 'aceptarOrden' ? <ClipboardCheck className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
        {procesando === u.ordenId ? 'Procesando...' : texto}
      </Button>
    );

  const seccion = (titulo: string, icono: React.ReactNode, ayuda: string, cantidad: number, contenido: React.ReactNode, testid: string) => (
    <div className="dashboard-card space-y-4 p-5 md:p-6" data-testid={testid}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-continental-black">
          {icono} {titulo} <Badge variant="secondary">{cantidad}</Badge>
        </h2>
        <p className="text-sm text-continental-gray-1">{ayuda}</p>
      </div>
      {cantidad === 0 ? <p className="text-sm text-continental-gray-2">Sin unidades.</p> : <div className="space-y-3">{contenido}</div>}
    </div>
  );

  const reporte = (r: ReportePorInspeccionar) => (
    <div key={r.reporteId} className="list-tile flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-continental-gray-3/60 p-4">
      <div>
        <p className="font-semibold text-continental-black">{r.vehiculoCodigo}{r.vehiculoTipo ? ` · ${r.vehiculoTipo}` : ''}</p>
        <p className="text-xs text-continental-gray-1">{r.folio} · {r.reportadoPor} · {formatDateTime(r.fecha)}</p>
        {r.descripcion && <p className="mt-1 line-clamp-2 text-sm text-continental-gray-1">{r.descripcion}</p>}
      </div>
      <div className="flex items-center gap-2">
        {r.estado === 2
          ? <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Rechazado: en corrección</span>
          : <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">En validación</span>}
        <Link to={`/reportes/${r.reporteId}`}><Button size="sm" variant="outline">Revisar</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="dashboard-wrapper space-y-5">
      <div className="dashboard-card flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Zona de Transición</p>
          <h1 className="text-2xl font-bold text-continental-black">Zona de Transición</h1>
          <p className="text-sm text-continental-gray-1">
            Capacidad de cada zona, fila de espera y unidades por etapa. Una unidad solo entra si hay espacio; si no, espera su turno.
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <CapacidadZonas capacidad={zona.capacidad} />

      {seccion('Reportes por inspeccionar', <Search className="h-5 w-5" />,
        'El Líder verifica la falla y valida el reporte antes del traslado.', zona.porInspeccionar.length,
        zona.porInspeccionar.map(reporte), 'zona-por-inspeccionar')}

      {seccion('Pendientes de traslado a la zona (dañados)', <Truck className="h-5 w-5" />,
        'Reportes validados. El Operador o Líder confirma la entrega física; si la zona está llena, esperan su turno en la fila.',
        zona.porTrasladar.length, zona.porTrasladar.map((u) => tarjeta(u, boton(u, 'confirmarTraslado', 'Confirmar entrega en zona'))), 'zona-por-trasladar')}

      {seccion(`En zona — vehículos dañados (${zona.capacidad.danados.ocupados}/${zona.capacidad.danados.capacidad})`, <ClipboardList className="h-5 w-5" />,
        'Esperando que un técnico acepte la orden y lleve la unidad al taller.',
        zona.enZonaDanados.length, zona.enZonaDanados.map((u) => tarjeta(u, boton(u, 'aceptarOrden', 'Aceptar orden'))), 'zona-danados')}

      {seccion('Reparadas, pendientes de entrega (reparados)', <Wrench className="h-5 w-5" />,
        'Reparación concluida. El técnico confirma la entrega; si la zona está llena, la unidad sigue bajo responsabilidad del Taller.',
        zona.porEntregar.length, zona.porEntregar.map((u) => tarjeta(u, boton(u, 'confirmarRetorno', 'Confirmar entrega en zona'))), 'zona-por-entregar')}

      {seccion(`En zona — vehículos reparados (${zona.capacidad.reparados.ocupados}/${zona.capacidad.reparados.capacidad})`, <ShieldCheck className="h-5 w-5" />,
        'Pendientes de la validación final del Líder o del Gerente de Mantenimiento.',
        zona.enZonaReparados.length,
        zona.enZonaReparados.map((u) => tarjeta(u, u.acciones.includes('validarReparacion') && (
          <Link to={`/ordenes/${u.ordenId}`}><Button size="sm" variant="success">Revisar y validar</Button></Link>
        ))), 'zona-reparados')}

      <AlertaCapacidadModal alerta={alerta} onClose={() => setAlerta(null)} />
    </div>
  );
}
