import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingCard, Alert, AlertTitle, AlertDescription, Card } from '@/components/ui';
import { Info, Truck, Wrench, Clock, CheckCircle, AlertTriangle, Activity, Users, LayoutDashboard, FileText, History, Package, Box, Calendar } from 'lucide-react';
import { dashboardService } from '@/services';
import { catalogosService } from '@/services/catalogosService';
import type { DashboardStats, KPIs, DashboardVehiculoResumen } from '@/interfaces';
import type { OrdenSinFirma, ReporteAnual } from '@/services/dashboardService';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import {
  KPICard,
  EquipmentStatusPanel,
  MaintenanceAlerts,
  WeeklyTrendChart,
  OrdersByStatusChart,
  FailuresByTypeChart,
  RecurrentFailuresChart,
  LocationMatrix,
} from '@/components/dashboard';
import { WorkshopTab } from '@/components/dashboard/tabs/WorkshopTab';
import { ReportsTab } from '@/components/dashboard/tabs/ReportsTab';
import { HistoryTab } from '@/components/dashboard/tabs/HistoryTab';
import { TechniciansTab } from '@/components/dashboard/tabs/TechniciansTab';
import { ProductionTab } from '@/components/dashboard/tabs/ProductionTab';
import { MTETab } from '@/components/dashboard/tabs/MTETab';
import { consumiblesService } from '@/services';

