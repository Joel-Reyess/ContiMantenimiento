import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ShieldX, ArrowLeft } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
        <p className="text-gray-500 mb-6 max-w-md">
          No tienes permisos para acceder a esta sección. Si crees que esto es un
          error, contacta al administrador del sistema.
        </p>
        <Link to="/dashboard">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
