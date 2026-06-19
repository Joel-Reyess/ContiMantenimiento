import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

interface FailureData {
  name: string;
  value: number;
}

interface FailuresByTypeChartProps {
  data?: FailureData[];
}

const COLORS = ['#ffa500', '#004eaf', '#2db928', '#00a5dc'];

export function FailuresByTypeChart({ data = [] }: FailuresByTypeChartProps) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="dashboard-card p-7 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/reportes')}
    >
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Fallas por Tipo de Vehículo
      </h3>
      <div className="h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#666', fontSize: 12 }}
                axisLine={{ stroke: '#e5e5e5' }}
              />
              <YAxis
                tick={{ fill: '#666', fontSize: 12 }}
                axisLine={{ stroke: '#e5e5e5' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`${value} fallas`, 'Cantidad']}
                labelStyle={{ color: '#000', fontWeight: 600 }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full text-continental-gray-1">
            <span className="text-lg font-medium">No hay datos para mostrar</span>
            <span className="text-sm mt-1">No se encontraron fallas registradas</span>
          </div>
        )}
      </div>
    </div>
  );
}
