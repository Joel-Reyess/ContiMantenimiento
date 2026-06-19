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

interface RecurrentFailureData {
  pregunta: string;
  cantidad: number;
}

interface RecurrentFailuresChartProps {
  data?: RecurrentFailureData[];
}

const COLORS = ['#ff8042', '#ffbb28', '#00c49f', '#0088fe', '#8884d8'];

export function RecurrentFailuresChart({ data = [] }: RecurrentFailuresChartProps) {
  // Sort and take top 5 for better visualization
  const chartData = [...data]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
    .map(item => ({
      name: item.pregunta.length > 25 ? item.pregunta.substring(0, 22) + '...' : item.pregunta,
      fullName: item.pregunta,
      value: item.cantidad
    }));

  return (
    <div className="dashboard-card p-7">
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Items de Checklist con más Fallas
      </h3>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#666', fontSize: 11 }}
                width={120}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`${value} reportes`, 'Fallas']}
                labelFormatter={(label: any, items: any) => items[0]?.payload?.fullName || label}
                labelStyle={{ color: '#000', fontWeight: 600 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                {chartData.map((_, index) => (
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
