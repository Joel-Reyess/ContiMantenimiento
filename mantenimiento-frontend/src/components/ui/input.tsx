import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  /** Texto de ayuda bajo el campo (p. ej. requisitos); se oculta cuando hay error */
  hint?: string;
  /** Botón o ícono dentro del campo, a la derecha (p. ej. mostrar contraseña) */
  accesorio?: React.ReactNode;
}

// index.css tiene reglas globales sin capa para input/p que ganan a las clases de Tailwind:
// por eso el borde rojo, el espacio del accesorio y los márgenes van en estilos en línea.
const estiloError: React.CSSProperties = { color: '#dc2626', marginTop: 4, marginBottom: 0 };
const estiloHint: React.CSSProperties = { color: '#6b7280', marginTop: 4, marginBottom: 0 };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, accesorio, id, style, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-semibold text-continental-black"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={cn(
              'flex h-11 w-full rounded-lg border border-continental-gray-3 bg-white px-4 py-2 text-sm font-medium text-continental-black shadow-sm transition-all placeholder:text-continental-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-60',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            style={{
              ...(error ? { borderColor: '#ef4444' } : null),
              ...(accesorio ? { paddingRight: 44 } : null),
              ...style
            }}
            ref={ref}
            {...props}
          />
          {accesorio && <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">{accesorio}</div>}
        </div>
        {error ? (
          <p className="text-xs font-medium" style={estiloError}>{error}</p>
        ) : hint ? (
          <p className="text-xs" style={estiloHint}>{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
