import { useEffect, useState } from 'react';
import { Settings, Plus, Loader2, RefreshCcw, ToggleLeft, ToggleRight, ListChecks, ClipboardPlus, Trash2, Package, Users, AlertTriangle, Calendar, FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFullImageUrl } from '@/lib/utils';
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
import { catalogosService, usuariosService, checklistService, adminService, dashboardService } from '@/services';
import { vehiculosService } from '@/services/vehiculosService';
import type { Area } from '@/interfaces';
import type { TipoVehiculoItem } from '@/services/catalogosService';
import type { ChecklistTemplate } from '@/services/checklistService';
import { useAllowedTipoVehiculo } from '@/hooks/useAllowedTipoVehiculo';
import { useAuth } from '@/contexts/AuthContext';

interface CrearAreaForm {
  nombre: string;
  codigo: string;
  descripcion: string;
}

interface ChecklistItemDraft {
  id?: number;
  orden: number;
  pregunta: string;
  tipoRespuesta: number;
  opciones?: string;
  obligatorio?: boolean;
  requiereFoto?: boolean;
  costoEstimado?: number;
}

interface PreventivoConfigDraft {
  frecuenciaPreventivoMeses?: number;
}

interface ProgramacionPreventiva {
  vehiculoId: number;
  vehiculoCodigo: string;
  tipoVehiculo: string;
  ultimaFecha?: string;
  proximaFecha: string;
  diasRestantes: number;
  estado: string;
}

