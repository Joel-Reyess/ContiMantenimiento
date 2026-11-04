import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActualizacion } from '@/hooks/useActualizacion';
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { Button, Modal, ModalFooter } from '@/components/ui';
import { flujoService, type AlertaCapacidad, type CapacidadZonas as Capacidad, type ZonaCapacidad } from '@/services/flujoService';

/** Semáforo del PDF: verde 0-8, amarillo 9-12, rojo 13-15 (de 15) */
const SEMAFORO = {
  verde: { color: '#2db928', texto: 'Capacidad disponible' },
  amarillo: { color: '#e0a100', texto: 'Capacidad próxima al límite' },
  rojo: { color: '#ff2d37', texto: 'Capacidad crítica o saturada' },
} as const;

function TarjetaZona({ z }: { z: ZonaCapacidad }) {
  const s = SEMAFORO[z.semaforo];
  const pct = Math.min(100, Math.round((z.ocupados / Math.max(1, z.capacidad)) * 100));
  return (
    <div className="dashboard-card border-l-4 p-5" style={{ borderLeftColor: s.color }} data-testid={`capacidad-${z.zona}`} data-semaforo={z.semaforo}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-continental-gray-1">{z.nombre}</p>
          <p className="text-3xl font-bold text-continental-black">
            {z.ocupados} <span className="text-xl font-semibold text-continental-gray-2">/ {z.capacidad}</span>
          </p>
        </div>
        <span className="mt-1 inline-flex h-4 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-continental-gray-4">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
      </div>
      <p className="mt-2 text-sm font-medium" style={{ color: s.color }}>{s.texto}</p>
      <p className="text-xs text-continental-gray-1">
        {z.disponibles} lugar(es) libre(s){z.enFila > 0 ? ` · ${z.enFila} en fila de espera` : ''}
      </p>
    </div>
  );
}

interface CapacidadZonasProps {
  /** Si no se pasa, el componente la consulta */
  capacidad?: Capacidad | null;
  /** Muestra la ventana de advertencia al abrir la pantalla si alguna zona está en 12/15 o más */
  avisarAlCargar?: boolean;
}

/** Indicador de ocupación de la Zona de Transición (Dashboard y módulo Zona de Transición) */
export function CapacidadZonas({ capacidad, avisarAlCargar = true }: CapacidadZonasProps) {
  const [propia, setPropia] = useState<Capacidad | null>(null);
  const [vistas, setVistas] = useState<string[]>(leerVistas);
  const datos = capacidad ?? propia;

  const consultar = useCallback(() => {
    if (capacidad !== undefined) return;
    void flujoService.capacidad().then((r) => { if (r.success && r.data) setPropia(r.data); });
  }, [capacidad]);
  useEffect(consultar, [consultar]);
  // Indicador "en tiempo real": se actualiza solo cada 20 s
  useActualizacion(consultar);

  // El aviso es "al cargar": se calcula con la primera ocupación recibida; los cambios posteriores
  // (p. ej. un traslado en la misma pantalla) ya muestran su propia ventana
  const [alCargar, setAlCargar] = useState<Capacidad | null>(null);
  if (datos && !alCargar) setAlCargar(datos);

  // La zona más crítica (saturada antes que preventiva); se muestra una vez por sesión por zona y nivel
  const candidata = useMemo(() => {
    if (!alCargar || !avisarAlCargar) return null;
    const alertas = [alCargar.danados, alCargar.reparados].map(alertaDeZona).filter((a): a is AlertaCapacidad => a !== null);
    return alertas.find((a) => a.nivel === 'saturada') ?? alertas[0] ?? null;
  }, [alCargar, avisarAlCargar]);
  const clave = candidata ? `alertaZona:${candidata.zona}:${candidata.nivel}` : null;
  const alerta = candidata && clave && !vistas.includes(clave) ? candidata : null;
  const cerrarAlerta = () => {
    if (!clave) return;
    try { sessionStorage.setItem(clave, '1'); } catch { /* sin sessionStorage solo dura en esta pantalla */ }
    setVistas((v) => [...v, clave]);
  };

  if (!datos) return null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2" data-testid="capacidad-zonas">
        <TarjetaZona z={datos.danados} />
        <TarjetaZona z={datos.reparados} />
      </div>
      <AlertaCapacidadModal alerta={alerta} onClose={cerrarAlerta} />
    </>
  );
}

function leerVistas(): string[] {
  try {
    return Object.keys(sessionStorage).filter((k) => k.startsWith('alertaZona:'));
  } catch {
    return [];
  }
}

function alertaDeZona(z: ZonaCapacidad): AlertaCapacidad | null {
  const unidades = z.zona === 'danados' ? 'unidades dañadas' : 'unidades reparadas';
  if (z.ocupados >= z.capacidad)
    return { zona: z.zona, nivel: 'saturada', ocupados: z.ocupados, capacidad: z.capacidad,
      mensaje: `Zona de Transición saturada (${z.ocupados}/${z.capacidad} ${unidades}). No es posible recibir más vehículos hasta liberar espacio disponible.` };
  if (z.ocupados >= z.alertaDesde)
    return { zona: z.zona, nivel: 'preventiva', ocupados: z.ocupados, capacidad: z.capacidad,
      mensaje: `La Zona de Transición está próxima a alcanzar su capacidad máxima (${z.ocupados}/${z.capacidad} ${unidades}).` };
  return null;
}

/** Ventana con ícono de advertencia (12/15) o de exclamación (15/15) */
export function AlertaCapacidadModal({ alerta, onClose }: { alerta: AlertaCapacidad | null | undefined; onClose: () => void }) {
  const saturada = alerta?.nivel === 'saturada';
  return (
    <Modal
      isOpen={Boolean(alerta)}
      onClose={onClose}
      title={saturada ? 'Zona de Transición saturada' : 'Capacidad próxima al máximo'}
      size="sm"
    >
      {alerta && (
        <div className="flex items-start gap-4" data-testid="alerta-capacidad" data-nivel={alerta.nivel}>
          {saturada
            ? <AlertOctagon className="h-10 w-10 flex-shrink-0" style={{ color: '#ff2d37' }} />
            : <AlertTriangle className="h-10 w-10 flex-shrink-0" style={{ color: '#e0a100' }} />}
          <p className="text-sm leading-relaxed text-continental-black">{alerta.mensaje}</p>
        </div>
      )}
      <ModalFooter>
        <Button onClick={onClose}>Entendido</Button>
      </ModalFooter>
    </Modal>
  );
}
