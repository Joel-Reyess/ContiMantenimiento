import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PendingRequestsList,
  MaintenanceAlerts,
  WeeklyStatsTable,
  OrdersByStatusChart,
  FailuresByTypeChart,
  WeeklyTrendChart,
} from '@/components/dashboard';
import { OrdenSinFirma, ReporteAnual } from '@/services/dashboardService';
import { KPIs } from '@/interfaces';

interface ReportsTabProps {
  ordenesSinFirma: OrdenSinFirma[];
  reporteAnual: ReporteAnual[];
  kpis: KPIs | null;
  orderStatusData: any[];
  failureData: any[];
}

export function ReportsTab({ ordenesSinFirma, reporteAnual, kpis: _kpis, orderStatusData, failureData }: ReportsTabProps) {
  const showOrdenes = ordenesSinFirma.length > 0;
  const showReporte = reporteAnual.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {(showOrdenes || showReporte) && (
        <div className={cn("grid gap-6", showOrdenes && showReporte ? "lg:grid-cols-2" : "grid-cols-1")}>
          {showOrdenes && (
            <section className="dashboard-card p-7 space-y-4 border-l-4 border-l-continental-red h-fit">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Atención Requerida</p>
              <h3 className="text-xl font-semibold text-continental-black">Contenedores Terminados sin Firma</h3>
              <p className="text-sm text-continental-gray-1">Contenedores que ya han sido reparados y requieren la firma de conformidad del líder para su liberación final. Asegure la calidad antes de cerrar.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-continental-black">Folio</th>
                      <th className="px-4 py-2 text-left font-semibold text-continental-black">Vehiculo</th>
                      <th className="px-4 py-2 text-center font-semibold text-continental-black">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesSinFirma.slice(0, 5).map((orden) => (
                      <tr key={orden.id} className="border-t border-continental-gray-3/60">
                        <td className="px-4 py-2 font-medium">
                          {orden.folio}
                          <span className="block text-[10px] text-gray-500 font-normal">
                             {orden.estado === 'Validada' ? 'Falta Firma (Líder)' : 'Falta Validación (Sup.)'}
                          </span>
                        </td>
                        <td className="px-4 py-2">{orden.vehiculoCodigo}</td>
                        <td className="px-4 py-2 text-center">
                          <Link to={`/ordenes/${orden.id}`} className="text-continental-blue hover:underline">
                            {orden.estado === 'Validada' ? 'Firmar' : 'Validar'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showReporte && (
          <section className="dashboard-card p-7 space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Reportes</p>
                <h3 className="text-xl font-semibold text-continental-black">Mantenimientos Anuales por Tipo</h3>
                <p className="text-sm text-continental-gray-1">Resumen consolidado de intervenciones de mantenimiento realizadas durante el año en curso, categorizadas por tipo de unidad.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Mes</th>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Tipo de Vehículo</th>
                      <th className="px-4 py-3 text-right font-semibold text-continental-black">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteAnual.map((item, idx) => (
                      <tr key={idx} className="border-t border-continental-gray-3/60 hover:bg-continental-gray-4/40">
                        <td className="px-4 py-3 font-semibold text-continental-black">{item.mesNombre}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{item.tipoVehiculo}</td>
                        <td className="px-4 py-3 text-right text-continental-black font-bold">{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <FailuresByTypeChart data={failureData.length > 0 ? failureData : undefined} />
        <WeeklyTrendChart />
      </div>

      <div className="dashboard-main-grid">
        <PendingRequestsList />
        <div className="space-y-6">
          <MaintenanceAlerts />
          <OrdersByStatusChart data={orderStatusData.length > 0 ? orderStatusData : undefined} />
        </div>
      </div>

      <WeeklyStatsTable />
    </div>
  );
}
