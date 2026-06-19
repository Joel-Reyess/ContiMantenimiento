import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vehiculosService } from '@/services/vehiculosService';
import { reportesService } from '@/services/reportesService';
import { Button, Card, Badge, Spinner, Alert, AlertTitle, AlertDescription } from '@/components/ui';
import { ArrowLeft, Truck, AlertTriangle, Info, History, Calendar, Wrench, Clock } from 'lucide-react';
import { EstadoVehiculoNombres, TipoVehiculoNombres } from '@/interfaces/Api.interface';
import { UbicacionBadge } from '@/components/vehiculos/UbicacionLegend';
import { useAuth } from '@/contexts/AuthContext';
import type { ReportImageFault } from '@/interfaces';

interface HistorialItem {
  id: number;
  ordenTrabajoId: number;
  folioOrden: string;
  tipoMantenimiento: string;
  descripcion: string;
  tecnicoNombre: string;
  fechaFinalizacion: string;
  costoTotal: number;
  estado: string;
  fechaReporteFalla?: string;
  fechaRecepcion?: string;
  fechaChecklistCompletado?: string;
  fechaFirmaAsignacion?: string;
  fechaInicioTrabajo?: string;
  fechaFirmaLider?: string;
}

interface ReporteVisualResumen {
  id: number;
  folio: string;
  fechaReporte: string;
  imageFaults: ReportImageFault[];
}

