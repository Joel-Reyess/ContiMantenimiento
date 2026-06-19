import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, CheckCircle, XCircle, Loader2, RefreshCcw } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalFooter,
  SearchableSelect,
  type SearchableSelectOption,
  Select,
  Spinner,
  Textarea
} from '@/components/ui';
import { refaccionesService } from '@/services/refaccionesService';
import { ordenesService } from '@/services/ordenesService';
import { consumiblesService } from '@/services/consumiblesService';
import type { SolicitudRefaccion } from '@/services/refaccionesService';

const estadoOpciones = [
  { value: '', label: 'Todos los estados' },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Aprobada', label: 'Aprobada' },
  { value: 'Rechazada', label: 'Rechazada' },
  { value: 'Entregada', label: 'Entregada' }
];

interface CrearRefaccionForm {
  ordenTrabajoId: string;
  nombreRefaccion: string;
  numeroParte: string;
  cantidad: string;
  justificacion: string;
}

type OrdenOption = SearchableSelectOption<{
  folio?: string;
  vehiculoCodigo?: string;
  prioridad?: string;
}>;

type RefaccionStockOption = SearchableSelectOption<{ costo?: number; codigo?: string; stock?: number }>;

export function RefaccionesPage() {
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [refacciones, setRefacciones] = useState<SolicitudRefaccion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenOption | null>(null);
  const [refaccionesStock, setRefaccionesStock] = useState<RefaccionStockOption[]>([]);
  const [refaccionSeleccionada, setRefaccionSeleccionada] = useState<RefaccionStockOption | null>(null);
  const [form, setForm] = useState<CrearRefaccionForm>({
    ordenTrabajoId: '',
    nombreRefaccion: '',
    numeroParte: '',
    cantidad: '1',
    justificacion: ''
  });

  const fetchOrdenes = useCallback(async (busqueda: string): Promise<OrdenOption[]> => {
    try {
      const res = await ordenesService.getAll({
        busqueda: busqueda || undefined,
        page: 1,
        pageSize: 10
      });

      if (res.success && res.data) {
        const data: unknown = res.data as unknown;
        const items =
          (data as { items?: any[]; Items?: any[] }).items ||
          (data as { items?: any[]; Items?: any[] }).Items ||
          (Array.isArray(data) ? (data as unknown[]) : []);

        return (items as any[]).map((o) => ({
          value: o.id,
          label: `${o.folio || `Orden ${o.id}`}${o.vehiculoCodigo ? ` - ${o.vehiculoCodigo}` : ''}`,
          description: o.prioridadNombre || '',
          meta: {
            folio: o.folio,
            vehiculoCodigo: o.vehiculoCodigo,
            prioridad: o.prioridadNombre
          }
        }));
      }
    } catch (err) {
      console.error('No se pudieron cargar ordenes', err);
    }
    return [];
  }, []);

  const loadRefacciones = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await refaccionesService.getAll(estadoFiltro || undefined);
      if (res.success && res.data) {
        setRefacciones(res.data || []);
      } else {
        setRefacciones([]);
        setError(res.message || 'No se pudieron cargar las solicitudes');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de refacciones');
      setRefacciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => loadRefacciones();

  useEffect(() => {
    // precargar refacciones de inventario
    consumiblesService.getAll({ q: undefined }).then((res) => {
      if (res.success && res.data) {
        const lista = (res.data as any[]).filter((c) => (c.categoria || '').toLowerCase().includes('refac'));
        setRefaccionesStock(
          lista.map((r) => ({
            value: r.id,
            label: `${r.nombre} (${r.codigo})`,
            description: `Stock: ${r.stockActual ?? 0}`,
            meta: { costo: r.costoUnitario ?? 0, codigo: r.codigo, stock: r.stockActual ?? 0 }
          }))
        );
      }
    });
  }, []);

  const handleCreate = async () => {
    setCreando(true);
    setError('');
    try {
      if (!form.ordenTrabajoId) {
        setError('Selecciona una orden de trabajo');
        return;
      }
      const costoEstimadoAuto = refaccionSeleccionada?.meta?.costo;
      const payload = {
        ordenTrabajoId: Number(form.ordenTrabajoId),
        nombreRefaccion: (refaccionSeleccionada?.label || form.nombreRefaccion).trim(),
        numeroParte: form.numeroParte.trim() || refaccionSeleccionada?.meta?.codigo || undefined,
        cantidad: Number(form.cantidad) || 1,
        justificacion: form.justificacion.trim() || undefined,
        costoEstimado: costoEstimadoAuto
      };
      const res = await refaccionesService.create(payload);
      if (res.success) {
        setCreateOpen(false);
        setForm({
          ordenTrabajoId: '',
          nombreRefaccion: '',
          numeroParte: '',
          cantidad: '1',
          justificacion: ''
        });
        setOrdenSeleccionada(null);
        setRefaccionSeleccionada(null);
        loadRefacciones();
      } else {
        setError(res.message || 'No se pudo crear la solicitud');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear la solicitud de refaccion');
    } finally {
      setCreando(false);
    }
  };

  const doAccion = async (fn: () => Promise<unknown>) => {
    setAccionando(true);
    setError('');
    try {
      await fn();
      await loadRefacciones();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la accion');
    } finally {
      setAccionando(false);
    }
  };

  const handleAprobar = (id: number) => {
    doAccion(() => refaccionesService.aprobar(id, undefined));
  };

  const handleRechazar = (id: number) => {
    const motivo = window.prompt('Motivo de rechazo:');
    if (!motivo) return;
    doAccion(() => refaccionesService.rechazar(id, motivo));
  };

  const handleEntregar = (id: number) => {
    doAccion(() => refaccionesService.marcarEntregada(id));
  };

  const badgeVariant = (estado: string) => {
    if (estado.toLowerCase().includes('pend')) return 'outline';
    if (estado.toLowerCase().includes('aprob')) return 'default';
    if (estado.toLowerCase().includes('rech')) return 'destructive';
    return 'secondary';
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Refacciones</p>
          <h1 className="text-3xl font-semibold text-continental-black">Solicitudes de refaccion</h1>
          <p className="text-continental-gray-1">Listado en vivo de solicitudes pendientes y aprobadas.</p>
        </div>
        <div className="flex gap-2">
          <Select options={estadoOpciones} value={estadoFiltro} onChange={(value) => setEstadoFiltro(value)} />
          <Button variant="outline" onClick={applyFilter} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva solicitud
          </Button>
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
      ) : refacciones.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay solicitudes</p>
          <p className="text-continental-gray-1">Aun no se han solicitado refacciones.</p>
          <div className="flex justify-center gap-2">
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Crear solicitud
            </Button>
            <Button variant="outline" onClick={loadRefacciones}>
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {refacciones.map((item) => (
            <Card key={item.id} className="px-8 py-7 border-l-4 border-continental-yellow">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 leading-relaxed">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-continental-yellow" />
                    <p className="font-semibold text-continental-black">{item.nombreRefaccion}</p>
                  </div>
                  <p className="text-sm text-continental-gray-1">
                    Orden: {item.ordenTrabajoFolio || item.ordenTrabajoId} · Cantidad: {item.cantidad}
                  </p>
                  <p className="text-xs text-continental-gray-2">
                    Solicitado: {new Date(item.fechaSolicitud).toLocaleString()} · Por: {item.solicitadoPorNombre || 'N/D'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Badge variant={badgeVariant(item.estado)}>{item.estado}</Badge>
                  <div className="flex gap-3">
                    {item.estado.toLowerCase().includes('pend') && (
                      <>
                        <Button size="sm" onClick={() => handleAprobar(item.id)} disabled={accionando} className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Aprobar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRechazar(item.id)} disabled={accionando} className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Rechazar
                        </Button>
                      </>
                    )}
                    {item.estado.toLowerCase().includes('aprob') && (
                      <Button size="sm" onClick={() => handleEntregar(item.id)} disabled={accionando} className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Entregar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setOrdenSeleccionada(null);
          setRefaccionSeleccionada(null);
          setForm({
            ordenTrabajoId: '',
            nombreRefaccion: '',
            numeroParte: '',
            cantidad: '1',
            justificacion: ''
          });
        }}
        title="Nueva solicitud de refaccion"
        description="Solicita una refaccion ligada a una orden de trabajo."
      >
        <div className="space-y-3">
          <SearchableSelect
            label="Orden de trabajo"
            placeholder="Buscar por folio, vehiculo o texto"
            selected={ordenSeleccionada}
            onSelect={(option) => {
              setOrdenSeleccionada(option);
              setForm((prev) => ({
                ...prev,
                ordenTrabajoId: option ? String(option.value) : ''
              }));
            }}
            fetchOptions={fetchOrdenes}
            noResultsText="No se encontraron ordenes"
          />
          <SearchableSelect
            label="Refaccion (inventario)"
            placeholder="Busca por codigo o nombre"
            selected={refaccionSeleccionada}
            onSelect={(opt) => {
              setRefaccionSeleccionada(opt);
              setForm((prev) => ({
                ...prev,
                nombreRefaccion: opt?.label || '',
                numeroParte: opt?.meta?.codigo || ''
              }));
            }}
            fetchOptions={async (q) => {
              try {
                const res = await consumiblesService.getAll({ q: q?.trim() || undefined });
                if (res.success && res.data) {
                  const lista = (res.data as any[]).filter((c) => (c.categoria || '').toLowerCase().includes('refac'));
                  return lista.map((r) => ({
                    value: r.id,
                    label: `${r.nombre} (${r.codigo})`,
                    description: `Stock: ${r.stockActual ?? 0}`,
                    meta: { codigo: r.codigo, stock: r.stockActual ?? 0 }
                  }));
                }
              } catch (err) {
                console.error('No se pudieron cargar refacciones', err);
              }
              return refaccionesStock;
            }}
            noResultsText="Sin refacciones"
          />
          <Input
            label="Nombre de la refaccion (si no esta en inventario)"
            placeholder="Ej. Filtro hidraulico"
            value={form.nombreRefaccion}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, nombreRefaccion: e.target.value }));
              if (e.target.value) setRefaccionSeleccionada(null);
            }}
          />
          <Input
            label="Numero de parte"
            placeholder="Opcional"
            value={form.numeroParte}
            onChange={(e) => setForm((prev) => ({ ...prev, numeroParte: e.target.value }))}
          />
          <Input
            label="Cantidad"
            type="number"
            min={1}
            value={form.cantidad}
            onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
          />
          <Textarea
            label="Justificacion"
            placeholder="Por que se requiere?"
            value={form.justificacion}
            onChange={(e) => setForm((prev) => ({ ...prev, justificacion: e.target.value }))}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creando} className="flex items-center gap-2">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
