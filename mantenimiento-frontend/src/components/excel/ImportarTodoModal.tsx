import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Modal, ModalFooter, useConfirm, useToast } from '@/components/ui';
import { excelService, type ExcelCredencial, type ExcelImportTodoResult } from '@/services/excelService';

interface ImportarTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportado?: (resultado: ExcelImportTodoResult) => void;
}

const celda: React.CSSProperties = { padding: '6px 10px' };

const NOMBRE: Record<string, string> = {
  areas: 'Áreas',
  prefijos: 'Prefijos',
  usuarios: 'Usuarios',
  vehiculos: 'Vehículos',
  inventario: 'Inventario'
};

/** CSV con BOM para que Excel respete los acentos */
function descargarCredenciales(credenciales: ExcelCredencial[]) {
  const campo = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lineas = [
    ['Usuario', 'Nombre', 'Contraseña temporal'].map(campo).join(','),
    ...credenciales.map((c) => [c.usuario, c.nombre, c.contrasena].map(campo).join(','))
  ];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Contraseñas temporales - ${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Importación masiva desde Configuración: el archivo de "Exportar todo" (Excel con una hoja por módulo o .zip con
 * un CSV por hoja). Se importan a la vez Áreas, Prefijos, Usuarios, Vehículos e Inventario; las demás hojas
 * (reportes, órdenes, pagos...) son de consulta. Primero se valida; se guarda todo o nada.
 */
export function ImportarTodoModal({ isOpen, onClose, onImportado }: ImportarTodoModalProps) {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ExcelImportTodoResult | null>(null);
  const [procesando, setProcesando] = useState<'' | 'validar' | 'importar'>('');
  const [error, setError] = useState('');
  const [credenciales, setCredenciales] = useState<ExcelCredencial[]>([]);
  const [credencialesGuardadas, setCredencialesGuardadas] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setArchivo(null);
      setResultado(null);
      setError('');
      setProcesando('');
      setCredenciales([]);
      setCredencialesGuardadas(false);
    }
  }, [isOpen]);

  const cerrar = async () => {
    if (procesando) return;
    if (credenciales.length > 0 && !credencialesGuardadas) {
      const ok = await confirmar({
        titulo: 'Contraseñas temporales',
        mensaje: 'Después de cerrar ya no podrás ver las contraseñas de los usuarios nuevos. ¿Ya las guardaste?',
        textoConfirmar: 'Sí, cerrar',
        textoCancelar: 'Volver',
        tono: 'advertencia'
      });
      if (!ok) return;
    }
    onClose();
  };

  const enviar = async (aplicar: boolean) => {
    if (!archivo) return;
    setProcesando(aplicar ? 'importar' : 'validar');
    setError('');
    try {
      const res = await excelService.importarTodo(archivo, aplicar);
      if (!res.success || !res.data) {
        setResultado(null);
        setError(res.message || 'No se pudo procesar el archivo');
        return;
      }
      setResultado(res.data);
      if (res.data.aplicado) {
        toast.exito(res.message || 'Importación aplicada');
        onImportado?.(res.data);
        const nuevas = res.data.hojas.flatMap((h) => h.credenciales || []);
        if (nuevas.length) setCredenciales(nuevas);
        else onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo');
    } finally {
      setProcesando('');
    }
  };

  const valido = resultado && !resultado.aplicado && resultado.totalErrores === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void cerrar()}
      title="Importar todo"
      description="El archivo de “Exportar todo”: cada hoja va a su módulo. Primero se valida; se guarda todo o nada."
      size="lg"
    >
      <div className="flex flex-col gap-4" data-testid="importar-todo">
        <p className="text-sm text-continental-gray-1" style={{ marginBottom: 0 }}>
          Se importan las hojas <strong>Áreas, Prefijos, Usuarios, Vehículos e Inventario</strong> (en ese orden, así un vehículo puede usar un área
          nueva del mismo archivo). Las demás hojas (reportes, órdenes, pagos…) son de consulta y no se importan. Sirve el Excel o el .zip de CSV.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
          className="hidden"
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            setResultado(null);
            setError('');
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" className="flex items-center gap-2" onClick={() => inputRef.current?.click()} disabled={!!procesando}>
            <FileSpreadsheet className="h-4 w-4" />
            Elegir archivo
          </Button>
          <span className="text-sm text-continental-gray-1">{archivo ? archivo.name : 'Ningún archivo seleccionado'}</span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo procesar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resultado && (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border border-continental-gray-3">
              <table className="w-full text-sm" data-testid="resultado-importar-todo">
                <thead className="bg-continental-gray-4/50 text-left text-xs uppercase text-continental-gray-1">
                  <tr>
                    <th style={celda}>Hoja</th>
                    <th style={celda} className="text-right">Filas</th>
                    <th style={celda} className="text-right">Nuevos</th>
                    <th style={celda} className="text-right">Actualizados</th>
                    <th style={celda} className="text-right">Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.hojas.map((h) => (
                    <tr key={h.entidad} className="border-t border-continental-gray-3/60">
                      <td style={celda}>{h.hoja || NOMBRE[h.entidad] || h.entidad}</td>
                      <td style={celda} className="text-right">{h.totalFilas}</td>
                      <td style={celda} className="text-right">{h.nuevos}</td>
                      <td style={celda} className="text-right">{h.actualizados}</td>
                      <td style={{ ...celda, color: h.totalErrores ? '#dc2626' : undefined }} className="text-right font-semibold">{h.totalErrores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resultado.omitidas.length > 0 && (
              <p className="text-xs text-continental-gray-1" style={{ marginBottom: 0 }}>
                No se importan (solo consulta): {resultado.omitidas.join(', ')}.
              </p>
            )}
            {resultado.totalErrores > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-red-200 bg-red-50" style={{ padding: 10 }}>
                <p className="text-sm font-semibold text-red-800" style={{ marginBottom: 4 }}>
                  Corrige estos errores y vuelve a validar (no se guardó nada):
                </p>
                <ul className="flex flex-col gap-1 text-sm text-red-800">
                  {resultado.hojas.flatMap((h) =>
                    h.errores.slice(0, 50).map((e, i) => (
                      <li key={`${h.entidad}-${i}`}>
                        <strong>{h.hoja || NOMBRE[h.entidad]}</strong>, fila {e.fila}{e.columna ? `, ${e.columna}` : ''}: {e.mensaje}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
            {valido && (
              <Alert variant="success">
                <AlertDescription>Archivo válido. Revisa los totales y presiona “Importar” para guardar todo.</AlertDescription>
              </Alert>
            )}
            {credenciales.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50" style={{ padding: 10 }}>
                <p className="text-sm font-semibold text-amber-900" style={{ marginBottom: 6 }}>
                  Contraseñas temporales de los usuarios nuevos (solo se muestran ahora):
                </p>
                <ul className="text-sm text-amber-900">
                  {credenciales.map((c) => (
                    <li key={c.usuario}><strong>{c.usuario}</strong> ({c.nombre}): <code>{c.contrasena}</code></li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => { descargarCredenciales(credenciales); setCredencialesGuardadas(true); }}>
                  Descargar contraseñas (CSV)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={() => void cerrar()} disabled={!!procesando}>
          {credenciales.length > 0 ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!resultado?.aplicado && (
          <>
            <Button variant="outline" onClick={() => void enviar(false)} disabled={!archivo || !!procesando} className="flex items-center gap-2">
              {procesando === 'validar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Validar
            </Button>
            <Button onClick={() => void enviar(true)} disabled={!valido || !!procesando} className="flex items-center gap-2">
              {procesando === 'importar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
