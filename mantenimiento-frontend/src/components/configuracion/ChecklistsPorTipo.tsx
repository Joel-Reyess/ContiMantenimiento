import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ClipboardPlus, ListChecks, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalFooter,
  Select,
  Spinner,
  useConfirm,
  useToast
} from '@/components/ui';
import { catalogosService, checklistService } from '@/services';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import type { ChecklistTemplate, ChecklistTemplateRequest } from '@/services/checklistService';

interface ItemDraft {
  id?: number;
  pregunta: string;
  costoEstimado: number;
  tipoRespuesta: number;
  opciones?: string;
  obligatorio: boolean;
  requiereFoto: boolean;
}

const parseNumero = (val: string) => {
  const num = Number(String(val).replace(',', '.'));
  return Number.isNaN(num) || num < 0 ? 0 : num;
};

const moneda = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

const normalizar = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Requerimientos 12.3, 12.3.1 y 12.3.2: un checklist por tipo de vehículo, que usan
 * automáticamente todos los vehículos de ese tipo (incluidos los que se den de alta después).
 * El nombre lo pone el tipo y los ítems se agregan en una ventana aparte.
 */
export function ChecklistsPorTipo() {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [plantillas, setPlantillas] = useState<ChecklistTemplate[]>([]);
  const [tipos, setTipos] = useState<TipoVehiculoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // Ventana del checklist
  const [abierto, setAbierto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tipoId, setTipoId] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [errorChecklist, setErrorChecklist] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Ventana para agregar un ítem (12.3.2)
  const [itemAbierto, setItemAbierto] = useState(false);
  const [nuevaPregunta, setNuevaPregunta] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('0');
  const [errorItem, setErrorItem] = useState('');
  const preguntaRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    setLoading(true);
    setErrorCarga('');
    try {
      const [tplRes, tiposRes] = await Promise.all([checklistService.getTemplates(), catalogosService.getTiposVehiculo()]);
      if (!tplRes.success) throw new Error(tplRes.message || 'No se pudieron cargar los checklists');
      setPlantillas(tplRes.data || []);
      if (tiposRes.success && tiposRes.data) setTipos(tiposRes.data);
    } catch (err) {
      console.error(err);
      setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar los checklists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const tiposConChecklist = new Set(plantillas.filter((p) => p.tipoVehiculo).map((p) => Number(p.tipoVehiculo)));
  const tipoActual = editId ? plantillas.find((p) => p.id === editId)?.tipoVehiculo : undefined;
  // Un checklist por tipo: solo se ofrecen los tipos que aún no tienen (más el del checklist que se edita)
  const opcionesTipo = tipos
    .filter((t) => t.activo !== false || t.id === Number(tipoActual))
    .filter((t) => !tiposConChecklist.has(t.id) || t.id === Number(tipoActual))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((t) => ({ value: String(t.id), label: t.nombre }));
  const vehiculosDelTipo = tipos.find((t) => t.id === Number(tipoId))?.totalVehiculos;

  const abrirNuevo = () => {
    setEditId(null);
    setTipoId('');
    setItems([]);
    setErrorChecklist('');
    setAbierto(true);
  };

  const abrirEditar = (tpl: ChecklistTemplate) => {
    setEditId(tpl.id);
    setTipoId(tpl.tipoVehiculo ? String(tpl.tipoVehiculo) : '');
    setItems(
      tpl.items.map((it) => ({
        id: it.id,
        pregunta: it.pregunta,
        costoEstimado: Number(it.costoEstimado ?? 0),
        tipoRespuesta: it.tipoRespuesta || 1,
        opciones: it.opciones,
        obligatorio: it.obligatorio,
        requiereFoto: it.requiereFoto
      }))
    );
    setErrorChecklist('');
    setAbierto(true);
  };

  const cerrar = () => {
    if (guardando) return;
    setAbierto(false);
    setItemAbierto(false);
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
    setErrorChecklist('');
  };

  const quitarItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setErrorChecklist('');
  };

  const abrirItem = () => {
    setNuevaPregunta('');
    setNuevoCosto('0');
    setErrorItem('');
    setItemAbierto(true);
  };

  /** Agrega el ítem a la lista; `seguir` deja la ventana abierta para capturar otro */
  const agregarItem = (seguir: boolean) => {
    const pregunta = nuevaPregunta.trim().replace(/\s+/g, ' ');
    if (!pregunta) {
      setErrorItem('Escribe la descripción del ítem.');
      return;
    }
    if (pregunta.length > 200) {
      setErrorItem('La descripción no puede pasar de 200 caracteres.');
      return;
    }
    if (items.some((it) => normalizar(it.pregunta) === normalizar(pregunta))) {
      setErrorItem(`"${pregunta}" ya está en la lista (duplicado).`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { pregunta, costoEstimado: parseNumero(nuevoCosto), tipoRespuesta: 1, obligatorio: true, requiereFoto: false }
    ]);
    setErrorChecklist('');
    toast.exito(`Ítem "${pregunta}" agregado. Guarda el checklist para conservarlo.`);
    if (seguir) {
      setNuevaPregunta('');
      setNuevoCosto('0');
      setErrorItem('');
      preguntaRef.current?.focus();
    } else {
      setItemAbierto(false);
    }
  };

  const guardar = async () => {
    if (!tipoId) {
      setErrorChecklist('Selecciona el tipo de vehículo.');
      return;
    }
    const limpios = items.map((it) => ({ ...it, pregunta: it.pregunta.trim().replace(/\s+/g, ' ') }));
    if (limpios.length === 0) {
      setErrorChecklist('Agrega al menos un ítem al checklist.');
      return;
    }
    const vacio = limpios.findIndex((it) => !it.pregunta);
    if (vacio >= 0) {
      setErrorChecklist(`El ítem #${vacio + 1} está vacío: escribe su descripción o quítalo.`);
      return;
    }
    const vistos = new Set<string>();
    for (const it of limpios) {
      const clave = normalizar(it.pregunta);
      if (vistos.has(clave)) {
        setErrorChecklist(`El ítem "${it.pregunta}" está repetido.`);
        return;
      }
      vistos.add(clave);
    }

    const payload: ChecklistTemplateRequest = {
      tipoVehiculo: Number(tipoId),
      items: limpios.map((it, idx) => ({
        id: it.id,
        orden: idx + 1,
        pregunta: it.pregunta,
        tipoRespuesta: it.tipoRespuesta,
        opciones: it.opciones || undefined,
        obligatorio: it.obligatorio,
        requiereFoto: it.requiereFoto,
        costoEstimado: it.costoEstimado
      }))
    };

    setGuardando(true);
    setErrorChecklist('');
    try {
      const res = editId ? await checklistService.updateTemplate(editId, payload) : await checklistService.createTemplate(payload);
      if (!res.success) {
        setErrorChecklist(res.message || 'No se pudo guardar el checklist');
        return;
      }
      toast.exito(res.message || 'Checklist guardado');
      setAbierto(false);
      void cargar();
    } catch (err) {
      console.error(err);
      setErrorChecklist('Error al guardar el checklist. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (tpl: ChecklistTemplate) => {
    const ok = await confirmar({
      titulo: `Eliminar checklist de ${tpl.nombre}`,
      mensaje: (
        <div className="flex flex-col gap-2">
          <p>
            {tpl.vigente
              ? 'Los vehículos de este tipo se quedarán sin checklist hasta que crees uno nuevo.'
              : 'Este checklist no se está usando.'}
          </p>
          <p>Si ya se usó en reportes u órdenes, esos registros conservan sus ítems.</p>
        </div>
      ),
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    try {
      const res = await checklistService.deleteTemplate(tpl.id);
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar el checklist');
        return;
      }
      toast.exito(res.message || `Checklist de ${tpl.nombre} eliminado`);
      void cargar();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el checklist');
    }
  };

  const avisoTarjeta = (tpl: ChecklistTemplate) => {
    if (!tpl.tipoVehiculo) return 'Sin tipo de vehículo: no se usa. Edítalo para asignarle un tipo o elimínalo.';
    if (!tpl.vigente) return `No se usa: ${tpl.nombre} tiene otro checklist más reciente. Elimina el que sobre.`;
    return '';
  };

  // Espacios con gap: index.css anula los márgenes de space-y-* con `* { margin: 0 }`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-continental-yellow" />
          <div>
            <h2 className="text-xl font-semibold text-continental-black">Checklists por tipo de vehículo</h2>
            <p className="text-sm text-continental-gray-1">
              Cada tipo tiene un checklist y todos sus vehículos lo usan automáticamente, incluidos los que se registren después.
            </p>
          </div>
        </div>
        <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={abrirNuevo}>
          <ClipboardPlus className="h-4 w-4" />
          Nuevo checklist
        </Button>
      </div>

      {errorCarga && (
        <Alert variant="destructive">
          <AlertDescription>{errorCarga}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : plantillas.length === 0 ? (
        <Card className="p-6 text-center flex flex-col gap-2">
          <p className="text-lg font-semibold text-continental-black">No hay checklists configurados</p>
          <p className="text-continental-gray-1">Crea uno por cada tipo de vehículo con "Nuevo checklist".</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plantillas.map((tpl) => {
            const aviso = avisoTarjeta(tpl);
            return (
              <Card key={tpl.id} className={`p-5 border-l-4 flex flex-col gap-3 ${aviso ? 'border-amber-400' : 'border-continental-blue'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-continental-black break-words">{tpl.nombre}</p>
                    <Badge variant="secondary">{tpl.items.length} ítem(s)</Badge>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(tpl)} className="flex items-center gap-1">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Eliminar checklist de ${tpl.nombre}`}
                      title="Eliminar checklist"
                      onClick={() => eliminar(tpl)}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {aviso && (
                  <p className="flex items-start gap-1 text-xs font-medium" style={{ color: '#b45309', marginBottom: 0 }}>
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {aviso}
                  </p>
                )}
                {/* Vista previa de precios */}
                <div className="text-xs flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                  {tpl.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <span className="text-continental-black">
                        <span className="text-continental-gray-2">#{idx + 1}</span> {item.pregunta}
                      </span>
                      <span className="flex-shrink-0 text-continental-gray-1">{moneda(Number(item.costoEstimado ?? 0))}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={abierto}
        onClose={cerrar}
        title={editId ? 'Editar checklist' : 'Nuevo checklist'}
        description="El checklist se asigna automáticamente a todos los vehículos del tipo seleccionado."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
          <Select
            label="Tipo de vehículo"
            value={tipoId}
            onChange={(v) => {
              setTipoId(v);
              setErrorChecklist('');
            }}
            options={opcionesTipo}
            placeholder="Selecciona el tipo de vehículo"
          />
          <p className="text-xs text-continental-gray-1">
            {tipoId && vehiculosDelTipo !== undefined
              ? `Se aplicará a ${vehiculosDelTipo} vehículo(s) de este tipo.`
              : 'Los tipos que ya tienen checklist no aparecen: edítalos desde su tarjeta.'}
          </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-continental-black text-sm">Ítems del checklist ({items.length})</p>
              <Button size="sm" variant="outline" onClick={abrirItem} className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Agregar ítem
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-continental-gray-1">Aún no hay ítems. Usa "Agregar ítem".</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                <div className="flex gap-2 text-xs font-semibold text-continental-gray-1">
                  <span className="w-6" />
                  <span className="flex-1">Ítem</span>
                  <span className="w-32">Costo estimado (MXN)</span>
                  <span className="w-12" />
                </div>
                {items.map((item, idx) => (
                  <div key={item.id ?? `nuevo-${idx}`} className="flex items-end gap-2 rounded-lg border border-continental-gray-3" style={{ padding: 8 }}>
                    <span className="pb-3 text-xs text-continental-gray-2 w-6 text-right">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Input
                        aria-label={`Ítem ${idx + 1}`}
                        value={item.pregunta}
                        onChange={(e) => actualizarItem(idx, { pregunta: e.target.value })}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        aria-label={`Costo del ítem ${idx + 1}`}
                        title="Costo estimado (MXN)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(item.costoEstimado)}
                        onChange={(e) => actualizarItem(idx, { costoEstimado: parseNumero(e.target.value) })}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Quitar ítem ${idx + 1}`}
                      title="Quitar ítem"
                      onClick={() => quitarItem(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {errorChecklist && (
          <Alert variant="destructive" style={{ marginTop: 12 }}>
            <AlertDescription>{errorChecklist}</AlertDescription>
          </Alert>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando} className="flex items-center gap-2">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
            {editId ? 'Guardar cambios' : 'Guardar checklist'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={itemAbierto} onClose={() => setItemAbierto(false)} title="Agregar ítem" size="md">
        <div className="flex flex-col gap-4">
          <Input
            ref={preguntaRef}
            label="Descripción del ítem"
            placeholder="Ej: Cambiar rueda delantera"
            value={nuevaPregunta}
            autoFocus
            onChange={(e) => {
              setNuevaPregunta(e.target.value);
              setErrorItem('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregarItem(false);
            }}
            error={errorItem}
          />
          <Input
            label="Costo estimado (MXN)"
            type="number"
            min={0}
            step="0.01"
            value={nuevoCosto}
            onChange={(e) => setNuevoCosto(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setItemAbierto(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => agregarItem(true)}>
            Agregar y capturar otro
          </Button>
          <Button onClick={() => agregarItem(false)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
