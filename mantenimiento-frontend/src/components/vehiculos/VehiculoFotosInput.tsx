import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { getFullImageUrl } from '@/lib/utils';
import type { VehiculoFoto } from '@/interfaces';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_MB = 10;

interface VehiculoFotosInputProps {
  /** Fotos ya guardadas del vehículo (solo en edición) */
  existentes?: VehiculoFoto[];
  onQuitarExistente?: (fotoId: number) => void;
  /** Fotos seleccionadas que se suben al guardar */
  nuevas: File[];
  onAgregar: (files: File[]) => void;
  onQuitarNueva: (index: number) => void;
  disabled?: boolean;
}

/**
 * Selector de una o varias fotografías del vehículo con vista previa (requerimiento 8.4).
 * No sube nada por sí mismo: la página sube las nuevas y borra las quitadas al guardar.
 */
export function VehiculoFotosInput({
  existentes = [],
  onQuitarExistente,
  nuevas,
  onAgregar,
  onQuitarNueva,
  disabled
}: VehiculoFotosInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rechazadas, setRechazadas] = useState('');

  // Se crean dentro del efecto para que StrictMode (montar/desmontar/montar) no deje URLs revocadas
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = nuevas.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [nuevas]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const validas: File[] = [];
    const malas: string[] = [];
    Array.from(list).forEach((f) => {
      if (!TIPOS_PERMITIDOS.includes(f.type)) malas.push(`${f.name} (formato no permitido)`);
      else if (f.size > TAMANO_MAXIMO_MB * 1024 * 1024) malas.push(`${f.name} (pesa más de ${TAMANO_MAXIMO_MB} MB)`);
      else validas.push(f);
    });
    setRechazadas(malas.length ? `No se agregaron: ${malas.join(', ')}` : '');
    if (validas.length) onAgregar(validas);
    if (inputRef.current) inputRef.current.value = '';
  };

  const miniaturas = [
    ...existentes.map((f) => ({ key: `e-${f.id}`, src: getFullImageUrl(f.url), alt: f.nombre || 'Foto', quitar: () => onQuitarExistente?.(f.id) })),
    ...nuevas.map((f, i) => ({ key: `n-${i}-${f.name}`, src: previews[i], alt: f.name, quitar: () => onQuitarNueva(i) }))
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-continental-black">Fotografías</p>
      {miniaturas.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {miniaturas.map((m) => (
            <div key={m.key} className="relative aspect-square overflow-hidden rounded-lg border border-continental-gray-3 bg-white">
              <img src={m.src} alt={m.alt} className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  data-icon="true"
                  aria-label={`Quitar ${m.alt}`}
                  onClick={m.quitar}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_PERMITIDOS.join(',')}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <ImagePlus className="h-4 w-4" />
        Agregar fotos
      </Button>
      <p className="text-xs text-continental-gray-1">JPG, PNG o WEBP, hasta {TAMANO_MAXIMO_MB} MB cada una. Puedes elegir varias.</p>
      {rechazadas && <p className="text-xs text-red-600">{rechazadas}</p>}
    </div>
  );
}
