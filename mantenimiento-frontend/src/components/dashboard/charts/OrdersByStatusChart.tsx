import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface OrderStatusData {
  name: string;
  value: number;
  color: string;
}

interface OrdersByStatusChartProps {
  data?: OrderStatusData[];
}

export function OrdersByStatusChart({ data = [] }: OrdersByStatusChartProps) {
  const navigate = useNavigate();
  // Filter out any "daata" or "data" entries if they exist
  const validData = data.filter(item => 
    item.name && 
    !item.name.toLowerCase().includes('daata') && 
    !item.name.toLowerCase().includes('data')
  );
  
  const total = validData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div 
      className="dashboard-card p-7 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/ordenes')}
    >
      <h3 className="text-lg font-semibold text-continental-black mb-4">
        Órdenes por Estado
      </h3>
      <div className="h-64">
        {validData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={validData as any}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {validData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`${value} órdenes`, '']}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-continental-gray-1">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full text-continental-gray-1">
            <span className="text-lg font-medium">No hay datos para mostrar</span>
            <span className="text-sm mt-1">No se encontraron órdenes registradas</span>
          </div>
        )}
      </div>
      <div className="text-center mt-2">
        <p className="text-2xl font-bold text-continental-black">{total}</p>
        <p className="text-sm text-continental-gray-1">Total de Órdenes</p>
      </div>
    </div>
  );
}
