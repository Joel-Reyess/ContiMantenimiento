import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services';

interface MaintenanceAlert {
  id: string;
  vehiculoCodigo: string;
  tipoVehiculo: string;
  fechaProgramada: Date;
  estado: string;
  diasRestantes: number;
}

interface AlertBoxProps {
  type: 'warning' | 'critical';
  title: string;
  count: number;
  icon: React.ReactNode;
  items: MaintenanceAlert[];
  redirectTo: string;
}

function AlertBox({ type, title, count, icon, items, redirectTo }: AlertBoxProps) {
  const [expanded, setExpanded] = useState(false);

  const styles = {
    warning: {
      container: 'border-continental-yellow bg-continental-yellow/10',
      icon: 'text-continental-yellow',
      badge: 'bg-continental-yellow text-continental-black',
    },
    critical: {
      container: 'border-continental-red bg-continental-red/10',
      icon: 'text-continental-red',
      badge: 'bg-continental-red text-white',
    },
  };

  if (count === 0) return null;

  return (
    <div className={cn('rounded-lg border-l-4 p-4', styles[type].container)}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={styles[type].icon}>{icon}</div>
          <div>
            <h4 className="font-semibold text-continental-black">{title}</h4>
            <p className="text-sm text-continental-gray-1">
              {count} vehículo{count !== 1 ? 's' : ''} requiere{count === 1 ? '' : 'n'} atención
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[2.1rem] h-8 px-2.5 rounded-full text-sm font-bold leading-none tabular-nums',
              styles[type].badge
            )}
          >
            {count}
          </span>
          <ChevronRight
            className={cn(
              'h-5 w-5 text-continental-gray-2 transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-continental-gray-3 pt-4">
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              to={redirectTo}
              className="flex items-center justify-between p-2 bg-white rounded-md hover:bg-continental-gray-4 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-continental-black">
                  {item.vehiculoCodigo}
                </span>
                <span className="text-xs text-continental-gray-1">
                  {item.tipoVehiculo}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-continental-gray-1">
                <Calendar className="h-3 w-3" />
                {new Date(item.fechaProgramada).toLocaleDateString('es-MX')}
              </div>
            </Link>
          ))}
          {items.length > 5 && (
            <p className="text-sm text-continental-gray-1 text-center pt-2">
              y {items.length - 5} más...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function MaintenanceAlerts() {
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceAlert[]>([]);
  const [overdueMaintenance, setOverdueMaintenance] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaintenanceAlerts();
  }, []);

  const loadMaintenanceAlerts = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getProgramacionPreventiva();

      const data = Array.isArray(response.data) ? response.data : [];
      const mapped: MaintenanceAlert[] = data.map((item) => ({
        id: `${item.vehiculoId}-${item.proximaFecha}`,
        vehiculoCodigo: item.vehiculoCodigo,
        tipoVehiculo: item.tipoVehiculo,
        fechaProgramada: new Date(item.proximaFecha),
        estado: item.estado,
        diasRestantes: item.diasRestantes
      }));

      const vencidos = mapped
        .filter((m) => m.diasRestantes < 0)
        .sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime());

      const proximos = mapped
        .filter((m) => m.diasRestantes >= 0)
        .sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime());

      setOverdueMaintenance(vencidos);
      setUpcomingMaintenance(proximos);
    } catch (error) {
      console.error('Error loading maintenance alerts:', error);
      setUpcomingMaintenance([]);
      setOverdueMaintenance([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card p-7">
        <h3 className="text-lg font-semibold text-continental-black mb-4">
          Alertas de Mantenimiento
        </h3>
        <div className="space-y-4">
          <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
          <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  const hasAlerts = upcomingMaintenance.length > 0 || overdueMaintenance.length > 0;
  const preventivosLink = '/configuracion?tab=preventivos';

  return (
    <div className="dashboard-card p-7 space-y-1">
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Alertas de Mantenimiento
      </h3>

      {!hasAlerts ? (
        <div className="text-center py-6 text-continental-gray-1">
          <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No hay alertas de mantenimiento</p>
          <p className="text-sm">Todos los equipos están al día</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AlertBox
            type="critical"
            title="Mantenimiento Vencido"
            count={overdueMaintenance.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            items={overdueMaintenance}
            redirectTo={preventivosLink}
          />
          <AlertBox
            type="warning"
            title="Próximos Mantenimientos"
            count={upcomingMaintenance.length}
            icon={<Clock className="h-5 w-5" />}
            items={upcomingMaintenance}
            redirectTo={preventivosLink}
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-continental-gray-3">
        <Link
          to={preventivosLink}
          className="text-sm text-continental-yellow hover:text-continental-yellow-dark font-medium flex items-center justify-center gap-1"
        >
          Ir a programación preventiva
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
