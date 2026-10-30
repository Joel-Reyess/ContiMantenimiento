import { useEffect, useState } from 'react';
import { Badge, Button, LoadingCard } from '@/components/ui';
import { reportesService } from '@/services';
import { formatDateTime } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, AlertTriangle, Clock, CheckCircle, ClipboardCheck } from 'lucide-react';
import { ActionCard, ReportFailureModal } from '@/components/tecnico';
import { dashboardService } from '@/services';

interface ReporteReciente {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  prioridad: number;
  prioridadNombre?: string;
  fechaReporte: string;
  tieneOrdenTrabajo: boolean;
}

interface MantenimientoPreventivoPendiente {
  vehiculoId: number;
  vehiculoCodigo: string;
  tipoVehiculo: string;
  proximaFecha: string;
  diasRestantes: number;
  estado: string;
}

export function LiderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reportes, setReportes] = useState<ReporteReciente[]>([]);
  const [preventivos, setPreventivos] = useState<MantenimientoPreventivoPendiente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [preventivoSeleccionado, setPreventivoSeleccionado] = useState<MantenimientoPreventivoPendiente | null>(null);
  const [stats, setStats] = useState({ hoy: 0, sinAtender: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [reportesRes, sinAtenderRes, programacionRes] = await Promise.all([
        reportesService.getAll({ pageSize: 10 }),
        reportesService.getSinAtender(),
        dashboardService.getProgramacionPreventiva()
      ]);

      if (reportesRes.success && reportesRes.data) {
        const items = Array.isArray(reportesRes.data)
          ? reportesRes.data
          : reportesRes.data.items || [];
        setReportes(items.slice(0, 10));

        // Count reports from today
        const today = new Date().toDateString();
        const reportesHoy = items.filter((r: ReporteReciente) =>
          new Date(r.fechaReporte).toDateString() === today
        ).length;

        setStats(prev => ({ ...prev, hoy: reportesHoy }));
      }

      if (sinAtenderRes.success && sinAtenderRes.data) {
        setStats(prev => ({ ...prev, sinAtender: sinAtenderRes.data?.length || 0 }));
      }

      if (programacionRes.success && Array.isArray(programacionRes.data)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const items = programacionRes.data
          .map((p) => {
            const diasRestantes = Number.isFinite(p?.diasRestantes)
              ? Number(p.diasRestantes)
              : (p?.proximaFecha
                  ? Math.ceil((new Date(p.proximaFecha).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : 999999);

            return {
              ...p,
              diasRestantes
            };
          })
          .filter((p) => Boolean(p?.vehiculoId && p?.vehiculoCodigo && p?.proximaFecha))
          .sort((a, b) => {
            const byDias = a.diasRestantes - b.diasRestantes;
            if (byDias !== 0) return byDias;
            return new Date(a.proximaFecha).getTime() - new Date(b.proximaFecha).getTime();
          });
        setPreventivos(items);
      } else {
        setPreventivos([]);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError('No se pudieron cargar los datos.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingCard message="Cargando..." />;
  }

  return (
    <div className="dashboard-wrapper">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Portal del Lider</p>
          <h1 className="text-3xl font-semibold text-continental-black">Hola, {user?.nombreCompleto || 'Lider'}</h1>
          <p className="text-continental-gray-1">Reporta fallas de equipos de manera rapida y sencilla.</p>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        </div>
      )}

      {/* Main Action Card - Prominent */}
      <div className="max-w-4xl mx-auto">
        <ActionCard
          icon={<Camera className="h-16 w-16 text-continental-yellow" />}
          title="Reportar Falla"
          description="Escanea el codigo QR del equipo o busca por codigo para reportar una falla rapidamente"
          onClick={() => {
            setPreventivoSeleccionado(null);
            setShowReportModal(true);
          }}
          variant="yellow"
        />
      </div>

      {/* Preventivos rapidos */}
      <div className="max-w-4xl mx-auto dashboard-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-continental-blue" />
            <h2 className="text-lg font-semibold text-continental-black">Mantenimientos Preventivos por Realizar</h2>
          </div>
          <Badge variant="secondary">{preventivos.length}</Badge>
        </div>

        {preventivos.length === 0 ? (
          <p className="text-sm text-continental-gray-1">No hay preventivos pendientes por capturar.</p>
        ) : (
          <>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                const first = preventivos[0];
                setPreventivoSeleccionado(first);
                setShowReportModal(true);
              }}
            >
              Iniciar siguiente preventivo
            </Button>

            {preventivos.length > 10 && (
              <p className="text-xs text-continental-gray-1">
                Mostrando los 10 mas cercanos de {preventivos.length} preventivos programados.
              </p>
            )}

            <div className="space-y-2">
              {preventivos.slice(0, 10).map((p) => (
                <div key={`${p.vehiculoId}-${p.proximaFecha}`} className="bg-continental-bg rounded-lg p-3 border border-continental-gray-3/60">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-continental-black">{p.vehiculoCodigo}</p>
                      <p className="text-xs text-continental-gray-1">
                        {p.tipoVehiculo} - Programado: {new Date(p.proximaFecha).toLocaleDateString('es-MX')} ({p.diasRestantes} dias)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreventivoSeleccionado(p);
                        setShowReportModal(true);
                      }}
                    >
                      Capturar checklist
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="max-w-4xl mx-auto grid gap-5 sm:grid-cols-2">
        <div
          onClick={() => navigate('/reportes')}
          className="dashboard-card border-l-4 border-l-continental-yellow p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-yellow/10">
            <AlertTriangle className="h-6 w-6 text-continental-yellow" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">Reportes Hoy</p>
            <p className="text-2xl font-bold text-continental-black">{stats.hoy}</p>
          </div>
        </div>

        <div
          onClick={() => navigate('/reportes')}
          className="dashboard-card border-l-4 border-l-continental-red p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-red/10">
            <Clock className="h-6 w-6 text-continental-red" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">Sin Atender</p>
            <p className="text-2xl font-bold text-continental-black">{stats.sinAtender}</p>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="dashboard-card p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-continental-black flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reportes Recientes
          </h2>
        </div>

        {reportes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-continental-green mx-auto mb-4" />
            <p className="text-continental-gray-1 text-lg">No hay reportes recientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reportes.map((reporte) => (
              <div
                key={reporte.id}
                className="bg-continental-bg rounded-lg p-4 border-l-4 border-l-continental-gray-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-continental-black">{reporte.folio}</span>
                      <Badge variant={reporte.tieneOrdenTrabajo ? 'success' : 'warning'}>
                        {reporte.tieneOrdenTrabajo ? 'Atendido' : 'Pendiente'}
                      </Badge>
                    </div>
                    <p className="text-continental-gray-1 text-sm">
                      <strong>Vehiculo:</strong> {reporte.vehiculoCodigo}
                    </p>
                    <p className="text-continental-gray-2 text-xs mt-1">
                      {formatDateTime(reporte.fechaReporte)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <ReportFailureModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setPreventivoSeleccionado(null);
        }}
        onSuccess={loadData}
        initialVehiculoId={preventivoSeleccionado?.vehiculoId ?? null}
        initialVehiculoCodigo={preventivoSeleccionado?.vehiculoCodigo ?? null}
        initialTipoMantenimiento={preventivoSeleccionado ? 'Preventivo' : undefined}
        forceFormStep={Boolean(preventivoSeleccionado)}
      />
    </div>
  );
}

