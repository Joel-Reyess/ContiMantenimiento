import { useEffect, useState } from 'react';
import { Users, RefreshCcw, Plus, Loader2, Key, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Modal,
  ModalFooter
} from '@/components/ui';
import { usuariosService } from '@/services/usuariosService';
import { catalogosService } from '@/services/catalogosService';
import type { UserList, UserCreateRequest, UserUpdateRequest } from '@/interfaces';
import { useAuth } from '@/contexts/AuthContext';

const estadoOpciones = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' }
];

export function UsuariosPage() {
  const { hasRole, user } = useAuth();
  const [usuarios, setUsuarios] = useState<UserList[]>([]);
  const [roles, setRoles] = useState<{ id: number; nombre: string }[]>([]);
  const [areas, setAreas] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [activo, setActivo] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [editUser, setEditUser] = useState<UserList | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<Partial<UserCreateRequest & UserUpdateRequest>>({
    nombreCompleto: '',
    username: '',
    password: '',
    rolId: 0,
    areaId: undefined,
    email: '',
    telefono: ''
  });

  const isAdmin = hasRole(['Administrador', 'SuperUsuario', 'Superusuario']);

  const loadUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const filtros = {
        busqueda: busqueda || undefined,
        activo: activo ? activo === 'true' : undefined,
        page: 1,
        pageSize: 100
      };

      const res = await usuariosService.getAll(filtros);
      const dataUsuarios: any = res.data;
      const listaBase: UserList[] = res.success && dataUsuarios
        ? (Array.isArray(dataUsuarios)
            ? dataUsuarios
            : dataUsuarios.items || dataUsuarios.Items || [])
        : [];

      setUsuarios(listaBase);
      if (!res.success) setError(res.message || 'No se pudieron cargar usuarios');
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de usuarios');
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
    catalogosService.getRoles().then((r) => {
      if (r.success && r.data) {
        // Agregar el rol "Lider" si no existe en la lista de roles
        const rolesData = r.data.map((x) => ({ id: x.id, nombre: x.nombre }));
        const hasLiderRole = rolesData.some(role => role.nombre === 'Lider');
        if (!hasLiderRole) {
          rolesData.push({ id: 6, nombre: 'Lider' });
        }
        setRoles(rolesData);
      }
    });
    catalogosService.getAreas().then((r) => {
      if (r.success && r.data) setAreas(r.data.map((a) => ({ id: a.id, nombre: a.nombre })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActivo = async (id: number, estaActivo: boolean) => {
    setAccionando(true);
    setError('');
    try {
      if (estaActivo) {
        await usuariosService.desactivar(id);
      } else {
        await usuariosService.activar(id);
      }
      await loadUsuarios();
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del usuario');
    } finally {
      setAccionando(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas restablecer la contraseña de este usuario?')) return;
    
    setAccionando(true);
    setError('');
    try {
      const res = await usuariosService.resetPassword(id);
      if (res.success && res.data) {
        const temporal = (res.data as any).passwordTemporal || (res.data as any).PasswordTemporal || '';
        setTempPassword(temporal);
        setPasswordModalOpen(true);
      } else {
        setError(res.message || 'No se pudo restablecer la contraseña');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor');
    } finally {
      setAccionando(false);
    }
  };

  const openCreate = () => {
    setEditUser(null);
    setShowPassword(false);
    setForm({
      nombreCompleto: '',
      username: '',
      password: '',
      rolId: roles[0]?.id || 0,
      areaId: undefined,
      email: '',
      telefono: ''
    });
    setModalOpen(true);
  };

  const openEdit = (u: UserList) => {
    setEditUser(u);
    setShowPassword(false);
    setForm({
      nombreCompleto: u.nombreCompleto,
      username: u.username,
      password: '',
      rolId: roles.find((r) => r.nombre === u.rolNombre)?.id || 0,
      areaId: (u as any).areaId,
      email: (u as any).email,
      telefono: (u as any).telefono
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (!form.nombreCompleto || !form.username || (!editUser && !form.password)) {
        setError('Nombre, usuario y contraseña (solo al crear) son requeridos');
        return;
      }
      if (!editUser && form.password && form.password.length < 6) {
        setError('La contrasena debe tener al menos 6 caracteres');
        return;
      }
      if (editUser && form.password && form.password.length < 6) {
        setError('La nueva contrasena debe tener al menos 6 caracteres');
        return;
      }
      if (editUser) {
        const payload: UserUpdateRequest = {
          nombreCompleto: form.nombreCompleto,
          email: form.email,
          telefono: form.telefono,
          rolId: form.rolId,
          areaId: form.areaId,
          password: form.password?.trim() ? form.password : undefined
        };
        const res = await usuariosService.update(editUser.id, payload);
        if (!res.success) throw new Error(res.message || 'No se pudo actualizar');
      } else {
        const payload: UserCreateRequest = {
          nombreCompleto: form.nombreCompleto!,
          username: form.username!,
          password: form.password!,
          rolId: form.rolId || 0,
          areaId: form.areaId,
          email: form.email,
          telefono: form.telefono,
          numeroEmpleado: (form as any).numeroEmpleado
        };
        const res = await usuariosService.create(payload);
        if (!res.success) throw new Error(res.message || 'No se pudo crear');
      }
      setModalOpen(false);
      await loadUsuarios();
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    if (user?.id === id) {
      setError('No puedes eliminar tu propio usuario.');
      return;
    }
    const confirmed = window.confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    setAccionando(true);
    setError('');
    try {
      const res = await usuariosService.delete(id);
      if (!res.success) throw new Error(res.message || 'No se pudo eliminar el usuario');
      await loadUsuarios();
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar el usuario');
    } finally {
      setAccionando(false);
    }
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Usuarios</p>
          <h1 className="text-3xl font-semibold text-continental-black">Gestion de usuarios</h1>
          <p className="text-continental-gray-1">Listado basico de roles y estado.</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre o numero"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Select options={estadoOpciones} value={activo} onChange={(value) => setActivo(value)} />
          <Button variant="outline" onClick={loadUsuarios} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={openCreate} className="flex items-center gap-2 bg-continental-gradient text-white">
            <Plus className="h-4 w-4" />
            Nuevo
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
      ) : usuarios.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay usuarios</p>
          <p className="text-continental-gray-1">Aun no se han registrado usuarios.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={loadUsuarios} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => (
            <Card key={u.id} className="px-8 py-7 border-l-4 border-continental-blue">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-continental-blue" />
                    <p className="font-semibold text-continental-black">{u.nombreCompleto || u.username}</p>
                  </div>
                  <p className="text-sm text-continental-gray-1">
                    Rol: {u.rolNombre || 'Sin rol'} • Area: {u.areaNombre || 'Sin area'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleResetPassword(u.id)} title="Restablecer contraseña" disabled={accionando}>
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                    Editar
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      disabled={accionando}
                      onClick={() => handleDelete(u.id)}
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Badge variant={u.activo ? 'default' : 'outline'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  <Button size="sm" variant="secondary" disabled={accionando} onClick={() => toggleActivo(u.id, !!u.activo)}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditUser(null);
          setShowPassword(false);
        }}
        title={editUser ? 'Editar usuario' : 'Nuevo usuario'}
        description="Completa los datos del usuario y asigna su rol."
      >
        <div className="space-y-3">
          <Input label="Nombre completo" value={form.nombreCompleto || ''} onChange={(e) => setForm((p) => ({ ...p, nombreCompleto: e.target.value }))} />
          <Input label="Usuario" value={form.username || ''} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} disabled={!!editUser} />
          <div className="relative">
            <Input
              label={editUser ? 'Nueva contrasena (opcional)' : 'Contrasena'}
              type={showPassword ? 'text' : 'password'}
              value={form.password || ''}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder={editUser ? 'Dejar vacio para no cambiarla' : undefined}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-continental-gray-1 hover:text-continental-black"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Select
            label="Rol"
            value={form.rolId ? String(form.rolId) : ''}
            onChange={(v) => setForm((p) => ({ ...p, rolId: v ? Number(v) : undefined }))}
            options={roles.map((r) => ({ value: String(r.id), label: r.nombre }))}
          />
          <Select
            label="Area (opcional)"
            value={form.areaId ? String(form.areaId) : ''}
            onChange={(v) => setForm((p) => ({ ...p, areaId: v ? Number(v) : undefined }))}
            options={[{ value: '', label: 'Sin area' }, ...areas.map((a) => ({ value: String(a.id), label: a.nombre }))]}
          />
          <Input label="Email" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Telefono" value={form.telefono || ''} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Contraseña Restablecida"
        description="Comparte esta contraseña temporal con el usuario. No podrás verla nuevamente."
      >
        <div className="p-4 bg-gray-100 rounded text-center my-4">
          <p className="text-xl font-mono font-bold select-all text-continental-black">{tempPassword}</p>
        </div>
        <ModalFooter>
          <Button onClick={() => setPasswordModalOpen(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
