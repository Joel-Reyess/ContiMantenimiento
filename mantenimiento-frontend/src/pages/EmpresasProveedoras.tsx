import { useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Power, RefreshCcw, Save, Trash2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalFooter,
  SearchInput,
  Select,
  Spinner,
  useConfirm,
  useToast
} from '@/components/ui';
import { empresasService, type Empresa, type EmpresaRequest } from '@/services/empresasService';
import { VolverConfiguracion } from '@/components/configuracion/VolverConfiguracion';

type CampoError = 'nombre' | 'identificador' | 'email' | 'general';

const FORM_VACIO: EmpresaRequest = { nombre: '', identificador: '', activo: true, contacto: '', telefono: '', email: '' };

const estadoOpciones = [
  { value: '', label: 'Todas' },
  { value: 'activas', label: 'Activas' },
  { value: 'inactivas', label: 'Inactivas' }
];

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Empresas proveedoras (PDF 06-nov, CFG-07): varias empresas hacen las mismas reparaciones con precios distintos.
 * Cada técnico pertenece a una (Usuarios) y sus tarifas se capturan en Configuración → Checklists.
 */
export function EmpresasProveedorasPage() {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [accionando, setAccionando] = useState(false);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [form, setForm] = useState<EmpresaRequest>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<CampoError, string>>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await empresasService.getAll();
      if (!res.success) throw new Error(res.message || 'No se pudieron cargar las empresas');
      setEmpresas(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const texto = sinAcentos(busqueda.trim());
  const visibles = empresas.filter(
    (e) =>
      (estado === '' || (estado === 'activas' ? e.activo : !e.activo)) &&
      (!texto || sinAcentos(`${e.nombre} ${e.identificador} ${e.contacto || ''}`).includes(texto))
  );

  const campo = (nombre: CampoError, cambios: Partial<EmpresaRequest>) => {
    setForm((f) => ({ ...f, ...cambios }));
    if (errores[nombre] || errores.general) setErrores((e) => ({ ...e, [nombre]: undefined, general: undefined }));
  };

  const abrirNueva = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrores({});
    setAbierto(true);
  };

  const abrirEditar = (e: Empresa) => {
    setEditando(e);
    setForm({
      nombre: e.nombre,
      identificador: e.identificador,
      activo: e.activo,
      contacto: e.contacto || '',
      telefono: e.telefono || '',
      email: e.email || ''
    });
    setErrores({});
    setAbierto(true);
  };

  const guardar = async () => {
    const e: Partial<Record<CampoError, string>> = {};
    if (!form.nombre.trim()) e.nombre = 'Escribe el nombre de la empresa.';
    if (!form.identificador.trim()) e.identificador = 'Escribe el RFC o identificador de la empresa.';
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'El correo no tiene un formato válido.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    try {
      const payload: EmpresaRequest = {
        nombre: form.nombre.trim(),
        identificador: form.identificador.trim(),
        activo: form.activo,
        contacto: form.contacto?.trim() || undefined,
        telefono: form.telefono?.trim() || undefined,
        email: form.email?.trim() || undefined
      };
      const res = editando ? await empresasService.update(editando.id, payload) : await empresasService.create(payload);
      if (!res.success) {
        const msg = res.message || 'No se pudo guardar la empresa';
        // El duplicado va bajo su campo
        if (/identificador/i.test(msg)) setErrores({ identificador: msg });
        else if (/ya existe la empresa/i.test(msg)) setErrores({ nombre: msg });
        else setErrores({ general: msg });
        return;
      }
      toast.exito(res.message || 'Empresa guardada');
      setAbierto(false);
      await cargar();
    } catch (err) {
      console.error(err);
      setErrores({ general: 'Error al guardar la empresa. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (e: Empresa) => {
    if (e.activo) {
      const ok = await confirmar({
        titulo: `Desactivar ${e.nombre}`,
        mensaje: (
          <div className="flex flex-col gap-2">
            <p>Ya no se podrá asignar a técnicos nuevos.</p>
            {e.tecnicos > 0 && (
              <p>
                Sus {e.tecnicos} técnico(s) siguen ligados a la empresa y sus órdenes de pago se siguen calculando con sus tarifas.
                Cámbialos de empresa en Usuarios si ya no trabajan con ella.
              </p>
            )}
          </div>
        ),
        textoConfirmar: 'Desactivar',
        tono: 'advertencia'
      });
      if (!ok) return;
    }
    setAccionando(true);
    try {
      const res = await empresasService.update(e.id, {
        nombre: e.nombre,
        identificador: e.identificador,
        activo: !e.activo,
        contacto: e.contacto,
        telefono: e.telefono,
        email: e.email
      });
      if (!res.success) {
        toast.error(res.message || 'No se pudo cambiar el estado de la empresa');
        return;
      }
      toast.exito(e.activo ? `${e.nombre} desactivada` : `${e.nombre} activada`);
      await cargar();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cambiar el estado de la empresa');
    } finally {
      setAccionando(false);
    }
  };

  const eliminar = async (e: Empresa) => {
    if (e.tecnicos > 0 || e.ordenesPago > 0) {
      toast.aviso(
        `${e.nombre} tiene ${[e.tecnicos > 0 ? `${e.tecnicos} técnico(s)` : '', e.ordenesPago > 0 ? `${e.ordenesPago} orden(es) de pago` : '']
          .filter(Boolean)
          .join(' y ')}. Desactívala en lugar de eliminarla para conservar el historial.`
      );
      return;
    }
    const ok = await confirmar({
      titulo: `Eliminar ${e.nombre}`,
      mensaje: `Se eliminará la empresa${e.tarifas > 0 ? ` con sus ${e.tarifas} tarifa(s)` : ''}. Esta acción no se puede deshacer y quedará en la bitácora.`,
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    setAccionando(true);
    try {
      const res = await empresasService.delete(e.id);
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar la empresa');
        return;
      }
      toast.exito(res.message || `Empresa ${e.nombre} eliminada`);
      await cargar();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar la empresa');
    } finally {
      setAccionando(false);
    }
  };

  // Espacios con gap: index.css anula los márgenes de space-y-* con `* { margin: 0 }`
  return (
    <div className="dashboard-wrapper flex flex-col gap-4">
      <VolverConfiguracion />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuración</p>
          <h1 className="text-3xl font-semibold text-continental-black">Empresas proveedoras</h1>
          <p className="text-continental-gray-1">
            Empresas que hacen las reparaciones. Cada técnico pertenece a una y sus órdenes de pago usan las tarifas de esa empresa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void cargar()} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={abrirNueva} className="flex items-center gap-2 bg-continental-gradient text-white">
            <Plus className="h-4 w-4" />
            Nueva empresa
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div style={{ width: 320, maxWidth: '100%' }}>
          <SearchInput
            placeholder="Buscar por nombre, RFC o contacto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div style={{ width: 180 }}>
          <Select aria-label="Estado" options={estadoOpciones} value={estado} onChange={setEstado} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : empresas.length === 0 ? (
        <Card className="text-center flex flex-col gap-2">
          <p className="text-lg font-semibold text-continental-black">No hay empresas proveedoras</p>
          <p className="text-continental-gray-1">Registra la primera con "Nueva empresa". Los técnicos sin empresa usan la tarifa base.</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card className="text-center">
          <p className="text-continental-gray-1">Ninguna empresa coincide con la búsqueda.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="lista-empresas">
          {visibles.map((e) => (
            <Card key={e.id} className={`border-l-4 flex flex-col gap-3 ${e.activo ? 'border-continental-blue' : 'border-continental-gray-3'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-continental-blue" />
                    <p className="font-semibold text-continental-black break-words">{e.nombre}</p>
                  </div>
                  <p className="text-sm text-continental-gray-1">RFC / ID: {e.identificador}</p>
                </div>
                <Badge variant={e.activo ? 'success' : 'cancelada'}>{e.activo ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              {(e.contacto || e.telefono || e.email) && (
                <p className="text-sm text-continental-gray-1 break-words">
                  {[e.contacto, e.telefono, e.email].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-xs text-continental-gray-2">
                {e.tecnicos} técnico(s) · {e.ordenesPago} orden(es) de pago · {e.tarifas} actividad(es) con tarifa propia
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => abrirEditar(e)} className="flex items-center gap-1">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void cambiarEstado(e)} disabled={accionando} className="flex items-center gap-1">
                  <Power className="h-4 w-4" />
                  {e.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void eliminar(e)}
                  disabled={accionando}
                  aria-label={`Eliminar ${e.nombre}`}
                  title="Eliminar empresa"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={abierto}
        onClose={() => !guardando && setAbierto(false)}
        title={editando ? `Editar ${editando.nombre}` : 'Nueva empresa proveedora'}
        description="Las actividades son las mismas para todas las empresas; solo cambian sus tarifas (Configuración → Checklists)."
        size="lg"
      >
        <div className="flex flex-col gap-3">
          {errores.general && (
            <Alert variant="destructive">
              <AlertDescription>{errores.general}</AlertDescription>
            </Alert>
          )}
          <Input
            label="Nombre de la empresa"
            value={form.nombre}
            onChange={(e) => campo('nombre', { nombre: e.target.value })}
            error={errores.nombre}
            maxLength={150}
            autoFocus
          />
          <Input
            label="RFC o identificador único"
            value={form.identificador}
            onChange={(e) => campo('identificador', { identificador: e.target.value.toUpperCase() })}
            error={errores.identificador}
            hint="No se puede repetir entre empresas."
            maxLength={30}
          />
          <Select
            label="Estado"
            value={form.activo ? 'activa' : 'inactiva'}
            onChange={(v) => campo('general', { activo: v === 'activa' })}
            options={[
              { value: 'activa', label: 'Activa' },
              { value: 'inactiva', label: 'Inactiva (no se asigna a técnicos nuevos)' }
            ]}
          />
          <p className="text-sm font-semibold text-continental-black">Contacto (opcional)</p>
          <Input label="Nombre del contacto" value={form.contacto || ''} onChange={(e) => campo('general', { contacto: e.target.value })} maxLength={100} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Teléfono" value={form.telefono || ''} onChange={(e) => campo('general', { telefono: e.target.value })} maxLength={20} />
            <Input
              label="Correo"
              type="email"
              value={form.email || ''}
              onChange={(e) => campo('email', { email: e.target.value })}
              error={errores.email}
              maxLength={100}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando} className="flex items-center gap-2">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editando ? 'Guardar cambios' : 'Registrar empresa'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
