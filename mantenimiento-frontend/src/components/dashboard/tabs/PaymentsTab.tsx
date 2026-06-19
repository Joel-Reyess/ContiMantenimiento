import { useState, useEffect } from 'react';
import { dashboardService, OrdenSinPago } from '@/services/dashboardService';
import type { DashboardStats } from '@/interfaces';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button } from '@/components/ui';
import { DollarSign, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PaymentsTabProps {
  stats?: DashboardStats | null;
}

export function PaymentsTab({ stats }: PaymentsTabProps) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['Administrador']);
  const [ordenes, setOrdenes] = useState<OrdenSinPago[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await dashboardService.getOrdenesSinPago();
      if (res.success && res.data) {
        setOrdenes(res.data);
      }
    } catch (error) {
      console.error('Error loading payments data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const totalPendingAmount = ordenes.reduce((acc, curr) => acc + curr.costoTotal, 0);

  if (isLoading) {
    return <div className="p-8 text-center text-continental-gray-1">Cargando informacion de pagos...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 border-l-4 border-l-continental-yellow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-continental-yellow/10 rounded-full">
              <FileText className="h-6 w-6 text-continental-yellow" />
            </div>
            <div>
              <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Pagos Pendientes (Ext)</p>
              <h3 className="text-2xl font-bold text-continental-black">{stats?.pagosPendientes || 0}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-continental-red">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-continental-red/10 rounded-full">
              <AlertCircle className="h-6 w-6 text-continental-red" />
            </div>
            <div>
              <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Ordenes Sin Pago</p>
              <h3 className="text-2xl font-bold text-continental-black">{ordenes.length}</h3>
            </div>
          </div>
        </Card>

        {isAdmin && (
          <Card className="p-6 border-l-4 border-l-continental-blue">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-continental-blue/10 rounded-full">
                <DollarSign className="h-6 w-6 text-continental-blue" />
              </div>
              <div>
                <p className="text-sm text-continental-gray-1 font-medium uppercase tracking-wide">Monto Pendiente (Estimado)</p>
                <h3 className="text-2xl font-bold text-continental-black">{formatCurrency(totalPendingAmount + (stats?.montoPagosPendientes || 0))}</h3>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-continental-gray-3/60 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-continental-black">Ordenes Finalizadas Sin Registro de Pago</h3>
            <p className="text-sm text-continental-gray-1">Ordenes completadas que aun no tienen un pago asociado o aprobado.</p>
          </div>
          <Link to="/pagos">
            <Button variant="outline" size="sm" className="gap-2">
              Gestionar Pagos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-continental-gray-4/50 text-continental-gray-1 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Folio</th>
                <th className="px-6 py-4">Vehiculo</th>
                <th className="px-6 py-4">Tecnico</th>
                <th className="px-6 py-4">Fecha Termino</th>
                {isAdmin && <th className="px-6 py-4 text-right">Costo Total</th>}
                <th className="px-6 py-4 text-center">Estado Pago</th>
                <th className="px-6 py-4 text-center">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-continental-gray-3/60">
              {ordenes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-continental-gray-1">
                    No hay ordenes pendientes de pago.
                  </td>
                </tr>
              ) : (
                ordenes.map((o) => (
                  <tr key={o.ordenId} className="transition-colors hover:bg-continental-gray-4/30">
                    <td className="px-6 py-4 font-medium text-continental-black">{o.folio}</td>
                    <td className="px-6 py-4">{o.vehiculo}</td>
                    <td className="px-6 py-4 text-continental-gray-1">{o.tecnico}</td>
                    <td className="px-6 py-4 text-continental-gray-1">
                      {new Date(o.fechaFinalizacion).toLocaleDateString('es-MX')}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right font-medium">
                        {formatCurrency(o.costoTotal)}
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {o.estadoPago === 'Sin Registro' ? 'No Registrado' : o.estadoPago}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link 
                        to={`/ordenes/${o.ordenId}`}
                        className="text-continental-blue hover:text-continental-blue-dark hover:underline"
                      >
                        Ver Orden
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
