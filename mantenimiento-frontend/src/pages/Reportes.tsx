import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, Plus, RefreshCcw, Search, Printer } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner
} from '@/components/ui';
import { reportesService } from '@/services/reportesService';
import { ordenesService } from '@/services/ordenesService';
import { catalogosService } from '@/services';
import { ReportFailureModal } from '@/components/tecnico';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';
import type { CategoriaFalla, ReporteFalla, ReporteFallaList, VehicleImagePoint } from '@/interfaces';
import { Prioridad, PrioridadNombres } from '@/interfaces/Api.interface';
import { getFullImageUrl } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface FiltersState {
  busqueda: string;
  prioridad?: string;
  categoriaId?: string;
}

export function ReportesPage() {
  const { id: reporteIdParam } = useParams();
  const reporteId = reporteIdParam ? Number(reporteIdParam) : undefined;
  const { hasRole } = useAuth();
  const canCrearOrden = hasRole(['Administrador', 'Superusuario', 'Supervisor']);

  const [filters, setFilters] = useState<FiltersState>({ busqueda: '' });
  const [reportes, setReportes] = useState<ReporteFallaList[]>([]);
  const [detalle, setDetalle] = useState<ReporteFalla | null>(null);
  const [categorias, setCategorias] = useState<CategoriaFalla[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [crearOpen, setCrearOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [vehicleImageUrl, setVehicleImageUrl] = useState<string | undefined>(undefined);

  // We keep priority options for filtering, but ReportFailureModal handles its own dropdowns
  const prioridadOptions = [
    { value: '1', label: 'Baja' },
    { value: '2', label: 'Media' },
    { value: '3', label: 'Alta' },
    { value: '4', label: 'Urgente' }
  ];

  const loadCategorias = async () => {
    const res = await reportesService.getCategorias();
    if (res.success && res.data) {
      setCategorias(res.data);
    }
  };

  const loadReportes = async () => {
    setLoading(true);
    setError('');
    try {
      if (reporteId) {
        const res = await reportesService.getReporteWithChecklistItems(reporteId);
        if (res.success && res.data) {
          let detalleData = res.data as ReporteFalla;
          try {
            const evidRes = await reportesService.getEvidencias(detalleData.id);
            if (evidRes.success && evidRes.data) {
              detalleData = { ...detalleData, evidencias: evidRes.data };
            }
          } catch (e) {
            // ignore
          }
          setDetalle({ ...detalleData, evidencias: detalleData.evidencias || [] });
        } else {
          setDetalle(null);
          setError(res.message || 'No se pudo cargar el reporte');
        }
      } else {
        const res = await reportesService.getAll({
          busqueda: filters.busqueda || undefined,
          prioridad: filters.prioridad ? Number(filters.prioridad) : undefined,
          categoriaId: filters.categoriaId ? Number(filters.categoriaId) : undefined,
          page: 1,
          pageSize: 20
        });
        if (res.success && res.data !== undefined && res.data !== null) {
          const data: unknown = res.data as unknown;
          const items = Array.isArray(data)
            ? data
            : (data as { items?: ReporteFallaList[]; Items?: ReporteFallaList[] }).items ||
              (data as { items?: ReporteFallaList[]; Items?: ReporteFallaList[] }).Items ||
              [];
          setReportes(items);
        } else {
          setReportes([]);
          setError(res.message || 'No se pudo cargar la lista de reportes');
        }
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de reportes');
      setReportes([]);
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  useEffect(() => {
    loadReportes();
  }, [reporteId]);

  // Carga la foto del tipo de vehiculo para dibujar las fallas visuales sobre ella.
  useEffect(() => {
    const tipoNombre = (detalle?.vehiculoTipo || '').trim().toLowerCase();
    const tieneFallas = Boolean(detalle?.imageFaults && detalle.imageFaults.length > 0);
    if (!tipoNombre || !tieneFallas) {
      setVehicleImageUrl(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await catalogosService.getTiposVehiculo();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const tipo = res.data.find(
            (t) => (t.nombre || '').trim().toLowerCase() === tipoNombre
          );
          const preferida = tipo?.imagenFallasUrl || tipo?.imagenUrl;
          setVehicleImageUrl(preferida ? getFullImageUrl(preferida) : undefined);
        } else {
          setVehicleImageUrl(undefined);
        }
      } catch {
        if (!cancelled) setVehicleImageUrl(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detalle?.id, detalle?.vehiculoTipo]);

  const applyFilters = () => {
    if (!reporteId) {
      loadReportes();
    }
  };

  const resetFilters = () => {
    setFilters({ busqueda: '' });
    if (!reporteId) {
      loadReportes();
    }
  };

  const handleCrearOrden = async () => {
    if (!detalle) return;
    setCreatingOrder(true);
    setError('');
    try {
      const payload = {
        reporteFallaId: detalle.id,
        vehiculoId: detalle.vehiculoId || 0,
        descripcion: detalle.descripcion || `Orden generada desde reporte ${detalle.folio || detalle.id}`,
        tipoMantenimiento: detalle.tipoMantenimiento || 'Correctivo',
        prioridad: detalle.prioridad ?? Prioridad.Baja,
        notas: detalle.ubicacion || undefined
      };

      const res = await ordenesService.create(payload as any);
      if (res.success) {
        loadReportes();
      } else {
        setError(res.message || 'No se pudo crear la orden');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear la orden de trabajo');
    } finally {
      setCreatingOrder(false);
    }
  };

  const renderList = () => (
    <div className="space-y-3">
      {reportes.map((rep) => (
        <Link key={rep.id} to={`/reportes/${rep.id}`} className="block">
          <Card className="px-8 py-7 hover:-translate-y-1 transition-all duration-200 border-l-4 border-continental-yellow">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-continental-yellow" />
                  <p className="font-semibold text-continental-black">
                    {rep.folio} - {rep.vehiculoCodigo}
                  </p>
                </div>
                <p className="text-sm text-continental-gray-1">
                  Prioridad: {rep.prioridadNombre || PrioridadNombres[rep.prioridad]} · Tipo: {rep.tipoMantenimiento || 'Correctivo'} · Reportado por {rep.reportadoPorNombre || 'N/D'}
                </p>
                <p className="text-xs text-continental-gray-2">
                  {rep.categoriaNombre ? `Categoria: ${rep.categoriaNombre} · ` : ''}
                  {new Date(rep.fechaReporte).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={rep.tieneOrdenTrabajo ? 'default' : 'outline'}>
                  {rep.tieneOrdenTrabajo ? 'Con orden' : 'Sin orden'}
                </Badge>
                <Badge variant="secondary">{rep.cantidadEvidencias} evidencia(s)</Badge>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );

  const renderDetalle = () => {
    if (!detalle) return null;

    const apiBase = import.meta.env.VITE_API_URL || '';
    const evidenceBase = apiBase && apiBase.includes('http') ? apiBase.replace(/\/api\/?$/, '') : '';

    const buildEvidenceUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return evidenceBase ? `${evidenceBase}${url}` : url;
    };

    // Fallas visuales -> puntos sobre la foto del carro (solo las que traen coordenadas).
    const imageFaultPoints: VehicleImagePoint[] = (detalle.imageFaults || [])
      .filter((f) => typeof f.xPct === 'number' && typeof f.yPct === 'number')
      .map((f) => ({
        id: f.vehicleImagePointId ?? f.id,
        imageKey: '',
        xPct: f.xPct as number,
        yPct: f.yPct as number,
        imageFaultId: f.imageFaultId,
        imageFaultName: f.imageFaultName,
        active: true,
      }));
    const imageFaultNumbers: Record<number, number> = {};
    imageFaultPoints.forEach((p, i) => {
      imageFaultNumbers[p.id] = i + 1;
    });

    return (
      <div className="space-y-4">
        <Link to="/reportes" className="inline-flex items-center gap-2 text-continental-gray-1 hover:text-continental-black">
          <ArrowLeft className="h-4 w-4" />
          Volver a reportes
        </Link>

        <Card className="p-6 space-y-4 print:hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-continental-gray-1">Reporte</p>
              <h2 className="text-2xl font-semibold text-continental-black">
                {detalle.folio} · {detalle.vehiculoCodigo}
              </h2>
              <p className="text-continental-gray-1">
                Prioridad {detalle.prioridadNombre || PrioridadNombres[detalle.prioridad]} · Tipo {detalle.tipoMantenimiento || 'Correctivo'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{detalle.tieneOrdenTrabajo ? 'Con orden' : 'Sin orden'}</Badge>
              <Badge variant="secondary">{detalle.categoriaNombre || 'Sin categoria'}</Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 text-sm text-continental-gray-1">
              <p className="font-semibold text-continental-black">Descripcion</p>
              <p className="text-continental-black">{detalle.descripcion}</p>
            </div>
            <div className="space-y-2 text-sm text-continental-gray-1">
              <p className="font-semibold text-continental-black">Ubicacion</p>
              <p className="text-continental-black">{detalle.ubicacion || 'No especificada'}</p>
              <p>Puede operar: {detalle.puedeOperar ? 'Si' : 'No'}</p>
              <p>Fecha: {new Date(detalle.fechaReporte).toLocaleString()}</p>
              <p>Reportado por: {detalle.reportadoPorNombre || 'N/D'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-continental-black">Evidencia fotografica</p>
            {detalle.evidencias && detalle.evidencias.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {detalle.evidencias.map((ev) => (
                  <a
                    key={ev.id}
                    href={buildEvidenceUrl(ev.urlImagen)}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-continental-gray-3 overflow-hidden hover:border-continental-yellow transition"
                  >
                    <img
                      src={buildEvidenceUrl(ev.urlImagen)}
                      alt={ev.descripcion || ev.nombreArchivo || 'Evidencia'}
                      className="h-40 w-full object-cover"
                    />
                    <div className="p-3 text-sm text-continental-gray-1">
                      <p className="font-medium text-continental-black">{ev.nombreArchivo || 'Foto'}</p>
                      <p>{ev.descripcion || 'Sin descripcion'}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-continental-gray-1 text-sm">Sin evidencia cargada.</p>
            )}
          </div>

          {detalle.itemsChecklist && detalle.itemsChecklist.length > 0 && (
            <div className="space-y-3">
              <p className="font-semibold text-continental-black">Items del checklist seleccionados</p>
              <div className="border rounded-lg p-4 bg-continental-gray-5">
                <ul className="space-y-2">
                  {detalle.itemsChecklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-continental-gray-1 py-1 border-b border-gray-200 last:border-0">
                      <span className="text-continental-yellow font-bold">•</span>
                      <span className="flex-1">{item.checklistItemPregunta}</span>
                      {item.cantidad !== undefined && item.cantidad !== null && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          Cant: {item.cantidad}
                        </Badge>
                      )}
                      {item.estado && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${item.estado === 'Completado' ? 'bg-green-100 text-green-800' : item.estado === 'EnProceso' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {item.estado}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="font-semibold text-continental-black">Fallas reportadas (imagen)</p>
            {detalle.imageFaults && detalle.imageFaults.length > 0 ? (
              <div className="rounded-lg border p-4 bg-continental-gray-5 space-y-4">
                {imageFaultPoints.length > 0 && (
                  <InteractiveVehicleImage
                    imageUrl={vehicleImageUrl}
                    points={imageFaultPoints}
                    pointNumbers={imageFaultNumbers}
                    showPointLabels={false}
                    readonly
                    emptyMessage="No hay fallas visuales con posicion para dibujar."
                  />
                )}
                <ul className="space-y-2">
                  {detalle.imageFaults.map((fault) => {
                    const numero = imageFaultNumbers[fault.vehicleImagePointId ?? fault.id];
                    return (
                      <li key={fault.id} className="flex flex-wrap items-center gap-2 text-sm text-continental-gray-1">
                        {numero ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-600 text-[11px] font-bold tabular-nums text-white">
                            {numero}
                          </span>
                        ) : (
                          <span className="text-continental-yellow font-bold">•</span>
                        )}
                        <span className="font-medium text-continental-black">{fault.imageFaultName || `Falla #${fault.imageFaultId}`}</span>
                        {fault.xPct !== undefined && fault.yPct !== undefined && (
                          <span className="text-xs text-continental-gray-2">
                            ({fault.xPct.toFixed(2)}%, {fault.yPct.toFixed(2)}%)
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-continental-gray-1">Sin fallas visuales reportadas.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            {!detalle.tieneOrdenTrabajo && canCrearOrden && (
              <Button onClick={handleCrearOrden} disabled={creatingOrder} className="flex items-center gap-2">
                {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Crear orden de trabajo
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={loadReportes} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>

        <div className="hidden print:block bg-white p-4 text-black font-sans text-xs">
          <div className="border border-black mb-4">
            <div className="flex border-b border-black">
              <div className="w-1/2 p-4 flex items-center justify-center border-r border-black">
                <img src="/continental.png" alt="Continental" className="h-12 object-contain" />
              </div>
              <div className="w-1/2">
                <div className="flex border-b border-black">
                  <div className="w-2/3 p-1 font-bold text-right border-r border-black">FOLIO:</div>
                  <div className="w-1/3 p-1 text-center font-bold text-red-600">{detalle.folio}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-1/3 p-1 border-r border-black font-bold">FECHA DE INGRESO:</div>
                  <div className="w-2/3 p-1 text-center">{new Date(detalle.fechaReporte).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
            <div className="flex">
              <div className="w-1/2 p-2 flex items-center gap-2 border-r border-black">
                <span className="font-bold">TIPO DE CARRO:</span>
                <span>{detalle.vehiculoTipo || detalle.vehiculoCodigo}</span>
              </div>
              <div className="w-1/2 p-2 flex items-center gap-2">
                <span className="font-bold">CODIGO DE BARRAS:</span>
                <span>{detalle.vehiculoCodigo}</span>
              </div>
            </div>
          </div>

          <table className="w-full border-collapse border border-black mb-4 text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1 text-left w-1/2">CHECK LIST</th>
                <th className="border border-black p-1 text-center w-[16%]">REPORTADO</th>
                <th className="border border-black p-1 text-center w-[16%]">REPARADO</th>
                <th className="border border-black p-1 text-center w-[16%]">VERIFICACION</th>
              </tr>
            </thead>
            <tbody>
              {detalle.itemsChecklist && detalle.itemsChecklist.length > 0 ? (
                detalle.itemsChecklist.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-black p-1 uppercase">{item.checklistItemPregunta}</td>
                    <td className="border border-black p-1 text-center">✓</td>
                    <td className="border border-black p-1 text-center">{item.estado === 'Completado' ? '✓' : ''}</td>
                    <td className="border border-black p-1 text-center">{item.estado === 'Completado' ? '✓' : ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="border border-black p-2 text-center italic">Sin items de checklist</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="border border-black p-1 font-bold bg-gray-50">OBSERVACIONES</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-black p-2 h-16 align-top">
                  {detalle.descripcion}
                  {detalle.ubicacion && <div>Ubicación: {detalle.ubicacion}</div>}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-black p-1 font-bold bg-gray-50">FALLAS REPORTADAS (IMAGEN)</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-black p-2 align-top">
                  {detalle.imageFaults && detalle.imageFaults.length > 0 ? (
                    <ul className="list-disc ml-4">
                      {detalle.imageFaults.map((fault) => (
                        <li key={fault.id} className="uppercase">
                          {fault.imageFaultName || `Falla #${fault.imageFaultId}`}
                          {fault.xPct !== undefined && fault.yPct !== undefined
                            ? ` (${fault.xPct.toFixed(2)}%, ${fault.yPct.toFixed(2)}%)`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="italic">Sin fallas visuales reportadas</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {detalle.evidencias && detalle.evidencias.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {detalle.evidencias.slice(0, 4).map((ev) => (
                <div key={ev.id} className="border border-black p-1">
                  <img src={buildEvidenceUrl(ev.urlImagen)} alt="Evidencia" className="w-full h-40 object-contain" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Reportes de Falla</p>
          <h1 className="text-3xl font-semibold text-continental-black">
            {reporteId ? 'Detalle del reporte' : 'Listado de reportes'}
          </h1>
          <p className="text-continental-gray-1">Seguimiento de incidencias y solicitudes de validacion.</p>
        </div>
        {!reporteId && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={applyFilters}>
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo reporte
            </Button>
          </div>
        )}
      </div>

      {!reporteId && (
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por folio, vehiculo o texto"
            value={filters.busqueda}
            onChange={(e) => setFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
          />
          <Select
            options={[{ value: '', label: 'Todas las prioridades' }, ...prioridadOptions]}
            value={filters.prioridad || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, prioridad: value }))}
          />
          <Select
            options={[{ value: '', label: 'Todas las categorias' }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
            value={filters.categoriaId || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, categoriaId: value }))}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={resetFilters}>
              Limpiar
            </Button>
            <Button className="w-full" onClick={applyFilters}>
              Aplicar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : error ? null : reporteId ? (
        renderDetalle()
      ) : reportes.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay reportes</p>
          <p className="text-continental-gray-1">Aun no se han registrado reportes de falla.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => setCrearOpen(true)} className="bg-continental-gradient text-white flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Crear reporte
            </Button>
            <Button variant="outline" onClick={loadReportes}>
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>
      ) : (
        renderList()
      )}

      <ReportFailureModal
        isOpen={crearOpen}
        onClose={() => setCrearOpen(false)}
        onSuccess={loadReportes}
      />
    </div>
  );
}
