import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-6">
          <FileQuestion className="w-8 h-8 text-gray-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-xl text-gray-700 mb-2">Página no encontrada</p>
        <p className="text-gray-500 mb-6 max-w-md">
          La página que buscas no existe o ha sido movida.
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