type Tab = 'resumen' | 'produccion' | 'taller' | 'mte' | 'reportes' | 'pagos' | 'historial' | 'tecnicos';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [equipos, setEquipos] = useState<DashboardVehiculoResumen[]>([]);
  const [alertasStock, setAlertasStock] = useState<number>(0);
  const [ordenesSinFirma, setOrdenesSinFirma] = useState<OrdenSinFirma[]>([]);
  const [reporteAnual, setReporteAnual] = useState<ReporteAnual[]>([]);
  const [overdueVehiclesCount, setOverdueVehiclesCount] = useState(0);
  const [vehiculosEnTallerCount, setVehiculosEnTallerCount] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [weeklyTrendData, setWeeklyTrendData] = useState<any[]>([]);
  const [planesPreventivos, setPlanesPreventivos] = useState<TipoVehiculoItem[]>([]);
  const [recordatoriosPreventivosSemana, setRecordatoriosPreventivosSemana] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'reportes') {
      loadReportesData();
    } else if (activeTab === 'historial') {
      loadHistorialData();
    }
  }, [activeTab]);

  const calcularCuotaSemanalFallback = (totalVehiculos: number, frecuenciaMeses?: number, frecuenciaDias?: number) => {
    if (totalVehiculos <= 0) return 0;
    const semanasCiclo =
      (frecuenciaMeses ?? 0) > 0
        ? Number(frecuenciaMeses) * 4.345
        : Math.max(1, Number(frecuenciaDias ?? 0) / 7);
    const cuota = Math.ceil(totalVehiculos / semanasCiclo);
    return Math.max(1, Math.min(cuota, totalVehiculos));
  };

  const calcularRecordatoriosFallback = (tipos: TipoVehiculoItem[]) => {
    return tipos
      .filter((t) => (t.frecuenciaPreventivoMeses ?? 0) > 0 && (t.totalVehiculos ?? 0) > 0)
      .reduce((acc, t) => {
        const total = Number(t.totalVehiculos ?? 0);
        const cuota = Number(t.programadosPorSemana ?? 0) > 0
          ? Number(t.programadosPorSemana)
          : calcularCuotaSemanalFallback(total, t.frecuenciaPreventivoMeses, t.frecuenciaMantenimientoDias);
        return acc + Math.max(0, cuota);
      }, 0);
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, kpisRes, alertasRes, tallerRes, trendRes, tiposRes, programacionRes] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getKPIs(),
        consumiblesService.getAlertas(),
        dashboardService.getVehiculosEnTaller(),
        dashboardService.getGraficoOrdenesPorDia(7),
        catalogosService.getTiposVehiculo(),
        dashboardService.getProgramacionPreventiva()
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (kpisRes.success && kpisRes.data) {
        setKpis(kpisRes.data);
      }
      if (trendRes.success && trendRes.data) {
        const mappedData = (trendRes.data as any).map((item: any) => ({
          name: item.diaSemana || new Date(item.fecha).toLocaleDateString('es-MX', { weekday: 'short' }),
          solicitudes: item.reportesCreados || 0,
          completadas: item.ordenesCompletadas || 0
        }));
        setWeeklyTrendData(mappedData);
      }
      if (alertasRes.success && Array.isArray(alertasRes.data)) {
        setAlertasStock(alertasRes.data.length);
      } else {
        setAlertasStock(0);
      }
      if (tallerRes.success && tallerRes.data) {
        setOverdueVehiclesCount(tallerRes.data.filter(v => v.diasEnTaller > 7).length);
        const unicos = new Set(tallerRes.data.map((v) => v.vehiculoId));
        setVehiculosEnTallerCount(unicos.size);
      } else {
        setOverdueVehiclesCount(0);
        setVehiculosEnTallerCount(null);
      }
      if (tiposRes.success && tiposRes.data) {
        const configurados = tiposRes.data.filter((t) =>
          (t.frecuenciaPreventivoMeses ?? 0) > 0
        );
        setPlanesPreventivos(configurados);
        const fallbackCount = calcularRecordatoriosFallback(configurados);
        if (programacionRes.success && programacionRes.data && programacionRes.data.length > 0) {
          setRecordatoriosPreventivosSemana(programacionRes.data.length);
        } else {
          setRecordatoriosPreventivosSemana(fallbackCount);
        }
      } else {
        setPlanesPreventivos([]);
        setRecordatoriosPreventivosSemana(0);
      }
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportesData = async () => {
    try {
      const [sinFirmaRes, anualRes] = await Promise.all([
        dashboardService.getOrdenesSinFirma(),
        dashboardService.getReporteAnual()
      ]);

      if (sinFirmaRes.success && sinFirmaRes.data) {
        setOrdenesSinFirma(sinFirmaRes.data);
      }
      if (anualRes.success && anualRes.data) {
        setReporteAnual(anualRes.data);
      }
    } catch (error) {
      console.error('Error al cargar datos de reportes:', error);
    }
  };

  const loadHistorialData = async () => {
    if (equipos.length > 0) return;
    setHistoryLoading(true);
    try {
      const resumenRes = await dashboardService.getResumen();
      if (resumenRes.success && resumenRes.data) {
        setEquipos(resumenRes.data.equipos || []);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingCard message="Cargando dashboard administrativo..." />;
  }

  const disponibilidad = kpis?.porcentajeDisponibilidad || 0;
  const totalVehiculos = stats?.totalVehiculos || 0;
  const vehiculosOperativos = stats?.vehiculosOperativos || 0;
  const vehiculosEnTaller = vehiculosEnTallerCount ?? stats?.vehiculosEnReparacion ?? 0;
  const reportesPendientes = stats?.reportesSinAtender || 0;
  const ordenesActivas = (stats?.ordenesPendientes || 0) + (stats?.ordenesEnProceso || 0);
  const ordenesCompletadas = stats?.ordenesCompletadasSemana || 0;
  const tiempoPromedio = kpis?.tiempoPromedioResolucion || 0;
  const totalProgramadosSemana = recordatoriosPreventivosSemana;
  const porcentajeOperativos = totalVehiculos > 0 ? (vehiculosOperativos / totalVehiculos) * 100 : 0;
  const tiempoPromedioDias = Math.floor(tiempoPromedio / 24);
  const tiempoPromedioHorasRestantes = tiempoPromedio - (tiempoPromedioDias * 24);
  const tiempoPromedioDisplay = `${tiempoPromedioDias}d (${tiempoPromedioHorasRestantes.toFixed(1)}h)`;

  // New KPI Calculations
  const maxInMaintenance = Math.ceil(totalVehiculos * 0.04);
  const isAvailabilityGood = vehiculosEnTaller <= maxInMaintenance;

  const orderStatusData =
    kpis?.ordenesPorEstado?.map((item) => ({
      name: item.estadoNombre || `Estado ${item.estado}`,
      value: item.cantidad,
      color:
        item.estado === 5
          ? '#2db928'
          : item.estado === 4
          ? '#10b981'
          : item.estado === 2
          ? '#ffa500'
          : item.estado === 1
          ? '#00a5dc'
          : '#6b7280',
    })) || [];

  const failureData =
    kpis?.fallasPorTipo?.map((item) => ({
      name: item.tipoNombre || `Tipo ${item.tipo}`,
      value: item.cantidadFallas,
    })) || [];

  const lastSync = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());


  return (
    <div className="dashboard-wrapper space-y-6">
      <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <p className="text-sm text-blue-800">
          Bienvenido a su Panel de Control. Desde aquí puede supervisar el estado general de la flota, atender reportes de falla urgentes y gestionar las órdenes de trabajo activas de manera eficiente.
        </p>
      </Card>
      
      <section className="dashboard-card border-l-4 border-l-continental-yellow/80 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Dashboard Administrativo</p>
            <h1 className="text-3xl font-bold text-continental-black">Panel General</h1>
            <p className="text-continental-gray-1">
              Vista ejecutiva del estado de la flota y solicitudes en validación. Supervise el rendimiento y las métricas clave de mantenimiento de forma centralizada.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      <div
        onClick={() => navigate('/vehiculos')}
        className={`rounded-lg border bg-white/70 px-4 py-3 cursor-pointer hover:bg-white transition-colors ${isAvailabilityGood ? 'border-continental-green' : 'border-continental-red'}`}
      >
        <p className="text-xs uppercase tracking-wide text-continental-gray-2">Disponibilidad</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-2xl font-semibold ${isAvailabilityGood ? 'text-continental-green' : 'text-continental-red'}`}>{disponibilidad.toFixed(1)}%</p>
          <span className="text-xs text-continental-gray-1">(Meta: {'>'}96%)</span>
        </div>
      </div>
              <div
                onClick={() => setActiveTab('reportes')}
                className="rounded-lg border border-continental-gray-3 bg-white/70 px-4 py-3 cursor-pointer hover:bg-white transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-continental-gray-2">Ordenes activas</p>
                <p className="text-2xl font-semibold text-continental-black">{ordenesActivas}</p>
              </div>
              <div
                onClick={() => setActiveTab('reportes')}
                className="rounded-lg border border-continental-gray-3 bg-white/70 px-4 py-3 cursor-pointer hover:bg-white transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-continental-gray-2">Reportes pendientes</p>
                <p className="text-2xl font-semibold text-continental-black">{reportesPendientes}</p>
              </div>
            </div>
          </div>
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/50 bg-white/80 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Ultima actualizacion</p>
              <p className="text-lg font-semibold text-continental-black">{lastSync}</p>
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              className="inline-flex items-center justify-center rounded-lg bg-continental-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-continental-yellow/40 transition hover:opacity-95"
            >
              Actualizar datos
            </button>
            <Link
              to="/reportes"
              className="inline-flex items-center justify-center rounded-lg border border-continental-yellow px-6 py-3 text-sm font-semibold text-continental-yellow transition hover:bg-continental-yellow hover:text-continental-black"
            >
              Revisar solicitudes
            </Link>
            <Link
              to="/inventario"
              className="inline-flex items-center justify-center rounded-lg border border-continental-green px-6 py-3 text-sm font-semibold text-continental-green transition hover:bg-continental-green hover:text-white"
            >
              Inventario
              {alertasStock > 0 && (
                <span className="ml-2 rounded-full bg-continental-red text-white text-xs px-2 py-0.5">
                  {alertasStock}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {overdueVehiclesCount > 0 && (
        <Alert variant="destructive" className="mt-6 border-continental-red bg-red-50 text-red-900 shadow-sm">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold ml-2">Alerta de Cumplimiento</AlertTitle>
          <AlertDescription className="ml-2">
            Hay {overdueVehiclesCount} vehiculos que han excedido el tiempo de reparacion de 7 dias. Revise la pestaña <span className="font-bold cursor-pointer underline" onClick={() => setActiveTab('taller')}>Taller</span>.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex overflow-x-auto space-x-1 rounded-xl bg-continental-gray-4 p-1 mt-6">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'resumen'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          General (Inventario)
        </button>
        <button
          onClick={() => setActiveTab('produccion')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'produccion'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <Box className="h-4 w-4" />
          Producción
        </button>
        <button
          onClick={() => setActiveTab('taller')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'taller'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Taller (Mantenimiento)
          {overdueVehiclesCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-continental-red text-white text-[10px] font-bold leading-none">
              {overdueVehiclesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('mte')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'mte'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <Package className="h-4 w-4" />
          MTE (Pagos/Ref)
        </button>
        <button
          onClick={() => setActiveTab('reportes')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'reportes'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Reportes y Ordenes
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'historial'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <History className="h-4 w-4" />
          Historial
        </button>
        <button
          onClick={() => setActiveTab('tecnicos')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'tecnicos'
              ? 'bg-white text-continental-black shadow-sm'
              : 'text-continental-gray-1 hover:text-continental-black hover:bg-white/50'
          }`}
        >
          <Users className="h-4 w-4" />
          Técnicos
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* New Top Section for Inventory Details */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-continental-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-continental-blue" />
                  Estado del Inventario
                </h3>
                <div className="space-y-4">
                  <div
                    onClick={() => navigate('/vehiculos')}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-600">Total Inventario</span>
                    <span className="text-xl font-bold text-gray-900">{totalVehiculos}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Objetivo mensual 2026 para reparar</span>
                    <span className="text-xl font-bold text-blue-600">{maxInMaintenance}</span>
                  </div>
                  <div
                    onClick={() => setActiveTab('taller')}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-600">Actual en Taller</span>
                    <span className={`text-xl font-bold ${isAvailabilityGood ? 'text-green-600' : 'text-red-600'}`}>
                      {vehiculosEnTaller}
                    </span>
                  </div>
                  {!isAvailabilityGood && (
                    <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">
                      ⚠️ Se ha excedido el límite del 4% de inventario en mantenimiento.
                    </div>
                  )}
                </div>
              </Card>

              <Card
                className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/configuracion?tab=preventivos')}
              >
                <h3 className="font-semibold text-lg mb-4 text-continental-black flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-continental-yellow" />
                  Programación Preventiva
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Tipos configurados</span>
                    <span className="text-xl font-bold text-continental-black">{planesPreventivos.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Programados por semana</span>
                    <span className="text-xl font-bold text-continental-blue">{totalProgramadosSemana}</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto pr-1 text-xs text-continental-gray-1 space-y-1">
                    {planesPreventivos.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex justify-between gap-2 border-b border-continental-gray-4 pb-1">
                        <span className="font-medium text-continental-black">{p.nombre}</span>
                        <span>
                          {p.frecuenciaPreventivoMeses ? `Cada ${p.frecuenciaPreventivoMeses} mes(es)` : 'N/D'} | Auto semanal
                        </span>
                      </div>
                    ))}
                    {planesPreventivos.length === 0 && (
                      <p className="text-continental-red font-medium">No se ha programado un mantenimiento aún.</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Weekly Trend Chart Detail (Moved Up) */}
              <div className="bg-white rounded-xl border border-gray-200 p-1">
                 <WeeklyTrendChart data={weeklyTrendData} />
              </div>
            </div>

            {/* Failures and Location Matrix */}
            <div className="grid gap-6 lg:grid-cols-2">
              <RecurrentFailuresChart data={kpis?.fallasRecurrentesChecklist} />
              <FailuresByTypeChart data={failureData.length > 0 ? failureData : undefined} />
            </div>

            <LocationMatrix data={kpis?.matrizUbicacion || []} />

            {/* Original KPI Grid (Moved Down) */}
            <div className="dashboard-kpi-grid">
              <KPICard
                label="Contenedores Operativos"
                value={vehiculosOperativos}
                trend={{
                  value: `${porcentajeOperativos.toFixed(2)}% del total`,
                  isPositive: true,
                }}
                variant="green"
                icon={<Truck className="h-6 w-6" />}
                onClick={() => navigate('/vehiculos')}
              />
              <KPICard
                label="En Taller"
                value={vehiculosEnTaller}
                variant="yellow"
                icon={<Wrench className="h-6 w-6" />}
                onClick={() => setActiveTab('taller')}
              />
              <KPICard
                label="Reportes Pendientes"
                value={reportesPendientes}
                trend={
                  reportesPendientes > 0
                    ? { value: `${stats?.reportesNuevosHoy || 0} nuevos hoy`, isPositive: false }
                    : undefined
                }
                variant={reportesPendientes > 5 ? 'red' : 'blue'}
                icon={<AlertTriangle className="h-6 w-6" />}
                onClick={() => setActiveTab('reportes')}
              />
              <KPICard
                label="Tiempo Promedio"
                value={tiempoPromedioDisplay}
                trend={{
                  value: 'de resolucion',
                  isPositive: tiempoPromedio < 4,
                }}
                variant="blue"
                icon={<Clock className="h-6 w-6" />}
                onClick={() => setActiveTab('reportes')}
              />
              <KPICard
                label="Completadas Semana"
                value={ordenesCompletadas}
                trend={{
                  value: `${stats?.ordenesCompletadasHoy || 0} hoy`,
                  isPositive: true,
                }}
                variant="green"
                icon={<CheckCircle className="h-6 w-6" />}
                onClick={() => setActiveTab('reportes')}
              />
            </div>

            <EquipmentStatusPanel />
            <MaintenanceAlerts />
          </div>
        )}

        {activeTab === 'produccion' && <ProductionTab />}

        {activeTab === 'taller' && <WorkshopTab />}
        
        {activeTab === 'mte' && <MTETab stats={stats} />}

        {activeTab === 'reportes' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="p-6 bg-blue-50 border-blue-200 flex gap-3 items-start mb-6">
              <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                Consulte informes estadísticos detallados sobre el desempeño del mantenimiento, tipos de falla más comunes y el estado general de las órdenes de trabajo.
              </p>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <OrdersByStatusChart data={orderStatusData.length > 0 ? orderStatusData : undefined} />
            </div>
            <ReportsTab 
              ordenesSinFirma={ordenesSinFirma} 
              reporteAnual={reporteAnual} 
              kpis={kpis} 
              orderStatusData={orderStatusData} 
              failureData={failureData} 
            />
          </div>
        )}

        {activeTab === 'historial' && <HistoryTab equipos={equipos} isLoading={historyLoading} />}

        {activeTab === 'tecnicos' && <TechniciansTab />}
      </div>
    </div>
  );
}
