import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import type { FormatoExport } from '@/services/excelService';

interface BotonExportarProps {
  /** Descarga en el formato elegido; si falla, lanza un Error con el mensaje del servidor */
  onExportar: (formato: FormatoExport) => Promise<void>;
  etiqueta?: string;
  /** Texto de cada opción (p. ej. "CSV (.zip, un archivo por hoja)" en "Exportar todo") */
  textoExcel?: string;
  textoCsv?: string;
  /** Si no se da, el error sale en un aviso */
  onError?: (mensaje: string) => void;
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * "Exportar" con dos formatos: Excel (.xlsx) o CSV. Ambos traen las mismas columnas que se usan al importar,
 * así lo que se descarga se puede corregir y volver a subir.
 */
export function BotonExportar({
  onExportar,
  etiqueta = 'Exportar',
  textoExcel = 'Excel (.xlsx)',
  textoCsv = 'CSV (.csv)',
  onError,
  variant = 'outline',
  className = ''
}: BotonExportarProps) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const exportar = async (formato: FormatoExport) => {
    setAbierto(false);
    setExportando(true);
    try {
      await onExportar(formato);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo exportar';
      if (onError) onError(mensaje);
      else toast.error(mensaje);
    } finally {
      setExportando(false);
    }
  };

  const opcion = 'flex w-full items-center gap-2 rounded-md text-left text-sm text-continental-black hover:bg-continental-gray-4';

  return (
    <div className={`relative inline-block ${className}`} ref={caja}>
      <Button
        type="button"
        variant={variant}
        disabled={exportando}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2"
      >
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exportando ? 'Generando...' : etiqueta}
        <ChevronDown className="h-4 w-4" />
      </Button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 flex min-w-[220px] flex-col rounded-lg border border-continental-gray-3 bg-white shadow-lg"
          style={{ padding: 6 }}
        >
          <button type="button" role="menuitem" className={opcion} style={{ padding: '8px 10px' }} onClick={() => void exportar('xlsx')}>
            <FileSpreadsheet className="h-4 w-4 text-green-700" /> {textoExcel}
          </button>
          <button type="button" role="menuitem" className={opcion} style={{ padding: '8px 10px' }} onClick={() => void exportar('csv')}>
            <FileText className="h-4 w-4 text-continental-gray-1" /> {textoCsv}
          </button>
        </div>
      )}
    </div>
  );
}
