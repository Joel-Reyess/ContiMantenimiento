import { useEffect, useState } from 'react';
import { Settings, Plus, Loader2, RefreshCcw, ToggleLeft, ToggleRight, Package } from 'lucide-react';
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
  Spinner,
  Textarea,
  Select
} from '@/components/ui';
import { catalogosService, vehiculoPrefijoConfigsService } from '@/services';
import type { VehiculoPrefijoConfig } from '@/interfaces';

interface CrearPrefijoForm {
  prefijoCodigo: string;
  tipoVehiculoId: number;
  descripcion?: string;
}

export function GestionVehiculosPrefijosPage() {
  const [activeTab, setActiveTab] = useState<'prefijos'>('prefijos');
  const [prefijos, setPrefijos] = useState<VehiculoPrefijoConfig[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [crearOpen, setCrearOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [prefijoEdit, setPrefijoEdit] = useState<VehiculoPrefijoConfig | null>(null);
  const [form, setForm] = useState<CrearPrefijoForm>({ prefijoCodigo: '', tipoVehiculoId: 0 });
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [debouncedFiltro, setDebouncedFiltro] = useState(filtroBusqueda);

  // Efecto para debouncing de la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFiltro(filtroBusqueda);
    }, 500);

    return () => clearTimeout(timer);
  }, [filtroBusqueda]);

  const loadPrefijos = async () => {
    setLoading(true);
    setError('');
    try {
      // Se limita a 10 resultados por página para mejorar el rendimiento
      const res = await vehiculoPrefijoConfigsService.getAll({ 
        busqueda: debouncedFiltro,
        pageSize: 10
      });
      if (res.success && res.data) {
        setPrefijos(res.data.items || []);
      } else {
        setPrefijos([]);
        setError(res.message || 'No se pudieron cargar los prefijos');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de prefijos de vehículos');
      setPrefijos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTiposVehiculo = async () => {
    try {
      const res = await catalogosService.getTiposVehiculo();
      if (res.success && res.data) {
        setTiposVehiculo(res.data);
        // Preselecciona el primer tipo disponible para evitar enviar 0
        if (form.tipoVehiculoId === 0 && res.data.length > 0) {
          setForm((prev) => ({ ...prev, tipoVehiculoId: res.data![0].id }));
        }
      } else setTiposVehiculo([]);
    } catch (err) {
      console.error('No se pudieron cargar tipos de vehículo', err);
      setTiposVehiculo([]);
    }
  };

  useEffect(() => {
    loadPrefijos();
    // Solo cargamos tipos de vehiculo una vez al inicio o cuando cambie algo relevante, 
    // no necesariamente con cada búsqueda, pero lo mantenemos aquí por si acaso.
    // Optimización: loadTiposVehiculo se puede mover a un useEffect separado que solo corra una vez.
  }, [debouncedFiltro]);

  useEffect(() => {
    loadTiposVehiculo();
  }, []);

  const handleCreate = async () => {
    setCreando(true);
    setError('');
    try {
      const payload = {
        prefijoCodigo: form.prefijoCodigo.trim(),
        tipoVehiculoId: form.tipoVehiculoId,
        descripcion: form.descripcion?.trim(),
        activo: true
      };
      const res = await vehiculoPrefijoConfigsService.create(payload);
      if (res.success) {
        setCrearOpen(false);
        setForm({ prefijoCodigo: '', tipoVehiculoId: 0 });
        loadPrefijos();
      } else {
        setError(res.message || 'No se pudo crear el prefijo');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear el prefijo');
    } finally {
      setCreando(false);
    }
  };

  const handleUpdate = async () => {
    if (!prefijoEdit) return;
    setEditando(true);
    setError('');
    try {
      const payload = {
        prefijoCodigo: prefijoEdit.prefijoCodigo.trim(),
        tipoVehiculoId: prefijoEdit.tipoVehiculoId,
        descripcion: prefijoEdit.descripcion?.trim(),
        activo: prefijoEdit.activo
      };
      const res = await vehiculoPrefijoConfigsService.update(prefijoEdit.id, payload);
      if (res.success) {
        setEditarOpen(false);
        setPrefijoEdit(null);
        loadPrefijos();
      } else {
        setError(res.message || 'No se pudo actualizar el prefijo');
      }
    } catch (err) {
      console.error(err);
      setError('Error al actualizar el prefijo');
    } finally {
      setEditando(false);
    }
  };

  const toggleActivo = async (prefijo: VehiculoPrefijoConfig) => {
    setAccionando(true);
    setError('');
    try {
      await vehiculoPrefijoConfigsService.update(prefijo.id, { activo: !prefijo.activo });
      loadPrefijos();
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del prefijo');
    } finally {
      setAccionando(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este prefijo? Esta acción no se puede deshacer.')) return;
    setAccionando(true);
    setError('');
    try {
      await vehiculoPrefijoConfigsService.delete(id);
      loadPrefijos();
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el prefijo');
    } finally {
      setAccionando(false);
    }
  };

  const tipoVehiculoNombre = (tipoId: number) => {
    const tipo = tiposVehiculo.find(tv => tv.id === tipoId);
    return tipo ? tipo.nombre : 'Desconocido';
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuracion</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-continental-black">Gestion de prefijos de vehiculos</h1>
            <p className="text-continental-gray-1">Administra las configuraciones de prefijos para autodeteccion de tipos de vehiculo.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPrefijos} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo prefijo
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

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant={activeTab === "prefijos" ? "default" : "outline"} onClick={() => setActiveTab("prefijos")}>
          Prefijos de Vehiculos
        </Button>
      </div>

      {activeTab === "prefijos" && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-continental-yellow" />
            <h2 className="text-xl font-semibold text-continental-black">Configuracion de Prefijos</h2>
          </div>
          <div className="flex gap-3 mb-4">
            <Input
              placeholder="Buscar por prefijo o tipo de vehículo..."
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
              className="max-w-md"
            />
          </div>
          {loading ? (
            <Spinner />
          ) : prefijos.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay Prefijos Configurados</p>
              <p className="text-continental-gray-1">Aun no se han registrado configuraciones de prefijos para vehículos.</p>
              <div className="flex justify-center gap-2">
                <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Crear Prefijo
                </Button>
                <Button variant="outline" onClick={loadPrefijos}>
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {prefijos.map((prefijo) => (
                <Card key={prefijo.id} className="px-6 py-5 border-l-4 border-continental-blue h-full flex flex-col justify-between">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3 min-w-0">
                      <Package className="h-5 w-5 text-continental-blue mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-continental-black break-words">{prefijo.prefijoCodigo}</p>
                        <p className="text-sm text-continental-gray-1">
                          Tipo: {tipoVehiculoNombre(prefijo.tipoVehiculoId)} ({prefijo.tipoVehiculoId})
                        </p>
                        {prefijo.descripcion && <p className="text-sm text-continental-gray-1 line-clamp-2 break-words">{prefijo.descripcion}</p>}
                        <p className="text-xs text-continental-gray-2 mt-1">
                          Creado: {new Date(prefijo.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                      <Badge variant={prefijo.activo ? 'default' : 'outline'}>{prefijo.activo ? 'Activo' : 'Inactivo'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => {
                        setPrefijoEdit(prefijo);
                        setEditarOpen(true);
                      }} disabled={accionando}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={accionando}
                        onClick={() => toggleActivo(prefijo)}
                        className="flex items-center gap-1 px-2 text-xs"
                      >
                        {prefijo.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {prefijo.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="destructive" onClick={() => handleEliminar(prefijo.id)} disabled={accionando}>
                      Eliminar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={crearOpen} onClose={() => setCrearOpen(false)} title="Nuevo prefijo de vehiculo" description="Crear una nueva configuracion de prefijo para autodeteccion de tipo de vehiculo.">
        <div className="space-y-3">
          <Input
            label="Prefijo de codigo"
            placeholder="Ej: MTC, TGR, CAR, 123..."
            value={form.prefijoCodigo}
            onChange={(e) => setForm((prev) => ({ ...prev, prefijoCodigo: e.target.value }))}
          />
          <Select
            label="Tipo de vehiculo"
            value={String(form.tipoVehiculoId)}
            onChange={(v) => setForm((prev) => ({ ...prev, tipoVehiculoId: Number(v) }))}
            options={tiposVehiculo.map((tv) => ({ value: String(tv.id), label: tv.nombre }))}
          />
          <Textarea
            label="Descripcion (opcional)"
            placeholder="Descripcion del prefijo..."
            value={form.descripcion || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCrearOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creando} className="flex items-center gap-2">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={editarOpen} onClose={() => {
        setEditarOpen(false);
        setPrefijoEdit(null);
      }} title="Editar prefijo de vehiculo" description="Actualizar la configuracion del prefijo.">
        {prefijoEdit && (
          <div className="space-y-3">
            <Input
              label="Prefijo de codigo"
              placeholder="Ej: MTC, TGR, CAR..."
              value={prefijoEdit.prefijoCodigo}
              onChange={(e) => setPrefijoEdit((prev) => ({ ...prev!, prefijoCodigo: e.target.value }))}
            />
            <Select
              label="Tipo de vehiculo"
              value={String(prefijoEdit.tipoVehiculoId)}
              onChange={(v) => setPrefijoEdit((prev) => ({ ...prev!, tipoVehiculoId: Number(v) }))}
              options={tiposVehiculo.map((tv) => ({ value: String(tv.id), label: tv.nombre }))}
            />
            <Textarea
              label="Descripcion (opcional)"
              placeholder="Descripcion del prefijo..."
              value={prefijoEdit.descripcion || ''}
              onChange={(e) => setPrefijoEdit((prev) => ({ ...prev!, descripcion: e.target.value }))}
            />
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => {
            setEditarOpen(false);
            setPrefijoEdit(null);
          }}>
            Cancelar
          </Button>
          <Button onClick={handleUpdate} disabled={editando} className="flex items-center gap-2">
            {editando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Actualizar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
