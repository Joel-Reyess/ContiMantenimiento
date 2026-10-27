import { useEffect, useState } from 'react';
import { Warehouse } from 'lucide-react';
import { Button, Card, Input, useToast } from '@/components/ui';
import { flujoService } from '@/services/flujoService';

/** Configuración: cuántos vehículos caben en cada zona de la Zona de Transición (15 y 15 por defecto) */
export function CapacidadZonaConfig() {
  const toast = useToast();
  const [danados, setDanados] = useState('');
  const [reparados, setReparados] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void flujoService.capacidad().then((r) => {
      if (r.success && r.data) {
        setDanados(String(r.data.danados.capacidad));
        setReparados(String(r.data.reparados.capacidad));
      }
    });
  }, []);

  const guardar = async () => {
    const d = Number(danados), r = Number(reparados);
    if (!Number.isInteger(d) || !Number.isInteger(r) || d < 1 || r < 1) {
      setError('Escribe un número entero mayor que cero para cada zona.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const res = await flujoService.guardarCapacidad(d, r);
      if (res.success) toast.exito(res.message || 'Capacidad actualizada');
      else setError(res.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="space-y-4 p-6" data-testid="config-capacidad-zona">
      <div className="flex items-center gap-2">
        <Warehouse className="h-5 w-5 text-continental-yellow" />
        <h2 className="text-xl font-semibold text-continental-black">Capacidad de la Zona de Transición</h2>
      </div>
      <p className="text-sm text-continental-gray-1">
        Cuando una zona se llena, el sistema bloquea el traslado y deja la unidad en fila de espera. El semáforo y los avisos
        (próxima a llenarse y saturada) se calculan sobre esta capacidad.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Vehículos dañados (pendientes de reparación)" type="number" min={1} value={danados} onChange={(e) => setDanados(e.target.value)} />
        <Input label="Vehículos reparados (pendientes de validación)" type="number" min={1} value={reparados} onChange={(e) => setReparados(e.target.value)} />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <Button onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar capacidad'}</Button>
    </Card>
  );
}
