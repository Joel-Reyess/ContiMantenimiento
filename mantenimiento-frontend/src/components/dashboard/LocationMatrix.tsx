import { Card } from '@/components/ui';
import { UbicacionPorTipoMatriz } from '@/interfaces/Dashboard.interface';

interface LocationMatrixProps {
  data: UbicacionPorTipoMatriz[];
}

export function LocationMatrix({ data }: LocationMatrixProps) {
  // Extract all unique vehicle types for columns
  const allTypes = Array.from(
    new Set(data.flatMap((d) => d.statsPorTipo.map((s) => s.tipoVehiculo)))
  ).sort();

  if (!data || data.length === 0) {
    return (
      <Card className="p-7">
        <h3 className="text-lg font-semibold text-continental-black mb-4">
          Matriz de Ubicación por Tipo de Vehículo
        </h3>
        <div className="flex items-center justify-center h-48 text-continental-gray-1">
          No hay datos de ubicación disponibles.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-7 overflow-hidden">
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Vehículos Actuales por Zona y Tipo
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 border-b border-r text-left text-xs font-bold text-continental-gray-2 uppercase tracking-wider bg-gray-50">
                Zona
              </th>
              {allTypes.map((type) => (
                <th
                  key={type}
                  className="p-2 border-b text-center text-xs font-bold text-continental-gray-2 uppercase tracking-wider bg-gray-50"
                >
                  {type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.ubicacion}>
                <td className="p-2 border-r border-b font-medium text-sm text-continental-black bg-gray-50">
                  {row.ubicacion}
                </td>
                {allTypes.map((type) => {
                  const stats = row.statsPorTipo.find((s) => s.tipoVehiculo === type);
                  const count = stats?.cantidad || 0;

                  // Dynamic background intensity based on count
                  let bgColor = '';
                  if (count > 0) {
                    if (count > 10) bgColor = 'bg-continental-red text-white';
                    else if (count > 5) bgColor = 'bg-orange-500 text-white';
                    else if (count > 2) bgColor = 'bg-orange-400 text-white';
                    else if (count > 0) bgColor = 'bg-orange-100 text-continental-black';
                  }

                  return (
                    <td
                      key={type}
                      className={`p-2 border-b text-center text-sm transition-colors ${bgColor}`}
                    >
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-lg ${count === 0 ? 'text-gray-300' : ''}`}>
                          {count}
                        </span>
                        {count > 0 && <span className="text-[10px] opacity-80">uds</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-4 text-[10px] text-continental-gray-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-100 border border-orange-200"></div>
          <span>1-2 uds</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-400"></div>
          <span>3-5 uds</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500"></div>
          <span>6-10 uds</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-continental-red"></div>
          <span>{'>'}10 uds</span>
        </div>
      </div>
    </Card>
  );
}
