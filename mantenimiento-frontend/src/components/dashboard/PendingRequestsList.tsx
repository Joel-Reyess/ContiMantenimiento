import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, User, MapPin, AlertCircle, ChevronRight, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportesService, ordenesService } from '@/services';

interface PendingItem {
  id: number;
  titulo: string;
  reportador: string;
  tiempoTranscurrido: string;
  area: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  tipo: 'reporte' | 'orden';
}

const priorityStyles = {
  Alta: 'bg-continental-red/10 text-continental-red',
  Media: 'bg-continental-yellow/20 text-continental-yellow-dark',
  Baja: 'bg-continental-blue/10 text-continental-blue-dark',
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffMins > 0) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  return 'hace un momento';
}

export function PendingRequestsList() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadPendingItems();
  }, []);

  const loadPendingItems = async () => {
    try {
      setLoading(true);
      let reportesData: any[] = [];
      let ordenesData: any[] = [];

      // Reportes sin atender (fallback: últimos reportes)
      try {
        const reportesRes = await reportesService.getSinAtender();
        const lista = Array.isArray(reportesRes.data)
          ? reportesRes.data
          : ((reportesRes.data as any)?.items || (reportesRes.data as any)?.Items || []);
        reportesData = Array.isArray(lista) ? lista : [];
        if (reportesData.length === 0) {
          const allRes = await reportesService.getAll({ page: 1, pageSize: 10 });
          const allList = Array.isArray(allRes.data)
            ? allRes.data
            : ((allRes.data as any)?.items || (allRes.data as any)?.Items || []);
          reportesData = Array.isArray(allList) ? allList : [];
        }
      } catch {
        try {
          const allRes = await reportesService.getAll({ page: 1, pageSize: 10 });
          const allList = Array.isArray(allRes.data)
            ? allRes.data
            : ((allRes.data as any)?.items || (allRes.data as any)?.Items || []);
          reportesData = Array.isArray(allList) ? allList : [];
        } catch {
          reportesData = [];
        }
      }

      // Órdenes que requieren acción administrativa (Pendiente de Asignación o Pendiente de Entrega)
      try {
        // Consultamos estados 1 (Pendiente) y 5 (Completada - esperando entrega)
        const [resPendientes, resCompletadas] = await Promise.all([
          ordenesService.getAll({ estado: 1, pageSize: 20 }), 
          ordenesService.getAll({ estado: 5, pageSize: 20 })
        ]);

        const extractItems = (res: any) => {
          const data = res.data;
          const lista = (data as any)?.items || (data as any)?.Items || (Array.isArray(data) ? data : []);
          return Array.isArray(lista) ? lista : [];
        };

        ordenesData = [
          ...extractItems(resPendientes),
          ...extractItems(resCompletadas)
        ].sort((a: any, b: any) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
        
      } catch {
        ordenesData = [];
      }

      const pendingItems: PendingItem[] = [];

      // Reportes sin atender
      if (reportesData.length > 0) {
        reportesData.forEach((reporte: any) => {
          const base = reporte.descripcion || reporte.folio || 'Reporte de falla';
          const titulo = base.length > 70 ? `${base.substring(0, 70)}...` : base;
          pendingItems.push({
            id: reporte.id,
            titulo,
            reportador: reporte.reportadoPorNombre || reporte.reportadoPor?.nombreCompleto || 'Usuario',
            tiempoTranscurrido: formatTimeAgo(new Date(reporte.fechaReporte)),
            area: reporte.ubicacion || 'Sin área',
            prioridad: (reporte.prioridadNombre || reporte.prioridad || 'Media') as PendingItem['prioridad'],
            tipo: 'reporte',
          });
        });
      }

      // Ordenes pendientes
      if (ordenesData.length > 0) {
        ordenesData.forEach((orden: any) => {
          let estadoLabel = '';
          if (orden.estado === 5) { // Completada
             estadoLabel = 'Pendiente de Firma';
          } else if (orden.estado === 1) { // Pendiente
             estadoLabel = 'Pendiente de Asignación';
          } else {
             estadoLabel = 'Acción Requerida';
          }

          pendingItems.push({
            id: orden.id,
            titulo: `${orden.folio || `Orden #${orden.id}`} - ${estadoLabel}`,
            reportador: orden.tecnicoNombre || orden.tecnicoAsignado?.nombreCompleto || 'Sin asignar',
            tiempoTranscurrido: formatTimeAgo(new Date(orden.fechaCreacion)),
            area: orden.vehiculoCodigo || orden.vehiculo?.area?.nombre || 'Sin área',
            prioridad: (orden.prioridadNombre || orden.prioridad || 'Media') as PendingItem['prioridad'],
            tipo: 'orden',
          });
        });
      }

      setItems(pendingItems);
    } catch (error) {
      console.error('Error loading pending items:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card border-l-4 border-l-continental-yellow">
        <div className="p-7 space-y-2">
          <h3 className="text-lg font-semibold text-continental-black mb-4">
            Solicitudes Pendientes de Acción
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="dashboard-card border-l-4 border-l-continental-yellow">
      <div className="px-9 py-8 space-y-3">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-continental-black">
            Solicitudes Pendientes de Acción
          </h3>
          <span className="text-sm text-continental-gray-1">
            {items.length} pendiente{items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-continental-gray-1">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {(showAll ? items : items.slice(0, 5)).map((item) => (
              <Link
                key={`${item.tipo}-${item.id}`}
                to={item.tipo === 'reporte' ? `/reportes/${item.id}` : `/ordenes/${item.id}`}
                className="block group"
              >
                <div className="px-7 py-6 bg-continental-bg rounded-lg hover:bg-continental-gray-4 transition-all duration-200 hover:translate-x-1">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3 mb-1">
                        {item.tipo === 'reporte' ? (
                          <AlertCircle className="h-4 w-4 text-continental-yellow" />
                        ) : (
                          <Wrench className="h-4 w-4 text-continental-blue" />
                        )}
                        <span className="font-medium text-continental-black truncate">
                          {item.titulo}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-continental-gray-1">
                        <span className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {item.reportador}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {item.tiempoTranscurrido}
                        </span>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          {item.area}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          priorityStyles[item.prioridad]
                        )}
                      >
                        {item.prioridad}
                      </span>
                      <ChevronRight className="h-4 w-4 text-continental-gray-2 group-hover:text-continental-yellow transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-continental-gray-3 flex flex-col items-center gap-2">
          <Link
            to="/reportes"
            className="text-sm text-continental-yellow hover:text-continental-yellow-dark font-medium flex items-center justify-center gap-1"
          >
            Ver todas las solicitudes
            <ChevronRight className="h-4 w-4" />
          </Link>
          {items.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm text-continental-blue hover:underline"
            >
              {showAll ? 'Mostrar menos' : 'Mostrar todas aquí'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
