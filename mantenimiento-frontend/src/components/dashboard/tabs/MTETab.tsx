import { useState, useEffect } from 'react';
import { refaccionesService, SolicitudRefaccion } from '@/services/refaccionesService';
import { DashboardStats } from '@/interfaces';
import { Card, Badge, Button } from '@/components/ui';
import { Package, ArrowRight } from 'lucide-react';
import { PaymentsTab } from './PaymentsTab';
import { Link, useNavigate } from 'react-router-dom';

interface MTETabProps {
  stats?: DashboardStats | null;
}

export function MTETab({ stats }: MTETabProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudRefaccion[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPartsData();
  }, []);

  const loadPartsData = async () => {
    setLoadingParts(true);
    try {
      const res = await refaccionesService.getPendientes();
      if (res.success && res.data) {
        setSolicitudes(res.data);
      }
    } catch (error) {
      console.error('Error loading parts requests:', error);
    } finally {
      setLoadingParts(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Facturacion Section (Reusing PaymentsTab logic) */}
      <div>
        <div 
          className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
          onClick={() => navigate('/pagos')}
        >
          <h2 className="text-xl font-bold text-continental-black flex items-center gap-2">
            <span className="bg-continental-blue w-2 h-6 rounded-sm"></span>
            Facturación y Pagos
          </h2>
          <Button variant="ghost" size="sm" className="gap-2">
            Ver Todos <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <PaymentsTab stats={stats} />
      </div>

      {/* Refacciones Section */}
      <div>
        <div 
          className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
          onClick={() => navigate('/refacciones')}
        >
          <h2 className="text-xl font-bold text-continental-black flex items-center gap-2">
            <span className="bg-continental-yellow w-2 h-6 rounded-sm"></span>
            Refacciones y Materiales
          </h2>
          <Button variant="ghost" size="sm" className="gap-2">
            Ver Inventario <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card 
            className="p-6 border-l-4 border-l-continental-yellow cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/refacciones')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-continental-yellow/10 rounded-full">
                <Package className="h-6 w-6 text-continental-yellow" />
              </div>
              <div>
                <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Solicitudes Pendientes</p>
                <h3 className="text-2xl font-bold text-continental-black">{solicitudes.length}</h3>
              </div>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="p-6 border-b border-continental-gray-3/60 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-continental-black">Solicitudes de Refacciones Pendientes</h3>
              <p className="text-sm text-continental-gray-1">Materiales solicitados por técnicos que requieren aprobación o entrega.</p>
            </div>
            <Link to="/refacciones">
              <Button variant="outline" size="sm" className="gap-2">
                Gestionar Refacciones <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-continental-gray-4/50 text-continental-gray-1 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Refaccion</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Orden</th>
                  <th className="px-6 py-4">Solicitante</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-continental-gray-3/60">
                {loadingParts ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-continental-gray-1">Cargando...</td>
                  </tr>
                ) : solicitudes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-continental-gray-1">
                      No hay solicitudes pendientes.
                    </td>
                  </tr>
                ) : (
                  solicitudes.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-continental-gray-4/30">
                      <td className="px-6 py-4 font-medium text-continental-black">
                        {s.nombreRefaccion}
                        {s.numeroParte && <span className="block text-xs text-continental-gray-1">{s.numeroParte}</span>}
                      </td>
                      <td className="px-6 py-4">{s.cantidad}</td>
                      <td className="px-6 py-4">
                        {s.ordenTrabajoFolio ? (
                          <Link to={`/ordenes/${s.ordenTrabajoId}`} className="text-continental-blue hover:underline">
                            {s.ordenTrabajoFolio}
                          </Link>
                        ) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-continental-gray-1">{s.solicitadoPorNombre || 'N/D'}</td>
                      <td className="px-6 py-4 text-continental-gray-1">
                        {new Date(s.fechaSolicitud).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {s.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
