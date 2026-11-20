import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { History, Filter, BarChart3, DollarSign, ChevronRight, FileText, Wrench } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import {
  vehiculosService,
  type ConteoHistorial,
  type HistorialVehiculo,
  type HistorialVehiculoFiltros,
  type IntervencionHistorial,
  type PeriodoCosto
} from '@/services/vehiculosService';

/*
 * Historial de mantenimiento individual del vehículo (Reporte 6, FLT-11 a FLT-16).
 * index.css tiene "* { margin:0; padding:0 }" fuera de capa: los rellenos, márgenes y separaciones van en estilos
 * en línea (p-*, space-y-* y ml-* de Tailwind no se aplican).
 */

const BARRA = '#2563eb';
const FONDO_BARRA = '#e5e7eb';
const TEXTO_SUAVE = '#6b7280';
const BORDE = '#e5e7eb';

const fecha = (s?: string | null) =>
  s ? new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s)) : '—';
const fechaHora = (s: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
const dinero = (n?: number | null) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const mes = (p: string) => {
  const [a, m] = p.split('-').map(Number);
  if (!m) return p;
  const t = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(new Date(a, m - 1, 1));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const estiloSeccion: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const estiloGrilla = (min: number): CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12
});
const estiloCampo: CSSProperties = {
  width: '100%', height: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
  fontSize: 14, color: '#111827', transform: 'none', boxShadow: 'none', boxSizing: 'border-box'
};

function colorEstado(estado: string): CSSProperties {
  if (estado === 'Validada' || estado === 'Entregado') return { background: '#dcfce7', color: '#166534' };
  if (estado === 'Cancelada') return { background: '#f3f4f6', color: '#4b5563' };
  if (estado === 'SinOrden') return { background: '#fef3c7', color: '#92400e' };
  if (estado === 'Completada') return { background: '#dbeafe', color: '#1e40af' };
  return { background: '#ffedd5', color: '#9a3412' };
}

function Etiqueta({ children, estilo }: { children: ReactNode; estilo?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11,
        fontWeight: 600, lineHeight: '16px', background: '#f3f4f6', color: '#374151', ...estilo
      }}
    >
      {children}
    </span>
  );
}

function Tile({ titulo, valor, detalle, testid }: { titulo: string; valor: ReactNode; detalle?: ReactNode; testid?: string }) {
  return (
    <div data-testid={testid} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: '12px 14px', background: '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: TEXTO_SUAVE, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4, overflowWrap: 'anywhere' }}>{valor}</div>
      {detalle && <div style={{ fontSize: 12, color: TEXTO_SUAVE, marginTop: 2 }}>{detalle}</div>}
    </div>
  );
}

