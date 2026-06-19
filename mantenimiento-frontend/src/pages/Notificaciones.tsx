import { useEffect, useState } from 'react';
import { Bell, CheckCircle, Trash2, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, Spinner } from '@/components/ui';
import { notificacionesService } from '@/services/notificacionesService';
import type { Notificacion } from '@/interfaces';

export function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await notificacionesService.getAll(soloNoLeidas);
      if (res.success && res.data) {
        setNotificaciones(res.data || []);
      } else {
        setNotificaciones([]);
        setError(res.message || 'No se pudieron cargar las notificaciones');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de notificaciones');
      setNotificaciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloNoLeidas]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    window.addEventListener('notifications:refresh', handler);
    return () => window.removeEventListener('notifications:refresh', handler);
  }, []);

  const marcarLeida = async (id: number) => {
    // Optimista: marcamos en UI; si falla, recargamos desde API
    setNotificaciones((prev) =>
      prev
        .map((n) => (n.id === id ? { ...n, leida: true } : n))
        .filter((n) => (soloNoLeidas ? !n.leida : true))
    );
    const resp = await notificacionesService.marcarLeida(id);
    if (!resp.success) {
      setError(resp.message || 'No se pudo marcar como leida');
      load();
    }
  };

  const borrar = async (id: number) => {
    await notificacionesService.eliminar(id);
    load();
  };

  const marcarTodas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })).filter((n) => (soloNoLeidas ? !n.leida : true)));
    const resp = await notificacionesService.marcarTodasLeidas();
    if (!resp.success) {
      setError(resp.message || 'No se pudieron marcar todas como leidas');
      load();
    }
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Notificaciones</p>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-semibold text-continental-black">Centro de avisos</h1>
            <p className="text-continental-gray-1">Resumen de alertas del sistema.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSoloNoLeidas((prev) => !prev)}>
              {soloNoLeidas ? 'Ver todas' : 'Solo no leidas'}
            </Button>
            <Button variant="outline" onClick={load} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button variant="secondary" onClick={marcarTodas}>
              Marcar todas como leidas
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : notificaciones.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay notificaciones</p>
          <p className="text-continental-gray-1">Aun no tienes avisos nuevos.</p>
          <Button variant="outline" onClick={load} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {notificaciones.map((n) => (
            <Card key={n.id} className="px-8 py-7 border-l-4 border-continental-blue">
              <div className="flex items-start gap-3 justify-between">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 text-continental-blue mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-continental-black">{n.titulo}</p>
                      {!n.leida && <Badge variant="destructive">Nuevo</Badge>}
                    </div>
                    <p className="text-sm text-continental-gray-1">{n.mensaje}</p>
                    <p className="text-xs text-continental-gray-2">{new Date(n.fechaCreacion).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!n.leida && (
                    <Button size="sm" variant="secondary" onClick={() => marcarLeida(n.id)} className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Leida
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => borrar(n.id)} className="flex items-center gap-1 text-red-600">
                    <Trash2 className="h-4 w-4" />
                    Borrar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
