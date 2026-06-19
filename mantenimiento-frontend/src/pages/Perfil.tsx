import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui';

export function PerfilPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard-wrapper">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Perfil</p>
        <h1 className="text-3xl font-semibold text-continental-black">Mi informacion</h1>
        <p className="text-continental-gray-1">Datos basicos de tu cuenta.</p>
      </div>

      <Card className="p-6 border-l-4 border-continental-yellow">
        <div className="space-y-2 text-continental-black">
          <p className="text-lg font-semibold">{user?.nombreCompleto || 'Usuario'}</p>
          <p className="text-sm text-continental-gray-1">Usuario: {user?.username || 'N/D'}</p>
          <p className="text-sm text-continental-gray-1">Rol: {user?.rolNombre || 'N/D'}</p>
          {user?.areaNombre && <p className="text-sm text-continental-gray-1">Area: {user.areaNombre}</p>}
        </div>
      </Card>
    </div>
  );
}
