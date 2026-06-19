import { useEffect, useState } from 'react';
import { Button, Card, Modal, ModalFooter } from '@/components/ui';
import { ordenesCompraService } from '@/services/ordenesCompraService';
import { refaccionesService } from '@/services/refaccionesService';
import type { OrdenCompra, SolicitudRefaccion } from '@/interfaces';
import { FileText, RefreshCcw, Eye, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function OrdenesCompraPage() {
  const { hasRole } = useAuth();
  const isSupervisor = hasRole(['Supervisor', 'SuperUsuario', 'Administrador']);

  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSolicitudes, setSelectedSolicitudes] = useState<number[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudRefaccion[]>([]);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleOrden, setDetalleOrden] = useState<OrdenCompra | null>(null);

  const loadOrdenes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ordenesCompraService.getAll();
      if (res.success && res.data) {
        setOrdenes(res.data);
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

  const loadSolicitudes = async () => {
    try {
      const res = await refaccionesService.getPendientes();
      if (res.success && res.data) {
        // Filtrar solo las que están Aprobadas y no tienen orden de compra asignada
        const aprobadas = res.data.filter((s: SolicitudRefaccion) => s.estado === 'Aprobada' && !(s as any).ordenCompraId);
        setSolicitudesPendientes(aprobadas);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOrdenes();
  }, []);

  useEffect(() => {
    if (createOpen) {
      loadSolicitudes();
    }
  }, [createOpen]);

  const handleCreate = async () => {
    if (selectedSolicitudes.length === 0) return;
    try {
      const res = await (ordenesCompraService as any).create({
        solicitudRefaccionIds: selectedSolicitudes
      });
      if (res.success) {
        setCreateOpen(false);
        setSelectedSolicitudes([]);
        loadOrdenes();
      } else {
        alert(res.message || 'Error al crear orden');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const handleUpdateEstado = async (id: number, nuevoEstado: string) => {
    try {
      await (ordenesCompraService as any).updateEstado(id, nuevoEstado);
      loadOrdenes();
      if (detalleOrden && detalleOrden.id === id) {
        setDetalleOrden({ ...detalleOrden, estado: nuevoEstado });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-continental-black">Órdenes de Compra</h1>
          <p className="text-continental-gray-1">Gestiona las compras de refacciones aprobadas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadOrdenes} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </Button>
          {isSupervisor && (
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 bg-continental-gradient text-white">
              <FileText className="h-4 w-4" /> Generar Orden
            </Button>
          )}
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ordenes.map((orden) => (
            <Card key={orden.id} className="p-4 space-y-3 border-l-4 border-l-continental-blue hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg">{orden.folio}</p>
                  <p className="text-sm text-gray-500">{new Date(orden.fechaRegistro).toLocaleDateString()}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                  orden.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  orden.estado === 'Aprobada' ? 'bg-blue-100 text-blue-800' :
                  orden.estado === 'Enviada' ? 'bg-purple-100 text-purple-800' :
                  orden.estado === 'Recibida' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {orden.estado}
                </div>
              </div>
              
              <div className="space-y-1 text-sm">
                <p><strong>Proveedor:</strong> {orden.proveedor?.nombreCompleto || orden.proveedor || 'No asignado'}</p>
                <p><strong>Costo Total:</strong> ${orden.total?.toFixed(2) || '0.00'}</p>
                <p><strong>Items:</strong> {orden.solicitudes?.length || 0}</p>
                {orden.numeroExterno && (
                  <p className="text-continental-blue font-medium">Ref. Ext: {orden.numeroExterno}</p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setDetalleOrden(orden); setDetalleOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" /> Ver Detalle
                </Button>
              </div>
            </Card>
          ))}
          {ordenes.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              No hay órdenes de compra registradas.
            </div>
          )}
        </div>
      )}

      {/* Modal Crear Orden */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Generar Orden de Compra">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
          <p className="text-sm text-gray-600">Selecciona las solicitudes aprobadas para incluir en la orden.</p>
          
          {solicitudesPendientes.length === 0 ? (
            <p className="text-center py-4 text-gray-500 italic">No hay solicitudes aprobadas pendientes.</p>
          ) : (
            <div className="space-y-2">
              {solicitudesPendientes.map(sol => (
                <label key={sol.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedSolicitudes.includes(sol.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedSolicitudes(prev => [...prev, sol.id]);
                      else setSelectedSolicitudes(prev => prev.filter(id => id !== sol.id));
                    }}
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{sol.nombreRefaccion} (x{sol.cantidad})</p>
                    <p className="text-gray-500 text-xs">
                      {sol.ordenTrabajoFolio ? `OT: ${sol.ordenTrabajoFolio}` : 'Sin OT'} - {sol.solicitadoPorNombre}
                    </p>
                    {sol.costoEstimado && <p className="text-xs font-medium text-green-600">Est: ${sol.costoEstimado}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={selectedSolicitudes.length === 0}>Generar Orden ({selectedSolicitudes.length})</Button>
        </ModalFooter>
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={detalleOpen && !!detalleOrden} onClose={() => setDetalleOpen(false)} title={`Orden ${detalleOrden?.folio}`}>
        {detalleOrden && (
          <div className="space-y-4">
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
                <p className="text-gray-500">Creado por</p>
                <p className="font-semibold">{detalleOrden.creadoPorNombre || 'Sistema'}</p>
              </div>
              <div>
                <p className="text-gray-500">Proveedor</p>
                <p className="font-semibold">{detalleOrden.proveedor?.nombreCompleto || detalleOrden.proveedor || 'N/D'}</p>
              </div>
              <div>
                <p className="text-gray-500"># Externo</p>
                <p className="font-semibold">{detalleOrden.numeroExterno || 'N/D'}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Items solicitados
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detalleOrden.solicitudes?.map((item: any, idx: number) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded text-sm flex justify-between">
                    <span>{item.cantidad}x {item.nombreRefaccion}</span>
                    {item.costoReal && <span className="font-medium">${item.costoReal}</span>}
                  </div>
                ))}
              </div>
            </div>

            {isSupervisor && detalleOrden.estado !== 'Recibida' && (
              <div className="border-t pt-4 flex gap-2 justify-end">
                {detalleOrden.estado === 'Pendiente' && (
                  <Button size="sm" onClick={() => handleUpdateEstado(detalleOrden.id, 'Aprobada')}>
                    Aprobar
                  </Button>
                )}
                {detalleOrden.estado === 'Aprobada' && (
                  <Button size="sm" onClick={() => handleUpdateEstado(detalleOrden.id, 'Enviada')}>
                    Marcar Enviada
                  </Button>
                )}
                {detalleOrden.estado === 'Enviada' && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleUpdateEstado(detalleOrden.id, 'Recibida')}>
                    Marcar Recibida
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