/** Lista ordenada con barra proporcional (una sola serie: un solo color, sin leyenda) */
function Ranking({ titulo, filas, vacio, unidad = 'eventos', mostrarImporte = false, testid }: {
  titulo: string; filas: ConteoHistorial[]; vacio: string; unidad?: string; mostrarImporte?: boolean; testid?: string;
}) {
  const valor = (f: ConteoHistorial) => (mostrarImporte ? f.importe ?? 0 : f.eventos);
  const max = Math.max(1, ...filas.map(valor));
  return (
    <div data-testid={testid} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: 14, minWidth: 0 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{titulo}</h4>
      {filas.length === 0 ? (
        <p style={{ fontSize: 13, color: TEXTO_SUAVE }}>{vacio}</p>
      ) : (
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
          {filas.slice(0, 8).map((f, i) => (
            <li key={f.nombre + i} title={`${f.nombre}: ${f.eventos} ${f.eventos === 1 ? 'evento' : 'eventos'}${f.importe != null ? ` · ${dinero(f.importe)}` : ''}`}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                <span style={{ color: TEXTO_SUAVE, fontWeight: 700, minWidth: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, color: '#111827', overflowWrap: 'anywhere' }}>{f.nombre}</span>
                <span style={{ color: '#111827', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {mostrarImporte ? dinero(f.importe) : `${f.eventos} ${f.eventos === 1 ? unidad.replace(/s$/, '') : unidad}`}
                </span>
              </div>
              <div style={{ marginLeft: 24, marginTop: 4, height: 6, background: FONDO_BARRA, borderRadius: 4 }}>
                <div style={{ width: `${Math.max(2, (valor(f) / max) * 100)}%`, height: 6, background: BARRA, borderRadius: 4 }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TablaPeriodos({ titulo, filas, etiqueta, testid }: { titulo: string; filas: PeriodoCosto[]; etiqueta: (p: string) => string; testid?: string }) {
  const max = Math.max(1, ...filas.map((f) => f.importe));
  const celda: CSSProperties = { padding: '6px 6px', borderBottom: `1px solid ${BORDE}`, textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <div data-testid={testid} style={{ border: `1px solid ${BORDE}`, borderRadius: 12, padding: 14, minWidth: 0 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{titulo}</h4>
      {filas.length === 0 ? (
        <p style={{ fontSize: 13, color: TEXTO_SUAVE }}>Sin órdenes de pago en este periodo.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: TEXTO_SUAVE }}>
                <th style={{ ...celda, textAlign: 'left' }}>Periodo</th>
                <th style={celda}>Importe</th>
                <th style={celda}>Variación</th>
                <th style={celda}>Reparaciones</th>
                <th style={celda}>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.periodo}>
                  <td style={{ ...celda, textAlign: 'left' }}>
                    <div>{etiqueta(f.periodo)}</div>
                    <div style={{ marginTop: 4, height: 4, minWidth: 60, background: FONDO_BARRA, borderRadius: 4 }} title={dinero(f.importe)}>
                      <div style={{ width: `${Math.max(2, (f.importe / max) * 100)}%`, height: 4, background: BARRA, borderRadius: 4 }} />
                    </div>
                  </td>
                  <td style={{ ...celda, fontWeight: 600 }}>{dinero(f.importe)}</td>
                  <td style={celda}>
                    {f.variacionPct == null ? '—' : `${f.variacionPct > 0 ? '▲ +' : f.variacionPct < 0 ? '▼ ' : ''}${f.variacionPct}%`}
                  </td>
                  <td style={celda}>{f.intervenciones}</td>
                  <td style={celda}>{dinero(f.promedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Intervencion({ i, verCostos }: { i: IntervencionHistorial; verCostos: boolean }) {
  const destino = i.ordenId ? `/ordenes/${i.ordenId}` : i.reporteId ? `/reportes/${i.reporteId}` : undefined;
  const hechas = i.actividades.filter((a) => a.completada);
  const pendientes = i.actividades.filter((a) => !a.completada);
  const contenido = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{i.ordenFolio ?? 'Sin orden de trabajo'}</span>
          {i.reporteFolio && <Etiqueta>Reporte {i.reporteFolio}</Etiqueta>}
          <Etiqueta estilo={{ background: '#eff6ff', color: '#1d4ed8' }}>{i.tipoMantenimiento}</Etiqueta>
          <Etiqueta estilo={colorEstado(i.estado)}>{i.estadoNombre}</Etiqueta>
        </div>
        <span style={{ fontSize: 13, color: TEXTO_SUAVE, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {fecha(i.fecha)}
          {destino && <ChevronRight className="h-4 w-4" />}
        </span>
      </div>
      {i.descripcionFalla && (
        <p style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
          <span style={{ color: TEXTO_SUAVE, fontWeight: 600 }}>Falla reportada: </span>{i.descripcionFalla}
        </p>
      )}
      {!i.ordenId ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Fallas señaladas en el reporte</div>
          <div style={{ color: '#111827', overflowWrap: 'anywhere' }}>{i.fallasReportadas.length ? i.fallasReportadas.join(', ') : '—'}</div>
        </div>
      ) : (
      <div style={{ ...estiloGrilla(200), marginTop: 10, fontSize: 13 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Componentes intervenidos</div>
          <div style={{ color: '#111827', overflowWrap: 'anywhere' }}>{i.componentes.length ? i.componentes.join(', ') : '—'}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Actividades realizadas</div>
          <div style={{ color: '#111827', overflowWrap: 'anywhere' }} data-testid="actividades">
            {hechas.length ? hechas.map((a) => `${a.nombre}${a.cantidad !== 1 ? ` ×${a.cantidad}` : ''}${a.hallazgo ? ' (hallazgo)' : ''}`).join(', ') : '—'}
            {pendientes.length > 0 && (
              <span style={{ color: TEXTO_SUAVE }}> · Pendientes: {pendientes.map((a) => a.nombre).join(', ')}</span>
            )}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Técnico / empresa</div>
          <div style={{ color: '#111827', overflowWrap: 'anywhere' }} data-testid="tecnico-empresa">
            {i.tecnico ?? 'Sin técnico'}{i.tecnico && !i.tecnicoActivo ? ' (desactivado)' : ''}
            {' · '}{i.empresa ?? 'Sin empresa'}
          </div>
        </div>
        {verCostos && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Importe de la reparación</div>
            <div style={{ color: '#111827', fontWeight: 700 }} data-testid="importe">
              {i.importe != null ? `${dinero(i.importe)}${i.pagoFolio ? ` · ${i.pagoFolio}` : ''}` : 'Sin orden de pago'}
            </div>
          </div>
        )}
      </div>
      )}
      {i.materiales.length > 0 && (
        <p style={{ fontSize: 12, color: TEXTO_SUAVE, marginTop: 8 }}>
          Materiales: {i.materiales.map((m) => `${m.nombre} (${m.cantidad})`).join(', ')}
        </p>
      )}
      {(i.lineaTiempo?.length ?? 0) > 1 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: TEXTO_SUAVE, fontWeight: 600, fontSize: 12 }}>Línea de tiempo del proceso</div>
          <ol data-testid="linea-tiempo" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, listStyle: 'none' }}>
            {i.lineaTiempo!.map((e, n) => (
              <li key={n} style={{ fontSize: 12, color: '#374151', background: '#f8fafc', border: `1px solid ${BORDE}`, borderRadius: 999, padding: '2px 10px' }}>
                <span style={{ fontWeight: 600 }}>{e.etapa}</span> · {fechaHora(e.fecha)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
  const estilo: CSSProperties = {
    display: 'block', border: `1px solid ${BORDE}`, borderRadius: 12, padding: 14, background: '#fff',
    color: 'inherit', textDecoration: 'none'
  };
  return destino ? (
    <Link to={destino} data-testid="intervencion" style={estilo} className="hover:shadow-md transition-shadow"
      aria-label={`Abrir ${i.ordenFolio ? `la orden ${i.ordenFolio}` : `el reporte ${i.reporteFolio}`}`}>
      {contenido}
    </Link>
  ) : (
    <div data-testid="intervencion" style={estilo}>{contenido}</div>
  );
}

const FILTROS_VACIOS: HistorialVehiculoFiltros = {
  desde: '', hasta: '', tipoMantenimiento: '', componente: '', empresaId: '', tecnicoId: '', estado: ''
};

export function HistorialMantenimiento({ vehiculoId }: { vehiculoId: number }) {
  const [filtros, setFiltros] = useState<HistorialVehiculoFiltros>(FILTROS_VACIOS);
  const [datos, setDatos] = useState<HistorialVehiculo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const peticion = useRef(0);

  useEffect(() => {
    const n = ++peticion.current;
    setCargando(true);
    setError('');
    vehiculosService.getHistorialMantenimiento(vehiculoId, filtros)
      .then((r) => {
        if (n !== peticion.current) return;
        if (r.success && r.data) setDatos(r.data);
        else setError(r.message || 'No se pudo cargar el historial de mantenimiento.');
      })
      .catch(() => { if (n === peticion.current) setError('Error de conexión al cargar el historial de mantenimiento.'); })
      .finally(() => { if (n === peticion.current) setCargando(false); });
  }, [vehiculoId, filtros]);

  const hayFiltros = useMemo(() => Object.values(filtros).some((v) => v), [filtros]);
  const cambiar = (k: keyof HistorialVehiculoFiltros) => (e: { target: { value: string } }) =>
    setFiltros((f) => ({ ...f, [k]: e.target.value }));

  const select = (k: keyof HistorialVehiculoFiltros, etiqueta: string, todos: string,
    opciones: { valor: string; nombre: string; activo?: boolean }[]) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 0 }}>
      {etiqueta}
      <select value={filtros[k] ?? ''} onChange={cambiar(k)} style={estiloCampo} data-testid={`filtro-${k}`}>
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.nombre}{o.activo === false ? ' (inactivo)' : ''}</option>
        ))}
      </select>
    </label>
  );

  if (!datos && cargando) {
    return (
      <Card id="historial" style={{ scrollMarginTop: 110 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size="lg" /></div>
      </Card>
    );
  }
  if (!datos) {
    return (
      <Card id="historial" style={{ scrollMarginTop: 110 }}>
        <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>
      </Card>
    );
  }

  const { resumen, estadisticas, economico, verCostos } = datos;
  const op = datos.filtros;

  return (
    <div id="historial" data-testid="historial-mantenimiento" style={{ ...estiloSeccion, scrollMarginTop: 110 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <History className="h-5 w-5 text-continental-blue" /> Historial de mantenimiento
        </h2>
        <span style={{ fontSize: 13, color: TEXTO_SUAVE, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {cargando && <Spinner size="sm" />}
          {datos.intervenciones.length} {datos.intervenciones.length === 1 ? 'intervención' : 'intervenciones'}
          {datos.hayFiltros ? ' con los filtros aplicados' : ''}
        </span>
      </div>

      {/* Filtros (FLT-16) */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter className="h-4 w-4" /> Filtros
          </h3>
          {hayFiltros && (
            <Button size="sm" variant="outline" onClick={() => setFiltros(FILTROS_VACIOS)} data-testid="limpiar-filtros">
              Limpiar filtros
            </Button>
          )}
        </div>
        <div style={estiloGrilla(160)}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 0 }}>
            Desde
            <input type="date" value={filtros.desde ?? ''} max={filtros.hasta || undefined} onChange={cambiar('desde')} style={estiloCampo} data-testid="filtro-desde" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 0 }}>
            Hasta
            <input type="date" value={filtros.hasta ?? ''} min={filtros.desde || undefined} onChange={cambiar('hasta')} style={estiloCampo} data-testid="filtro-hasta" />
          </label>
          {select('tipoMantenimiento', 'Tipo de mantenimiento', 'Todos', op.tiposMantenimiento)}
          {select('componente', 'Componente o actividad', 'Todos', op.componentes)}
          {select('empresaId', 'Empresa proveedora', 'Todas', op.empresas)}
          {select('tecnicoId', 'Técnico responsable', 'Todos', op.tecnicos)}
          {select('estado', 'Estado de la orden', 'Todos', op.estados)}
        </div>
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </Card>

      {/* Resumen general (FLT-12) */}
      <div style={estiloGrilla(150)} data-testid="resumen">
        <Tile testid="res-reportes" titulo="Reportes de falla" valor={resumen.totalReportes} />
        <Tile testid="res-ordenes" titulo="Órdenes de trabajo" valor={resumen.totalOrdenes} />
        <Tile testid="res-actividades" titulo="Actividades ejecutadas" valor={resumen.totalActividades} />
        {verCostos && <Tile testid="res-importe" titulo="Importe acumulado" valor={dinero(resumen.importeAcumulado)} detalle="Órdenes de pago generadas" />}
        {verCostos && <Tile testid="res-promedio" titulo="Costo promedio por intervención" valor={dinero(resumen.costoPromedio)} />}
        <Tile titulo="Último mantenimiento" valor={fecha(resumen.fechaUltimoMantenimiento)} />
        <Tile titulo="Último reporte de falla" valor={fecha(resumen.fechaUltimoReporte)} />
        <Tile
          testid="res-empresa"
          titulo="Empresa con mayor participación"
          valor={<span style={{ fontSize: 16 }}>{resumen.empresaMayorParticipacion?.nombre ?? '—'}</span>}
          detalle={resumen.empresaMayorParticipacion
            ? `${resumen.empresaMayorParticipacion.eventos} ${resumen.empresaMayorParticipacion.eventos === 1 ? 'orden' : 'órdenes'}`
            : undefined}
        />
      </div>

      {/* Historial cronológico (FLT-13) */}
      <Card>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Wrench className="h-4 w-4" /> Intervenciones
        </h3>
        <p style={{ fontSize: 12, color: TEXTO_SUAVE, marginBottom: 12 }}>
          De la más reciente a la más antigua. Toca una intervención para abrir su orden de trabajo.
        </p>
        {datos.intervenciones.length === 0 ? (
          <p style={{ fontSize: 14, color: TEXTO_SUAVE, textAlign: 'center', padding: 24 }} data-testid="sin-intervenciones">
            {datos.hayFiltros ? 'Ninguna intervención coincide con los filtros.' : 'Este vehículo no tiene reportes ni órdenes de trabajo registrados.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="lista-intervenciones">
            {datos.intervenciones.map((i) => (
              <Intervencion key={`${i.ordenId ?? 'r'}-${i.reporteId ?? 'o'}`} i={i} verCostos={verCostos} />
            ))}
          </div>
        )}
      </Card>

      {/* Estadísticas de comportamiento (FLT-14) */}
      <Card>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <BarChart3 className="h-4 w-4" /> Estadísticas de comportamiento
        </h3>
        <div style={estiloGrilla(240)}>
          <Ranking testid="est-actividades" titulo="Actividades de reparación más frecuentes" filas={estadisticas.actividadesFrecuentes} vacio="Sin actividades ejecutadas." />
          <Ranking testid="est-componentes" titulo="Componentes más intervenidos" filas={estadisticas.componentesFrecuentes} vacio="Sin componentes registrados." />
          <Ranking testid="est-fallas" titulo="Fallas más recurrentes" filas={estadisticas.fallasRecurrentes} vacio="Sin fallas reportadas." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <Ranking testid="est-tipos" titulo="Tipo de mantenimiento" filas={estadisticas.tiposMantenimiento} vacio="Sin órdenes de trabajo." unidad="órdenes" />
            {estadisticas.tipoPredominante && (
              <p style={{ fontSize: 13, color: '#374151' }} data-testid="tipo-predominante">
                Predominante: <strong>{estadisticas.tipoPredominante}</strong>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Análisis económico (FLT-15): solo Administrador y Gerente de Mantenimiento */}
      {verCostos && economico && (
        <Card data-testid="economico">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <DollarSign className="h-4 w-4" /> Análisis económico
          </h3>
          <p style={{ fontSize: 12, color: TEXTO_SUAVE, marginBottom: 12 }}>
            Importes de las órdenes de pago generadas al concluir cada reparación (no se recalculan con tarifas actuales).
          </p>
          <div style={{ ...estiloGrilla(150), marginBottom: 12 }}>
            <Tile testid="eco-total" titulo="Importe total acumulado" valor={dinero(economico.total)} />
            <Tile titulo="Costo promedio por reparación" valor={dinero(economico.promedio)} />
            <Tile titulo="Reparaciones con orden de pago" valor={economico.intervencionesConCosto} />
          </div>
          <div style={estiloGrilla(260)}>
            <Ranking testid="eco-actividad" titulo="Costos por actividad" filas={economico.porActividad} vacio="Sin órdenes de pago." mostrarImporte />
            <Ranking testid="eco-proveedor" titulo="Costos por proveedor" filas={economico.porProveedor} vacio="Sin órdenes de pago." mostrarImporte />
          </div>
          <div style={{ ...estiloGrilla(420), marginTop: 12 }}>
            <TablaPeriodos testid="eco-periodo" titulo="Costos por periodo (mensual)" filas={economico.porPeriodo} etiqueta={mes} />
            <TablaPeriodos testid="eco-comparativo" titulo="Comparativo histórico por año" filas={economico.comparativo} etiqueta={(p) => p} />
          </div>
        </Card>
      )}

      {!verCostos && (
        <p style={{ fontSize: 12, color: TEXTO_SUAVE, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText className="h-4 w-4" /> Los importes y el análisis económico solo los consultan el Administrador y el Gerente de Mantenimiento.
        </p>
      )}
    </div>
  );
}
