import { useState, useEffect } from 'react';
import { dashboardService, OrdenSinFirma } from '@/services/dashboardService';
import { ordenesService } from '@/services/ordenesService';
import { Card } from '@/components/ui';
import { ClipboardList, Clock, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrdenTrabajoList } from '@/interfaces';

export function ProductionTab() {
  const [ordenesSinFirma, setOrdenesSinFirma] = useState<OrdenSinFirma[]>([]);
  const [ordenesCreadas, setOrdenesCreadas] = useState<OrdenTrabajoList[]>([]);
  const [ordenesTransicion, setOrdenesTransicion] = useState<OrdenTrabajoList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sinFirmaRes, creadasRes, transicionRes] = await Promise.all([
        dashboardService.getOrdenesSinFirma(),
        ordenesService.getAll({ estado: 1 }), // Pendiente
        ordenesService.getAll({ estado: 7 }) // Validada (Zona de Transicion/Entrega)
      ]);

      if (sinFirmaRes.success && sinFirmaRes.data) {
        setOrdenesSinFirma(sinFirmaRes.data);
      }
      
      if (creadasRes.success && creadasRes.data) {
        const items = (creadasRes.data as any).items || [];
        setOrdenesCreadas(items);
      }

      if (transicionRes.success && transicionRes.data) {
         const items = (transicionRes.data as any).items || [];
         setOrdenesTransicion(items);
      }

    } catch (error) {
      console.error('Error loading production data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-continental-gray-1">Cargando informacion de produccion...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/ordenes" className="block">
          <Card className="p-6 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <ClipboardList className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Ordenes Creadas</p>
                <h3 className="text-2xl font-bold text-continental-black">{ordenesCreadas.length}</h3>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/ordenes" className="block">
          <Card className="p-6 border-l-4 border-l-continental-yellow hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-continental-yellow/10 rounded-full">
                <Clock className="h-6 w-6 text-continental-yellow" />
              </div>
              <div>
                <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Pendientes Aprobacion</p>
                <h3 className="text-2xl font-bold text-continental-black">{ordenesSinFirma.length}</h3>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/ordenes" className="block">
          <Card className="p-6 border-l-4 border-l-green-500 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Alertas Entrega</p>
                <h3 className="text-2xl font-bold text-continental-black">{ordenesTransicion.length}</h3>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Ordenes Creadas */}
        <Card className="overflow-hidden h-full cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ordenes')}>
          <div className="p-4 border-b border-continental-gray-3/60 bg-blue-50/50">
            <h3 className="text-base font-semibold text-blue-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Órdenes Creadas
            </h3>
            <p className="text-xs text-blue-700">Recién registradas, pendientes de asignar.</p>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
             {ordenesCreadas.length === 0 ? (
               <p className="p-4 text-sm text-center text-gray-500">No hay órdenes creadas.</p>
             ) : (
               <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Folio</th>
                      <th className="px-4 py-2">Vehiculo</th>
                      <th className="px-4 py-2 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordenesCreadas.map(o => (
                      <tr key={o.id} onClick={(e) => { e.stopPropagation(); navigate(`/ordenes/${o.id}`); }} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{o.folio}</td>
                        <td className="px-4 py-2">{o.vehiculoCodigo}</td>
                        <td className="px-4 py-2 text-right"><Link to={`/ordenes/${o.id}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>Ver</Link></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             )}
          </div>
        </Card>

        {/* Pendientes Aprobacion */}
        <Card className="overflow-hidden h-full cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ordenes')}>
          <div className="p-4 border-b border-continental-gray-3/60 bg-yellow-50/50">
             <h3 className="text-base font-semibold text-yellow-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Órdenes Pendientes de Aprobación
            </h3>
            <p className="text-xs text-yellow-700">Requieren validación o firma.</p>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
             {ordenesSinFirma.length === 0 ? (
               <p className="p-4 text-sm text-center text-gray-500">No hay pendientes.</p>
             ) : (
               <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Folio</th>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordenesSinFirma.map(o => (
                      <tr key={o.id} onClick={(e) => { e.stopPropagation(); navigate(`/ordenes/${o.id}`); }} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{o.folio}</td>
                        <td className="px-4 py-2 text-xs">
                           {o.estado === 'Validada' ? 'Falta Firma' : 'Falta Validación'}
                        </td>
                        <td className="px-4 py-2 text-right"><Link to={`/ordenes/${o.id}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>Revisar</Link></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             )}
          </div>
        </Card>

        {/* Alertas de Entrega */}
        <Card className="overflow-hidden h-full md:col-span-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ordenes')}>
          <div className="p-4 border-b border-continental-gray-3/60 bg-green-50/50">
             <h3 className="text-base font-semibold text-green-900 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Alertas de Entrega (Zona de Transición)
            </h3>
            <p className="text-xs text-green-700">Órdenes validadas, listas para entrega.</p>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
             {ordenesTransicion.length === 0 ? (
               <p className="p-4 text-sm text-center text-gray-500">No hay alertas de entrega.</p>
             ) : (
               <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Folio</th>
                      <th className="px-4 py-2">Vehiculo</th>
                      <th className="px-4 py-2">Tecnico</th>
                      <th className="px-4 py-2 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordenesTransicion.map(o => (
                      <tr key={o.id} onClick={(e) => { e.stopPropagation(); navigate(`/ordenes/${o.id}`); }} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{o.folio}</td>
                        <td className="px-4 py-2">{o.vehiculoCodigo}</td>
                        <td className="px-4 py-2 text-gray-500">{o.tecnicoNombre}</td>
                        <td className="px-4 py-2 text-right"><Link to={`/ordenes/${o.id}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>Ver</Link></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             )}
          </div>
        </Card>
      </div>
    </div>
  );
}
