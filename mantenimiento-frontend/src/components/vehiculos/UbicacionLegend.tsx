import { cn } from '@/lib/utils';

export enum UbicacionVehiculo {
  Piso = 1,
  Taller = 2,
  Transicion = 3,
  TransicionPorReparar = 4,
  TransicionReparado = 5
}

type UbicacionVisualConfig = {
  label: string;
  dotClass: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
};

const ubicacionSinAsignar: UbicacionVisualConfig = {
  label: 'Sin ubicacion',
  dotClass: 'bg-gray-400',
  badgeClass: 'bg-gray-100',
  textClass: 'text-gray-700',
  borderClass: 'border-gray-300'
};

export const ubicacionConfig: Record<UbicacionVehiculo, UbicacionVisualConfig> = {
  [UbicacionVehiculo.Piso]: {
    label: 'Piso (Disponible)',
    dotClass: 'bg-continental-green',
    badgeClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200'
  },
  [UbicacionVehiculo.Taller]: {
    label: 'En Taller',
    dotClass: 'bg-continental-yellow',
    badgeClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200'
  },
  [UbicacionVehiculo.Transicion]: {
    label: 'Transicion',
    dotClass: 'bg-continental-blue-light',
    badgeClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-200'
  },
  [UbicacionVehiculo.TransicionPorReparar]: {
    label: 'Z. Transicion (Por Reparar)',
    dotClass: 'bg-continental-red',
    badgeClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200'
  },
  [UbicacionVehiculo.TransicionReparado]: {
    label: 'Z. Transicion (Reparado)',
    dotClass: 'bg-continental-blue-dark',
    badgeClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200'
  }
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function resolveUbicacionVehiculo(ubicacion: unknown): UbicacionVehiculo | null {
  if (typeof ubicacion === 'number' && Number.isFinite(ubicacion)) {
    return ubicacionConfig[ubicacion as UbicacionVehiculo]
      ? (ubicacion as UbicacionVehiculo)
      : null;
  }

  if (typeof ubicacion !== 'string') return null;
  const cleaned = normalizeText(ubicacion);
  if (!cleaned) return null;

  const asNumber = Number(cleaned);
  if (Number.isFinite(asNumber) && ubicacionConfig[asNumber as UbicacionVehiculo]) {
    return asNumber as UbicacionVehiculo;
  }

  if (cleaned.includes('por reparar') || cleaned.includes('transicionporreparar')) {
    return UbicacionVehiculo.TransicionPorReparar;
  }
  if (cleaned.includes('reparado') || cleaned.includes('transicionreparado')) {
    return UbicacionVehiculo.TransicionReparado;
  }
  if (cleaned.includes('taller')) {
    return UbicacionVehiculo.Taller;
  }
  if (cleaned.includes('transicion')) {
    return UbicacionVehiculo.Transicion;
  }
  if (cleaned.includes('piso') || cleaned.includes('disponible')) {
    return UbicacionVehiculo.Piso;
  }

  return null;
}

function getUbicacionVisualConfig(ubicacion: unknown): UbicacionVisualConfig {
  const resolved = resolveUbicacionVehiculo(ubicacion);
  return resolved ? ubicacionConfig[resolved] : ubicacionSinAsignar;
}

interface UbicacionLegendProps {
  className?: string;
}

export function UbicacionLegend({ className }: UbicacionLegendProps) {
  return (
    <div className={cn('flex flex-wrap gap-4 p-3 bg-white rounded-lg shadow-sm border border-continental-gray-3', className)}>
      <span className="text-sm font-medium text-continental-gray-1 mr-2">Ubicacion:</span>
      {Object.values(UbicacionVehiculo)
        .filter((v) => typeof v === 'number')
        .map((ubicacion) => {
          const config = ubicacionConfig[ubicacion as UbicacionVehiculo];
          return (
            <div key={ubicacion} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full border border-black/10', config.dotClass)} />
              <span className="text-sm text-continental-gray-1">{config.label}</span>
            </div>
          );
        })}
    </div>
  );
}

interface UbicacionBadgeProps {
  ubicacion?: UbicacionVehiculo | number | string | null;
  size?: 'sm' | 'md';
}

export function UbicacionBadge({ ubicacion, size = 'md' }: UbicacionBadgeProps) {
  const config = getUbicacionVisualConfig(ubicacion);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.badgeClass,
        config.textClass,
        config.borderClass,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      <span className={cn('rounded-full border border-black/10', config.dotClass, size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5')} />
      {config.label}
    </span>
  );
}

export default UbicacionLegend;
