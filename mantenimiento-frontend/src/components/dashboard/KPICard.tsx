import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KPIVariant = 'default' | 'green' | 'red' | 'blue' | 'yellow';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: KPIVariant;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const variantStyles: Record<KPIVariant, string> = {
  default: 'border-l-continental-yellow',
  green: 'border-l-continental-green',
  red: 'border-l-continental-red',
  blue: 'border-l-continental-blue-dark',
  yellow: 'border-l-continental-yellow',
};

export function KPICard({ label, value, trend, variant = 'default', icon, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'dashboard-card p-7 border-l-4 transition-all duration-300 hover:-translate-y-1',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md active:scale-[0.98]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-continental-gray-1 text-sm uppercase tracking-wide mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-continental-black">{value}</p>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 mt-2 text-sm font-medium',
                trend.isPositive ? 'text-continental-green' : 'text-continental-red'
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-continental-gray-2">{icon}</div>
        )}
      </div>
    </div>
  );
}
