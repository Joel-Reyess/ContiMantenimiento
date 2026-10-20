import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Modal, ModalFooter, useConfirm, useToast } from '@/components/ui';
import { ordenesCompraService } from '@/services/ordenesCompraService';
import type { OrdenCompra } from '@/interfaces';
import { FileText, RefreshCcw, Eye, Receipt, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const moneda = (n: number | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const colorEstado: Record<string, string> = {
  Activa: 'bg-blue-100 text-blue-800',
  Completada: 'bg-green-100 text-green-800',
  Cancelada: 'bg-gray-100 text-gray-800'
};

/**
 * Órdenes de compra. Una OC agrupa pagos aprobados de un mismo proveedor y se genera en
 * Control de pagos (seleccionando los pagos). Aquí se consultan, se marcan como completadas y se eliminan.
 */
export function OrdenesCompraPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id: idRuta } = useParams();
  const { hasRole } = useAuth();
  const isSupervisor = hasRole(['Supervisor', 'SuperUsuario', 'Administrador']);
  const esAdmin = hasRole(['SuperUsuario', 'Administrador']);
  const { confirmar } = useConfirm();
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [actualizando, setActualizando] = useState(false);

  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detalleOrden, setDetalleOrden] = useState<OrdenCompra | null>(null);

  const loadOrdenes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ordenesCompraService.getAll();
      if (res.success && res.data) {
        setOrdenes(res.data);
        // Enlace directo desde Control de pagos (/ordenes-compra/:id): abrir su detalle
        if (idRuta) {
          const orden = res.data.find((o) => o.id === Number(idRuta));
          if (orden) setDetalleOrden(orden);
          else setError(`La orden de compra #${idRuta} ya no existe.`);
        }
      } else {
        setError(res.message || 'Error al cargar órdenes de compra');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRuta]);

  const cerrarDetalle = () => {
    setDetalleOrden(null);
    if (idRuta) navigate('/ordenes-compra', { replace: true });
  };

  /** Eliminar OC (solo administradores): sus pagos quedan sin orden de compra y vuelven a "Aprobado" */
  const eliminarOrden = async (orden: { id: number; folio: string }) => {
    const ok = await confirmar({
      titulo: `Eliminar orden de compra ${orden.folio}`,
      mensaje: (
        <div className="flex flex-col gap-2">
          <p>Los pagos incluidos quedarán sin orden de compra y volverán al estado "Aprobado", para poder incluirlos en otra.</p>
          <p>Esta acción no se puede deshacer. Quedará registrado quién la realizó y cuándo.</p>
        </div>
      ),
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    setEliminandoId(orden.id);
    try {
      const res = await ordenesCompraService.delete(orden.id);
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar la orden de compra');
        return;
      }
      toast.exito(res.message || `Orden de compra ${orden.folio} eliminada`);
      if (detalleOrden?.id === orden.id) cerrarDetalle();
      await loadOrdenes();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar la orden de compra');
    } finally {
      setEliminandoId(null);
    }
  };

  const marcarCompletada = async (orden: OrdenCompra) => {
    setActualizando(true);
    try {
      const res = await ordenesCompraService.update(orden.id, { estado: 'Completada' });
      if (!res.success) {
        toast.error(res.message || 'No se pudo actualizar la orden de compra');
        return;
      }
      toast.exito(`Orden de compra ${orden.folio} completada`);
      if (res.data) setDetalleOrden(res.data);
      await loadOrdenes();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar la orden de compra');
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="dashboard-wrapper flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-continental-black">Órdenes de Compra</h1>
          <p className="text-continental-gray-1">Pagos aprobados agrupados por proveedor</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadOrdenes} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </Button>
          {esAdmin && (
            <Link to="/pagos">
              <Button className="flex items-center gap-2 bg-continental-gradient text-white">
                <FileText className="h-4 w-4" /> Generar desde Control de pagos
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ordenes.map((orden) => (
            <Card key={orden.id} className="flex flex-col gap-3 border-l-4 border-l-continental-blue hover:shadow-md transition-shadow" style={{ padding: 16 }}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-lg">{orden.folio}</p>
                  <p className="text-sm text-gray-500">{new Date(orden.fechaRegistro).toLocaleDateString()}</p>
                </div>
                <span className={`rounded text-xs font-semibold ${colorEstado[orden.estado] ?? 'bg-gray-100 text-gray-800'}`} style={{ padding: '2px 8px' }}>
                  {orden.estado}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <p><strong>Proveedor:</strong> {orden.proveedorNombre || 'No asignado'}</p>
                <p><strong>Total:</strong> {moneda(orden.total)}</p>
                <p><strong>Pagos:</strong> {orden.pagos?.length ?? 0}</p>
                {orden.numeroExterno && (
                  <p className="text-continental-blue font-medium">Ref. Ext: {orden.numeroExterno}</p>
                )}
              </div>

              <div className="flex justify-end gap-2" style={{ paddingTop: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setDetalleOrden(orden)}>
                  <Eye className="h-4 w-4 mr-1" /> Ver Detalle
                </Button>
                {esAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void eliminarOrden(orden)}
                    disabled={eliminandoId === orden.id}
                    aria-label={`Eliminar orden de compra ${orden.folio}`}
                    title="Eliminar orden de compra"
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {ordenes.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              No hay órdenes de compra registradas. Se generan en Control de pagos, seleccionando pagos aprobados.
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!detalleOrden} onClose={cerrarDetalle} title={`Orden ${detalleOrden?.folio ?? ''}`}>
        {detalleOrden && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Estado</p>
                <p className="font-semibold">{detalleOrden.estado}</p>
              </div>
              <div>
                <p className="text-gray-500">Fecha</p>
                <p className="font-semibold">{new Date(detalleOrden.fechaRegistro).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Proveedor</p>
                <p className="font-semibold">{detalleOrden.proveedorNombre || 'N/D'}</p>
              </div>
              <div>
                <p className="text-gray-500"># Externo</p>
                <p className="font-semibold">{detalleOrden.numeroExterno || 'N/D'}</p>
              </div>
            </div>

            <div className="border-t" style={{ paddingTop: 16 }}>
              <h4 className="font-semibold flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Receipt className="h-4 w-4" /> Pagos incluidos ({detalleOrden.pagos?.length ?? 0})
              </h4>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {(detalleOrden.pagos ?? []).map((p) => (
                  <div key={p.id} className="bg-gray-50 rounded text-sm flex justify-between gap-2" style={{ padding: 8 }}>
                    <span>
                      <Link to={`/ordenes/${p.ordenTrabajoId}`} className="text-continental-blue hover:underline">
                        {p.ordenTrabajoFolio || `Orden #${p.ordenTrabajoId}`}
                      </Link>
                      {p.tecnicoNombre ? ` · ${p.tecnicoNombre}` : ''}
                    </span>
                    <span className="font-medium">{moneda(p.montoTotal)}</span>
                  </div>
                ))}
                {(detalleOrden.pagos ?? []).length === 0 && (
                  <p className="text-sm text-gray-500">Esta orden ya no tiene pagos.</p>
                )}
              </div>
              <p className="text-sm font-semibold text-right" style={{ marginTop: 8 }}>Total: {moneda(detalleOrden.total)}</p>
            </div>
          </div>
        )}
        <ModalFooter>
          {detalleOrden && isSupervisor && detalleOrden.estado === 'Activa' && (
            <Button onClick={() => void marcarCompletada(detalleOrden)} disabled={actualizando}>
              Marcar como completada
            </Button>
          )}
          <Button variant="outline" onClick={cerrarDetalle}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
