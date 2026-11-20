import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CircleSlash, Gauge } from 'lucide-react';
import { Alert, AlertDescription, Spinner } from '@/components/ui';
import { useActualizacion } from '@/hooks/useActualizacion';
import {
  COLOR_SEMAFORO,
  colorDisponibilidad,
  colorFinanciero,
  moneda,
  presupuestoService,
  type IndicadoresProveedores as Indicadores,
} from '@/services/presupuestoService';

// Celdas con estilo en línea: index.css anula los padding de Tailwind (`* { padding: 0 }`).
// Los importes no se parten; los encabezados, la empresa y la disponibilidad sí (solo si hace falta), para que la tabla
// quepa en la tarjeta del tablero sin desplazarla de lado (antes se cortaba "Costo promedio")
const celda: React.CSSProperties = { padding: '8px 6px', whiteSpace: 'nowrap' };
const encabezado: React.CSSProperties = { ...celda, whiteSpace: 'normal', verticalAlign: 'bottom' };
const celdaTexto: React.CSSProperties = { ...celda, whiteSpace: 'normal' };

function Punto({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, flexShrink: 0 }} />;
}

/**
 * Indicadores por empresa proveedora (Reporte 6, DSH-03). Operativos: disponibilidad actual, órdenes atendidas,
 * reparaciones concluidas y pendientes, órdenes activas con semáforo por capacidad (0-6 verde, 7-9 amarillo, 10 rojo)
 * y órdenes sin proveedor. Financieros: presupuesto asignado, utilizado y saldo, costo promedio por reparación y
 * gasto por tipo de vehículo (de las órdenes de pago vigentes).
 */
