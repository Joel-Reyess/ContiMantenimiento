import { useEffect, useRef } from 'react';

/**
 * Vuelve a consultar cada 20 s (como la campana de notificaciones) y al regresar a la pestaña,
 * para que la ocupación de la Zona de Transición y las etapas se vean al momento sin recargar.
 */
export function useActualizacion(consultar: () => unknown, cadaMs = 20000) {
  const ref = useRef(consultar);
  useEffect(() => {
    ref.current = consultar;
  }, [consultar]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void ref.current();
    };
    const intervalo = window.setInterval(tick, cadaMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [cadaMs]);
}
