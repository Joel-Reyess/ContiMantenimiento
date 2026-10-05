import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Modal, ModalFooter } from '@/components/ui';
import { excelService, type EntidadImportable, type ExcelImportResult } from '@/services/excelService';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entidad: EntidadImportable;
  /** Ej. "vehículos" o "artículos de inventario" */
  titulo: string;
  onImportado: (resultado: ExcelImportResult) => void;
}

/**
 * Importación masiva desde Excel (requerimiento 12.2) en dos pasos:
 * 1) Validar: el backend revisa todo el archivo y regresa los errores por fila sin guardar nada.
 * 2) Importar: solo si no hubo errores; se aplica todo o nada.
 */
export function ExcelImportModal({ isOpen, onClose, entidad, titulo, onImportado }: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ExcelImportResult | null>(null);
  const [procesando, setProcesando] = useState<'' | 'plantilla' | 'validar' | 'importar'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setArchivo(null);
      setResultado(null);
      setError('');
      setProcesando('');
    }
  }, [isOpen]);

  const descargarPlantilla = async () => {
    setProcesando('plantilla');
    setError('');
    try {
      await excelService.descargarPlantilla(entidad);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar la plantilla');
    } finally {
      setProcesando('');
    }
  };

  const enviar = async (aplicar: boolean) => {
    if (!archivo) return;
    setProcesando(aplicar ? 'importar' : 'validar');
    setError('');
    try {
      const res = await excelService.importar(entidad, archivo, aplicar);
      if (!res.success || !res.data) {
        setResultado(null);
        setError(res.message || 'No se pudo procesar el archivo');
        return;
      }
      setResultado(res.data);
      if (res.data.aplicado) {
        onImportado(res.data);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo');
    } finally {
      setProcesando('');
    }
  };

  const valido = resultado && resultado.totalErrores === 0 && resultado.totalFilas > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!procesando) onClose();
      }}
      title={`Importar ${titulo} desde Excel`}
      description="Primero se valida el archivo; solo se guarda si no tiene errores."
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-continental-black">1. Descarga la plantilla y llénala</p>
          <p className="text-xs text-continental-gray-1">
            Trae las columnas correctas, listas desplegables e instrucciones. También puedes usar un archivo generado con "Exportar Excel".
          </p>
          <Button type="button" size="sm" variant="outline" className="flex items-center gap-2" onClick={descargarPlantilla} disabled={!!procesando}>
            {procesando === 'plantilla' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar plantilla
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-continental-black">2. Selecciona el archivo (.xlsx)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setResultado(null);
              setError('');
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" className="flex items-center gap-2" onClick={() => inputRef.current?.click()} disabled={!!procesando}>
              <FileSpreadsheet className="h-4 w-4" />
              Elegir archivo
            </Button>
            <span className="text-sm text-continental-gray-1">{archivo ? archivo.name : 'Ningún archivo seleccionado'}</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resultado && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(resultado.totalErrores > 0
                ? [
                    { label: 'Filas', valor: resultado.totalFilas, color: 'text-continental-black' },
                    { label: 'Errores', valor: resultado.totalErrores, color: 'text-red-700' }
                  ]
                : [
                    { label: 'Filas', valor: resultado.totalFilas, color: 'text-continental-black' },
                    { label: 'Nuevos', valor: resultado.nuevos, color: 'text-green-700' },
                    { label: 'Actualizados', valor: resultado.actualizados, color: 'text-blue-700' },
                    { label: 'Errores', valor: 0, color: 'text-continental-black' }
                  ]
              ).map((s) => (
                <div key={s.label} className="rounded-lg border border-continental-gray-3 bg-white px-3 py-2 text-center">
                  <p className={`text-xl font-semibold ${s.color}`}>{s.valor}</p>
                  <p className="text-xs text-continental-gray-1">{s.label}</p>
                </div>
              ))}
            </div>

            {resultado.totalErrores > 0 ? (
              <>
                <Alert variant="destructive">
                  <AlertTitle>El archivo tiene errores; no se guardó nada</AlertTitle>
                  <AlertDescription>Corrige estas filas en Excel y vuelve a seleccionar el archivo.</AlertDescription>
                </Alert>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-continental-gray-3">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-continental-gray-4 text-left">
                      <tr>
                        <th className="px-3 py-2 w-16">Fila</th>
                        <th className="px-3 py-2 w-32">Columna</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.errores.map((e, i) => (
                        <tr key={i} className="border-t border-continental-gray-3">
                          <td className="px-3 py-1.5 font-medium">{e.fila}</td>
                          <td className="px-3 py-1.5">{e.columna}</td>
                          <td className="px-3 py-1.5 text-red-700">{e.mensaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resultado.totalErrores > resultado.errores.length && (
                  <p className="text-xs text-continental-gray-1">
                    Se muestran los primeros {resultado.errores.length} de {resultado.totalErrores} errores.
                  </p>
                )}
              </>
            ) : resultado.totalFilas === 0 ? (
              <Alert variant="warning">
                <AlertDescription>El archivo no tiene filas con datos (la fila 1 deben ser los encabezados).</AlertDescription>
              </Alert>
            ) : (
              <Alert variant="success">
                <AlertTitle>Archivo válido</AlertTitle>
                <AlertDescription>
                  Se darán de alta {resultado.nuevos} y se actualizarán {resultado.actualizados} {titulo}. Presiona "Importar" para guardar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={!!procesando}>
          Cancelar
        </Button>
        {valido ? (
          <Button onClick={() => enviar(true)} disabled={!!procesando} className="flex items-center gap-2">
            {procesando === 'importar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {procesando === 'importar' ? 'Importando...' : `Importar ${resultado.totalFilas} registro(s)`}
          </Button>
        ) : (
          <Button onClick={() => enviar(false)} disabled={!archivo || !!procesando} className="flex items-center gap-2">
            {procesando === 'validar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {procesando === 'validar' ? 'Validando...' : 'Validar archivo'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
