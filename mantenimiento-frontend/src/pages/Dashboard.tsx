import { Card } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { SupervisorDashboard } from './dashboards/SupervisorDashboard';
import { LiderDashboard } from './dashboards/LiderDashboard';

export function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const candidateRoles = [user?.rolNombre, ...roles].filter(Boolean) as string[];
  const normalize = (rol: string) =>
    rol
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizedRoles = candidateRoles.map(normalize);
  const displayRole = candidateRoles[0] || 'sin rol';

  const isAdmin = normalizedRoles.some((r) => r === 'superusuario' || r === 'administrador');
  const isSupervisor = normalizedRoles.some((r) => r.includes('supervisor'));
  const isLider = normalizedRoles.some((r) => r.includes('lider'));
  const isTecnico = normalizedRoles.some((r) => r.includes('tecnico'));

  if (isAdmin) return <AdminDashboard />;
  if (isSupervisor) return <SupervisorDashboard />;
  if (isLider) return <LiderDashboard />;
  if (isTecnico) return <Navigate to="/ordenes" replace />;

  return (
    <div className="dashboard-wrapper">
      <Card className="p-6">
        <p className="text-lg font-semibold text-continental-black">Rol no reconocido</p>
        <p className="text-continental-gray-1">
          No se pudo determinar el dashboard para tu rol: {displayRole}.
        </p>
      </Card>
    </div>
  );
}
