import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';

export interface SearchableSelectOption<TMeta = unknown> {
  value: string | number;
  label: string;
  description?: string;
  meta?: TMeta;
}

interface SearchableSelectProps<TMeta = unknown> {
  label?: string;
  placeholder?: string;
  selected?: SearchableSelectOption<TMeta> | null;
  disabled?: boolean;
  fetchOptions: (query: string) => Promise<SearchableSelectOption<TMeta>[]>;
  onSelect: (option: SearchableSelectOption<TMeta> | null) => void;
  noResultsText?: string;
}

export function SearchableSelect<TMeta = unknown>({
  label,
  placeholder = 'Busca y selecciona',
  selected,
  disabled,
  fetchOptions,
  onSelect,
  noResultsText = 'Sin resultados',
}: SearchableSelectProps<TMeta>) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchableSelectOption<TMeta>[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected?.label) {
      setQuery(selected.label);
    }
  }, [selected]);

  const loadOptions = useMemo(
    () =>
      debounce(async (term: string) => {
        setLoading(true);
        try {
          const results = await fetchOptions(term);
          setOptions(results);
        } catch (error) {
          console.error('Error al buscar opciones', error);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, 250),
    [fetchOptions]
  );

  useEffect(() => {
    if (!isOpen) return;
    loadOptions(query);
  }, [isOpen, query, loadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    setIsOpen(true);
    loadOptions(value);
    if (selected) {
      onSelect(null);
    }
  };

  const handleSelect = (option: SearchableSelectOption<TMeta>) => {
    onSelect(option);
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onSelect(null);
    setOptions([]);
    setIsOpen(false);
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            loadOptions(query);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-continental-gray-2 hover:text-continental-black"
              aria-label="Limpiar seleccion"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <Search className="h-4 w-4 text-continental-gray-2" />
          )}
        </div>

        {isOpen && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-continental-gray-3 bg-white shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-continental-gray-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-continental-gray-2">{noResultsText}</div>
            ) : (
              options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="w-full px-3 py-2 text-left hover:bg-continental-gray-4 transition-colors"
                  onClick={() => handleSelect(option)}
                >
                  <p className="text-sm text-continental-black">{option.label}</p>
                  {option.description && <p className="text-xs text-continental-gray-2">{option.description}</p>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
