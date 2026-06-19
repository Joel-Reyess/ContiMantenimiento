import { useMemo } from 'react';
import { CheckCircle2, Clock, Wrench, ShieldCheck, Truck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstadoOrdenTrabajo } from '@/interfaces/Api.interface';
import { ubicacionConfig, UbicacionVehiculo } from '@/components/vehiculos/UbicacionLegend';
import type { OrdenTrabajo } from '@/interfaces';

interface Step {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'pending' | 'active' | 'completed' | 'blocked';
  responsible?: string;
}

interface OrdenFlowStatusProps {
  orden: OrdenTrabajo;
  reportadaPorNombre?: string;
  className?: string;
}

export function OrdenFlowStatus({ orden, reportadaPorNombre, className }: OrdenFlowStatusProps) {
  const steps = useMemo<Step[]>(() => {
    const reportadaPor =
      reportadaPorNombre || orden.reporteFalla?.reportadoPorNombre || orden.creadoPorNombre || 'Sin registro';

    const s: Step[] = [
      {
        id: 'reporte',
        label: 'Reportada',
        description: 'Falla registrada',
        icon: AlertCircle,
        status: 'completed',
        responsible: reportadaPor
      },
      {
        id: 'asignacion',
        label: 'Aceptada',
        description: 'Técnico asignado',
        icon: CheckCircle2,
        status: orden.estado <= EstadoOrdenTrabajo.Asignada ? 'active' : 'completed',
        responsible: orden.tecnicoNombre || 'Pendiente'
      },
      {
        id: 'taller',
        label: 'Taller',
        description: 'Reparación activa',
        icon: Wrench,
        status: 
          orden.estado >= EstadoOrdenTrabajo.Completada ? 'completed' :
          orden.estado === EstadoOrdenTrabajo.EnProceso ? 'active' :
          orden.estado === EstadoOrdenTrabajo.EsperandoRefacciones ? 'blocked' : 'pending',
        responsible: orden.tecnicoNombre || 'Técnico'
      },
      {
        id: 'validacion',
        label: 'Validación',
        description: 'Firmas de entrega',
        icon: ShieldCheck,
        status: 
          orden.estado === EstadoOrdenTrabajo.Validada ? 'completed' :
          orden.estado === EstadoOrdenTrabajo.Completada ? 'active' : 'pending',
        responsible: 'Líder / Supervisor'
      },
      {
        id: 'piso',
        label: 'Disponible',
        description: 'Regreso a piso',
        icon: Truck,
        status: orden.estado === EstadoOrdenTrabajo.Validada ? 'completed' : 'pending',
        responsible: 'Logística'
      }
    ];
    return s;
  }, [orden, reportadaPorNombre]);

  const getApprovalStatus = () => {
    const needsLider = orden.estadoAprobacionLider === 0;
    const needsSupervisor = orden.estadoAprobacionSupervisor === 0;
    
    if (orden.estado === EstadoOrdenTrabajo.Completada) {
      if (needsLider) return { label: 'Esperando aprobación del Líder', type: 'warning' };
      if (needsSupervisor) return { label: 'Esperando validación del Supervisor', type: 'warning' };
    }
    
    if (orden.estado === EstadoOrdenTrabajo.EsperandoRefacciones) {
      return { label: 'Detenida por falta de refacciones', type: 'error' };
    }

    return null;
  };

  const statusMsg = getApprovalStatus();

  return (
    <div className={cn("w-full py-6 px-4 bg-white rounded-xl border border-continental-gray-3/60 shadow-sm", className)}>
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 w-full h-1 bg-gray-200 -z-0 rounded-full">
          <div 
            className="h-full bg-continental-green transition-all duration-500 rounded-full" 
            style={{ width: `${(steps.findIndex(s => s.status === 'active' || s.status === 'pending') === -1 ? 4 : Math.max(0, steps.findIndex(s => s.status === 'active' || (s.status === 'pending' && steps[steps.indexOf(s)-1]?.status === 'completed')))) * 25}%` }}
          />
        </div>

        {/* Steps */}
        {steps.map((step) => (
          <div key={step.id} className="relative z-10 flex flex-col items-center group w-1/5">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
              step.status === 'completed' ? "bg-continental-green border-continental-green text-white shadow-lg shadow-continental-green/20" :
              step.status === 'active' ? "bg-amber-500 border-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/30 scale-110" :
              step.status === 'blocked' ? "bg-red-50 border-red-500 text-red-500" :
              "bg-white border-gray-300 text-gray-400"
            )}>
              <step.icon className="w-6 h-6" />
            </div>
            
            <div className="mt-3 text-center">
              <p className={cn(
                "text-xs font-bold uppercase tracking-wider",
                step.status === 'pending' ? "text-gray-400" : "text-continental-black"
              )}>
                {step.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                {step.responsible}
              </p>
            </div>

            {/* Tooltip or additional info on hover */}
            <div className="absolute -bottom-10 opacity-0 group-hover:opacity-100 transition-opacity bg-continental-black text-white text-[9px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">
              {step.description}
            </div>
          </div>
        ))}
      </div>

      {statusMsg && (
        <div className={cn(
          "mt-12 p-3 rounded-lg border flex items-center gap-3 animate-in slide-in-from-top-2",
          statusMsg.type === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-800"
        )}>
          <Clock className="w-4 h-4" />
          <p className="text-xs font-semibold">{statusMsg.label}</p>
        </div>
      )}
      
      <div className="mt-4 flex justify-end">
        <div className="text-[10px] text-continental-gray-2 flex items-center gap-1.5 bg-continental-bg px-2 py-1 rounded border border-continental-gray-3/30 shadow-sm">
          <span className="font-bold">Ubicación Actual:</span>
          <span className="text-continental-blue font-bold uppercase">
            {orden.vehiculoUbicacionNombre || 
             (typeof orden.vehiculoUbicacion === 'number' 
                ? (ubicacionConfig[orden.vehiculoUbicacion as UbicacionVehiculo]?.label || orden.vehiculoUbicacion)
                : (orden.vehiculoUbicacion || 'Piso (Disponible)'))}
          </span>
        </div>
      </div>
    </div>
  );
}