export function IndicadoresProveedores() {
  const [datos, setDatos] = useState<Indicadores | null>(null);
  const [error, setError] = useState('');

  const aplicar = useCallback((r: Awaited<ReturnType<typeof presupuestoService.indicadores>>) => {
    if (r.success && r.data) {
      setDatos(r.data);
      setError('');
    } else setError(r.message || 'No se pudieron cargar los indicadores por proveedor');
  }, []);
  const cargar = useCallback(async () => aplicar(await presupuestoService.indicadores()), [aplicar]);

  useEffect(() => {
    let vigente = true;
    void presupuestoService.indicadores().then((r) => { if (vigente) aplicar(r); });
    return () => { vigente = false; };
  }, [aplicar]);
  // Se actualiza sola cada 20 s, como el resto del tablero
  useActualizacion(cargar);

  return (
    <section className="dashboard-card flex flex-col gap-5" data-testid="indicadores-proveedores">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Empresas proveedoras</p>
        <h3 className="text-xl font-semibold text-continental-black flex items-center gap-2">
          <Gauge className="h-5 w-5 text-continental-blue-dark" />
          Indicadores por empresa
        </h3>
        <p className="text-sm text-continental-gray-1">
          Disponibilidad, carga de trabajo y presupuesto de cada empresa. Activas = órdenes aceptadas por el taller que aún no llegan a DISPONIBLE.
        </p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!datos && !error && <Spinner />}

      {datos && (
        <>
          <div className="flex flex-wrap items-center text-sm" style={{ gap: 10 }}>
            <span className="flex items-center rounded-full font-semibold"
              data-testid="ordenes-sin-proveedor"
              style={{
                gap: 6, padding: '4px 12px',
                backgroundColor: datos.ordenesSinProveedor > 0 ? '#4b1f6f' : 'rgba(15, 23, 42, 0.06)',
                color: datos.ordenesSinProveedor > 0 ? '#fff' : 'var(--continental-black, #000)'
              }}>
              <CircleSlash className="h-4 w-4" /> Órdenes sin proveedor disponible: {datos.ordenesSinProveedor}
            </span>
            <span className="flex items-center text-continental-gray-1" style={{ gap: 12 }}>
              <span className="flex items-center" style={{ gap: 4 }}><Punto color={COLOR_SEMAFORO.verde} /> Con capacidad</span>
              <span className="flex items-center" style={{ gap: 4 }}><Punto color={COLOR_SEMAFORO.amarillo} /> Cerca del límite</span>
              <span className="flex items-center" style={{ gap: 4 }}><Punto color={COLOR_SEMAFORO.rojo} /> En su capacidad máxima ({datos.capacidadMaxima})</span>
            </span>
            <Link to="/presupuesto-empresas" className="font-medium text-continental-blue-dark underline-offset-2 hover:underline">Presupuesto de Empresas</Link>
          </div>

          {datos.empresas.length === 0 ? (
            <p className="text-sm text-continental-gray-1">No hay empresas proveedoras registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" data-testid="tabla-indicadores-proveedores">
                <thead>
                  <tr className="text-left text-xs uppercase text-continental-gray-1">
                    {['Empresa', 'Disponibilidad', 'Activas', 'Atendidas', 'Concluidas', 'Pendientes', 'Asignado', 'Utilizado', 'Saldo', 'Costo promedio'].map((h, i) => (
                      <th key={h} style={{ ...encabezado, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.empresas.map((e) => (
                    <tr key={e.empresaId} className="border-t border-continental-gray-3/60" data-testid={`indicador-${e.empresaId}`}>
                      <td style={{ ...celdaTexto, minWidth: 140 }} className="font-semibold text-continental-black">
                        <span className="flex items-center" style={{ gap: 6 }}><Building2 className="h-4 w-4 flex-shrink-0" />{e.empresa}</span>
                      </td>
                      <td style={{ ...celdaTexto, minWidth: 110 }} title={e.motivo}>
                        <span className="flex items-center" style={{ gap: 6 }}><Punto color={colorDisponibilidad(e.disponibilidad)} />{e.disponibilidad}</span>
                      </td>
                      <td style={{ ...celda, textAlign: 'right' }} data-testid="activas">
                        <span className="inline-flex items-center" style={{ gap: 6 }}><Punto color={COLOR_SEMAFORO[e.semaforoCapacidad]} />{e.activas} de {e.capacidad}</span>
                      </td>
                      <td style={{ ...celda, textAlign: 'right' }}>{e.ordenesAtendidas}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{e.reparacionesConcluidas}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{e.reparacionesPendientes}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{e.tienePresupuesto ? moneda(e.asignado) : '—'}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{moneda(e.utilizado)}</td>
                      <td style={{ ...celda, textAlign: 'right', color: colorFinanciero(e.estadoFinanciero) }} className="font-semibold" title={e.estadoFinanciero}>
                        {e.tienePresupuesto ? moneda(e.saldo) : 'Sin presupuesto'}
                      </td>
                      <td style={{ ...celda, textAlign: 'right' }}>{moneda(e.costoPromedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {datos.empresas.some((e) => e.gastoPorTipo.length > 0) && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              <p className="text-sm font-semibold text-continental-black">Gasto por tipo de vehículo</p>
              <div className="grid md:grid-cols-2 xl:grid-cols-3" style={{ gap: 12 }} data-testid="gasto-por-tipo">
                {datos.empresas.filter((e) => e.gastoPorTipo.length > 0).map((e) => {
                  const max = Math.max(...e.gastoPorTipo.map((g) => g.total), 0);
                  return (
                    <div key={e.empresaId} className="rounded-xl border border-continental-gray-3/60" style={{ padding: 12 }}>
                      <p className="text-sm font-semibold text-continental-black" style={{ marginBottom: 6 }}>{e.empresa}</p>
                      <ul className="flex flex-col text-sm" style={{ gap: 6 }}>
                        {e.gastoPorTipo.map((g) => (
                          <li key={g.tipo} className="flex flex-col" style={{ gap: 2 }}>
                            <span className="flex justify-between" style={{ gap: 8 }}>
                              <span>{g.tipo} <span className="text-continental-gray-1">({g.reparaciones})</span></span>
                              <span className="font-medium">{moneda(g.total)}</span>
                            </span>
                            <span style={{ height: 8, background: 'rgba(15, 23, 42, 0.06)', borderRadius: 4 }}>
                              <span style={{ display: 'block', width: `${max > 0 ? Math.max(2, (g.total / max) * 100) : 0}%`, height: '100%', background: 'var(--continental-blue-dark)', borderRadius: 4 }} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
