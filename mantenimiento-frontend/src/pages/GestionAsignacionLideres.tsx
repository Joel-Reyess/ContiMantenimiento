import { useEffect, useMemo, useState } from 'react';
import { UserCheck, Plus, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Modal,
  ModalFooter,
  Spinner,
  Select
} from '@/components/ui';
import { usuariosService, asignacionesService, catalogosService } from '@/services';
import type { LiderTipoVehiculoAsignacionDto, UserList } from '@/interfaces';

type RoleKey = 'Lider' | 'Supervisor';

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const matchesRole = (rolNombre: string | undefined, role: RoleKey) => {
  const norm = normalize(rolNombre);
  if (!norm) return role === 'Lider';
  if (role === 'Lider') return norm.includes('lider');
  return norm.includes('supervisor');
};

export function GestionAsignacionLideresPage() {
  const [asignaciones, setAsignaciones] = useState<LiderTipoVehiculoAsignacionDto[]>([]);
  const [lideres, setLideres] = useState<UserList[]>([]);
  const [supervisores, setSupervisores] = useState<UserList[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState<RoleKey>('Lider');
  const [crearOpen, setCrearOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);

  const [formRole, setFormRole] = useState<RoleKey>('Lider');
  const [form, setForm] = useState({ usuarioId: 0, tiposVehiculo: [] as number[] });
  const [editandoUsuarioId, setEditandoUsuarioId] = useState<number | null>(null);

  const usuariosPorId = useMemo(() => {
    const map = new Map<number, { nombreCompleto: string; rolNombre?: string }>();
    for (const u of lideres) map.set(u.id, { nombreCompleto: u.nombreCompleto, rolNombre: (u as any).rolNombre });
    for (const u of supervisores) map.set(u.id, { nombreCompleto: u.nombreCompleto, rolNombre: (u as any).rolNombre });
    return map;
  }, [lideres, supervisores]);

  const tiposPorId = useMemo(() => {
    return new Map(tiposVehiculo.map((t) => [t.id, t.nombre]));
  }, [tiposVehiculo]);

  const asignacionesAgrupadas = useMemo(() => {
    const map = new Map<
      number,
      {
        usuarioId: number;
        usuarioNombre: string;
        rolNombre?: string;
        items: LiderTipoVehiculoAsignacionDto[];
      }
    >();

    for (const asig of asignaciones) {
      const usuario = usuariosPorId.get(asig.usuarioId);
      const rolNombre = usuario?.rolNombre;
      if (!matchesRole(rolNombre, roleFilter)) continue;

      const entry = map.get(asig.usuarioId) || {
        usuarioId: asig.usuarioId,
        usuarioNombre: usuario?.nombreCompleto || asig.usuarioNombre,
        rolNombre,
        items: []
      };
      entry.items.push(asig);
      map.set(asig.usuarioId, entry);
    }

    return Array.from(map.values()).sort((a, b) => a.usuarioNombre.localeCompare(b.usuarioNombre));
  }, [asignaciones, usuariosPorId, roleFilter]);

  const asignacionesPorUsuario = useMemo(() => {
    const map = new Map<number, LiderTipoVehiculoAsignacionDto[]>();
    for (const asig of asignaciones) {
      const list = map.get(asig.usuarioId) || [];
      list.push(asig);
      map.set(asig.usuarioId, list);
    }
    return map;
  }, [asignaciones]);

  const assignedTipoIds = useMemo(() => {
    if (!form.usuarioId) return new Set<number>();
    const ids = asignaciones
      .filter((a) => a.usuarioId === form.usuarioId)
      .map((a) => Number(a.tipoVehiculo));
    return new Set(ids);
  }, [form.usuarioId, asignaciones]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [asignacionesRes, rolesRes, tiposRes] = await Promise.all([
        asignacionesService.getAll(),
        catalogosService.getRoles(),
        catalogosService.getTiposVehiculo()
      ]);

      if (asignacionesRes.success && asignacionesRes.data) {
        setAsignaciones(asignacionesRes.data);
      } else {
        setError(asignacionesRes.message || 'Error al cargar asignaciones');
      }

      if (tiposRes.success && tiposRes.data) {
        setTiposVehiculo(tiposRes.data);
      }

      const roles = rolesRes.success && rolesRes.data ? rolesRes.data : [];
      const liderRole = roles.find((r) => normalize(r.nombre).includes('lider'));
      const supervisorRole = roles.find((r) => normalize(r.nombre).includes('supervisor'));

      if (!liderRole || !supervisorRole) {
        setError('No se encontraron roles de lider o supervisor');
      }

      const [lideresRes, supervisoresRes] = await Promise.all([
        liderRole ? usuariosService.getAll({ pageSize: 200, rolId: liderRole.id, activo: true }) : Promise.resolve(null),
        supervisorRole ? usuariosService.getAll({ pageSize: 200, rolId: supervisorRole.id, activo: true }) : Promise.resolve(null)
      ]);

      if (lideresRes && lideresRes.success && lideresRes.data) {
        const data: any = lideresRes.data;
        setLideres(data.items || data.Items || []);
      }

      if (supervisoresRes && supervisoresRes.success && supervisoresRes.data) {
        const data: any = supervisoresRes.data;
        setSupervisores(data.items || data.Items || []);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (form.usuarioId === 0 || form.tiposVehiculo.length === 0) {
      setError('Seleccione un usuario y al menos un tipo de vehiculo');
      return;
    }

    setCreando(true);
    setError('');
    try {
      const actuales = asignacionesPorUsuario.get(form.usuarioId) || [];
      const actualesIds = new Set(actuales.map((a) => Number(a.tipoVehiculo)));
      const seleccionados = new Set(form.tiposVehiculo);

      const paraAgregar = form.tiposVehiculo.filter((id) => !actualesIds.has(id));
      const paraEliminar = actuales.filter((a) => !seleccionados.has(Number(a.tipoVehiculo)));

      if (paraAgregar.length > 0) {
        const payload = paraAgregar.map((tipoVehiculo) => ({
          usuarioId: form.usuarioId,
          tipoVehiculo
        }));
        const res = await asignacionesService.createBatch(payload);
        if (!res.success) {
          setError(res.message || 'No se pudo crear la asignacion');
          return;
        }
      }

      if (paraEliminar.length > 0) {
        await Promise.all(paraEliminar.map((a) => asignacionesService.delete(a.id)));
      }

      setCrearOpen(false);
      setEditandoUsuarioId(null);
      setForm({ usuarioId: 0, tiposVehiculo: [] });
      loadData();
    } catch (err) {
      console.error(err);
      setError('Error al crear la asignacion');
    } finally {
      setCreando(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Estas seguro de eliminar esta asignacion?')) return;
    setAccionando(true);
    try {
      await asignacionesService.delete(id);
      loadData();
    } catch (err) {
      setError('Error al eliminar');
    } finally {
      setAccionando(false);
    }
  };

  const openModal = (role: RoleKey, usuarioId?: number) => {
    if (usuarioId) {
      const actuales = asignacionesPorUsuario.get(usuarioId) || [];
      setFormRole(role);
      setForm({
        usuarioId,
        tiposVehiculo: actuales.map((a) => Number(a.tipoVehiculo))
      });
      setEditandoUsuarioId(usuarioId);
    } else {
      setFormRole(role);
      setForm({ usuarioId: 0, tiposVehiculo: [] });
      setEditandoUsuarioId(null);
    }
    setCrearOpen(true);
  };

  const usuariosForm = formRole === 'Supervisor' ? supervisores : lideres;

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuracion</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-continental-black">Asignacion de responsables</h1>
            <p className="text-continental-gray-1">Asigna multiples tipos de vehiculo a lideres y supervisores.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => openModal(roleFilter)}>
              <Plus className="h-4 w-4" />
              Nueva asignacion
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={roleFilter === 'Lider' ? 'default' : 'outline'}
          onClick={() => setRoleFilter('Lider')}
        >
          Lideres
        </Button>
        <Button
          variant={roleFilter === 'Supervisor' ? 'default' : 'outline'}
          onClick={() => setRoleFilter('Supervisor')}
        >
          Supervisores
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : asignacionesAgrupadas.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay asignaciones registradas</p>
          <Button className="bg-continental-gradient text-white" onClick={() => openModal(roleFilter)}>
            Crear asignacion
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {asignacionesAgrupadas.map((grupo) => (
            <Card key={grupo.usuarioId} className="px-6 py-5 border-l-4 border-continental-orange">
              <div className="flex items-start gap-3 justify-between">
                <div className="flex gap-3">
                  <UserCheck className="h-5 w-5 text-continental-orange mt-0.5" />
                  <div>
                    <p className="font-semibold text-continental-black">{grupo.usuarioNombre}</p>
                    {grupo.rolNombre && (
                      <p className="text-xs text-continental-gray-2">Rol: {grupo.rolNombre}</p>
                    )}
                    <div className="mt-2 space-y-2">
                      {grupo.items.map((asig) => (
                        <div key={asig.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-continental-gray-1">
                            {tiposPorId.get(Number(asig.tipoVehiculo)) || asig.tipoVehiculoNombre}
                          </span>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDelete(asig.id)}
                            disabled={accionando}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-continental-gray-2 mt-3">
                      Asignadas: {grupo.items.length}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => openModal(roleFilter, grupo.usuarioId)}
                    >
                      Editar asignaciones
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={crearOpen}
        onClose={() => setCrearOpen(false)}
        title={editandoUsuarioId ? 'Editar asignaciones' : 'Nueva asignacion'}
        description="Selecciona un usuario y varios tipos de vehiculo."
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={formRole === 'Lider' ? 'default' : 'outline'}
              onClick={() => {
                setFormRole('Lider');
                setForm({ usuarioId: 0, tiposVehiculo: [] });
                setEditandoUsuarioId(null);
              }}
            >
              Lideres
            </Button>
            <Button
              variant={formRole === 'Supervisor' ? 'default' : 'outline'}
              onClick={() => {
                setFormRole('Supervisor');
                setForm({ usuarioId: 0, tiposVehiculo: [] });
                setEditandoUsuarioId(null);
              }}
            >
              Supervisores
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Usuario</label>
            <Select
              value={String(form.usuarioId)}
              onChange={(v) => setForm((prev) => ({ ...prev, usuarioId: Number(v), tiposVehiculo: [] }))}
              options={[
                { value: '0', label: 'Seleccione un usuario' },
                ...usuariosForm.map((u) => ({ value: String(u.id), label: u.nombreCompleto }))
              ]}
              disabled={editandoUsuarioId !== null}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipos de vehiculo</label>
            <div className="flex flex-wrap gap-2">
              {tiposVehiculo.map((t) => {
                const isAssigned = assignedTipoIds.has(t.id);
                const checked = form.tiposVehiculo.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      checked ? 'border-continental-orange bg-continental-orange/10' : 'border-continental-gray-3'
                    } ${isAssigned && !checked ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={isAssigned}
                      checked={checked}
                      onChange={() =>
                        setForm((prev) => {
                          if (prev.tiposVehiculo.includes(t.id)) {
                            return { ...prev, tiposVehiculo: prev.tiposVehiculo.filter((x) => x !== t.id) };
                          }
                          return { ...prev, tiposVehiculo: [...prev.tiposVehiculo, t.id] };
                        })
                      }
                      className="hidden"
                    />
                    <span className={isAssigned && !checked ? 'text-continental-gray-2' : undefined}>
                      {t.nombre} {isAssigned ? '(asignado)' : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCrearOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={creando}>
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
