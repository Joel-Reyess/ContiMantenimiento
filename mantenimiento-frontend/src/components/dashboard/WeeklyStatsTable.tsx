import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services';

interface StatRow {
  metric: string;
  thisWeek: number | string;
  lastWeek: number | string;
  change: number;
  unit?: string;
}

interface WeeklyStatsTableProps {
  data?: StatRow[];
}

function TrendIndicator({ change, inverted = false }: { change: number; inverted?: boolean }) {
  // For some metrics like cost or time, negative is good
  const isPositive = inverted ? change < 0 : change > 0;
  const isNeutral = change === 0;

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-continental-gray-1">
        <Minus className="h-4 w-4" />
        <span>0%</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isPositive ? 'text-continental-green' : 'text-continental-red'
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
    </div>
  );
}

export function WeeklyStatsTable({ data = [] }: WeeklyStatsTableProps) {
  const [stats, setStats] = useState<StatRow[]>(data);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWeeklyStats();
  }, []);

  const loadWeeklyStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getKPIs();

      if (response.data?.weeklyComparison) {
        // Transform weeklyComparison to StatRow format if needed
        // For now, keep default stats since API returns different format
        // setStats(response.data.weeklyComparison);
      }
    } catch (error) {
      console.error('Error loading weekly stats:', error);
      setStats([]);
    } finally {
      setLoading(false);
    }
  };

  // Metrics where decrease is positive (inverted)
  const invertedMetrics = [
    'Tiempo Promedio Resolución',
    'Costo Promedio por Reparación',
    'Refacciones Solicitadas',
  ];

  if (loading) {
    return (
      <div className="dashboard-card p-7">
        <h3 className="text-lg font-semibold text-continental-black mb-4">
          Estadísticas Semanales
        </h3>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card p-7">
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Estadísticas Semanales
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-continental-gray-3">
              <th className="text-left py-3 px-4 text-sm font-semibold text-continental-gray-1 uppercase tracking-wide">
                Métrica
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-continental-gray-1 uppercase tracking-wide">
                Esta Semana
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-continental-gray-1 uppercase tracking-wide">
                Semana Anterior
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-continental-gray-1 uppercase tracking-wide">
                Cambio
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.length > 0 ? (
              stats.map((row, index) => (
                <tr
                  key={row.metric}
                  className={cn(
                    'border-b border-continental-gray-4 hover:bg-continental-bg transition-colors',
                    index % 2 === 0 ? 'bg-white' : 'bg-continental-gray-4/30'
                  )}
                >
                  <td className="py-3 px-4 text-sm font-medium text-continental-black">
                    {row.metric}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-semibold text-continental-black">
                    {row.thisWeek}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-continental-gray-1">
                    {row.lastWeek}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <TrendIndicator
                      change={row.change}
                      inverted={invertedMetrics.includes(row.metric)}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-continental-gray-1">
                  No hay estadísticas suficientes para mostrar comparativas semanales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-continental-gray-3 text-sm text-continental-gray-1">
        <p>
          <span className="text-continental-green">●</span> Verde = Mejora &nbsp;
          <span className="text-continental-red">●</span> Rojo = Requiere atención
        </p>
      </div>
    </div>
  );
}
