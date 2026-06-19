import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, CheckCircle, XCircle, Loader2, RefreshCcw, Search, AlertTriangle, Warehouse, Check } from 'lucide-react';
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
import { consumiblesService } from '@/services';
import type { SolicitudRefaccion } from '@/services/refaccionesService';
import type { Consumible } from '@/services';
import { cn } from '@/lib/utils';

type TabType = 'stock' | 'solicitudes';
type TipoFiltro = 'todos' | 'refacciones' | 'consumibles';

const estadoOpciones = [
  { value: '', label: 'Todos los estados' },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Aprobada', label: 'Aprobada' },
  { value: 'Rechazada', label: 'Rechazada' },
  { value: 'Entregada', label: 'Entregada' }
];

interface FormState {
  codigo: string;
  nombre: string;
  categoria?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo?: number;
  costoUnitario: number;
  activo: boolean;
}

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

export function MaterialesUnificadoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

  // Stock state
  const [items, setItems] = useState<Consumible[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [q, setQ] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdjust, setShowAdjust] = useState<Consumible | null>(null);
  const [savingStock, setSavingStock] = useState(false);
  const [errorStock, setErrorStock] = useState('');
  const [form, setForm] = useState<FormState>({
    codigo: '',
    nombre: '',
    categoria: '',
    unidad: 'pieza',
    stockActual: 0,
    stockMinimo: 0,
    stockMaximo: undefined,
    costoUnitario: 0,
    activo: true,
  });
  const [ajuste, setAjuste] = useState<{ tipo: 'ajuste+' | 'ajuste-'; cantidad: number; comentario: string }>({
    tipo: 'ajuste+',
    cantidad: 1,
    comentario: '',
  });

  // Solicitudes state
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [refacciones, setRefacciones] = useState<SolicitudRefaccion[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [errorSolicitudes, setErrorSolicitudes] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenOption | null>(null);
  const [refaccionSeleccionada, setRefaccionSeleccionada] = useState<RefaccionStockOption | null>(null);
  const [formSolicitud, setFormSolicitud] = useState<CrearRefaccionForm>({
    ordenTrabajoId: '',
    nombreRefaccion: '',
    numeroParte: '',
    cantidad: '1',
    justificacion: ''
  });

  // Load stock
  const loadStock = async () => {
    try {
      setLoadingStock(true);
      const resp = await consumiblesService.getAll({ bajoStock: soloBajoStock, q: q.trim() || undefined });
      if (resp.success && resp.data) setItems(resp.data as Consumible[]);
      else setItems([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStock(false);
    }
  };

  // Load solicitudes
  const loadRefacciones = async () => {
    setLoadingSolicitudes(true);
    setErrorSolicitudes('');
    try {
      const res = await refaccionesService.getAll(estadoFiltro || undefined);
      if (res.success && res.data) {
        setRefacciones(res.data || []);
      } else {
        setRefacciones([]);
        setErrorSolicitudes(res.message || 'No se pudieron cargar las solicitudes');
      }
    } catch (err) {
      console.error(err);
      setErrorSolicitudes('No se pudo conectar con el servicio de refacciones');
      setRefacciones([]);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    loadStock();
    loadRefacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloBajoStock]);

  // Filter stock by tipo
  const filteredStock = useMemo(() => {
    const term = q.toLowerCase();
    return items.filter((i) => {
      const matchesQuery =
        !term ||
        i.nombre.toLowerCase().includes(term) ||
        i.codigo.toLowerCase().includes(term) ||
        (i.categoria || '').toLowerCase().includes(term);

      const cat = (i.categoria || '').toLowerCase();
      const esRefaccion = cat.includes('refac');
      if (tipoFiltro === 'refacciones' && !esRefaccion) return false;
      if (tipoFiltro === 'consumibles' && esRefaccion) return false;
      return matchesQuery;
    });
  }, [items, q, tipoFiltro]);

  // Filter solicitudes by tipo
  const filteredSolicitudes = useMemo(() => {
    if (tipoFiltro === 'todos') return refacciones;
    // For solicitudes, we don't have a direct category, so show all
    return refacciones;
  }, [refacciones, tipoFiltro]);

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

  const handleCreateStock = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setErrorStock('Codigo y nombre son obligatorios');
      return;
    }
    setSavingStock(true);
    setErrorStock('');
    try {
      const resp = await consumiblesService.create({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria?.trim() || (tipoFiltro === 'refacciones' ? 'Refaccion' : undefined),
        unidad: form.unidad.trim() || 'pieza',
        stockActual: Number(form.stockActual) || 0,
        stockMinimo: Number(form.stockMinimo) || 0,
        stockMaximo: form.stockMaximo !== undefined ? Number(form.stockMaximo) || 0 : undefined,
        costoUnitario: Number(form.costoUnitario) || 0,
        activo: form.activo
      });
      if (resp.success) {
        setShowCreate(false);
        setForm({
          codigo: '',
          nombre: '',
          categoria: '',
          unidad: 'pieza',
          stockActual: 0,
          stockMinimo: 0,
          stockMaximo: undefined,
          costoUnitario: 0,
          activo: true,
        });
        loadStock();
      } else setErrorStock(resp.message || 'No se pudo crear');
    } catch (err) {
      setErrorStock('Error al crear');
    } finally {
      setSavingStock(false);
    }
  };

  const handleAjuste = async () => {
    if (!showAdjust) return;
    if (ajuste.cantidad <= 0) {
      setErrorStock('Cantidad invalida');
      return;
    }
    setSavingStock(true);
    setErrorStock('');
    try {
      const resp = await consumiblesService.ajustar(
        showAdjust.id,
        ajuste.tipo,
        Number(ajuste.cantidad) || 0,
        ajuste.comentario?.trim() || undefined
      );
      if (resp.success) {
        setShowAdjust(null);
        setAjuste({ tipo: 'ajuste+', cantidad: 1, comentario: '' });
        loadStock();
      } else setErrorStock(resp.message || 'No se pudo ajustar');
    } catch (err) {
      setErrorStock('Error al ajustar stock');
    } finally {
      setSavingStock(false);
    }
  };

  const handleCreateSolicitud = async () => {
    setCreando(true);
    setErrorSolicitudes('');
    try {
      if (!formSolicitud.ordenTrabajoId) {
        setErrorSolicitudes('Selecciona una orden de trabajo');
        setCreando(false);
        return;
      }
      const costoEstimadoAuto = refaccionSeleccionada?.meta?.costo;
      const payload = {
        ordenTrabajoId: Number(formSolicitud.ordenTrabajoId),
        nombreRefaccion: (refaccionSeleccionada?.label || formSolicitud.nombreRefaccion).trim(),
        numeroParte: formSolicitud.numeroParte.trim() || refaccionSeleccionada?.meta?.codigo || undefined,
        cantidad: Number(formSolicitud.cantidad) || 1,
        justificacion: formSolicitud.justificacion.trim() || undefined,
        costoEstimado: costoEstimadoAuto
      };
      const res = await refaccionesService.create(payload);
      if (res.success) {
        setCreateOpen(false);
        setFormSolicitud({
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
        setErrorSolicitudes(res.message || 'No se pudo crear la solicitud');
      }
    } catch (err) {
      console.error(err);
      setErrorSolicitudes('Error al crear la solicitud de refaccion');
    } finally {
      setCreando(false);
    }
  };

  const doAccion = async (fn: () => Promise<unknown>) => {
    setAccionando(true);
    setErrorSolicitudes('');
    try {
      await fn();
      await loadRefacciones();
    } catch (err) {
      console.error(err);
      setErrorSolicitudes('No se pudo completar la accion');
    } finally {
      setAccionando(false);
    }
  };

  const handleAprobar = (id: number) => doAccion(() => refaccionesService.aprobar(id, undefined));
  const handleRechazar = (id: number) => {
    const motivo = window.prompt('Motivo de rechazo:');
    if (!motivo) return;
    doAccion(() => refaccionesService.rechazar(id, motivo));
  };
  const handleEntregar = (id: number) => doAccion(() => refaccionesService.marcarEntregada(id));

  const badgeVariant = (estado: string) => {
    if (estado.toLowerCase().includes('pend')) return 'outline';
    if (estado.toLowerCase().includes('aprob')) return 'default';
    if (estado.toLowerCase().includes('rech')) return 'destructive';
    return 'secondary';
  };

  return (
    <div className="dashboard-wrapper space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Materiales</p>
          <h1 className="text-3xl font-semibold text-continental-black">Refacciones y Consumibles</h1>
          <p className="text-continental-gray-1">Gestiona stock y solicitudes en un solo lugar.</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-continental-gray-3 pb-3">
        <Button
          variant={activeTab === 'stock' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('stock')}
          className="flex items-center gap-2"
        >
          <Warehouse className="h-4 w-4" />
          Stock de Materiales
        </Button>
        <Button
          variant={activeTab === 'solicitudes' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('solicitudes')}
          className="flex items-center gap-2"
        >
          <Package className="h-4 w-4" />
          Solicitudes de Refacciones
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tipoFiltro === 'todos' ? 'default' : 'outline'}
          onClick={() => setTipoFiltro('todos')}
        >
          Todos
        </Button>
        <Button
          size="sm"
          variant={tipoFiltro === 'refacciones' ? 'default' : 'outline'}
          onClick={() => setTipoFiltro('refacciones')}
        >
          Refacciones
        </Button>
        <Button
          size="sm"
          variant={tipoFiltro === 'consumibles' ? 'default' : 'outline'}
          onClick={() => setTipoFiltro('consumibles')}
        >
          Consumibles
        </Button>
      </div>

      {/* Stock Tab Content */}
      {activeTab === 'stock' && (
        <div className="dashboard-card p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="h-4 w-4 text-continental-gray-2 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadStock()}
                placeholder="Buscar por codigo, nombre o categoria"
                className="w-full h-11 rounded-lg border border-continental-gray-3 pl-14 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
                style={{ paddingLeft: '3.5rem' }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSoloBajoStock((v) => !v)}
                className={cn(soloBajoStock && 'border-continental-yellow text-continental-yellow')}
              >
                <AlertTriangle className="h-4 w-4 mr-1" /> Bajo stock
              </Button>
              <Button variant="outline" onClick={loadStock}>
                <RefreshCcw className="h-4 w-4 mr-1" /> Actualizar
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo
              </Button>
            </div>
          </div>

          {loadingStock ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
              <table className="min-w-full text-sm">
                <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Codigo</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Unidad</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Stock</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Min</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((c) => {
                    const bajo = c.stockActual <= c.stockMinimo;
                    return (
                      <tr key={c.id} className="border-t border-continental-gray-3/60 hover:bg-continental-gray-4/40">
                        <td className="px-4 py-3 font-semibold text-continental-black">{c.codigo}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{c.nombre}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{c.categoria || 'N/D'}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{c.unidad}</td>
                        <td className="px-4 py-3 text-continental-black">{c.stockActual}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{c.stockMinimo}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                              bajo ? 'bg-continental-red/15 text-continental-red' : 'bg-continental-green/15 text-continental-green'
                            )}
                          >
                            {bajo ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            {bajo ? 'Bajo' : 'OK'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" onClick={() => { setShowAdjust(c); setErrorStock(''); }}>
                            Ajustar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-continental-gray-1">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Solicitudes Tab Content */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Select options={estadoOpciones} value={estadoFiltro} onChange={(value) => setEstadoFiltro(value)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadRefacciones} className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
              <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva solicitud
              </Button>
            </div>
          </div>

          {errorSolicitudes && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorSolicitudes}</AlertDescription>
            </Alert>
          )}

          {loadingSolicitudes ? (
            <Spinner />
          ) : filteredSolicitudes.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay solicitudes</p>
              <p className="text-continental-gray-1">Aun no se han solicitado refacciones.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSolicitudes.map((item) => (
                <Card key={item.id} className="px-8 py-7 border-l-4 border-continental-yellow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 leading-relaxed">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-continental-yellow" />
                        <p className="font-semibold text-continental-black">{item.nombreRefaccion}</p>
                      </div>
                      <p className="text-sm text-continental-gray-1">
                        Orden: {item.ordenTrabajoFolio || item.ordenTrabajoId} - Cantidad: {item.cantidad}
                      </p>
                      <p className="text-xs text-continental-gray-2">
                        Solicitado: {new Date(item.fechaSolicitud).toLocaleString()} - Por: {item.solicitadoPorNombre || 'N/D'}
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
        </div>
      )}

      {/* Create Stock Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo material" description="Agrega refaccion o consumible al inventario.">
          <div className="space-y-4">
            {errorStock && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{errorStock}</div>}
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Codigo" value={form.codigo} onChange={(e) => setForm((s) => ({ ...s, codigo: e.target.value }))} />
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} />
              <Input label="Categoria" value={form.categoria || ''} onChange={(e) => setForm((s) => ({ ...s, categoria: e.target.value }))} placeholder="Ej: Refaccion, Consumible" />
              <Input label="Unidad" value={form.unidad} onChange={(e) => setForm((s) => ({ ...s, unidad: e.target.value }))} />
              <Input label="Stock actual" type="number" value={String(form.stockActual)} onChange={(e) => setForm((s) => ({ ...s, stockActual: Number(e.target.value) || 0 }))} />
              <Input label="Stock minimo" type="number" value={String(form.stockMinimo)} onChange={(e) => setForm((s) => ({ ...s, stockMinimo: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateStock} disabled={savingStock}>
              {savingStock ? 'Guardando...' : 'Guardar'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <Modal isOpen={!!showAdjust} onClose={() => setShowAdjust(null)} title={`Ajustar stock - ${showAdjust.nombre}`}>
          <div className="space-y-4">
            {errorStock && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{errorStock}</div>}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-continental-black mb-2">Tipo</label>
                <select
                  value={ajuste.tipo}
                  onChange={(e) => setAjuste((s) => ({ ...s, tipo: e.target.value as 'ajuste+' | 'ajuste-' }))}
                  className="w-full h-11 rounded-lg border border-continental-gray-3 px-3 text-sm"
                >
                  <option value="ajuste+">Entrada (+)</option>
                  <option value="ajuste-">Salida (-)</option>
                </select>
              </div>
              <Input label="Cantidad" type="number" value={String(ajuste.cantidad)} onChange={(e) => setAjuste((s) => ({ ...s, cantidad: Number(e.target.value) || 1 }))} />
            </div>
            <Input label="Comentario" value={ajuste.comentario} onChange={(e) => setAjuste((s) => ({ ...s, comentario: e.target.value }))} />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAdjust(null)}>Cancelar</Button>
            <Button onClick={handleAjuste} disabled={savingStock}>
              {savingStock ? 'Aplicando...' : 'Aplicar'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Create Solicitud Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setOrdenSeleccionada(null);
          setRefaccionSeleccionada(null);
          setFormSolicitud({
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
              setFormSolicitud((prev) => ({
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
              setFormSolicitud((prev) => ({
                ...prev,
                nombreRefaccion: opt?.label || '',
                numeroParte: opt?.meta?.codigo || ''
              }));
            }}
            fetchOptions={async (query) => {
              try {
                const res = await consumiblesService.getAll({ q: query?.trim() || undefined });
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
              return [];
            }}
            noResultsText="Sin refacciones"
          />
          <Input
            label="Nombre de la refaccion (si no esta en inventario)"
            placeholder="Ej. Filtro hidraulico"
            value={formSolicitud.nombreRefaccion}
            onChange={(e) => {
              setFormSolicitud((prev) => ({ ...prev, nombreRefaccion: e.target.value }));
              if (e.target.value) setRefaccionSeleccionada(null);
            }}
          />
          <Input
            label="Numero de parte"
            placeholder="Opcional"
            value={formSolicitud.numeroParte}
            onChange={(e) => setFormSolicitud((prev) => ({ ...prev, numeroParte: e.target.value }))}
          />
          <Input
            label="Cantidad"
            type="number"
            value={formSolicitud.cantidad}
            onChange={(e) => setFormSolicitud((prev) => ({ ...prev, cantidad: e.target.value }))}
          />
          <Textarea
            label="Justificacion"
            placeholder="Por que se requiere?"
            value={formSolicitud.justificacion}
            onChange={(e) => setFormSolicitud((prev) => ({ ...prev, justificacion: e.target.value }))}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateSolicitud} disabled={creando} className="flex items-center gap-2">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