export function VehiculoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [todosLosVehiculos, setTodosLosVehiculos] = useState<any[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [reportesVisuales, setReportesVisuales] = useState<ReporteVisualResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (vehiculoId: number) => {
    setLoading(true);
    setError('');
    try {
      const [vehiculoRes, historialRes, allRes, reportesRes] = await Promise.all([
        vehiculosService.getById(vehiculoId),
        vehiculosService.getHistorial(vehiculoId),
        vehiculosService.getAll({ page: 1, pageSize: 1000 }),
        reportesService.getAll({ vehiculoId, page: 1, pageSize: 30 })
      ]);

      if (vehiculoRes.success && vehiculoRes.data) {
        setVehiculo(vehiculoRes.data);
      } else {
        setError(vehiculoRes.message || 'Error al cargar el vehículo');
      }

      if (historialRes.success && historialRes.data) {
        setHistorial(historialRes.data as HistorialItem[]);
      }

      if (allRes.success && allRes.data) {
        const raw = allRes.data as any;
        setTodosLosVehiculos(raw.items || raw.Items || (Array.isArray(raw) ? raw : []));
      }

      if (reportesRes.success && reportesRes.data) {
        const raw = reportesRes.data as any;
        const reportesList = raw.items || raw.Items || (Array.isArray(raw) ? raw : []);
        const detalles = await Promise.all(
          (reportesList as Array<{ id: number }>)
            .slice(0, 20)
            .map((rep) => reportesService.getById(rep.id))
        );

        const visuales = detalles
          .filter((res) => res.success && res.data && Array.isArray(res.data.imageFaults) && res.data.imageFaults.length > 0)
          .map((res) => ({
            id: res.data!.id,
            folio: res.data!.folio,
            fechaReporte: res.data!.fechaReporte,
            imageFaults: res.data!.imageFaults || []
          }));

        setReportesVisuales(visuales);
      } else {
        setReportesVisuales([]);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al cargar los datos');
      setReportesVisuales([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/D';
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const alertasMantenimiento = useMemo(() => {
    if (!vehiculo || todosLosVehiculos.length === 0) return [];
    
    // Filtrar vehículos del mismo tipo que el actual
    const delMismoTipo = todosLosVehiculos.filter(v => v.tipo === vehiculo.tipo || v.tipoNombre === vehiculo.tipoNombre);
    
    const hoy = new Date();
    return delMismoTipo.filter(v => {
      if (!v.proximoMantenimiento) return false;
      const fechaProx = new Date(v.proximoMantenimiento);
      return fechaProx <= hoy;
    });
  }, [vehiculo, todosLosVehiculos]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !vehiculo) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Vehículo no encontrado'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Regresar
        </Button>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper space-y-6 animate-in fade-in duration-500">
      {/* Alerts */}
      {alertasMantenimiento.length > 0 && (
        <Alert variant="destructive" className="border-red-600 bg-red-50 animate-pulse">
          <Clock className="h-4 w-4" />
          <AlertTitle className="font-bold">¡ALERTA DE MANTENIMIENTO PREVENTIVO!</AlertTitle>
          <AlertDescription>
            Existen {alertasMantenimiento.length} vehículos de tipo <span className="font-bold uppercase">{vehiculo.tipoNombre || 'este tipo'}</span> que ya requieren mantenimiento preventivo según su fecha programada.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-continental-black flex items-center gap-2">
              <Truck className="h-6 w-6 text-continental-red" />
              {vehiculo.codigo}
            </h1>
            <p className="text-continental-gray-1">Detalle del contenedor e historial de mantenimiento</p>
          </div>
        </div>
        <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-800">
            Consulte la ficha técnica detallada del contenedor, su ubicación actual en planta y el registro histórico de todas las intervenciones de mantenimiento realizadas.
          </p>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Información General</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Tipo:</span>
              <span className="font-medium">{vehiculo.tipoNombre || TipoVehiculoNombres[vehiculo.tipo]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Marca/Modelo:</span>
              <span className="font-medium">{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' / ') || 'N/D'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Número de Serie:</span>
              <span className="font-medium">{vehiculo.numeroSerie || 'N/D'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Año:</span>
              <span className="font-medium">{vehiculo.anio || 'N/D'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Estado Actual</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-continental-gray-1">Estado:</span>
              <Badge variant={vehiculo.estado === 1 ? 'default' : 'secondary'}>
                {vehiculo.estadoNombre || EstadoVehiculoNombres[vehiculo.estado]}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-continental-gray-1">Ubicación:</span>
              <UbicacionBadge ubicacion={vehiculo.ubicacion} />
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Área:</span>
              <span className="font-medium">{vehiculo.areaNombre || 'No asignada'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Mantenimiento</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-continental-gray-2" />
                <span className="text-continental-gray-1">Último Mtto:</span>
              </div>
              <span className="font-medium">{formatDate(vehiculo.ultimoMantenimiento)}</span>
            </div>
            <div className="flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-continental-gray-2" />
                <span className="text-continental-gray-1">Próximo Mtto:</span>
              </div>
              <span className="font-medium text-continental-blue">{formatDate(vehiculo.proximoMantenimiento)}</span>
            </div>
            {vehiculo.notas && (
              <div className="pt-2">
                <span className="text-continental-gray-1 block mb-1">Notas:</span>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">{vehiculo.notas}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-continental-black">Fallas reportadas (imagen)</h3>
        {reportesVisuales.length === 0 ? (
          <p className="text-sm text-continental-gray-1">No hay reportes con fallas visuales para este vehículo.</p>
        ) : (
          <div className="space-y-3">
            {reportesVisuales.map((reporte) => (
              <div key={reporte.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-continental-black">{reporte.folio}</p>
                  <span className="text-xs text-continental-gray-1">{formatDate(reporte.fechaReporte)}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {reporte.imageFaults.map((fault) => (
                    <li key={fault.id} className="text-sm text-continental-gray-1">
                      • {fault.imageFaultName || `Falla #${fault.imageFaultId}`}
                      {fault.xPct !== undefined && fault.yPct !== undefined
                        ? ` (${fault.xPct.toFixed(2)}%, ${fault.yPct.toFixed(2)}%)`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-lg text-continental-black flex items-center gap-2">
            <History className="h-5 w-5 text-continental-blue" />
            Historial de Mantenimiento Detallado
          </h3>
          <Badge variant="secondary">{historial.length} registros</Badge>
        </div>
        
        <div className="p-6 space-y-8">
          {historial.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay registros de mantenimiento para este vehículo.
            </div>
          ) : (
            historial.map((item) => (
              <div key={item.id} className="border rounded-lg overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gray-50 p-4 border-b flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-continental-black">{item.folioOrden}</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px]">
                      {item.tipoMantenimiento}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[10px]">
                      {item.estado}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    Finalización: {formatDate(item.fechaFinalizacion)}
                  </div>
                </div>
                
                <div className="p-4 grid md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción del Trabajo</h4>
                      <p className="text-sm text-gray-700">{item.descripcion}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                       <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Técnico Asignado</h4>
                        <p className="text-sm font-medium">{item.tecnicoNombre}</p>
                      </div>
                      {hasRole(['Administrador']) && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Costo Total</h4>
                          <p className="text-sm font-bold text-continental-blue">{formatCurrency(item.costoTotal)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-l pl-6 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Línea de Tiempo del Proceso</h4>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:border-l-2 before:border-gray-100 before:my-1">
                      {item.fechaReporteFalla && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Falla Reportada</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaReporteFalla)}</p>
                        </div>
                      )}
                      {item.fechaRecepcion && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Pasó a Recepción</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaRecepcion)}</p>
                        </div>
                      )}
                      {item.fechaFirmaAsignacion && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Técnico Firmó Asignación</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaFirmaAsignacion)}</p>
                        </div>
                      )}
                      {item.fechaInicioTrabajo && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Inicio de Trabajo</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaInicioTrabajo)}</p>
                        </div>
                      )}
                      {item.fechaChecklistCompletado && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Checklist Completado</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaChecklistCompletado)}</p>
                        </div>
                      )}
                      {item.fechaFirmaLider && (
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase">Validado por Líder</p>
                          <p className="text-xs font-medium text-gray-700">{formatDate(item.fechaFirmaLider)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
