import * as React from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Modal, ModalFooter } from './modal';
import { Button } from './button';
import { Textarea } from './textarea';

/**
 * Ventanas de confirmación propias del sistema (reemplazan window.confirm / window.prompt).
 *
 *   const { confirmar, pedirTexto } = useConfirm();
 *   if (!(await confirmar({ titulo: 'Eliminar área', mensaje: '...', tono: 'peligro', textoConfirmar: 'Eliminar' }))) return;
 *   const motivo = await pedirTexto({ titulo: 'Rechazar', etiqueta: 'Motivo', requerido: true }); // null si cancela
 */

type Tono = 'peligro' | 'advertencia' | 'info';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje?: React.ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  tono?: Tono;
}

export interface OpcionesTexto extends OpcionesConfirmacion {
  etiqueta: string;
  placeholder?: string;
  requerido?: boolean;
  valorInicial?: string;
}

interface Pendiente {
  opciones: OpcionesConfirmacion & Partial<OpcionesTexto>;
  conTexto: boolean;
  resolver: (valor: boolean | string | null) => void;
}

interface ConfirmContextValue {
  confirmar: (opciones: OpcionesConfirmacion) => Promise<boolean>;
  pedirTexto: (opciones: OpcionesTexto) => Promise<string | null>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

const estilosTono: Record<Tono, { icono: React.ReactNode; boton: string }> = {
  peligro: {
    icono: <Trash2 className="h-6 w-6 text-red-600" />,
    boton: 'bg-red-600 hover:bg-red-700 text-white'
  },
  advertencia: {
    icono: <AlertTriangle className="h-6 w-6 text-amber-600" />,
    boton: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  info: {
    icono: <Info className="h-6 w-6 text-blue-600" />,
    boton: ''
  }
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pendiente, setPendiente] = React.useState<Pendiente | null>(null);
  const [texto, setTexto] = React.useState('');
  const [errorTexto, setErrorTexto] = React.useState('');

  const abrir = React.useCallback(
    (opciones: Pendiente['opciones'], conTexto: boolean) =>
      new Promise<boolean | string | null>((resolver) => {
        setTexto(opciones.valorInicial ?? '');
        setErrorTexto('');
        setPendiente({ opciones, conTexto, resolver });
      }),
    []
  );

  const valor = React.useMemo<ConfirmContextValue>(
    () => ({
      confirmar: (opciones) => abrir(opciones, false) as Promise<boolean>,
      pedirTexto: (opciones) => abrir(opciones, true) as Promise<string | null>
    }),
    [abrir]
  );

  const cerrar = (resultado: boolean | string | null) => {
    pendiente?.resolver(resultado);
    setPendiente(null);
  };

  const aceptar = () => {
    if (!pendiente) return;
    if (pendiente.conTexto) {
      const limpio = texto.trim();
      if (pendiente.opciones.requerido && !limpio) {
        setErrorTexto(`${pendiente.opciones.etiqueta} es obligatorio.`);
        return;
      }
      cerrar(limpio);
    } else {
      cerrar(true);
    }
  };

  const tono = estilosTono[pendiente?.opciones.tono ?? (pendiente?.conTexto ? 'info' : 'advertencia')];

  return (
    <ConfirmContext.Provider value={valor}>
      {children}
      <Modal
        isOpen={pendiente !== null}
        onClose={() => cerrar(pendiente?.conTexto ? null : false)}
        title={pendiente?.opciones.titulo}
        size="sm"
      >
        <div className="flex gap-3">
          <div className="flex-shrink-0 pt-0.5">{tono.icono}</div>
          <div className="flex-1 space-y-3 text-sm text-continental-black">
            {pendiente?.opciones.mensaje && <div className="leading-relaxed">{pendiente.opciones.mensaje}</div>}
            {pendiente?.conTexto && (
              <div>
                <Textarea
                  label={`${pendiente.opciones.etiqueta}${pendiente.opciones.requerido ? ' *' : ''}`}
                  placeholder={pendiente.opciones.placeholder}
                  value={texto}
                  autoFocus
                  onChange={(e) => {
                    setTexto(e.target.value);
                    if (errorTexto) setErrorTexto('');
                  }}
                />
                {errorTexto && (
                  <p className="mt-1 text-sm font-medium" style={{ color: '#dc2626', marginBottom: 0 }}>
                    {errorTexto}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => cerrar(pendiente?.conTexto ? null : false)}>
            {pendiente?.opciones.textoCancelar ?? 'Cancelar'}
          </Button>
          <Button className={tono.boton} onClick={aceptar}>
            {pendiente?.opciones.textoConfirmar ?? 'Aceptar'}
          </Button>
        </ModalFooter>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}
