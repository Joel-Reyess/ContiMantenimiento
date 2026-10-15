import * as React from 'react';
import { AlertTriangle, CheckCircle, X, XCircle } from 'lucide-react';

/**
 * Avisos de éxito / error / advertencia visibles desde cualquier pantalla y por encima de las ventanas.
 *
 *   const toast = useToast();
 *   toast.exito('Área eliminada');  toast.error(res.message);  toast.aviso('...');
 */

type TipoAviso = 'exito' | 'error' | 'aviso';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
}

interface ToastContextValue {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  aviso: (mensaje: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const estilos: Record<TipoAviso, { clase: string; icono: React.ReactNode }> = {
  exito: { clase: 'border-green-200 bg-green-50 text-green-900', icono: <CheckCircle className="h-6 w-6 text-green-600" /> },
  error: { clase: 'border-red-200 bg-red-50 text-red-900', icono: <XCircle className="h-6 w-6 text-red-600" /> },
  aviso: { clase: 'border-amber-200 bg-amber-50 text-amber-900', icono: <AlertTriangle className="h-6 w-6 text-amber-600" /> }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = React.useState<Aviso[]>([]);
  const siguienteId = React.useRef(1);

  const quitar = React.useCallback((id: number) => setAvisos((prev) => prev.filter((a) => a.id !== id)), []);

  const agregar = React.useCallback(
    (tipo: TipoAviso, mensaje: string) => {
      const id = siguienteId.current++;
      setAvisos((prev) => [...prev.slice(-3), { id, tipo, mensaje }]);
      // Los errores se quedan más tiempo para que alcancen a leerse
      window.setTimeout(() => quitar(id), tipo === 'error' ? 9000 : 5000);
    },
    [quitar]
  );

  const valor = React.useMemo<ToastContextValue>(
    () => ({
      exito: (m) => agregar('exito', m),
      error: (m) => agregar('error', m),
      aviso: (m) => agregar('aviso', m)
    }),
    [agregar]
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[2000] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl ${estilos[a.tipo].clase}`}
          >
            <div className="flex-shrink-0">{estilos[a.tipo].icono}</div>
            <div className="flex-1 text-sm font-semibold leading-snug">{a.mensaje}</div>
            <button
              type="button"
              data-icon="true"
              aria-label="Cerrar aviso"
              onClick={() => quitar(a.id)}
              className="flex-shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
