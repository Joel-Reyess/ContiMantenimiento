import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ClipboardCheck, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, Select, Spinner, useConfirm, useToast } from '@/components/ui';
import { catalogosService } from '@/services';
import { electricosService, type ChecklistPreventivoTipo } from '@/services/electricosService';

interface ActividadEdit { key: string; descripcion: string }
interface CategoriaEdit { key: string; nombre: string; actividades: ActividadEdit[] }

let siguiente = 0;
const clave = () => `k${++siguiente}`;

const aEdicion = (c: ChecklistPreventivoTipo): CategoriaEdit[] =>
  c.categorias.map((cat) => ({ key: clave(), nombre: cat.nombre, actividades: cat.actividades.map((a) => ({ key: clave(), descripcion: a.descripcion })) }));

const mover = <T,>(lista: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
};

// Campos de texto con su estilo en línea: index.css trae `input { padding; min-height: 48px }` sin capa
const campo: React.CSSProperties = { flex: '1 1 140px', minWidth: 0, width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 8 };
const iconoBtn: React.CSSProperties = { width: 34, height: 34, minHeight: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

/**
 * Checklist preventivo jerárquico por tipo de equipo eléctrico (EQE-10): categorías numeradas ("1. DAÑOS") con sus
 * actividades ("1.1 …"). Al guardar se reemplaza el checklist del tipo y se renumera; los preventivos ya iniciados
 * conservan la copia con la que empezaron. La carga inicial vino de los formatos del cliente (Anexo).
 */
export function ChecklistPreventivo() {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [params, setParams] = useSearchParams();
  const [tipos, setTipos] = useState<{ id: number; nombre: string }[] | null>(null);
  const [tipoId, setTipoId] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<CategoriaEdit[] | null>(null);
  const [original, setOriginal] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void catalogosService.getTiposVehiculo().then((r) => {
      const electricos = (r.success && r.data ? r.data : []).filter((t) => t.flujoMantenimiento === 'Electrico').map((t) => ({ id: t.id, nombre: t.nombre }));
      setTipos(electricos);
      const pedido = Number(params.get('tipo'));
      setTipoId(electricos.some((t) => t.id === pedido) ? pedido : electricos[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = useCallback(async (id: number) => {
    setCategorias(null);
    setError('');
    const r = await electricosService.checklist(id);
    if (!r.success || !r.data) {
      setError(r.message || 'No se pudo cargar el checklist');
      setCategorias([]);
      return;
    }
    const edit = aEdicion(r.data);
    setCategorias(edit);
    setOriginal(JSON.stringify(edit.map((c) => [c.nombre, c.actividades.map((a) => a.descripcion)])));
  }, []);

  useEffect(() => {
    if (tipoId) void cargar(tipoId);
  }, [tipoId, cargar]);

  const firma = useMemo(() => JSON.stringify((categorias ?? []).map((c) => [c.nombre, c.actividades.map((a) => a.descripcion)])), [categorias]);
  const cambios = categorias !== null && firma !== original;
  const totalActividades = (categorias ?? []).reduce((n, c) => n + c.actividades.length, 0);

  const cambiarTipo = async (v: string) => {
    if (cambios && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si cambias de tipo se pierden los cambios que no has guardado.', textoConfirmar: 'Cambiar de tipo', tono: 'peligro' }))) return;
    setTipoId(Number(v));
    setParams({ tipo: v }, { replace: true });
  };

  const actualizar = (i: number, fn: (c: CategoriaEdit) => CategoriaEdit) =>
    setCategorias((prev) => (prev ? prev.map((c, k) => (k === i ? fn(c) : c)) : prev));

  const guardar = async () => {
    if (!tipoId || !categorias) return;
    const limpias = categorias
      .map((c) => ({ nombre: c.nombre.trim(), actividades: c.actividades.map((a) => a.descripcion.trim()).filter(Boolean) }))
      .filter((c) => c.nombre || c.actividades.length > 0);
    const sinNombre = limpias.findIndex((c) => !c.nombre);
    if (sinNombre >= 0) return setError(`La categoría ${sinNombre + 1} no tiene nombre.`);
    const vacia = limpias.find((c) => c.actividades.length === 0);
    if (vacia) return setError(`La categoría ${vacia.nombre} no tiene actividades.`);
    if (limpias.length === 0) return setError('Agrega al menos una categoría con sus actividades.');
    setGuardando(true);
    setError('');
    try {
      const r = await electricosService.guardarChecklist(tipoId, {
        tipoVehiculoId: tipoId,
        categorias: limpias.map((c, i) => ({ numero: i + 1, nombre: c.nombre, actividades: c.actividades.map((d) => ({ descripcion: d })) })),
      });
      if (!r.success || !r.data) return setError(r.message || 'No se pudo guardar el checklist');
      const edit = aEdicion(r.data);
      setCategorias(edit);
      setOriginal(JSON.stringify(edit.map((c) => [c.nombre, c.actividades.map((a) => a.descripcion)])));
      toast.exito(r.message || 'Checklist preventivo guardado');
    } finally {
      setGuardando(false);
    }
  };

  if (tipos === null) return <Spinner />;
  if (tipos.length === 0)
    return (
      <Alert variant="info">
        <AlertDescription>
          No hay tipos de vehículo con flujo de equipo eléctrico. Márcalo en Tipos de vehículo → Editar → Flujo de mantenimiento.
        </AlertDescription>
      </Alert>
    );

  return (
    <div className="flex flex-col" style={{ gap: 16 }} data-testid="checklist-preventivo">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between" style={{ gap: 12 }}>
        <div>
          <h2 className="flex items-center text-xl font-semibold text-continental-black" style={{ gap: 8 }}>
            <ClipboardCheck className="h-5 w-5 text-continental-yellow" /> Checklist preventivo
          </h2>
          <p className="text-sm text-continental-gray-1">
            Categorías y actividades que el técnico marca en Buen estado o Mal estado. Al guardar se renumeran; los preventivos ya iniciados no cambian.
          </p>
        </div>
        <div style={{ minWidth: 240 }}>
          <Select label="Tipo de equipo" value={tipoId ? String(tipoId) : ''} onChange={(v) => void cambiarTipo(v)} data-testid="cp-tipo"
            options={tipos.map((t) => ({ value: String(t.id), label: t.nombre }))} />
        </div>
      </div>

      {categorias === null ? (
        <Spinner />
      ) : (
        <>
          <p className="text-sm text-continental-gray-1" data-testid="cp-resumen">
            {categorias.length} categoría(s) · {totalActividades} actividad(es){cambios ? ' · cambios sin guardar' : ''}
          </p>
          {categorias.map((c, i) => (
            <Card key={c.key} className="flex flex-col" style={{ padding: 14, gap: 10 }} data-testid={`cp-categoria-${i}`}>
              <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                <span className="text-lg font-bold text-continental-black" style={{ minWidth: 28 }}>{i + 1}.</span>
                <input aria-label={`Nombre de la categoría ${i + 1}`} value={c.nombre} style={{ ...campo, fontWeight: 600, textTransform: 'uppercase' }}
                  data-testid={`cp-cat-nombre-${i}`} maxLength={150}
                  onChange={(e) => actualizar(i, (x) => ({ ...x, nombre: e.target.value }))} />
                <Button variant="ghost" data-icon="true" style={iconoBtn} aria-label={`Subir categoría ${i + 1}`} disabled={i === 0}
                  onClick={() => setCategorias((p) => (p ? mover(p, i, -1) : p))}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" data-icon="true" style={iconoBtn} aria-label={`Bajar categoría ${i + 1}`} disabled={i === categorias.length - 1}
                  onClick={() => setCategorias((p) => (p ? mover(p, i, 1) : p))}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" data-icon="true" style={{ ...iconoBtn, color: '#c0392b' }} aria-label={`Quitar categoría ${i + 1}`}
                  data-testid={`cp-quitar-categoria-${i}`}
                  onClick={async () => {
                    if (c.actividades.length > 0 && !(await confirmar({ titulo: 'Quitar categoría', mensaje: `Se quitará ${c.nombre || 'la categoría'} con sus ${c.actividades.length} actividad(es) (se guarda al presionar Guardar).`, textoConfirmar: 'Quitar', tono: 'peligro' }))) return;
                    setCategorias((p) => (p ? p.filter((_, k) => k !== i) : p));
                  }}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <ol className="flex flex-col" style={{ gap: 6, paddingLeft: 4 }}>
                {c.actividades.map((a, j) => (
                  <li key={a.key} className="flex flex-wrap items-center" style={{ gap: 6 }} data-testid={`cp-act-${i}-${j}`}>
                    <span className="text-sm font-medium text-continental-gray-1" style={{ minWidth: 40 }}>{i + 1}.{j + 1}</span>
                    <input aria-label={`Actividad ${i + 1}.${j + 1}`} value={a.descripcion} style={campo} maxLength={300}
                      data-testid={`cp-act-desc-${i}-${j}`}
                      onChange={(e) => actualizar(i, (x) => ({ ...x, actividades: x.actividades.map((y, k) => (k === j ? { ...y, descripcion: e.target.value } : y)) }))} />
                    <Button variant="ghost" data-icon="true" style={iconoBtn} aria-label={`Subir actividad ${i + 1}.${j + 1}`} disabled={j === 0}
                      onClick={() => actualizar(i, (x) => ({ ...x, actividades: mover(x.actividades, j, -1) }))}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" data-icon="true" style={iconoBtn} aria-label={`Bajar actividad ${i + 1}.${j + 1}`} disabled={j === c.actividades.length - 1}
                      onClick={() => actualizar(i, (x) => ({ ...x, actividades: mover(x.actividades, j, 1) }))}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" data-icon="true" style={{ ...iconoBtn, color: '#c0392b' }} aria-label={`Quitar actividad ${i + 1}.${j + 1}`}
                      data-testid={`cp-quitar-act-${i}-${j}`}
                      onClick={() => actualizar(i, (x) => ({ ...x, actividades: x.actividades.filter((_, k) => k !== j) }))}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ol>
              <div>
                <Button size="sm" variant="outline" className="flex items-center gap-2" data-testid={`cp-agregar-actividad-${i}`}
                  onClick={() => actualizar(i, (x) => ({ ...x, actividades: [...x.actividades, { key: clave(), descripcion: '' }] }))}>
                  <Plus className="h-4 w-4" /> Agregar actividad
                </Button>
              </div>
            </Card>
          ))}
          <div>
            <Button variant="outline" className="flex items-center gap-2" data-testid="cp-agregar-categoria"
              onClick={() => setCategorias((p) => [...(p ?? []), { key: clave(), nombre: '', actividades: [{ key: clave(), descripcion: '' }] }])}>
              <Plus className="h-4 w-4" /> Agregar categoría
            </Button>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex flex-wrap" style={{ gap: 8, position: 'sticky', bottom: 8 }}>
            <Button onClick={() => void guardar()} disabled={guardando || !cambios} className="flex items-center gap-2" data-testid="cp-guardar">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar checklist
            </Button>
            <Button variant="outline" onClick={() => tipoId && void cargar(tipoId)} disabled={guardando || !cambios} className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Descartar cambios
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
