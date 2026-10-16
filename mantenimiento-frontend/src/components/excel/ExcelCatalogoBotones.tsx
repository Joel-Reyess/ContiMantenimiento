import { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { excelService, type EntidadImportable, type ExcelImportResult } from '@/services/excelService';
import { ExcelImportModal } from './ExcelImportModal';

interface ExcelCatalogoBotonesProps {
  entidad: Extract<EntidadImportable, 'areas' | 'prefijos' | 'usuarios'>;
  /** En plural y minúsculas, para los mensajes: "áreas", "prefijos", "usuarios" */
  titulo: string;
  /** Para recargar la lista después de importar */
  onImportado: (resultado: ExcelImportResult) => void;
}

/**
 * "Exportar Excel" e "Importar Excel" de un catálogo (áreas, prefijos, usuarios).
 * El archivo exportado se puede editar y volver a importar.
 */
export function ExcelCatalogoBotones({ entidad, titulo, onImportado }: ExcelCatalogoBotonesProps) {
  const toast = useToast();
  const [exportando, setExportando] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const exportar = async () => {
    setExportando(true);
    try {
      await excelService.exportar(entidad);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => void exportar()} disabled={exportando} className="flex items-center gap-2">
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Exportar Excel
      </Button>
      <Button variant="outline" onClick={() => setImportOpen(true)} className="flex items-center gap-2">
        <Upload className="h-4 w-4" />
        Importar Excel
      </Button>
      <ExcelImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        entidad={entidad}
        titulo={titulo}
        onImportado={(r) => {
          toast.exito(`Importación completada: ${r.nuevos} nuevo(s) y ${r.actualizados} actualizado(s)`);
          onImportado(r);
        }}
      />
    </>
  );
}
