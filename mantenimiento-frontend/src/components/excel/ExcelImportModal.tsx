import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileSpreadsheet, KeyRound, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Modal, ModalFooter, useConfirm, useToast } from '@/components/ui';
import { excelService, type EntidadImportable, type ExcelCredencial, type ExcelImportResult } from '@/services/excelService';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entidad: EntidadImportable;
  /** Ej. "vehículos" o "artículos de inventario" */
  titulo: string;
  onImportado: (resultado: ExcelImportResult) => void;
}

// index.css anula los padding/margin de Tailwind (`* { padding: 0; margin: 0 }`):
// los espacios van con gap y las celdas con estilo en línea
const celda: React.CSSProperties = { padding: '6px 12px' };
const encabezado: React.CSSProperties = { padding: '8px 12px' };
const tarjeta: React.CSSProperties = { padding: '8px 12px' };

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
 * Importación masiva desde Excel (requerimiento 12.2) en dos pasos:
 * 1) Validar: el backend revisa todo el archivo y regresa los errores por fila sin guardar nada.
 * 2) Importar: solo si no hubo errores; se aplica todo o nada.
 * Al importar usuarios, las contraseñas temporales generadas se muestran una sola vez antes de cerrar.
 */
export function ExcelImportModal({ isOpen, onClose, entidad, titulo, onImportado }: ExcelImportModalProps) {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ExcelImportResult | null>(null);
  const [procesando, setProcesando] = useState<'' | 'plantilla' | 'validar' | 'importar'>('');
  const [error, setError] = useState('');
  // Contraseñas temporales de la importación ya aplicada; mientras haya, la ventana no se cierra sola
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
        mensaje: 'Después de cerrar ya no podrás ver estas contraseñas; tendrías que restablecerlas una por una. ¿Ya las guardaste?',
        textoConfirmar: 'Sí, cerrar',
        textoCancelar: 'Volver',
        tono: 'advertencia'
      });
      if (!ok) return;
    }
    onClose();
  };

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
        if (res.data.credenciales?.length) setCredenciales(res.data.credenciales);
        else onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo');
    } finally {
      setProcesando('');
    }
  };

  const copiarCredenciales = async () => {
    const texto = ['Usuario\tNombre\tContraseña temporal', ...credenciales.map((c) => `${c.usuario}\t${c.nombre}\t${c.contrasena}`)].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCredencialesGuardadas(true);
      toast.exito('Contraseñas copiadas; pégalas en Excel o en un lugar seguro');
    } catch {
      toast.error('No se pudo copiar; usa "Descargar"');
    }
  };

  const valido = resultado && resultado.totalErrores === 0 && resultado.totalFilas > 0;

  if (credenciales.length > 0 && resultado) {
    return (
      <Modal isOpen={isOpen} onClose={() => void cerrar()} title={`Importar ${titulo} desde Excel`} size="lg">
        <div className="flex flex-col gap-4">
          <Alert variant="success">
            <AlertTitle>Importación completada</AlertTitle>
            <AlertDescription>
              Se dieron de alta {resultado.nuevos} y se actualizaron {resultado.actualizados} {titulo}.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Guarda las contraseñas temporales</AlertTitle>
            <AlertDescription>
              Estos usuarios se crearon sin contraseña en el archivo y el sistema les generó una. Es la única vez que se muestran:
              descárgalas o cópialas y entrégaselas a cada persona.
            </AlertDescription>
          </Alert>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-continental-gray-3">
            <table className="w-full text-sm" data-testid="tabla-credenciales">
              <thead className="sticky top-0 bg-continental-gray-4 text-left">
                <tr>
                  <th style={encabezado}>Usuario</th>
                  <th style={encabezado}>Nombre</th>
                  <th style={encabezado}>Contraseña temporal</th>
                </tr>
              </thead>
              <tbody>
                {credenciales.map((c) => (
                  <tr key={c.usuario} className="border-t border-continental-gray-3">
                    <td style={celda} className="font-medium">{c.usuario}</td>
                    <td style={celda}>{c.nombre}</td>
                    <td style={celda} className="font-mono">{c.contrasena}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" className="flex items-center gap-2" onClick={() => void copiarCredenciales()}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              descargarCredenciales(credenciales);
              setCredencialesGuardadas(true);
            }}
          >
            <Download className="h-4 w-4" />
            Descargar (.csv)
          </Button>
          <Button className="flex items-center gap-2" onClick={() => void cerrar()}>
            <KeyRound className="h-4 w-4" />
            Listo
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void cerrar()}
      title={`Importar ${titulo} desde Excel`}
      description="Primero se valida el archivo; solo se guarda si no tiene errores."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-continental-black">1. Descarga la plantilla y llénala</p>
          <p className="text-xs text-continental-gray-1">
            Trae las columnas correctas, listas desplegables e instrucciones. También puedes usar un archivo generado con "Exportar Excel".
          </p>
          <div>
            <Button type="button" size="sm" variant="outline" className="flex items-center gap-2" onClick={descargarPlantilla} disabled={!!procesando}>
              {procesando === 'plantilla' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar plantilla
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
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
              // Permite volver a elegir el mismo archivo después de corregirlo en Excel
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
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resultado && (
          <div className="flex flex-col gap-3">
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
                <div key={s.label} style={tarjeta} className="rounded-lg border border-continental-gray-3 bg-white text-center">
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
                  <table className="w-full text-sm" data-testid="tabla-errores-importacion">
                    <thead className="sticky top-0 bg-continental-gray-4 text-left">
                      <tr>
                        <th style={encabezado} className="w-16">Fila</th>
                        <th style={encabezado} className="w-40">Columna</th>
                        <th style={encabezado}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.errores.map((e, i) => (
                        <tr key={i} className="border-t border-continental-gray-3">
                          <td style={celda} className="font-medium">{e.fila}</td>
                          <td style={celda}>{e.columna}</td>
                          <td style={celda} className="text-red-700">{e.mensaje}</td>
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
        <Button variant="outline" onClick={() => void cerrar()} disabled={!!procesando}>
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
