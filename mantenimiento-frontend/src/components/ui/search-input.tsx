import * as React from 'react';
import { Search } from 'lucide-react';
import { Input, type InputProps } from './input';

export interface SearchInputProps extends Omit<InputProps, 'accesorio' | 'type'> {
  /** Si se pasa, la lupa es un botón que busca (y Enter también); si no, solo indica que el campo filtra */
  onBuscar?: () => void;
}

/**
 * Campo de búsqueda con la lupa dentro, a la derecha (estandarización de controles de búsqueda:
 * en lugar del botón "Buscar" aparte, solo el ícono junto al campo).
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({ onBuscar, onKeyDown, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    enterKeyHint="search"
    onKeyDown={(e) => {
      if (e.key === 'Enter' && onBuscar) {
        e.preventDefault();
        onBuscar();
      }
      onKeyDown?.(e);
    }}
    accesorio={
      onBuscar ? (
        <button
          type="button"
          data-icon="true"
          onClick={onBuscar}
          aria-label="Buscar"
          title="Buscar"
          className="flex h-8 w-8 items-center justify-center rounded-full text-continental-gray-1 transition hover:bg-continental-yellow hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70"
        >
          <Search className="h-5 w-5" />
        </button>
      ) : (
        <Search className="h-5 w-5 text-continental-gray-2" aria-hidden="true" />
      )
    }
    {...props}
  />
));
SearchInput.displayName = 'SearchInput';
