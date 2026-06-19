import { useState } from 'react';
import { DashboardVehiculoResumen } from '@/interfaces';
import { Input, Badge, Spinner } from '@/components/ui';
import { Search, History } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HistoryTabProps {
  equipos: DashboardVehiculoResumen[];
  isLoading?: boolean;
}

export function HistoryTab({ equipos, isLoading }: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEquipos = equipos
    .filter((v) => v.totalReportes > 0 || v.ultimoMantenimiento) // Solo los que hayan tenido mantenimientos/reportes
    .filter(
      (v) =>
        v.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.tipoNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.marca?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const formatDate = (value?: string) =>
    value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'N/D';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-wrap">
        <div className="min-w-[200px] flex-1">
           <h3 className="text-lg font-semibold text-continental-black">Historial y Estado de Contenedores</h3>
           <p className="text-sm text-continental-gray-1">Busque un contenedor para consultar su estado operativo actual, ubicación y el histórico completo de mantenimientos finalizados.</p>
        </div>
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-continental-gray-1 z-10 pointer-events-none" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!pl-12"
          />
        </div>
      </div>

      <div className="rounded-xl border border-continental-gray-3/60 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <Spinner size="lg" />
            <p className="text-continental-gray-1">Cargando vehículos...</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-continental-gray-4/50 text-continental-gray-1 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Codigo</th>
                <th className="px-6 py-4 text-left font-semibold">Tipo</th>
                <th className="px-6 py-4 text-left font-semibold">Marca / Modelo</th>
                <th className="px-6 py-4 text-left font-semibold">Estado</th>
                <th className="px-6 py-4 text-left font-semibold">Ult. Mtto</th>
                <th className="px-6 py-4 text-left font-semibold">Prox. Mtto</th>
                <th className="px-6 py-4 text-center font-semibold">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-continental-gray-3/60">
              {filteredEquipos.slice(0, 50).map((vehiculo) => (
                <tr key={vehiculo.id} className="hover:bg-continental-gray-4/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-continental-black">{vehiculo.codigo}</td>
                  <td className="px-6 py-4 text-continental-gray-1">{vehiculo.tipoNombre || 'N/D'}</td>
                  <td className="px-6 py-4 text-continental-gray-1">
                    {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || 'N/D'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge estado={vehiculo.estadoNombre || 'N/D'} />
                  </td>
                  <td className="px-6 py-4 text-continental-gray-1">{formatDate(vehiculo.ultimoMantenimiento)}</td>
                  <td className={`px-6 py-4 font-medium ${
                    vehiculo.proximoMantenimiento && new Date(vehiculo.proximoMantenimiento) <= new Date() 
                      ? 'text-red-600 animate-pulse' 
                      : 'text-continental-gray-1'
                  }`}>
                    {formatDate(vehiculo.proximoMantenimiento)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      to={`/vehiculos/${vehiculo.id}`}
                      className="inline-flex items-center gap-2 text-continental-blue hover:text-continental-blue-dark font-medium text-xs uppercase tracking-wide hover:underline"
                    >
                      <History className="h-3 w-3" />
                      Historial
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredEquipos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-continental-gray-1">
                    No se encontraron vehiculos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        {!isLoading && filteredEquipos.length > 50 && (
            <div className="p-4 text-center text-xs text-continental-gray-1 border-t border-continental-gray-3/60">
                Mostrando los primeros 50 resultados. Refine su busqueda para ver mas.
            </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const normalized = (estado || '').toLowerCase();
  let style = 'bg-gray-100 text-gray-800';
  
  if (normalized.includes('operativo')) {
    style = 'bg-green-100 text-green-800';
  } else if (normalized.includes('mantenimiento') || normalized.includes('reparacion')) {
    style = 'bg-yellow-100 text-yellow-800';
  } else if (normalized.includes('fuera')) {
    style = 'bg-red-100 text-red-800';
  }

  return (
    <Badge variant="outline" className={`border-0 ${style}`}>
      {estado}
    </Badge>
  );
}
