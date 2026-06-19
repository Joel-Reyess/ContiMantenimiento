import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, LoadingCard } from '@/components/ui';
import { dashboardService } from '@/services';
import type { DashboardTecnico, OrdenTrabajoList } from '@/interfaces';
import { formatDateTime, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Clock, CheckCircle, PlayCircle, ArrowRight, AlertCircle, Camera, ClipboardCheck, Package, Target, HelpCircle } from 'lucide-react';
import { ActionCard, ReportFailureModal, MaintenanceChecklistModal, RequestPartsModal } from '@/components/tecnico';

export function TecnicoDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardTecnico | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showPartsModal, setShowPartsModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await dashboardService.getDashboardTecnico();
      if (response.success && response.data) {
        setDashboard(response.data);
      } else {
        setDashboard({
          ordenesActivas: [],
          ordenesAsignadas: 0,
          ordenesCompletadasHoy: 0,
          ordenesCompletadasSemana: 0,
          ordenesEnProceso: 0,
          metaMensual: 0
        } as DashboardTecnico);
        setError(response.message || 'No se pudieron cargar tus datos.');
      }
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      setError('No se pudo cargar el dashboard del técnico.');
      setDashboard({
        ordenesActivas: [],
        ordenesAsignadas: 0,
        ordenesCompletadasHoy: 0,
        ordenesCompletadasSemana: 0,
        ordenesEnProceso: 0,
        metaMensual: 0
      } as DashboardTecnico);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingCard message="Cargando tus ordenes..." />;
  }

  const ordenEnProceso = dashboard?.ordenesActivas?.find((o) => o.estado === 2);
  const ordenesPendientes = dashboard?.ordenesActivas?.filter((o) => o.estado === 1) || [];
  const activeOrdersCount = dashboard?.ordenesActivas?.length || 0;

  return (
    <div className="dashboard-wrapper">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Portal del Tecnico</p>
          <h1 className="text-3xl font-semibold text-continental-black">Hola, {user?.nombreCompleto || 'Tecnico'}</h1>
          <p className="text-continental-gray-1">Gestiona tus tareas, reporta fallas y solicita refacciones.</p>
        </div>
        <div className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-continental-gray-1 shadow">
          {activeOrdersCount} tareas activas
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        </div>
      )}

      {/* Action Cards */}
      <div className="max-w-5xl mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          icon={<Camera className="h-12 w-12 text-continental-yellow" />}
          title="Reportar Falla"
          description="Escanea código QR y reporta fallas con evidencia fotográfica"
          onClick={() => setShowReportModal(true)}
          variant="yellow"
        />
        <ActionCard
          icon={<ClipboardCheck className="h-12 w-12 text-continental-green" />}
          title="Checklist de Mantenimiento"
          description="Completa tareas de mantenimiento preventivo"
          onClick={() => setShowChecklistModal(true)}
          variant="green"
        />
        <ActionCard
          icon={<Package className="h-12 w-12 text-continental-blue" />}
          title="Solicitar Refacciones"
          description="Solicita piezas adicionales para reparaciones"
          onClick={() => setShowPartsModal(true)}
          variant="blue"
        />
      </div>

      {/* Stats Cards */}
      <div className="max-w-5xl mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => navigate('/ordenes')}
          className="dashboard-card border-l-4 border-l-continental-blue p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-blue/10">
            <Wrench className="h-6 w-6 text-continental-blue" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">Ordenes Asignadas</p>
            <p className="text-2xl font-bold text-continental-black">{dashboard?.ordenesAsignadas || 0}</p>
          </div>
        </div>

        <div
          onClick={() => navigate('/ordenes')}
          className="dashboard-card border-l-4 border-l-continental-yellow p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-yellow/10">
            <Clock className="h-6 w-6 text-continental-yellow" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">En Proceso</p>
            <p className="text-2xl font-bold text-continental-black">{dashboard?.ordenesEnProceso || 0}</p>
          </div>
        </div>

        <div
          onClick={() => navigate('/ordenes')}
          className="dashboard-card border-l-4 border-l-continental-green p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-green/10">
            <CheckCircle className="h-6 w-6 text-continental-green" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">Completadas Hoy</p>
            <p className="text-2xl font-bold text-continental-black">{dashboard?.ordenesCompletadasHoy || 0}</p>
          </div>
        </div>

        <div
          onClick={() => navigate('/ordenes')}
          className="dashboard-card border-l-4 border-l-continental-green p-6 text-center flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-green/10">
            <CheckCircle className="h-6 w-6 text-continental-green" />
          </div>
          <div>
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide">Esta Semana</p>
            <p className="text-2xl font-bold text-continental-black">{dashboard?.ordenesCompletadasSemana || 0}</p>
          </div>
        </div>

        <div className="dashboard-card border-l-4 border-l-continental-blue p-6 text-center flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-continental-blue/10">
            <Target className="h-6 w-6 text-continental-blue" />
          </div>
          <div className="relative group">
            <p className="text-sm text-continental-gray-1 uppercase tracking-wide flex items-center justify-center gap-1">
              Fijar Meta de Mantenimientos por mes
              <HelpCircle className="h-3.5 w-3.5 text-continental-gray-2 cursor-help" />
            </p>
            <p className="text-2xl font-bold text-continental-black">{dashboard?.metaMensual || 0}</p>
            
            {/* Tooltip manual */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-continental-black text-white text-[10px] rounded shadow-lg z-50">
              Número de mantenimientos por mes que puedes realizar.
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-continental-black"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Orden en proceso */}
      {ordenEnProceso && (
        <div className="max-w-5xl mx-auto bg-continental-yellow/10 border-2 border-continental-yellow rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PlayCircle className="h-6 w-6 text-continental-yellow" />
            <h2 className="text-lg font-semibold text-continental-black">Orden en Proceso</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xl font-bold text-continental-black">{ordenEnProceso.folio}</p>
              <p className="text-continental-gray-1">Vehiculo: {ordenEnProceso.vehiculoCodigo}</p>
              <p className="text-sm text-continental-gray-2">Tipo de mantenimiento: {ordenEnProceso.tipoMantenimiento || 'N/D'}</p>
            </div>
            <Link to={`/ordenes/${ordenEnProceso.id}`}>
              <Button>
                Continuar Trabajo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Lista de tareas asignadas */}
      <div className="dashboard-card p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-continental-black flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Tareas Asignadas
          </h2>
          <Link
            to="/mis-ordenes"
            className="text-sm text-continental-yellow hover:text-continental-yellow-dark flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {ordenesPendientes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-continental-green mx-auto mb-4" />
            <p className="text-continental-gray-1 text-lg">No tienes ordenes pendientes por iniciar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenesPendientes.map((orden) => (
              <TaskItem key={orden.id} orden={orden} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ReportFailureModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} onSuccess={loadDashboard} />
      <MaintenanceChecklistModal isOpen={showChecklistModal} onClose={() => setShowChecklistModal(false)} onSuccess={loadDashboard} />
      <RequestPartsModal isOpen={showPartsModal} onClose={() => setShowPartsModal(false)} onSuccess={loadDashboard} />
    </div>
  );
}

function TaskItem({ orden }: { orden: OrdenTrabajoList }) {
  const getPrioridadColor = (prioridad: number) => {
    switch (prioridad) {
      case 3:
        return 'border-l-continental-red';
      case 2:
        return 'border-l-continental-yellow';
      default:
        return 'border-l-continental-blue';
    }
  };

  return (
    <Link
      to={`/ordenes/${orden.id}`}
      className={cn(
        'block bg-continental-bg rounded-lg p-5 border-l-4 transition-all duration-200',
        'hover:bg-continental-gray-4 hover:translate-x-1',
        getPrioridadColor(orden.prioridad)
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-continental-black text-lg">{orden.folio}</span>
            <Badge variant={orden.prioridad >= 2 ? 'alta' : 'media'}>{orden.prioridadNombre}</Badge>
          </div>
          <p className="text-continental-gray-1 mb-1">
            <strong>Vehiculo:</strong> {orden.vehiculoCodigo}
          </p>
          <p className="text-continental-gray-1 mb-2">
            <strong>Tipo de mantenimiento:</strong> {orden.tipoMantenimiento || 'N/D'}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-continental-gray-2">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Asignada: {formatDateTime(orden.fechaCreacion)}
            </span>
            {orden.prioridad >= 2 && (
              <span className="flex items-center gap-1 text-continental-yellow">
                <AlertCircle className="h-4 w-4" />
                Prioridad: {orden.prioridadNombre}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm">
          Ver Detalles
        </Button>
      </div>
    </Link>
  );
}