export function ConfiguracionPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'areas' | 'checklists' | 'tipos' | 'preventivos'>('areas');
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<TipoVehiculoItem[]>([]);
  const [preventivoDraft, setPreventivoDraft] = useState<Record<number, PreventivoConfigDraft>>({});
  const [savingPreventivoId, setSavingPreventivoId] = useState<number | null>(null);
  const [programacionPreventiva, setProgramacionPreventiva] = useState<ProgramacionPreventiva[]>([]);
  const [loadingProgramacion, setLoadingProgramacion] = useState(false);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [editingTipo, setEditingTipo] = useState<Partial<TipoVehiculoItem> | null>(null); // Changed to Partial for creation
  const [isCreatingTipo, setIsCreatingTipo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [supervisores, setSupervisores] = useState<{ id: number; nombre: string }[]>([]);
  const [plantillas, setPlantillas] = useState<ChecklistTemplate[]>([]);
  const [vehiculos, setVehiculos] = useState<{ id: number; codigo: string; tipo?: string; area?: string }[]>([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<number, number | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [crearOpen, setCrearOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [areaSeleccionada, setAreaSeleccionada] = useState<Area | null>(null);
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [form, setForm] = useState<CrearAreaForm>({ nombre: '', codigo: '', descripcion: '' });
  const [crearChecklistOpen, setCrearChecklistOpen] = useState(false);
  const [creandoChecklist, setCreandoChecklist] = useState(false);
  const [tplNombre, setTplNombre] = useState('');
  const [tplDescripcion, setTplDescripcion] = useState('');
  const [tplTipoVehiculo, setTplTipoVehiculo] = useState('');
  const [tplTipoMantenimiento, setTplTipoMantenimiento] = useState('');
  const [tplEditId, setTplEditId] = useState<number | null>(null);
  const [itemsDraft, setItemsDraft] = useState<ChecklistItemDraft[]>([]);
  const { filterVehiculos } = useAllowedTipoVehiculo();
  const [nuevoItem, setNuevoItem] = useState<ChecklistItemDraft>({
    orden: 1,
    pregunta: '',
    tipoRespuesta: 1,
    opciones: '',
    obligatorio: true,
    requiereFoto: false,
    costoEstimado: 0
  });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const canReset = hasRole(['Administrador', 'SuperUsuario', 'Superusuario']);

  const navigate = useNavigate();
  const location = useLocation();

  const parseNumero = (val: string | number | undefined) => {
    if (val === undefined || val === null) return 0;
    const num = Number(String(val).replace(',', '.'));
    return Number.isNaN(num) ? 0 : num;
  };

  const calcularCuotaSemanalFallback = (totalVehiculos: number, frecuenciaMeses?: number, frecuenciaDias?: number) => {
    if (totalVehiculos <= 0) return 0;
    const semanasCiclo =
      (frecuenciaMeses ?? 0) > 0
        ? Number(frecuenciaMeses) * 4.345
        : Math.max(1, Number(frecuenciaDias ?? 0) / 7);
    const cuota = Math.ceil(totalVehiculos / semanasCiclo);
    return Math.max(1, Math.min(cuota, totalVehiculos));
  };

  const buildProgramacionFallback = (tipos: TipoVehiculoItem[]): ProgramacionPreventiva[] => {
    const hoy = new Date();
    const programacion: ProgramacionPreventiva[] = [];

    tipos
      .filter((t) => (t.frecuenciaPreventivoMeses ?? 0) > 0 && (t.totalVehiculos ?? 0) > 0)
      .forEach((tipo) => {
        const total = Number(tipo.totalVehiculos ?? 0);
        const meses = Number(tipo.frecuenciaPreventivoMeses ?? 0);
        const cuota = Number(tipo.programadosPorSemana ?? 0) > 0
          ? Number(tipo.programadosPorSemana)
          : calcularCuotaSemanalFallback(total, meses, tipo.frecuenciaMantenimientoDias);

        if (cuota <= 0) return;

        const proxima = new Date(hoy);
        proxima.setMonth(proxima.getMonth() + meses);
        const diasRestantes = Math.max(0, Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));

        for (let i = 1; i <= cuota; i++) {
          programacion.push({
            vehiculoId: -(tipo.id * 1000 + i),
            vehiculoCodigo: `Programado ${i}/${cuota}`,
            tipoVehiculo: tipo.nombre,
            proximaFecha: proxima.toISOString(),
            diasRestantes,
            estado: 'Programado'
          });
        }
      });

    return programacion.slice(0, 120);
  };

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'preventivos') {
      setActiveTab('preventivos');
    }
  }, [location.search]);

  const handleResetDatos = async () => {
    if (!canReset) return;
    setResetError('');
    setResetMessage('');
    setResetting(true);
    try {
      const res = await adminService.resetDatos();
      if (!res.success) throw new Error(res.message || 'No se pudo reiniciar los datos');
      setResetMessage(res.message || 'Datos reiniciados');
    } catch (err: any) {
      setResetError(err.message || 'Error al reiniciar los datos');
    } finally {
      setResetting(false);
      setResetModalOpen(false);
    }
  };

  const loadAreas = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await catalogosService.getAreas();
      if (res.success && res.data) {
        setAreas(res.data || []);
      } else {
        setAreas([]);
        setError(res.message || 'No se pudieron cargar las areas');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de areas');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlantillas = async () => {
    try {
      const res = await checklistService.getTemplates();
      if (res.success && res.data) setPlantillas(res.data);
      else setPlantillas([]);
    } catch (err) {
      console.error('No se pudieron cargar plantillas', err);
      setPlantillas([]);
    }
  };

  const loadTiposVehiculo = async () => {
    setLoadingTipos(true);
    try {
      const res = await catalogosService.getTiposVehiculo();
      if (res.success && res.data) {
        setTiposVehiculo(res.data);
        const draft: Record<number, PreventivoConfigDraft> = {};
        res.data.forEach((tipo) => {
          draft[tipo.id] = {
            frecuenciaPreventivoMeses: tipo.frecuenciaPreventivoMeses ?? 0
          };
        });
        setPreventivoDraft(draft);
      }
    } catch (err) {
      console.error('Error cargando tipos de vehiculo', err);
    } finally {
      setLoadingTipos(false);
    }
  };

  const handleSaveTipo = async () => {
    if (!editingTipo) return;
    setAccionando(true);
    setError('');
    
    // Validación básica
    if (!editingTipo.nombre?.trim()) {
      setError('El nombre del tipo de vehículo es obligatorio');
      setAccionando(false);
      return;
    }

    try {
      // Asegurar que la frecuencia sea número
      const frecuencia = editingTipo.frecuenciaMantenimientoDias ? Number(editingTipo.frecuenciaMantenimientoDias) : undefined;

      let finalImagenUrl = editingTipo.imagenUrl;
      
      // Si estamos editando y hay un ID, subimos la imagen primero si existe archivo
      if (selectedFile && editingTipo.id) {
        setUploading(true);
        const uploadRes = await catalogosService.uploadImagenTipoVehiculo(editingTipo.id, selectedFile);
        if (!uploadRes.success) {
          setError(uploadRes.message || 'Error al subir la imagen');
          setUploading(false);
          setAccionando(false);
          return;
        }
        // Aseguramos de usar la URL que retorna el backend
        if (uploadRes.data && uploadRes.data.imagenUrl) {
          finalImagenUrl = uploadRes.data.imagenUrl;
        }
        setUploading(false);
      }

      const payload = {
        ...editingTipo,
        frecuenciaMantenimientoDias: frecuencia,
        imagenUrl: finalImagenUrl
      };

      let res;
      if (isCreatingTipo) {
        // En creación no subimos la imagen en este paso porque requerimos el ID
        // Opcional: Implementar subida en dos pasos o endpoint especial
        res = await catalogosService.createTipoVehiculo(payload);
        
        // Si se creó exitosamente y había un archivo seleccionado, intentamos subirlo ahora
        if (res.success && res.data && selectedFile) {
           try {
             setUploading(true);
             const uploadRes = await catalogosService.uploadImagenTipoVehiculo(res.data.id, selectedFile);
             if (uploadRes.success && uploadRes.data?.imagenUrl) {
               // Actualizamos la URL en el objeto recién creado
               await catalogosService.updateTipoVehiculo(res.data.id, { ...res.data, imagenUrl: uploadRes.data.imagenUrl });
             }
           } catch (uploadErr) {
             console.error('Error subiendo imagen tras crear', uploadErr);
             // No fallamos toda la operación, pero avisamos o simplemente queda sin imagen
           } finally {
             setUploading(false);
           }
        }
      } else if (editingTipo.id) {
        res = await catalogosService.updateTipoVehiculo(editingTipo.id, payload);
      } else {
        throw new Error("Estado inválido: edición sin ID");
      }

      if (res && res.success) {
        setEditingTipo(null);
        setSelectedFile(null);
        setIsCreatingTipo(false);
        loadTiposVehiculo();
      } else {
        setError(res?.message || 'Error al guardar tipo de vehiculo');
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar tipo de vehiculo');
    } finally {
      setAccionando(false);
    }
  };


  const handleDeleteTipo = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este tipo de vehículo? Esta acción no se puede deshacer.')) return;
    
    setAccionando(true);
    setError('');
    try {
      const res = await catalogosService.deleteTipoVehiculo(id);
      if (res.success) {
        loadTiposVehiculo();
      } else {
        setError(res.message || 'No se pudo eliminar el tipo de vehículo');
      }
    } catch (err) {
      console.error(err);
      setError('Error al eliminar el tipo de vehículo');
    } finally {
      setAccionando(false);
    }
  };

  const updatePreventivoDraft = (
    tipoId: number,
    value: number | string | undefined
  ) => {
    setPreventivoDraft((prev) => {
      const current = prev[tipoId] || {};
      const frecuencia = typeof value === 'number' ? Number(value) : 0;

      return {
        ...prev,
        [tipoId]: {
          ...current,
          frecuenciaPreventivoMeses: frecuencia > 0 ? frecuencia : 0
        }
      };
    });
  };

  const handleGuardarProgramacionPreventiva = async (tipo: TipoVehiculoItem) => {
    const draft = preventivoDraft[tipo.id] || {};
    const frecuenciaMeses =
      Number(draft.frecuenciaPreventivoMeses ?? 0) > 0
        ? Number(draft.frecuenciaPreventivoMeses)
        : undefined;

    setSavingPreventivoId(tipo.id);
    setError('');
    try {
      const res = await catalogosService.updateTipoVehiculo(tipo.id, {
        id: tipo.id,
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        imagenUrl: tipo.imagenUrl,
        maxInWorkshop: tipo.maxInWorkshop,
        frecuenciaMantenimientoDias: tipo.frecuenciaMantenimientoDias,
        frecuenciaPreventivoMeses: frecuenciaMeses,
        fechaProximoMantenimiento: undefined,
        activo: frecuenciaMeses ? true : tipo.activo,
        proveedorId: tipo.proveedorId
      });

      if (!res.success) {
        setError(res.message || 'No se pudo guardar la programación preventiva.');
      } else {
        await loadTiposVehiculo();
        await loadProgramacionPreventiva();
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar la programación preventiva.');
    } finally {
      setSavingPreventivoId(null);
    }
  };

  const loadProgramacionPreventiva = async () => {
    if (activeTab !== 'preventivos') return;
    setLoadingProgramacion(true);
    try {
      const res = await dashboardService.getProgramacionPreventiva();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setProgramacionPreventiva(res.data);
        return;
      }

      const tiposRes = await catalogosService.getTiposVehiculo();
      if (tiposRes.success && tiposRes.data) {
        setProgramacionPreventiva(buildProgramacionFallback(tiposRes.data));
      } else {
        setProgramacionPreventiva([]);
      }
    } catch (err) {
      console.error('Error al cargar programación preventiva', err);
      const fallback = buildProgramacionFallback(tiposVehiculo);
      setProgramacionPreventiva(fallback);
    } finally {
      setLoadingProgramacion(false);
    }
  };

  useEffect(() => {
    loadAreas();
    loadSupervisores();
    loadPlantillas();
    loadVehiculos();
    loadAsignaciones();
    loadTiposVehiculo();
    loadTecnicos();
  }, []);

  useEffect(() => {
    if (activeTab === 'preventivos') {
      loadProgramacionPreventiva();
    }
  }, [activeTab]);

  const loadVehiculos = async () => {
    setLoadingVehiculos(true);
    try {
      // Traer todos los vehiculos (activos o no) para permitir asignar checklist
      const res = await vehiculosService.getAll({ page: 1, pageSize: 200 });
      if (res.success && res.data) {
        const raw: any = res.data as any;
        const items =
          raw.items ||
          raw.Items ||
          (Array.isArray(raw) ? raw : []) ||
          (raw.data && (raw.data.items || raw.data.Items)) ||
          [];
        const filtered = filterVehiculos(items);
        setVehiculos(filtered.map((v: any) => ({ id: v.id, codigo: v.codigo, tipo: v.tipoNombre || v.tipo, area: v.areaNombre })));
      } else {
        setVehiculos([]);
      }
    } catch (err) {
      console.error('No se pudieron cargar vehiculos', err);
      setVehiculos([]);
    } finally {
      setLoadingVehiculos(false);
    }
  };

  const loadAsignaciones = async () => {
    try {
      const res = await checklistService.getAsignaciones();
      if (res.success && res.data) {
        const map: Record<number, number | undefined> = {};
        res.data.forEach((a) => {
          map[a.vehiculoId] = a.checklistTemplateId;
        });
        setAsignaciones(map);
      } else {
        setAsignaciones({});
      }
    } catch (err) {
      console.error('No se pudieron cargar asignaciones de checklist', err);
      setAsignaciones({});
    }
  };

  const handleAsignarChecklist = async (vehiculoId: number, templateId?: number) => {
    try {
      const res = await checklistService.asignarChecklistVehiculo({ vehiculoId, checklistTemplateId: templateId });
      if (!res.success) {
        setError(res.message || 'No se pudo guardar la asignacion de checklist');
        return;
      }
      setAsignaciones((prev) => ({ ...prev, [vehiculoId]: templateId }));
    } catch (err) {
      console.error('No se pudo asignar checklist', err);
      setError('No se pudo asignar checklist al vehiculo');
    }
  };

  const loadTecnicos = async () => {
    try {
      const res = await catalogosService.getTecnicos(false);
      if (res.success && res.data) {
        setTecnicos(res.data.map(t => ({ id: t.id, nombre: t.nombre || (t as any).nombreCompleto })));
      }
    } catch (err) {
      console.error('Error cargando tecnicos', err);
    }
  };

  const loadSupervisores = async () => {
    try {
      // Intentar cargar usuarios (si el endpoint existe) y filtrar roles con "super" o "admin"
      const res = await usuariosService.getAll({ page: 1, pageSize: 100 });
      let listado: { id: number; nombre: string }[] = [];
      if (res.success && res.data) {
        const items = (res.data as any).items || (res.data as any).Items || (Array.isArray(res.data) ? res.data : []);
        listado = items
          .map((s: any) => ({
            id: s.id,
            nombre: s.nombreCompleto || s.username || `Supervisor ${s.id}`,
            rol: (s.rolNombre || '').toLowerCase(),
          }))
          .filter((s: any) => s.rol.includes('super') || s.rol.includes('admin'))
          .map((s: any) => ({ id: s.id, nombre: s.nombre }));
      }

      // Si no hay usuarios con rol de supervisor/admin, usar tecnicos como fallback
      if (listado.length === 0) {
        const techRes = await catalogosService.getTecnicos(false);
        if (techRes.success && techRes.data) {
          listado = techRes.data.map((t: any) => ({
            id: t.id,
            nombre: t.nombreCompleto || `Tecnico ${t.id}`,
          }));
        }
      }

      setSupervisores(listado);
    } catch (err) {
      console.error('No se pudieron cargar supervisores', err);
    }
  };

  const handleCreate = async () => {
    setCreando(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined
      };
      const res = await catalogosService.createArea(payload);
      if (res.success) {
        setCrearOpen(false);
        setForm({ nombre: '', codigo: '', descripcion: '' });
        loadAreas();
      } else {
        setError(res.message || 'No se pudo crear el area');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear el area');
    } finally {
      setCreando(false);
    }
  };

  const toggleActiva = async (area: Area) => {
    setAccionando(true);
    setError('');
    try {
      await catalogosService.updateArea(area.id, { activa: !area.activa });
      loadAreas();
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del area');
    } finally {
      setAccionando(false);
    }
  };

  const abrirAsignarSupervisor = (area: Area) => {
    setAreaSeleccionada(area);
    setSupervisorId(area.supervisorId ? String(area.supervisorId) : '');
  };

  const handleAsignarSupervisor = async () => {
    if (!areaSeleccionada) return;
    setAsignando(true);
    setError('');
    try {
      await catalogosService.updateArea(areaSeleccionada.id, { supervisorId: supervisorId ? Number(supervisorId) : undefined });
      setAreaSeleccionada(null);
      setSupervisorId('');
      loadAreas();
    } catch (err) {
      console.error(err);
      setError('No se pudo asignar el supervisor');
    } finally {
      setAsignando(false);
    }
  };

  const agregarItemDraft = () => {
    const preguntaLimpia = nuevoItem.pregunta.trim();
    if (!preguntaLimpia) return;

    const prevLength = itemsDraft.length;
    const nuevoDraft: ChecklistItemDraft = {
      ...nuevoItem,
      pregunta: preguntaLimpia,
      opciones: nuevoItem.opciones?.trim() || '',
      costoEstimado: parseNumero(nuevoItem.costoEstimado),
      orden: prevLength + 1
    };

    setItemsDraft((prev) => [...prev, nuevoDraft]);
    setNuevoItem({
      orden: prevLength + 2,
      pregunta: '',
      tipoRespuesta: 1,
      opciones: '',
      obligatorio: true,
      requiereFoto: false,
      costoEstimado: 0
    });
    setError('');
  };

  const eliminarItem = (idx: number) => {
    setItemsDraft((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, orden: i + 1 })));
  };

  const actualizarItem = (idx: number, changes: Partial<ChecklistItemDraft>) => {
    setItemsDraft((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...changes } : it)).map((it, i) => ({ ...it, orden: i + 1 }))
    );
  };

  const handleCrearChecklist = async () => {
    if (!tplNombre.trim() || itemsDraft.length === 0) {
      setError('Agrega nombre y al menos un item al checklist');
      return;
    }
    setCreandoChecklist(true);
    setError('');
    try {
      const payload = {
        nombre: tplNombre.trim(),
        descripcion: tplDescripcion.trim() || undefined,
        tipoVehiculo: tplTipoVehiculo ? Number(tplTipoVehiculo) : undefined,
        tipoMantenimiento: tplTipoMantenimiento || undefined,
        items: itemsDraft.map((i, idx) => ({
          id: i.id,
          orden: idx + 1,
          pregunta: i.pregunta,
          tipoRespuesta: 1,
          opciones: i.opciones || undefined,
          obligatorio: !!i.obligatorio,
          requiereFoto: !!i.requiereFoto,
          costoEstimado: i.costoEstimado ?? 0
        }))
      };
      const res = tplEditId
        ? await checklistService.updateTemplate(tplEditId, payload)
        : await checklistService.createTemplate(payload);
      if (!res.success) {
        setError(res.message || 'No se pudo guardar el checklist');
      } else {
        setCrearChecklistOpen(false);
        setTplNombre('');
        setTplDescripcion('');
        setTplTipoVehiculo('');
        setTplTipoMantenimiento('');
        setItemsDraft([]);
        setTplEditId(null);
        loadPlantillas();
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar checklist');
    } finally {
      setCreandoChecklist(false);
    }
  };

  const isEditingChecklist = tplEditId !== null;

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Configuracion</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-continental-black">Panel de ajustes</h1>
            <p className="text-continental-gray-1">Mantiene catalogos clave para el sistema.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { loadAreas(); loadPlantillas(); loadTiposVehiculo(); }} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => {
              setTplEditId(null);
              setTplNombre('');
              setTplDescripcion('');
              setTplTipoVehiculo('');
              setTplTipoMantenimiento('');
              setItemsDraft([]);
              setCrearChecklistOpen(true);
            }}>
              <ClipboardPlus className="h-4 w-4" />
              Nuevo checklist
            </Button>
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva area
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/fallas-imagen')} className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Fallas visuales
          </Button>
          <Button variant="outline" onClick={() => navigate('/asignacion-lideres')} className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Asignar Líderes
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant={activeTab === "areas" ? "default" : "outline"} onClick={() => setActiveTab("areas")}>
          Catalogo de Areas
        </Button>
        <Button variant={activeTab === "checklists" ? "default" : "outline"} onClick={() => setActiveTab("checklists")}>
          Checklists y asignacion
        </Button>
        <Button variant={activeTab === "tipos" ? "default" : "outline"} onClick={() => setActiveTab("tipos")}>
          Gestión de Tipos de Vehículo
        </Button>
        <Button variant={activeTab === "preventivos" ? "default" : "outline"} onClick={() => setActiveTab("preventivos")}>
          Programación preventiva
        </Button>
      </div>

      {activeTab === "areas" && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-continental-yellow" />
            <h2 className="text-xl font-semibold text-continental-black">Catalogo de Areas</h2>
          </div>
          {loading ? (
            <Spinner />
          ) : areas.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay Areas</p>
              <p className="text-continental-gray-1">Aun no se han registrado Areas o ubicaciones.</p>
              <div className="flex justify-center gap-2">
                <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Crear Area
                </Button>
                <Button variant="outline" onClick={loadAreas}>
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {areas.map((area) => (
                <Card key={area.id} className="px-8 py-7 border-l-4 border-continental-yellow">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3 min-w-0">
                      <Settings className="h-5 w-5 text-continental-yellow mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-continental-black break-words">{area.nombre}</p>
                        <p className="text-sm text-continental-gray-1">
                          Codigo: {area.codigo || 'N/D'} - Supervisor: {area.supervisorNombre || 'No asignado'}
                        </p>
                        {area.descripcion && <p className="text-sm text-continental-gray-1">{area.descripcion}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge variant={area.activa ? 'default' : 'outline'}>{area.activa ? 'Activa' : 'Inactiva'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => abrirAsignarSupervisor(area)} disabled={accionando}>
                        Asignar supervisor
                      </Button>
                      <Button size="sm" variant="secondary" disabled={accionando} onClick={() => toggleActiva(area)} className="flex items-center gap-1">
                        {area.activa ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {area.activa ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "tipos" && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-continental-yellow" />
              <h2 className="text-xl font-semibold text-continental-black">Gestión de Tipos de Vehículo</h2>
            </div>
            <Button
              className="bg-continental-gradient text-white flex items-center gap-2"
              onClick={() => {
                setEditingTipo({ nombre: '', descripcion: '', activo: true, maxInWorkshop: 0 });
                setIsCreatingTipo(true);
                setSelectedFile(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo Tipo
            </Button>
          </div>
          {loadingTipos ? (
            <Card className="p-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 text-continental-blue animate-spin" />
              <p className="text-continental-gray-1 animate-pulse">Cargando tipos de vehículo...</p>
            </Card>
          ) : tiposVehiculo.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay tipos de vehiculo cargados</p>
              <Button variant="outline" onClick={loadTiposVehiculo}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tiposVehiculo.map((tipo) => (
                <Card key={tipo.id} className="p-5 border-l-4 border-continental-blue space-y-3">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {tipo.imagenUrl ? (
                        <div className="h-16 w-16 rounded-lg overflow-hidden border border-continental-gray-3/30 bg-white flex-shrink-0">
                          <img src={getFullImageUrl(tipo.imagenUrl)} alt={tipo.nombre} className="h-full w-full object-contain" />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-continental-bg flex items-center justify-center border border-dashed border-continental-gray-3 flex-shrink-0">
                           <Package className="h-8 w-8 text-continental-gray-2" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-continental-black break-words">{tipo.nombre}</p>
                        <p className="text-sm text-continental-gray-1">ID: {tipo.id}</p>
                        {tipo.proveedorId && (
                          <p className="text-xs text-continental-blue font-medium">
                            Técnico: {tipo.proveedorNombre || 'Asignado'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 sm:flex-col shrink-0">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingTipo(tipo);
                          setIsCreatingTipo(false);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTipo(tipo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!tipo.imagenUrl && (
                    <p className="text-xs text-red-500 font-medium">Sin imagen de contenedor asignada</p>
                  )}
                  {tipo.frecuenciaMantenimientoDias && tipo.frecuenciaMantenimientoDias > 0 && (
                    <div className="pt-2 border-t border-dashed mt-2">
                      <div className="flex items-center gap-2 text-xs text-continental-gray-1">
                        <Calendar className="h-3 w-3" />
                        <span>Frecuencia: Cada {tipo.frecuenciaMantenimientoDias} días</span>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "preventivos" && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-continental-yellow" />
            <h2 className="text-xl font-semibold text-continental-black">Programación de mantenimiento preventivo</h2>
          </div>
          <p className="text-sm text-continental-gray-1">
            Define por tipo de contenedor cada cuántos meses realizar mantenimiento. El objetivo semanal se calcula automáticamente.
          </p>

          {loadingTipos ? (
            <Card className="p-8 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 text-continental-blue animate-spin" />
              <p className="text-sm text-continental-gray-1 animate-pulse">Cargando tipos de vehículo...</p>
            </Card>
          ) : tiposVehiculo.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay tipos para programar</p>
              <Button variant="outline" onClick={loadTiposVehiculo}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Tipo de contenedor</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Total</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Frecuencia (meses)</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Estado</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposVehiculo.map((tipo) => {
                      const draft = preventivoDraft[tipo.id] || {};
                      const completo = (draft.frecuenciaPreventivoMeses ?? 0) > 0;
                      return (
                        <tr key={tipo.id} className="border-t border-continental-gray-3/60">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-continental-black">{tipo.nombre}</p>
                            <p className="text-xs text-continental-gray-1">ID: {tipo.id}</p>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-continental-black">{tipo.totalVehiculos ?? 0}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              className="w-28 rounded border border-continental-gray-3 px-2 py-1 text-center"
                              value={draft.frecuenciaPreventivoMeses ?? 0}
                              onChange={(e) =>
                                updatePreventivoDraft(
                                  tipo.id,
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={completo ? 'default' : 'outline'}>
                              {completo ? 'Configurado' : 'Sin programar mantenimiento'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col gap-2 items-center">
                              <Button
                                size="sm"
                                className="min-w-[110px]"
                                onClick={() => handleGuardarProgramacionPreventiva(tipo)}
                                disabled={savingPreventivoId === tipo.id}
                              >
                                {savingPreventivoId === tipo.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Guardar Config'
                                )}
                              </Button>
                              
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {tiposVehiculo.every((tipo) => {
                const draft = preventivoDraft[tipo.id] || {};
                return (draft.frecuenciaPreventivoMeses ?? 0) <= 0;
              }) && (
                <div className="rounded-lg border border-continental-red/30 bg-red-50 px-4 py-3 text-sm font-medium text-continental-red">
                  No se ha programado un mantenimiento aún.
                </div>
              )}

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-continental-blue" />
                  <h3 className="text-lg font-semibold text-continental-black">Próximos Mantenimientos Preventivos</h3>
                </div>
                
                {loadingProgramacion ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 text-continental-blue animate-spin" />
                  </div>
                ) : programacionPreventiva.length === 0 ? (
                  <Card className="p-4 text-center text-continental-gray-1">
                    No hay mantenimientos preventivos próximos.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {programacionPreventiva.map((item) => (
                      <Card key={item.vehiculoId} className={`p-4 border-l-4 ${
                        item.estado === 'Vencido' ? 'border-l-red-500 bg-red-50/50' :
                        (item.estado === 'Próximo' || item.estado === 'Proximo') ? 'border-l-yellow-500 bg-yellow-50/50' :
                        'border-l-green-500'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-continental-black">{item.vehiculoCodigo}</p>
                            <p className="text-xs text-continental-gray-1">{item.tipoVehiculo}</p>
                          </div>
                          <Badge variant={
                            item.estado === 'Vencido' ? 'destructive' :
                            (item.estado === 'Próximo' || item.estado === 'Proximo') ? 'secondary' :
                            'default'
                          }>
                            {item.estado}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-continental-gray-2">Último:</span>
                            <span className="font-medium text-continental-black">
                              {item.ultimaFecha ? new Date(item.ultimaFecha).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-continental-gray-2">Programado:</span>
                            <span className="font-medium text-continental-black">
                              {new Date(item.proximaFecha).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="pt-2 text-xs text-right font-medium text-continental-blue">
                            {item.diasRestantes < 0 
                              ? `Vencido hace ${Math.abs(item.diasRestantes)} días` 
                              : `Faltan ${item.diasRestantes} días`}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "checklists" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="h-5 w-5 text-continental-yellow" />
            <h2 className="text-xl font-semibold text-continental-black">Checklists</h2>
          </div>
          {plantillas.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-lg font-semibold text-continental-black">No hay checklists configurados</p>
              <p className="text-continental-gray-1">Crea plantillas para usarlas en las ordenes de trabajo.</p>
              <div className="flex justify-center">
                <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCrearChecklistOpen(true)}>
                  <ClipboardPlus className="h-4 w-4" />
                  Nuevo checklist
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {plantillas.map((tpl) => {
                const total = tpl.items.reduce((acc, it) => acc + (Number((it as any).costoEstimado || 0) || 0), 0);
                return (
                  <Card key={tpl.id} className="p-5 border-l-4 border-continental-blue space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-continental-black">{tpl.nombre}</p>
                        <p className="text-sm text-continental-gray-1">{tpl.descripcion || 'Sin descripcion'}</p>
                        <p className="text-xs text-continental-gray-2">
                          Vehiculo: {tpl.tipoVehiculoNombre || 'Todos'} - Mantenimiento: {tpl.tipoMantenimiento || 'Todos'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{tpl.items.length} items</Badge>
                        <p className="text-xs text-continental-gray-2">Costo base: ${total.toFixed(2)}</p>
                        <Button
                          size="sm"
                          className="mt-2"
                          variant="outline"
                          onClick={() => {
                            setTplEditId(tpl.id);
                            setTplNombre(tpl.nombre);
                            setTplDescripcion(tpl.descripcion || '');
                            setTplTipoVehiculo(tpl.tipoVehiculo ? String(tpl.tipoVehiculo) : '');
                            setTplTipoMantenimiento(tpl.tipoMantenimiento || '');
                            setItemsDraft(
                              tpl.items.map((it, idx) => ({
                                id: it.id,
                                orden: idx + 1,
                                pregunta: it.pregunta,
                                // Conservamos tipo si viene, si no, checkbox
                                tipoRespuesta: (it as any).tipoRespuesta || 1,
                                opciones: it.opciones || '',
                                obligatorio: it.obligatorio,
                                requiereFoto: it.requiereFoto,
                                costoEstimado: (it as any).costoEstimado ?? 0
                              }))
                            );
                            setCrearChecklistOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-continental-gray-1 space-y-1 max-h-28 overflow-y-auto pr-1">
                      {tpl.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="text-continental-gray-2">#{item.orden}</span>
                          <span className="text-continental-black">{item.pregunta}</span>
                          <span className="text-continental-gray-2">${((item as any).costoEstimado ?? 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-continental-yellow" />
              <h3 className="text-lg font-semibold text-continental-black">Asignar checklist a vehiculos</h3>
            </div>
            {loadingVehiculos ? (
              <Card className="p-8 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 text-continental-blue animate-spin" />
                <p className="text-sm text-continental-gray-1 animate-pulse">Cargando vehículos...</p>
              </Card>
            ) : vehiculos.length === 0 ? (
              <Card className="p-4 text-sm text-continental-gray-1">No hay vehiculos cargados o activos.</Card>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Vehiculo</th>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Tipo / Area</th>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiculos.map((v) => (
                      <tr key={v.id} className="border-t border-continental-gray-3/60">
                        <td className="px-4 py-3 font-semibold text-continental-black">{v.codigo}</td>
                        <td className="px-4 py-3 text-continental-gray-1">{[v.tipo, v.area].filter(Boolean).join(' / ') || 'N/D'}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={asignaciones[v.id] ? String(asignaciones[v.id]) : ''}
                            onChange={(val) => handleAsignarChecklist(v.id, val ? Number(val) : undefined)}
                            options={[
                              { value: '', label: 'Sin checklist' },
                              ...plantillas.map((p) => ({ value: String(p.id), label: `${p.nombre} (${p.items.length} items)` }))
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-continental-gray-2">
              Nota: Asignacion guardada en backend.
            </p>
          </div>
        </div>
      )}

      {canReset && (
        <Card className="border border-red-200 bg-red-50/60 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-red-600">Acción destructiva</p>
              <h3 className="text-lg font-semibold text-red-800">Reiniciar los datos del sistema</h3>
              <p className="text-sm text-red-700">
                Esta operación eliminará vehículos, órdenes, reportes, evidencias, consumibles, refacciones, pagos,
                notificaciones y registros. Se conservarán únicamente usuarios/roles, áreas, prefijos de vehículo y plantillas/items de checklist.
                No se podrán recuperar los datos eliminados.
              </p>
            </div>
          </div>
          {resetError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{resetError}</AlertDescription>
            </Alert>
          )}
          {resetMessage && (
            <Alert variant="default">
              <AlertTitle>Listo</AlertTitle>
              <AlertDescription>{resetMessage}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => {
                setResetError('');
                setResetMessage('');
                setResetModalOpen(true);
              }}
            >
              Reiniciar los datos del sistema
            </Button>
          </div>
        </Card>
      )}

      <Modal
        isOpen={resetModalOpen}
        onClose={() => {
          if (!resetting) setResetModalOpen(false);
        }}
        title="Reiniciar los datos del sistema"
        description="Esta acción elimina la información operativa y no se puede deshacer."
      >
        <div className="space-y-3">
          <p className="text-sm text-red-700">
            Se borrarán <strong>vehículos, órdenes, reportes, evidencias, consumibles, refacciones, pagos, notificaciones, logs y usuarios no esenciales</strong>.
          </p>
          <p className="text-sm text-red-700">
            <strong>Se conservarán únicamente:</strong>
            <ul className="list-disc list-inside ml-2">
              <li>Usuarios clave (Admin, SuperUsuario, Líder, Tecnico_demo y lista específica)</li>
              <li>Roles y Permisos</li>
              <li>Áreas</li>
              <li>Plantillas de checklist</li>
            </ul>
          </p>
           <p className="text-sm text-red-700 font-bold mt-2">
            IMPORTANTE: Esta operación solo se puede ejecutar UNA VEZ.
          </p>
          <Alert variant="destructive">
            <AlertTitle>Operación irreversible</AlertTitle>
            <AlertDescription>Confirma solo si tienes respaldo y entiendes el impacto.</AlertDescription>
          </Alert>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setResetModalOpen(false)} disabled={resetting}>
            Cancelar
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleResetDatos} disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {resetting ? 'Reiniciando...' : 'Sí, borrar todo (Única vez)'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={crearOpen} onClose={() => setCrearOpen(false)} title="Nueva area" description="Crear una nueva area o ubicacion.">
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
          />
          <Input
            label="Codigo"
            value={form.codigo}
            onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
          />
          <Textarea
            label="Descripcion"
            value={form.descripcion}
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

      <Modal
        isOpen={crearChecklistOpen}
        onClose={() => {
          setCrearChecklistOpen(false);
          setItemsDraft([]);
          setTplNombre('');
          setTplDescripcion('');
          setTplTipoVehiculo('');
          setTplTipoMantenimiento('');
          setTplEditId(null);
        }}
        title={isEditingChecklist ? 'Editar checklist' : 'Nuevo checklist'}
        description={
          isEditingChecklist
            ? 'Edita la plantilla de checklist para actualizar preguntas y costos.'
            : 'Crea una plantilla de checklist para usar en las ordenes.'
        }
      >
        <div className="space-y-3">
          <Input label="Nombre" value={tplNombre} onChange={(e) => setTplNombre(e.target.value)} />
          <Textarea label="Descripcion" value={tplDescripcion} onChange={(e) => setTplDescripcion(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Tipo de vehiculo (opcional)"
              value={tplTipoVehiculo}
              onChange={(v) => setTplTipoVehiculo(v)}
              options={[
                { value: '', label: 'Todos' },
                { value: '1', label: 'Carrito' },
                { value: '2', label: 'Tugger' },
                { value: '3', label: 'Montacargas' }
              ]}
            />
            <Input
              label="Tipo de mantenimiento (opcional)"
              placeholder="Correctivo, Preventivo..."
              value={tplTipoMantenimiento}
              onChange={(e) => setTplTipoMantenimiento(e.target.value)}
            />
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <p className="font-semibold text-continental-black text-sm">Items del checklist</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-continental-gray-2">Lista actual</p>
                {itemsDraft.length === 0 && <p className="text-xs text-continental-gray-2">Aun no agregas items.</p>}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {itemsDraft.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 border rounded-lg p-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          label={`Item #${idx + 1}`}
                          value={item.pregunta}
                          onChange={(e) => actualizarItem(idx, { pregunta: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Costo estimado (MXN)"
                            type="number"
                            value={String(item.costoEstimado ?? 0)}
                            onChange={(e) => actualizarItem(idx, { costoEstimado: parseNumero(e.target.value) })}
                          />
                          <div className="flex flex-col justify-end text-xs text-continental-gray-2">
                            <span>Respuesta: Si/No</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => eliminarItem(idx)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-continental-gray-2">Agregar nuevo</p>
                <Input
                  label="Pregunta"
                  value={nuevoItem.pregunta}
                  onChange={(e) => setNuevoItem((prev) => ({ ...prev, pregunta: e.target.value }))}
                />
                <Input
                  label="Costo estimado (MXN)"
                  type="number"
                  value={String(nuevoItem.costoEstimado ?? 0)}
                  onChange={(e) => setNuevoItem((prev) => ({ ...prev, costoEstimado: parseNumero(e.target.value) }))}
                />
                <div className="text-xs text-continental-gray-2">Tipo de respuesta: Si/No</div>
                <Button variant="outline" onClick={agregarItemDraft} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar item
                </Button>
              </div>
            </div>
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setCrearChecklistOpen(false);
              setItemsDraft([]);
              setTplNombre('');
              setTplDescripcion('');
              setTplTipoVehiculo('');
              setTplTipoMantenimiento('');
              setTplEditId(null);
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleCrearChecklist} disabled={creandoChecklist} className="flex items-center gap-2">
            {creandoChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
            {isEditingChecklist ? 'Actualizar checklist' : 'Guardar checklist'}
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        isOpen={!!areaSeleccionada}
        onClose={() => {
          setAreaSeleccionada(null);
          setSupervisorId('');
        }}
        title="Asignar supervisor"
        description={areaSeleccionada ? `Asignar responsable para ${areaSeleccionada.nombre}` : ''}
      >
        <div className="space-y-3">
          <Select
            label="Supervisor"
            value={supervisorId}
            onChange={(v) => setSupervisorId(v)}
            options={[{ value: '', label: 'Sin asignar' }, ...supervisores.map((s) => ({ value: String(s.id), label: s.nombre }))]}
          />
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setAreaSeleccionada(null);
              setSupervisorId('');
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleAsignarSupervisor} disabled={asignando} className="flex items-center gap-2">
            {asignando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={!!editingTipo}
        onClose={() => {
          setEditingTipo(null);
          setSelectedFile(null);
          setIsCreatingTipo(false);
        }}
        title={isCreatingTipo ? "Nuevo Tipo de Vehículo/Contenedor" : "Editar Tipo de Vehículo"}
        description={isCreatingTipo ? "Registra un nuevo tipo de vehículo o contenedor." : `Edita la información de ${editingTipo?.nombre}`}
      >
        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
          <Input
            label="Nombre"
            placeholder="Ej: Carrito, Tugger, Montacargas..."
            value={editingTipo?.nombre || ''}
            onChange={(e) => setEditingTipo(prev => prev ? { ...prev, nombre: e.target.value } : null)}
          />
          <Textarea
            label="Descripción"
            placeholder="Descripción opcional..."
            value={editingTipo?.descripcion || ''}
            onChange={(e) => setEditingTipo(prev => prev ? { ...prev, descripcion: e.target.value } : null)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Frecuencia Mantenimiento (Días)"
              type="number"
              placeholder="Ej: 30"
              value={editingTipo?.frecuenciaMantenimientoDias || ''}
              onChange={(e) => setEditingTipo(prev => prev ? { ...prev, frecuenciaMantenimientoDias: e.target.value ? Number(e.target.value) : undefined } : null)}
            />
            <div className="flex flex-col justify-end">
               <p className="text-xs text-continental-gray-1 italic">Define cada cuántos días se recomienda realizar mantenimiento preventivo.</p>
            </div>
          </div>

          <Select
            label="Técnico por Defecto (Asignación Automática)"
            value={editingTipo?.proveedorId ? String(editingTipo.proveedorId) : ''}
            onChange={(val) => setEditingTipo(prev => prev ? { ...prev, proveedorId: val ? Number(val) : undefined } : null)}
            options={[
              { value: '', label: 'Sin técnico automático' },
              ...tecnicos.map(t => ({ value: String(t.id), label: t.nombre }))
            ]}
          />
          
          <div className="space-y-2 pt-2 border-t border-continental-gray-3">
            <p className="text-sm font-medium text-continental-black">Imagen de Referencia</p>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  // Opcional: Crear una URL temporal para previsualización inmediata
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setEditingTipo(prev => prev ? { ...prev, imagenUrl: reader.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>

          {!isCreatingTipo && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-continental-gray-3" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-continental-gray-2">O usar URL</span>
                </div>
              </div>

              <Input
                label="URL de Imagen"
                placeholder="https://ejemplo.com/imagen.png"
                value={editingTipo?.imagenUrl && !editingTipo.imagenUrl.startsWith('data:') ? editingTipo.imagenUrl : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingTipo(prev => prev ? { ...prev, imagenUrl: val } : null);
                  setSelectedFile(null);
                }}
              />
            </>
          )}

          {editingTipo?.imagenUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-continental-gray-1 text-center">Previsualización</p>
              <div className="flex justify-center p-2 border rounded-lg bg-continental-bg/30">
                <img 
                  src={getFullImageUrl(editingTipo.imagenUrl)} 
                  alt="Previsualización" 
                  className="max-h-48 object-contain"
                  onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x300?text=Error+al+cargar+imagen')}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700">
              Esta imagen se utilizará para identificar visualmente el tipo de contenedor asociado a este modelo de vehículo en todo el sistema.
            </p>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => {
            setEditingTipo(null);
            setSelectedFile(null);
          }}>
            Cancelar
          </Button>
          <Button onClick={handleSaveTipo} disabled={accionando || uploading} className="flex items-center gap-2">
            {accionando || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            {uploading ? 'Subiendo...' : (isCreatingTipo ? 'Crear' : 'Guardar Cambios')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
