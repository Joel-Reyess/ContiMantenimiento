import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock, Gauge, Wrench, Zap } from 'lucide-react';
import { Alert, AlertDescription, Spinner } from '@/components/ui';
import { useActualizacion } from '@/hooks/useActualizacion';
import { COLOR_PREVENTIVO, electricosService, type IndicadoresElectricos as Indicadores } from '@/services/electricosService';
import { KPICard } from './KPICard';

// Celdas con estilo en línea: index.css anula los padding de Tailwind (`* { padding: 0 }`)
const celda: React.CSSProperties = { padding: '8px 10px', whiteSpace: 'nowrap' };

function semaforo(activas: number, capacidad: number) {
  if (capacidad <= 0) return '#969696';
  if (activas >= capacidad) return '#ff2d37';
  return activas >= Math.round(capacidad * 0.7) ? '#e6a700' : '#2db928';
}

/** Barra de una sola serie: un solo tono, el valor va en texto */
function Barra({ valor, max }: { valor: number; max: number }) {
  const ancho = max > 0 ? Math.max(valor > 0 ? 3 : 0, (valor / max) * 100) : 0;
  return (
    <span style={{ display: 'block', height: 8, background: 'rgba(15, 23, 42, 0.06)', borderRadius: 4, minWidth: 80 }}>
      <span style={{ display: 'block', width: `${ancho}%`, height: '100%', background: 'var(--continental-blue-dark)', borderRadius: 4 }} />
    </span>
  );
}

/**
 * Indicadores de equipos eléctricos (EQE-12): equipos fuera de servicio por tipo y motivo, tiempo promedio fuera de
 * servicio (órdenes cerradas en 90 días), cumplimiento de preventivos, vencidos y próximos, órdenes activas contra el
 * tope del proveedor y fallas recurrentes por equipo (correctivos en 180 días).
 */
export function IndicadoresElectricos() {
  const [datos, setDatos] = useState<Indicadores | null>(null);
  const [error, setError] = useState('');

  const aplicar = useCallback((r: Awaited<ReturnType<typeof electricosService.indicadores>>) => {
    if (r.success && r.data) {
      setDatos(r.data);
      setError('');
    } else setError(r.message || 'No se pudieron cargar los indicadores de equipos eléctricos');
  }, []);
  const cargar = useCallback(async () => aplicar(await electricosService.indicadores()), [aplicar]);

  useEffect(() => {
    let vigente = true;
    void electricosService.indicadores().then((r) => { if (vigente) aplicar(r); });
    return () => { vigente = false; };
  }, [aplicar]);
  useActualizacion(cargar);

  const maxFallas = Math.max(0, ...(datos?.fallasRecurrentes ?? []).map((f) => f.correctivos));

  return (
    <section className="dashboard-card flex flex-col gap-5" data-testid="indicadores-electricos">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Montacargas, tuggers y traspaletas</p>
        <h3 className="text-xl font-semibold text-continental-black flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: '#ff8c00' }} />
          Equipos eléctricos
        </h3>
        <p className="text-sm text-continental-gray-1">
          Estado de los equipos, cumplimiento del mantenimiento preventivo y carga del proveedor.{' '}
          <Link to="/equipos-electricos" className="font-medium text-continental-blue-dark underline-offset-2 hover:underline">Ver equipos</Link>
        </p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!datos && !error && <Spinner />}

      {datos && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="kpis-electricos">
            <KPICard label="Fuera de servicio" value={`${datos.fueraDeServicio} de ${datos.totalEquipos}`} variant={datos.fueraDeServicio > 0 ? 'red' : 'green'} icon={<Wrench className="h-6 w-6" />} />
            <KPICard label="Tiempo promedio fuera de servicio" value={datos.horasPromedioFueraServicio === null || datos.horasPromedioFueraServicio === undefined ? '—' : `${datos.horasPromedioFueraServicio.toLocaleString('es-MX')} h`} variant="blue" icon={<Clock className="h-6 w-6" />} />
            <KPICard label="Cumplimiento de preventivos" value={`${datos.cumplimientoPreventivos}%`} variant={datos.preventivosVencidos > 0 ? 'yellow' : 'green'} icon={<CalendarClock className="h-6 w-6" />} />
            <KPICard label={datos.proveedor ? `Órdenes activas · ${datos.proveedor}` : 'Órdenes activas (sin proveedor)'} value={`${datos.activas} de ${datos.capacidad}`} variant="default" icon={<Gauge className="h-6 w-6" />} />
          </div>

          <div className="flex flex-wrap items-center text-sm" style={{ gap: 12 }}>
            <span className="flex items-center" style={{ gap: 6 }} data-testid="preventivos-vencidos">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_PREVENTIVO.Vencido }} />
              Preventivos vencidos: <strong>{datos.preventivosVencidos}</strong>
            </span>
            <span className="flex items-center" style={{ gap: 6 }} data-testid="preventivos-proximos">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_PREVENTIVO.Pendiente }} />
              Próximos 7 días: <strong>{datos.preventivosProximos}</strong>
            </span>
            <span className="flex items-center" style={{ gap: 6 }}>
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: semaforo(datos.activas, datos.capacidad) }} />
              Tope del proveedor: <strong>{datos.activas} de {datos.capacidad}</strong>
            </span>
          </div>

          <div className="grid lg:grid-cols-2" style={{ gap: 16 }}>
            <div className="flex flex-col" style={{ gap: 6 }}>
              <p className="text-sm font-semibold text-continental-black">Fuera de servicio por tipo y motivo</p>
              {datos.fueraPorTipo.length === 0 ? (
                <p className="text-sm text-continental-gray-1">Todos los equipos están operativos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" data-testid="fuera-por-tipo">
                    <thead>
                      <tr className="text-left text-xs uppercase text-continental-gray-1">
                        <th style={celda}>Tipo</th>
                        <th style={{ ...celda, textAlign: 'right' }}>Correctivo</th>
                        <th style={{ ...celda, textAlign: 'right' }}>Preventivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.fueraPorTipo.map((f) => (
                        <tr key={f.tipo} className="border-t border-continental-gray-3/60">
                          <td style={celda} className="font-medium text-continental-black">{f.tipo}</td>
                          <td style={{ ...celda, textAlign: 'right' }}>{f.correctivo}</td>
                          <td style={{ ...celda, textAlign: 'right' }}>{f.preventivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              <p className="text-sm font-semibold text-continental-black">Fallas recurrentes por equipo (correctivos, 180 días)</p>
              {datos.fallasRecurrentes.length === 0 ? (
                <p className="text-sm text-continental-gray-1">Sin correctivos en los últimos 180 días.</p>
              ) : (
                <ul className="flex flex-col text-sm" style={{ gap: 8 }} data-testid="fallas-recurrentes">
                  {datos.fallasRecurrentes.map((f) => (
                    <li key={f.vehiculoId} className="flex flex-col" style={{ gap: 2 }}>
                      <span className="flex justify-between" style={{ gap: 8 }}>
                        <span>{f.equipo} <span className="text-continental-gray-1">{f.tipo ? `(${f.tipo})` : ''}</span></span>
                        <span className="font-medium">{f.correctivos}</span>
                      </span>
                      <Barra valor={f.correctivos} max={maxFallas} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
