import { useEffect, useRef, useState } from 'react';
import { Building2, DollarSign, Receipt, Wrench } from 'lucide-react';
import { Alert, AlertDescription, Select, Spinner } from '@/components/ui';
import { dashboardService, type GastoPeriodo, type GastoProveedorFila, type Periodicidad } from '@/services/dashboardService';
import { empresasService } from '@/services/empresasService';
import { formatCurrency } from '@/lib/utils';
import { KPICard } from './KPICard';

const PERIODOS: Record<Periodicidad, number> = { semanal: 8, quincenal: 6, mensual: 6 };
const SIN_EMPRESA = 'Sin empresa (tarifa base)';

const periodicidades = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal (1–15 y 16–fin de mes)' },
  { value: 'mensual', label: 'Mensual' }
];

/** '' = todas las empresas; 'sin' = técnicos sin empresa; o el id de la empresa */
const claveEmpresa = (f: GastoProveedorFila) => (f.empresaId ? String(f.empresaId) : 'sin');

// Celdas con estilo en línea: index.css anula los padding de Tailwind (`* { padding: 0 }`)
const celda: React.CSSProperties = { padding: '8px 10px' };

/** Barra horizontal de una sola serie (magnitud): un solo tono, extremo redondeado, el valor va en texto */
function Barra({ valor, max, titulo }: { valor: number; max: number; titulo: string }) {
  const ancho = max > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / max) * 100) : 0;
  return (
    <div title={titulo} style={{ height: 10, background: 'rgba(15, 23, 42, 0.06)', borderRadius: 4, minWidth: 80 }}>
      <div style={{ width: `${ancho}%`, height: '100%', background: 'var(--continental-blue-dark)', borderRadius: 4 }} />
    </div>
  );
}

/**
 * Dashboard financiero por proveedor (PDF 06-nov, DSH-02): reparaciones, costo total y costo promedio por empresa
 * proveedora, por semana, quincena o mes, con comparación entre proveedores. Sale de las órdenes de pago no rechazadas,
 * en la empresa con la que se generó cada una.
 */
