import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Package, Plus, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Input, Select, useToast } from '@/components/ui';
import { consumiblesService, type Consumible } from '@/services/consumiblesService';
import { flujoService, type MaterialOrden, type MaterialesOrden as Materiales } from '@/services/flujoService';
import { formatCurrency } from '@/lib/utils';

/** Mensaje del documento (PDF 29-oct, 5.1) cuando no hay existencia suficiente */
const SIN_EXISTENCIA =
  'La refacción seleccionada no cuenta con existencia suficiente para completar la operación solicitada. Consulta con el Gerente de Mantenimiento.';

const esRefaccion = (categoria?: string) => (categoria || '').toLowerCase().includes('refac');

interface Pendiente {
  consumibleId: number;
  cantidad: string;
}

interface Props {
  ordenId: number;
  /** Cambia cuando cambia la orden (estado, técnico): vuelve a cargar */
  version?: string | number;
}

/**
 * Refacciones y consumibles usados en la orden (PDF 29-oct, 5.1). En la etapa TALLER el técnico los elige con
 * su cantidad (nunca más de lo que hay); se descuentan del inventario al terminar la reparación y pasan a la
 * orden de pago. El Líder y el Gerente los consultan con sus costos.
 */
export function MaterialesOrden({ ordenId, version }: Props) {
  const toast = useToast();
  const [datos, setDatos] = useState<Materiales | null>(null);
  const [inventario, setInventario] = useState<Consumible[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [elegido, setElegido] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const res = await flujoService.materiales(ordenId);
    if (!res.success || !res.data) {
      setError(res.message || 'No se pudieron cargar los materiales');
      return;
    }
    setDatos(res.data);
    setPendientes(res.data.items.filter((i) => !i.descontado).map((i) => ({ consumibleId: i.consumibleId, cantidad: String(i.cantidad) })));
    setError('');
    if (res.data.editable) {
      const inv = await consumiblesService.getAll({ activo: true });
      if (inv.success && Array.isArray(inv.data)) setInventario(inv.data);
    }
  }, [ordenId]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  const porId = useMemo(() => new Map(inventario.map((c) => [c.id, c])), [inventario]);

  const opciones = useMemo(
    () => [
      { value: '', label: 'Elige una refacción o consumible…' },
      ...inventario
        .filter((c) => !pendientes.some((p) => p.consumibleId === c.id))
        .sort((a, b) => Number(esRefaccion(b.categoria)) - Number(esRefaccion(a.categoria)) || a.nombre.localeCompare(b.nombre))
        .map((c) => ({
          value: String(c.id),
          label: `${esRefaccion(c.categoria) ? 'Refacción' : 'Consumible'} · ${c.nombre} (${c.codigo}) · ${
            c.stockActual > 0 ? `hay ${c.stockActual} ${c.unidad}` : 'sin existencia'
          }`,
          // Sin existencia no se puede seleccionar
          disabled: c.stockActual <= 0
        }))
    ],
    [inventario, pendientes]
  );

  if (!datos) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const excede = (p: Pendiente) => {
    const c = porId.get(p.consumibleId);
    return !!c && Number(p.cantidad) > c.stockActual;
  };
  const invalida = (p: Pendiente) => !(Number(p.cantidad) > 0);
  const hayExceso = pendientes.some(excede);
  const hayInvalida = pendientes.some(invalida);

  const agregar = () => {
    if (!elegido) return;
    setPendientes((prev) => [...prev, { consumibleId: Number(elegido), cantidad: '1' }]);
    setElegido('');
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await flujoService.guardarMateriales(
        ordenId,
        pendientes.map((p) => ({ consumibleId: p.consumibleId, cantidad: Number(p.cantidad) }))
      );
      if (res.success && res.data) {
        toast.exito('Materiales guardados. Se descuentan del inventario al terminar la reparación.');
        await cargar();
      } else {
        setError(res.message || 'No se pudieron guardar los materiales');
      }
    } finally {
      setGuardando(false);
    }
  };

  const descontados = datos.items.filter((i) => i.descontado);
  const tabla = (titulo: string, filas: MaterialOrden[], total: number) =>
    filas.length > 0 && (
      <div>
        <p className="mb-1 text-sm font-semibold text-continental-black">{titulo}</p>
        <div className="overflow-x-auto rounded-lg border border-continental-gray-3">
          <table className="w-full text-sm">
            <thead className="bg-continental-gray-4/50 text-left text-xs uppercase text-continental-gray-1">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Costo unitario</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.id} className="border-t border-continental-gray-3/60">
                  <td className="px-3 py-2">
                    {m.nombre} <span className="text-xs text-continental-gray-1">({m.codigo})</span>
                    {m.descontado ? (
                      <Badge variant="secondary" className="ml-2">Descontado</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">Pendiente</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{m.cantidad} {m.unidad}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(m.costoUnitario)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(m.subtotal)}</td>
                </tr>
              ))}
              <tr className="border-t border-continental-gray-3 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Total</td>
                <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );

  const items = datos.editable ? descontados : datos.items;
  return (
    <div className="space-y-4" data-testid="materiales-orden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-continental-black">
          <Package className="h-5 w-5" /> Refacciones y consumibles utilizados
        </h3>
        {datos.aplicaGarantia && <Badge variant="secondary">Garantía: refacciones sin costo en la orden de pago</Badge>}
      </div>

      {datos.items.length === 0 && !datos.editable && (
        <p className="text-sm text-continental-gray-2">No se registraron materiales en esta orden.</p>
      )}
      {tabla('Refacciones utilizadas', items.filter((i) => i.esRefaccion), items.filter((i) => i.esRefaccion).reduce((a, i) => a + i.subtotal, 0))}
      {tabla('Consumibles utilizados', items.filter((i) => !i.esRefaccion), items.filter((i) => !i.esRefaccion).reduce((a, i) => a + i.subtotal, 0))}

      {datos.editable ? (
        <div className="space-y-3 rounded-xl border border-dashed border-continental-gray-3 p-4" data-testid="captura-materiales">
          <p className="text-sm text-continental-gray-1">
            Elige lo que usaste en la reparación. Se descuenta del inventario al terminar la reparación y pasa a la orden de pago.
          </p>
          {pendientes.map((p, idx) => {
            const c = porId.get(p.consumibleId);
            return (
              <div key={p.consumibleId} className="flex flex-wrap items-end gap-3" data-testid={`material-${p.consumibleId}`}>
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-medium text-continental-black" style={{ marginBottom: 0 }}>
                    {c ? `${c.nombre} (${c.codigo})` : `Material #${p.consumibleId}`}
                  </p>
                  <p className="text-xs text-continental-gray-1" style={{ marginBottom: 0 }}>
                    {c ? `${esRefaccion(c.categoria) ? 'Refacción' : 'Consumible'} · hay ${c.stockActual} ${c.unidad} · ${formatCurrency(c.costoUnitario ?? 0)} c/u` : ''}
                  </p>
                </div>
                <div className="w-32">
                  <Input
                    label="Cantidad"
                    type="number"
                    min={0}
                    max={c?.stockActual}
                    step="any"
                    value={p.cantidad}
                    onChange={(e) =>
                      setPendientes((prev) => prev.map((x, i) => (i === idx ? { ...x, cantidad: e.target.value } : x)))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Quitar material"
                  onClick={() => setPendientes((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {excede(p) && (
                  <p className="w-full text-sm font-medium" style={{ color: '#dc2626', marginBottom: 0 }} data-testid="sin-existencia">
                    {SIN_EXISTENCIA}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Select options={opciones} value={elegido} onChange={(v) => setElegido(v)} aria-label="Material a agregar" />
            </div>
            <Button variant="outline" onClick={agregar} disabled={!elegido} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={() => void guardar()} disabled={guardando || hayExceso || hayInvalida} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {guardando ? 'Guardando...' : 'Guardar materiales'}
            </Button>
          </div>
        </div>
      ) : (
        datos.bloqueo && (
          <p className="flex items-center gap-2 text-sm text-continental-gray-1">
            <Lock className="h-4 w-4" /> {datos.bloqueo}
          </p>
        )
      )}
    </div>
  );
}
