import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { excelService, type EntidadImportable, type ExcelImportResult } from '@/services/excelService';
import { ExcelImportModal } from './ExcelImportModal';
import { BotonExportar } from './BotonExportar';

interface ExcelCatalogoBotonesProps {
  entidad: Extract<EntidadImportable, 'areas' | 'prefijos' | 'usuarios'>;
  /** En plural y minúsculas, para los mensajes: "áreas", "prefijos", "usuarios" */
  titulo: string;
  /** Para recargar la lista después de importar */
  onImportado: (resultado: ExcelImportResult) => void;
}

/**
 * "Exportar" (Excel o CSV) e "Importar" de un catálogo (áreas, prefijos, usuarios).
 * El archivo exportado se puede editar y volver a importar.
 */
export function ExcelCatalogoBotones({ entidad, titulo, onImportado }: ExcelCatalogoBotonesProps) {
  const toast = useToast();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <BotonExportar onExportar={(formato) => excelService.exportar(entidad, formato)} />
      <Button variant="outline" onClick={() => setImportOpen(true)} className="flex items-center gap-2">
        <Upload className="h-4 w-4" />
        Importar
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