export function GastoProveedores() {
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual');
  const [empresa, setEmpresa] = useState('');
  const [periodoClave, setPeriodoClave] = useState('');
  const [periodos, setPeriodos] = useState<GastoPeriodo[]>([]);
  const [empresas, setEmpresas] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const peticion = useRef(0);

  // Todas las empresas registradas (con o sin gasto) más "sin empresa"
  useEffect(() => {
    empresasService.getAll().then((r) => {
      if (r.success && r.data)
        setEmpresas([
          ...r.data.map((e) => ({ value: String(e.id), label: `${e.nombre}${e.activo ? '' : ' (inactiva)'}` })),
          { value: 'sin', label: SIN_EMPRESA }
        ]);
    });
  }, []);

  const cargar = async (per: Periodicidad) => {
    const id = ++peticion.current;
    setLoading(true);
    setError('');
    try {
      const res = await dashboardService.getGastoProveedores(per, PERIODOS[per]);
      if (id !== peticion.current) return;
      if (!res.success || !res.data) throw new Error(res.message || 'No se pudo cargar el gasto por proveedor');
      const lista = res.data.periodos;
      setPeriodos(lista);
      // Al cambiar de periodicidad se abre el periodo actual
      setPeriodoClave((actual) => (lista.some((p) => p.clave === actual) ? actual : lista[0]?.clave || ''));
    } catch (err) {
      if (id === peticion.current) setError(err instanceof Error ? err.message : 'No se pudo cargar el gasto por proveedor');
    } finally {
      if (id === peticion.current) setLoading(false);
    }
  };

  useEffect(() => {
    void cargar('mensual');
  }, []);

  const cambiarPeriodicidad = (v: string) => {
    const per = v as Periodicidad;
    setPeriodicidad(per);
    void cargar(per);
  };

  const periodo = periodos.find((p) => p.clave === periodoClave) || periodos[0];
  const nombreEmpresa = empresa ? empresas.find((e) => e.value === empresa)?.label || 'Empresa' : 'Todas las empresas';

  /** Totales del periodo para la selección (todas o una empresa) */
  const resumen = (p?: GastoPeriodo) => {
    if (!p) return { reparaciones: 0, costoTotal: 0, costoPromedio: 0 };
    if (!empresa) return { reparaciones: p.reparaciones, costoTotal: p.costoTotal, costoPromedio: p.costoPromedio };
    const f = p.proveedores.find((x) => claveEmpresa(x) === empresa);
    return { reparaciones: f?.reparaciones ?? 0, costoTotal: f?.costoTotal ?? 0, costoPromedio: f?.costoPromedio ?? 0 };
  };
  const actual = resumen(periodo);
  const proveedores = periodo?.proveedores ?? [];
  const maxProveedor = Math.max(0, ...proveedores.map((f) => f.costoTotal));
  const tendencia = periodos.map((p) => ({ p, ...resumen(p) }));
  const maxTendencia = Math.max(0, ...tendencia.map((t) => t.costoTotal));

  return (
    <section className="dashboard-card flex flex-col gap-5" data-testid="gasto-proveedores">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Dashboard financiero</p>
        <h3 className="text-xl font-semibold text-continental-black flex items-center gap-2">
          <Building2 className="h-5 w-5 text-continental-blue-dark" />
          Gasto por proveedor
        </h3>
        <p className="text-sm text-continental-gray-1">
          Órdenes de pago no rechazadas, con los importes de la empresa con la que se generó cada una (fecha de la orden de pago).
        </p>
      </div>

      {/* Filtros en una sola fila */}
      <div className="grid gap-3 md:grid-cols-3">
        <Select
          label="Proveedor"
          value={empresa}
          onChange={setEmpresa}
          options={[{ value: '', label: 'Todas las empresas' }, ...empresas]}
        />
        <Select
          label="Periodicidad"
          value={periodicidad}
          onChange={cambiarPeriodicidad}
          options={periodicidades}
        />
        <Select
          label="Periodo"
          value={periodo?.clave || ''}
          onChange={setPeriodoClave}
          options={periodos.map((p) => ({ value: p.clave, label: p.etiqueta }))}
          disabled={periodos.length === 0}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : !periodo ? null : (
        <>
          <p className="text-sm text-continental-black" data-testid="gasto-resumen">
            <strong>Proveedor:</strong> {nombreEmpresa} · <strong>Periodo:</strong> {periodo.etiqueta} · <strong>Reparaciones:</strong>{' '}
            {actual.reparaciones} · <strong>Costo total:</strong> {formatCurrency(actual.costoTotal)} · <strong>Costo promedio:</strong>{' '}
            {formatCurrency(actual.costoPromedio)}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <KPICard label="Reparaciones" value={actual.reparaciones} variant="blue" icon={<Wrench className="h-6 w-6" />} />
            <KPICard label="Costo total facturado" value={formatCurrency(actual.costoTotal)} variant="yellow" icon={<DollarSign className="h-6 w-6" />} />
            <KPICard label="Costo promedio por reparación" value={formatCurrency(actual.costoPromedio)} variant="green" icon={<Receipt className="h-6 w-6" />} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-continental-black">Comparación entre proveedores · {periodo.etiqueta}</p>
            {proveedores.length === 0 ? (
              <p className="text-sm text-continental-gray-1">Sin órdenes de pago en este periodo.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm" data-testid="comparacion-proveedores">
                  <thead className="bg-continental-bg text-continental-gray-1 text-left">
                    <tr>
                      <th style={celda}>Proveedor</th>
                      <th style={celda} className="text-right">Reparaciones</th>
                      <th style={celda} className="text-right">Costo total</th>
                      <th style={celda} className="text-right">Costo promedio</th>
                      <th style={{ ...celda, width: '28%' }}>Participación en el gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.map((f) => {
                      const elegido = empresa === claveEmpresa(f);
                      const pct = periodo.costoTotal > 0 ? Math.round((f.costoTotal / periodo.costoTotal) * 100) : 0;
                      return (
                        <tr key={claveEmpresa(f)} className={`border-t border-continental-gray-3/60 ${elegido ? 'bg-continental-yellow/10' : ''}`}>
                          <td style={celda} className={elegido ? 'font-bold text-continental-black' : 'text-continental-black'}>{f.empresa}</td>
                          <td style={celda} className="text-right">{f.reparaciones}</td>
                          <td style={celda} className="text-right">{formatCurrency(f.costoTotal)}</td>
                          <td style={celda} className="text-right">{formatCurrency(f.costoPromedio)}</td>
                          <td style={celda}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Barra valor={f.costoTotal} max={maxProveedor} titulo={`${f.empresa}: ${formatCurrency(f.costoTotal)} (${pct}%)`} />
                              </div>
                              <span className="w-10 text-right text-xs text-continental-gray-1">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-continental-gray-3 font-semibold">
                      <td style={celda}>Total</td>
                      <td style={celda} className="text-right">{periodo.reparaciones}</td>
                      <td style={celda} className="text-right">{formatCurrency(periodo.costoTotal)}</td>
                      <td style={celda} className="text-right">{formatCurrency(periodo.costoPromedio)}</td>
                      <td style={celda} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold text-continental-black">Evolución · {nombreEmpresa}</p>
            <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
              <table className="min-w-full text-sm" data-testid="evolucion-proveedores">
                <thead className="bg-continental-bg text-continental-gray-1 text-left">
                  <tr>
                    <th style={celda}>Periodo</th>
                    <th style={celda} className="text-right">Reparaciones</th>
                    <th style={celda} className="text-right">Costo total</th>
                    <th style={celda} className="text-right">Costo promedio</th>
                    <th style={{ ...celda, width: '28%' }} />
                  </tr>
                </thead>
                <tbody>
                  {tendencia.map((t) => (
                    <tr
                      key={t.p.clave}
                      className={`border-t border-continental-gray-3/60 cursor-pointer hover:bg-continental-gray-4/40 ${t.p.clave === periodo.clave ? 'bg-continental-yellow/10 font-semibold' : ''}`}
                      onClick={() => setPeriodoClave(t.p.clave)}
                      title="Ver este periodo"
                    >
                      <td style={celda}>{t.p.etiqueta}</td>
                      <td style={celda} className="text-right">{t.reparaciones}</td>
                      <td style={celda} className="text-right">{formatCurrency(t.costoTotal)}</td>
                      <td style={celda} className="text-right">{formatCurrency(t.costoPromedio)}</td>
                      <td style={celda}>
                        <Barra valor={t.costoTotal} max={maxTendencia} titulo={`${t.p.etiqueta}: ${formatCurrency(t.costoTotal)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
