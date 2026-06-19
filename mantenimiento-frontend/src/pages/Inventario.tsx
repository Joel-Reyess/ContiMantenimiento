import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, AlertTriangle, Check, X } from 'lucide-react';
import { Button, LoadingCard } from '@/components/ui';
import { consumiblesService } from '@/services';
import type { Consumible } from '@/services';
import { cn } from '@/lib/utils';

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

interface InventarioProps {
  modoRefacciones?: boolean;
  soloConsumibles?: boolean;
}

export function InventarioPage({ modoRefacciones = false, soloConsumibles = false }: InventarioProps) {
  const [items, setItems] = useState<Consumible[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [tipoVista, setTipoVista] = useState<'todos' | 'refacciones' | 'consumibles'>(
    modoRefacciones ? 'refacciones' : soloConsumibles ? 'consumibles' : 'todos'
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showAdjust, setShowAdjust] = useState<Consumible | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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

  const load = async () => {
    try {
      setLoading(true);
      const resp = await consumiblesService.getAll({ bajoStock: soloBajoStock, q: q.trim() || undefined });
      if (resp.success && resp.data) setItems(resp.data as Consumible[]);
      else setItems([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloBajoStock]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    const tipoFiltro = modoRefacciones ? 'refacciones' : soloConsumibles ? 'consumibles' : tipoVista;
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
  }, [items, q, tipoVista, modoRefacciones, soloConsumibles]);

  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Codigo y nombre son obligatorios');
      return;
    }
    if (form.stockActual < 0 || form.stockMinimo < 0) {
      setError('Stock y minimo no pueden ser negativos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const resp = await consumiblesService.create({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria?.trim() || undefined,
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
        load();
      } else setError(resp.message || 'No se pudo crear');
    } catch (err) {
      setError('Error al crear consumible');
    } finally {
      setSaving(false);
    }
  };

  const handleAjuste = async () => {
    if (!showAdjust) return;
    if (ajuste.cantidad <= 0) {
      setError('Cantidad invalida');
      return;
    }
    setSaving(true);
    setError('');
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
        load();
      } else setError(resp.message || 'No se pudo ajustar');
    } catch (err) {
      setError('Error al ajustar stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingCard message="Cargando inventario..." />;

  return (
    <div className="dashboard-wrapper space-y-6">
      <header className="dashboard-card p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Inventario</p>
            <h1 className="text-2xl font-bold text-continental-black">
            {modoRefacciones ? 'Refacciones (stock)' : 'Consumibles'}
            </h1>
            <p className="text-sm text-continental-gray-1">
              {modoRefacciones ? 'Stock de refacciones y entregas.' : 'Administra stock, umbrales y ajustes de almacen.'}
            </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setShowCreate(true);
              setError('');
              const tipoActual = modoRefacciones ? 'refacciones' : tipoVista;
              setForm((prev) => ({ ...prev, categoria: tipoActual === 'refacciones' ? 'Refaccion' : prev.categoria }));
            }}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> {(modoRefacciones ? 'Nueva refaccion' : tipoVista === 'refacciones' ? 'Nueva refaccion' : 'Nuevo consumible')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSoloBajoStock((v) => !v)}
            className={cn(soloBajoStock && 'border-continental-yellow text-continental-yellow')}
          >
            <AlertTriangle className="h-4 w-4 mr-1" /> Bajo stock
          </Button>
        </div>
        {!modoRefacciones && !soloConsumibles && (
          <div className="flex flex-wrap gap-2">
            <Button variant={tipoVista === 'todos' ? 'default' : 'outline'} onClick={() => setTipoVista('todos')}>
              Todos
            </Button>
            <Button variant={tipoVista === 'refacciones' ? 'default' : 'outline'} onClick={() => setTipoVista('refacciones')}>
              Refacciones con stock
            </Button>
            <Button variant={tipoVista === 'consumibles' ? 'default' : 'outline'} onClick={() => setTipoVista('consumibles')}>
              Consumibles
            </Button>
          </div>
        )}
      </header>

      <div className="dashboard-card p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="h-4 w-4 text-continental-gray-2 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Buscar por codigo, nombre o categoria"
              className="w-full h-11 rounded-lg border border-continental-gray-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
            />
          </div>
          <Button variant="outline" onClick={load}>
            Actualizar
          </Button>
        </div>

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
              {filtered.map((c) => {
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
                        {bajo ? 'Bajo stock' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setShowAdjust(c); setError(''); }}>
                          Ajustar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-continental-gray-1">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title={tipoVista === 'refacciones' ? 'Nueva refaccion' : 'Nuevo consumible'} onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            {error && <Alert message={error} />}
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Codigo" value={form.codigo} onChange={(v) => setForm((s) => ({ ...s, codigo: v }))} />
              <Input label="Nombre" value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} />
              <Input label="Categoria" value={form.categoria || ''} onChange={(v) => setForm((s) => ({ ...s, categoria: v }))} />
              <Input label="Unidad" value={form.unidad} onChange={(v) => setForm((s) => ({ ...s, unidad: v }))} />
              <Input
                label="Stock actual"
                type="number"
                value={String(form.stockActual)}
                onChange={(v) => setForm((s) => ({ ...s, stockActual: Number(v) || 0 }))}
              />
              <Input
                label="Stock minimo"
                type="number"
                value={String(form.stockMinimo)}
                onChange={(v) => setForm((s) => ({ ...s, stockMinimo: Number(v) || 0 }))}
              />
              <Input
                label="Stock maximo"
                type="number"
                value={form.stockMaximo !== undefined ? String(form.stockMaximo) : ''}
                onChange={(v) => setForm((s) => ({ ...s, stockMaximo: v === '' ? undefined : Number(v) || 0 }))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showAdjust && (
        <Modal title={`Ajustar stock - ${showAdjust.nombre}`} onClose={() => setShowAdjust(null)}>
          <div className="space-y-4">
            {error && <Alert message={error} />}
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
              <Input
                label="Cantidad"
                type="number"
                value={String(ajuste.cantidad)}
                onChange={(v) => setAjuste((s) => ({ ...s, cantidad: Number(v) || 1 }))}
              />
            </div>
            <Input label="Comentario" value={ajuste.comentario} onChange={(v) => setAjuste((s) => ({ ...s, comentario: v }))} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAdjust(null)}>
                Cancelar
              </Button>
              <Button onClick={handleAjuste} disabled={saving}>
                {saving ? 'Aplicando...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-continental-gray-3">
          <h2 className="text-lg font-semibold text-continental-black">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-continental-gray-4 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-continental-black mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
      />
    </div>
  );
}

function Alert({ message }: { message: string }) {
  return <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{message}</div>;
}
