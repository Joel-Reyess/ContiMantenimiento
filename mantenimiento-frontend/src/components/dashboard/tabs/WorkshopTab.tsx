import { useState, useEffect } from 'react';
import { dashboardService, VehiculoEnTaller } from '@/services/dashboardService';
import { vehiculosService } from '@/services/vehiculosService';
import { catalogosService, TipoVehiculoItem } from '@/services/catalogosService';
import { Card, Badge, Alert, AlertTitle, AlertDescription, Button, Input, Modal, ModalFooter } from '@/components/ui';
import { AlertTriangle, CheckCircle, Clock, Calendar, ListOrdered, AlertCircle, Edit, Loader2, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface VehiculoPreventivo {
  id: number;
  codigo: string;
  tipo: string;
  proximoMantenimiento: string;
  diasParaMantenimiento: number;
}

export function WorkshopTab() {
  const [vehiculos, setVehiculos] = useState<VehiculoEnTaller[]>([]);
  const [preventivos, setPreventivos] = useState<VehiculoPreventivo[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<TipoVehiculoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTipo, setEditingTipo] = useState<TipoVehiculoItem | null>(null);
  const [accionando, setAccionando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tallerRes, vehiculosRes, tiposRes] = await Promise.all([
        dashboardService.getVehiculosEnTaller(),
        vehiculosService.getAll({ page: 1, pageSize: 100 }), // Fetch enough to find upcoming
        catalogosService.getTiposVehiculo()
      ]);

      if (tallerRes.success && tallerRes.data) {
        setVehiculos(tallerRes.data);
      }

      if (tiposRes.success && tiposRes.data) {
        setTiposVehiculo(tiposRes.data);
      }

      if (vehiculosRes.success && vehiculosRes.data) {
        const data: any = vehiculosRes.data;
        const items = (data.items || data.Items || []) as any[];
        
        // Filter for upcoming preventive maintenance (e.g., next 7 days or overdue)
        const upcoming = items
          .filter((v: any) => v.proximoMantenimiento)
          .map((v: any) => {
            const nextDate = new Date(v.proximoMantenimiento);
            const today = new Date();
            const diffTime = nextDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return {
              id: v.id,
              codigo: v.codigo,
              tipo: v.tipoNombre,
              proximoMantenimiento: v.proximoMantenimiento,
              diasParaMantenimiento: diffDays
            };
          })
          .filter(v => v.diasParaMantenimiento <= 7) // Show those due within 7 days or overdue
          .sort((a, b) => a.diasParaMantenimiento - b.diasParaMantenimiento);
          
        setPreventivos(upcoming);
      }

    } catch (error) {
      console.error('Error loading workshop data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTipo = async () => {
    if (!editingTipo) return;
    setAccionando(true);
    try {
      const res = await catalogosService.updateTipoVehiculo(editingTipo.id, editingTipo);
      if (res.success) {
        setEditingTipo(null);
        // Reload types to update the view
        const tiposRes = await catalogosService.getTiposVehiculo();
        if (tiposRes.success && tiposRes.data) {
          setTiposVehiculo(tiposRes.data);
        }
      } else {
        console.error('Error al actualizar tipo de vehiculo');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAccionando(false);
    }
  };

  const overdueVehicles = vehiculos.filter(v => {
    const isPreventivo = (v.tipoMantenimiento || '').toLowerCase().includes('preventivo');
    const limit = isPreventivo ? 2 : 7;
    return v.diasEnTaller > limit;
  });
  
  const approachingLimit = vehiculos.filter(v => {
    const isPreventivo = (v.tipoMantenimiento || '').toLowerCase().includes('preventivo');
    const limit = isPreventivo ? 2 : 7;
    // Approaching: within 20% of limit or specific days logic.
    // For 2 days limit: approaching at 1.5? or just > 1. Let's say >= limit - 1
    const approachStart = Math.max(1, limit - 2); 
    return v.diasEnTaller >= approachStart && v.diasEnTaller <= limit;
  });
  
  const avgRepairTime = vehiculos.length > 0 
    ? vehiculos.reduce((acc, v) => acc + v.diasEnTaller, 0) / vehiculos.length 
    : 0;

  // FIFO List: Sort by entry date (oldest first)
  const fifoList = [...vehiculos].sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime());

  // Calculate Workshop Utilization
  const workshopStats = tiposVehiculo
    .map(t => {
      const count = vehiculos.filter(v => v.tipo === t.nombre).length;
      
      // If configured, use it. Otherwise 4% of total fleet
      let limit = t.maxInWorkshop && t.maxInWorkshop > 0 
        ? t.maxInWorkshop 
        : Math.ceil((t.totalVehiculos || 0) * 0.04);
      
      // Ensure limit is at least 1 if there are vehicles, or 0 if no vehicles
      if (limit === 0 && (t.totalVehiculos || 0) > 0) limit = 1;

      // If no limit (0), we can't calculate percent, so avoid division by zero
      const percent = limit > 0 
        ? Math.min((count / limit) * 100, 100) 
        : 0;

      return {
        ...t,
        count,
        computedLimit: limit, // Store the limit used for display
        percent,
        isExceeded: limit > 0 && count > limit
      };
    })
    .sort((a, b) => b.percent - a.percent); // Optional: sort by utilization

  if (isLoading) {
    return <div className="p-8 text-center text-continental-gray-1">Cargando informacion del taller...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6 border-l-4 border-l-continental-blue cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ordenes')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-continental-blue/10 rounded-full">
              <Clock className="h-5 w-5 text-continental-blue" />
            </div>
            <div>
              <p className="text-xs text-continental-gray-1 font-medium uppercase tracking-wide">Promedio Dias Taller</p>
              <h3 className="text-xl font-bold text-continental-black">{avgRepairTime.toFixed(1)} dias</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-continental-yellow cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/ordenes')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-continental-yellow/10 rounded-full">
              <AlertTriangle className="h-5 w-5 text-continental-yellow" />
            </div>
            <div>
              <p className="text-xs text-continental-gray-1 font-medium uppercase tracking-wide">Proximos a Exceder</p>
              <h3 className="text-xl font-bold text-continental-black">{approachingLimit.length}</h3>
            </div>
          </div>
        </Card>
        
        <Card 
          className={`p-6 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${overdueVehicles.length > 0 ? 'border-l-continental-red' : 'border-l-continental-green'}`}
          onClick={() => navigate('/ordenes')}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${overdueVehicles.length > 0 ? 'bg-continental-red/10' : 'bg-continental-green/10'}`}>
              <AlertCircle className={`h-5 w-5 ${overdueVehicles.length > 0 ? 'text-continental-red' : 'text-continental-green'}`} />
            </div>
            <div>
              <p className="text-xs text-continental-gray-1 font-medium uppercase tracking-wide">Fuera de Tiempo ({'>'}7d)</p>
              <h3 className="text-xl font-bold text-continental-black">{overdueVehicles.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-continental-blue cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/vehiculos')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-continental-blue/10 rounded-full">
              <Calendar className="h-5 w-5 text-continental-blue" />
            </div>
            <div>
              <p className="text-xs text-continental-gray-1 font-medium uppercase tracking-wide">Preventivos Pendientes</p>
              <h3 className="text-xl font-bold text-continental-black">{preventivos.length}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      <div className="space-y-2">
        {overdueVehicles.length > 0 && (
          <Alert variant="destructive" className="border-continental-red bg-red-50 text-red-900 cursor-pointer" onClick={() => navigate('/ordenes')}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold ml-2 text-sm">Crítico: Exceso de tiempo</AlertTitle>
            <AlertDescription className="ml-2 text-xs">
              {overdueVehicles.length} vehículos han superado el KPI de 7 días (Correctivo).
            </AlertDescription>
          </Alert>
        )}
        {approachingLimit.length > 0 && (
          <Alert className="border-yellow-400 bg-yellow-50 text-yellow-900 cursor-pointer" onClick={() => navigate('/ordenes')}>
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="font-bold ml-2 text-sm">Atención: Próximos a vencer</AlertTitle>
            <AlertDescription className="ml-2 text-xs">
              {approachingLimit.length} vehículos están entre 5 y 7 días de reparación.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workshop Capacity KPI */}
        <Card className="overflow-hidden h-full">
          <div className="p-4 border-b border-continental-gray-3/60 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => navigate('/vehiculos')}>
            <div>
              <h3 className="text-base font-semibold text-continental-black flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-continental-orange" />
                Objetivo mensual 2026 para reparar
              </h3>
              <p className="text-xs text-continental-gray-1">Monitoreo de objetivos de reparación</p>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[400px]">
            {workshopStats.length === 0 ? (
              <p className="text-center text-sm text-continental-gray-1 py-4">No hay límites configurados.</p>
            ) : (
              <div className="space-y-4">
                {workshopStats.map(stat => (
                  <div key={stat.id} className="space-y-1">
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-continental-black cursor-pointer hover:underline" onClick={() => navigate('/vehiculos')}>{stat.nombre}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-continental-gray-1 hover:text-continental-blue" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTipo(stat);
                          }}
                          title="Editar límite"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className={`${stat.isExceeded ? 'text-red-600 font-bold' : 'text-continental-gray-1'}`}>
                        {stat.count} / {stat.computedLimit}
                        {!(stat.maxInWorkshop && stat.maxInWorkshop > 0) && (
                          <span className="text-[10px] text-gray-400 ml-1" title="Límite calculado (4% de la flota)">(Auto)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden cursor-pointer" onClick={() => navigate('/vehiculos')}>
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          stat.isExceeded ? 'bg-red-500' : 
                          stat.percent > 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${stat.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* FIFO List (Current Workshop) */}
        <Card className="overflow-hidden h-full">
          <div className="p-4 border-b border-continental-gray-3/60 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => navigate('/recepcion')}>
            <div>
              <h3 className="text-base font-semibold text-continental-black flex items-center gap-2">
                <ListOrdered className="h-4 w-4" />
                Vehículos en Taller (FIFO)
              </h3>
              <p className="text-xs text-continental-gray-1">Ordenados por fecha de ingreso</p>
            </div>
            <Badge variant="secondary">{vehiculos.length} Total</Badge>
          </div>
          <div className="overflow-y-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-continental-gray-1 font-semibold uppercase text-xs sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Vehiculo</th>
                  <th className="px-4 py-3">Ingreso</th>
                  <th className="px-4 py-3 text-center">Dias</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-continental-gray-3/60">
                {fifoList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-continental-gray-1 text-xs">
                      Taller libre.
                    </td>
                  </tr>
                ) : (
                  fifoList.map((v) => {
                    const isOverdue = v.diasEnTaller > 7;
                    const isApproaching = v.diasEnTaller >= 5 && v.diasEnTaller <= 7;
                    return (
                      <tr key={v.vehiculoId} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : isApproaching ? 'bg-yellow-50/30' : ''}`}>
                        <td className="px-4 py-3 font-medium text-continental-black cursor-pointer" onClick={() => navigate(`/vehiculos/${v.vehiculoId}`)}>
                          {v.codigo}
                          <span className="block text-[10px] text-gray-500">{v.tipo}</span>
                        </td>
                        <td className="px-4 py-3 text-continental-gray-1 text-xs">
                          {new Date(v.fechaIngreso).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge 
                            variant={isOverdue ? 'destructive' : isApproaching ? 'outline' : 'secondary'} 
                            className={`text-xs ${isOverdue ? 'bg-red-100 text-red-800' : isApproaching ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}`}
                          >
                            {v.diasEnTaller}d
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/ordenes/${v.ordenId}`} className="text-blue-600 hover:underline text-xs">
                            Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending Preventive Maintenance */}
        <Card className="overflow-hidden h-full border-blue-100 col-span-1 lg:col-span-2">
          <div className="p-4 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center cursor-pointer hover:bg-blue-100" onClick={() => navigate('/vehiculos')}>
            <div>
              <h3 className="text-base font-semibold text-blue-900 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Mantenimiento Preventivo Pendiente
              </h3>
              <p className="text-xs text-blue-700">Vehículos próximos a fecha programada</p>
            </div>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">{preventivos.length} Pendientes</Badge>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-continental-gray-1 font-semibold uppercase text-xs sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Vehiculo</th>
                  <th className="px-4 py-3">Fecha Prog.</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {preventivos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-continental-gray-1 text-xs">
                      No hay preventivos próximos (7 días).
                    </td>
                  </tr>
                ) : (
                  preventivos.map((v) => {
                    const isOverdue = v.diasParaMantenimiento < 0;
                    const isToday = v.diasParaMantenimiento === 0;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3 font-medium text-continental-black cursor-pointer" onClick={() => navigate(`/vehiculos/${v.id}`)}>
                          {v.codigo}
                          <span className="block text-[10px] text-gray-500">{v.tipo}</span>
                        </td>
                        <td className="px-4 py-3 text-continental-gray-1 text-xs">
                          {new Date(v.proximoMantenimiento).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            isOverdue ? 'bg-red-100 text-red-700' : 
                            isToday ? 'bg-orange-100 text-orange-700' : 
                            'bg-green-100 text-green-700'
                          }`}>
                            {isOverdue ? `${Math.abs(v.diasParaMantenimiento)} dias vencido` : isToday ? 'Hoy' : `En ${v.diasParaMantenimiento} dias`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/vehiculos/${v.id}`} className="text-blue-600 hover:underline text-xs">
                            Detalle
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={!!editingTipo}
        onClose={() => setEditingTipo(null)}
        title="Editar Objetivo Mensual"
        description={`Configurar el objetivo mensual 2026 para reparar para ${editingTipo?.nombre}`}
      >
        <div className="space-y-3">
          <Input
            label="Objetivo mensual 2026 para reparar (dejar en blanco o 0 para sin objetivo)"
            type="number"
            value={editingTipo?.maxInWorkshop?.toString() || ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              setEditingTipo(prev => prev ? { ...prev, maxInWorkshop: val } : null);
            }}
          />
          <p className="text-xs text-continental-gray-1">
            Este objetivo determinará la meta de reparaciones mensuales.
          </p>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingTipo(null)}>
            Cancelar
          </Button>
          <Button onClick={handleUpdateTipo} disabled={accionando} className="flex items-center gap-2">
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
