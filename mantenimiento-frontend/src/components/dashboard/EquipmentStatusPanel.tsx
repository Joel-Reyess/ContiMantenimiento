import { useState, useEffect } from 'react';
import { Truck, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services';
import type { EstadoPorTipo } from '@/interfaces';
import { useNavigate } from 'react-router-dom';

interface StatusIndicatorProps {
  label: string;
  count: number;
  color: 'green' | 'yellow' | 'red' | 'blue';
}

function StatusIndicator({ label, count, color }: StatusIndicatorProps) {
  const colorClasses = {
    green: 'text-continental-green',
    yellow: 'text-continental-yellow',
    red: 'text-continental-red',
    blue: 'text-blue-500',
  };

  return (
    <div className="flex items-center gap-2">
      <CircleDot className={cn('h-4 w-4', colorClasses[color])} />
      <span className="text-sm text-continental-gray-1">{label}:</span>
      <span className={cn('font-semibold', colorClasses[color])}>{count}</span>
    </div>
  );
}

interface VehicleTypeCardProps {
  title: string;
  icon: React.ReactNode;
  status: {
    piso: number;
    taller: number;
    transicion: number;
  };
}

function VehicleTypeCard({ title, icon, status }: VehicleTypeCardProps) {
  const total = status.piso + status.taller + status.transicion;
  const operationalPercent = total > 0 ? (status.piso / total) * 100 : 0;
  const navigate = useNavigate();

  return (
    <div 
      className="p-4 bg-continental-bg rounded-lg cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/vehiculos')}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-continental-yellow/20 rounded-lg">
          {icon}
        </div>
        <div>
          <h4 className="font-semibold text-continental-black">{title}</h4>
          <p className="text-xs text-continental-gray-1">
            {operationalPercent.toFixed(0)}% operativos
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <StatusIndicator label="Piso" count={status.piso} color="green" />
        <StatusIndicator label="Taller" count={status.taller} color="yellow" />
        <StatusIndicator label="Transicion" count={status.transicion} color="blue" />
      </div>
    </div>
  );
}

export function EquipmentStatusPanel() {
  const [statusData, setStatusData] = useState<EstadoPorTipo[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalPiso, setTotalPiso] = useState(0);
  const [totalTaller, setTotalTaller] = useState(0);
  const [totalTransicion, setTotalTransicion] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadEquipmentStatus();
  }, []);

  const loadEquipmentStatus = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getResumen();

      if (response.success && response.data) {
        const data = response.data;
        if (data.estadosPorTipo && data.estadosPorTipo.length > 0) {
          setStatusData(data.estadosPorTipo);
          
          let gTotal = 0, tPiso = 0, tTaller = 0, tTrans = 0;
          data.estadosPorTipo.forEach(item => {
            gTotal += item.total;
            // Use new fields if available, otherwise fallback to old mappings
            const piso = item.piso ?? item.operativos;
            const taller = item.taller ?? item.enMantenimiento;
            const transicion = item.transicion ?? item.fueraDeServicio;
            
            tPiso += piso;
            tTaller += taller;
            tTrans += transicion;
          });
          
          setGrandTotal(gTotal);
          setTotalPiso(tPiso);
          setTotalTaller(tTaller);
          setTotalTransicion(tTrans);
        } else {
          // Fallback logic
          const equipos = data.equipos || [];
          setGrandTotal(data.totalVehiculos || equipos.length);
          setTotalPiso(data.vehiculosEnPiso ?? data.vehiculosOperativos);
          setTotalTaller(data.vehiculosEnTaller ?? data.vehiculosEnMantenimiento);
          setTotalTransicion(data.vehiculosEnTransicion ?? data.vehiculosFueraServicio);
        }
      }
    } catch (error) {
      console.error('Error loading equipment status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card p-7">
        <h3 className="text-lg font-semibold text-continental-black mb-4">
          Estado de Equipos
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card p-7 space-y-2">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
        onClick={() => navigate('/vehiculos')}
      >
        <h3 className="text-lg font-semibold text-continental-black">
          Estado de Contenedores
        </h3>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-continental-black">
            {totalTaller} en taller actualmente
          </span>
          <span className="text-xs text-continental-gray-1">
            {grandTotal} contenedores totales
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
        {statusData.map((typeStats) => (
          <VehicleTypeCard
            key={typeStats.tipo}
            title={typeStats.tipo}
            icon={<Truck className="h-5 w-5 text-continental-yellow" />}
            status={{
              piso: typeStats.piso ?? typeStats.operativos,
              taller: typeStats.taller ?? typeStats.enMantenimiento,
              transicion: typeStats.transicion ?? typeStats.fueraDeServicio
            }}
          />
        ))}
        {statusData.length === 0 && (
          <p className="text-sm text-continental-gray-2 text-center py-4">
            No hay datos de tipos de vehículos disponibles.
          </p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-continental-gray-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-continental-gray-1">Disponibilidad Total</span>
          <span className="font-semibold text-continental-green">
            {grandTotal > 0 ? ((totalPiso / grandTotal) * 100).toFixed(1) : 0}%
          </span>
        </div>
        <div 
          className="h-2 bg-continental-gray-3 rounded-full overflow-hidden flex cursor-pointer"
          onClick={() => navigate('/vehiculos')}
        >
          <div
            className="bg-continental-green transition-all duration-500"
            style={{ width: `${grandTotal > 0 ? (totalPiso / grandTotal) * 100 : 0}%` }}
          />
          <div
            className="bg-continental-yellow transition-all duration-500"
            style={{ width: `${grandTotal > 0 ? (totalTaller / grandTotal) * 100 : 0}%` }}
          />
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${grandTotal > 0 ? (totalTransicion / grandTotal) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
