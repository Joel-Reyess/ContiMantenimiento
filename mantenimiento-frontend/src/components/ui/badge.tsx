import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
        // Estados de orden de trabajo
        pendiente: 'border-transparent bg-gray-100 text-gray-800',
        asignada: 'border-transparent bg-blue-100 text-blue-800',
        enProceso: 'border-transparent bg-yellow-100 text-yellow-800',
        completada: 'border-transparent bg-green-100 text-green-800',
        validada: 'border-transparent bg-emerald-100 text-emerald-800',
        rechazada: 'border-transparent bg-red-100 text-red-800',
        cancelada: 'border-transparent bg-gray-200 text-gray-600',
        // Prioridades
        baja: 'border-transparent bg-slate-100 text-slate-700',
        media: 'border-transparent bg-blue-100 text-blue-700',
        alta: 'border-transparent bg-orange-100 text-orange-700',
        critica: 'border-transparent bg-red-100 text-red-700',
        // Estados de vehículo
        operativo: 'border-transparent bg-green-100 text-green-800',
        enReparacion: 'border-transparent bg-yellow-100 text-yellow-800',
        fueraServicio: 'border-transparent bg-red-100 text-red-800',
        enMantenimiento: 'border-transparent bg-blue-100 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
