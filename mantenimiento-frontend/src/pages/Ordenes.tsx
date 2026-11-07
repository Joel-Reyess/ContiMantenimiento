import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Modal,
  ModalFooter,
  SearchableSelect,
  type SearchableSelectOption,
  Select,
  Spinner,
  useConfirm,
  useToast,
  SearchInput
} from '@/components/ui';
import {
  ArrowLeft,
  Clock,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  Wrench,
  CheckCircle,
  Package,
  ClipboardList,
  FileText,
  Trash2,
  Search,
  Camera,
  Printer
} from 'lucide-react';
import { catalogosService, vehiculosService } from '@/services';
import { UbicacionBadge } from '@/components/vehiculos/UbicacionLegend';
import { ordenesService } from '@/services/ordenesService';
import { usuariosService } from '@/services/usuariosService';
import { reportesService } from '@/services/reportesService';
import { checklistService } from '@/services/checklistService';
import { ordenTrabajoChecklistItemService } from '@/services/ordenTrabajoChecklistItemService';
import { ReportFailureModal } from '@/components/tecnico';
import { MaterialesOrden, PanelFlujo } from '@/components/flujo';
import { flujoService, type MaterialOrden } from '@/services/flujoService';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';
import { getFullImageUrl } from '@/lib/utils';
import type { OrdenTrabajo, OrdenTrabajoList, ReporteFalla, Evidencia, VehicleImagePoint } from '@/interfaces';
import { EstadoOrdenNombres, EstadoOrdenTrabajo, Prioridad, PrioridadNombres } from '@/interfaces/Api.interface';
import type { ChecklistItem as ChecklistTemplateItem } from '@/services/checklistService';
import { useAuth } from '@/contexts/AuthContext';

interface FiltersState {
  busqueda: string;
  estado?: string;
  prioridad?: string;
}


interface DummyChecklistSeed {
  id: string;
  nombre: string;
  costo: number;
  preset?: {
    reportado?: boolean;
    reparado?: boolean;
    verificado?: boolean;
  };
}

interface DummyChecklistRow {
  id: string;
  nombre: string;
  costo: number;
  reportado: boolean;
  reparado: boolean;
  verificado: boolean;
}

interface DummyChecklistReporte {
  fecha: string;
  total: number;
  items: DummyChecklistRow[];
  tipo: string;
}

const dummyChecklistCatalog: Record<string, DummyChecklistSeed[]> = {
  costado: [
    { id: 'c-1', nombre: 'Desarmado y armado de carro', costo: 550, preset: { reportado: true, reparado: true } },
    { id: 'c-2', nombre: 'Reparacion de estructura', costo: 420, preset: { reportado: true, reparado: true } },
    { id: 'c-3', nombre: 'Aplicacion de soldadura (cambio postes)', costo: 380, preset: { reportado: true, reparado: true } },
    { id: 'c-4', nombre: 'Colocar suelo lateral', costo: 260, preset: { reportado: true } },
    { id: 'c-5', nombre: 'Reparar rodillos principales', costo: 310, preset: { reportado: true, reparado: true, verificado: true } },
    { id: 'c-6', nombre: 'Reparar resorte y base', costo: 190, preset: { reportado: true } },
    { id: 'c-7', nombre: 'Reparar tapas de fibra de vidrio', costo: 240, preset: { reportado: true } },
    { id: 'c-8', nombre: 'Reparacion de laminas de aluminio', costo: 200 },
    { id: 'c-9', nombre: 'Reparar frenos y palancas', costo: 270, preset: { reportado: true } },
    { id: 'c-10', nombre: 'Cambio de chumaceras', costo: 330, preset: { reportado: true, reparado: true } },
    { id: 'c-11', nombre: 'Pintura de carro', costo: 180 }
  ],
  general: [
    { id: 'g-1', nombre: 'Inspeccion general de seguridad', costo: 150, preset: { reportado: true } },
    { id: 'g-2', nombre: 'Limpieza de componentes', costo: 120 },
    { id: 'g-3', nombre: 'Ajuste de tornilleria critica', costo: 210 },
    { id: 'g-4', nombre: 'Prueba de centrado', costo: 260 },
    { id: 'g-5', nombre: 'Etiquetado y documentacion', costo: 90 }
  ]
};

const resolveChecklistKey = (tipo?: string) => {
  if (!tipo) return 'general';
  const normalized = tipo.toLowerCase();
  if (normalized.includes('costado')) return 'costado';
  return 'general';
};

export function OrdenesPage() {
  const { confirmar } = useConfirm();
  const toast = useToast();
  const location = useLocation();
  const { id: ordenIdParam } = useParams();
  const ordenId = ordenIdParam ? Number(ordenIdParam) : undefined;
  const isMisOrdenes = location.pathname.includes('mis-ordenes');
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(['Administrador', 'Superusuario', 'Supervisor']);
  const canEliminar = hasRole(['Administrador', 'SuperUsuario']);
  // Líder y Operador consultan las órdenes; el Líder además aprueba o rechaza reparaciones
  const puedeTrabajarOrden = hasRole(['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico']);
  // Asignar o cambiar técnico y cancelar: Supervisor (Gerente) y administración; el técnico acepta la orden
  const puedeAsignarYCancelar = hasRole(['SuperUsuario', 'Administrador', 'Supervisor']);
  const navigate = useNavigate();
  const [eliminandoOrden, setEliminandoOrden] = useState(false);

  /** Eliminar orden (solo administradores): confirmación del sistema, aviso y regreso al listado */
  const handleEliminarOrden = async () => {
    if (!detalle || eliminandoOrden) return;
    const ok = await confirmar({
      titulo: `Eliminar orden ${detalle.folio}`,
      mensaje: (
        <div className="space-y-2">
          <p>Se eliminará la orden con su checklist, evidencias, refacciones, actividades adicionales y pagos.</p>
          <p>
            Si viene de un reporte, el reporte se conserva: vuelve a quedar "sin orden" para poder crear otra, salvo que
            la orden ya esté validada o entregada (entonces queda como atendido).
          </p>
          <p>Si el vehículo ya no tiene otra orden ni reporte abierto, regresa a Piso como operativo. Si el pago estaba en una orden de compra, su total se ajusta.</p>
          <p>Esta acción no se puede deshacer. Quedará registrado quién la realizó y cuándo.</p>
        </div>
      ),
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return;
    setEliminandoOrden(true);
    try {
      const res = await ordenesService.delete(detalle.id);
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar la orden');
        return;
      }
      toast.exito(res.message || `Orden ${detalle.folio} eliminada`);
      navigate(isMisOrdenes ? '/mis-ordenes' : '/ordenes');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar la orden');
    } finally {
      setEliminandoOrden(false);
    }
  };

  const [filters, setFilters] = useState<FiltersState>({ busqueda: '' });
  const [ordenes, setOrdenes] = useState<OrdenTrabajoList[]>([]);
  const [detalle, setDetalle] = useState<OrdenTrabajo | null>(null);
  const [vehicleImageUrl, setVehicleImageUrl] = useState<string | undefined>(undefined);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; title?: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [showCompletar, setShowCompletar] = useState(false);
  const [compHoras, setCompHoras] = useState('1');
  const [compError, setCompError] = useState('');
  // Al terminar: lo que se descontará del inventario (lo guardado en "Refacciones y consumibles utilizados")
  const [materialesAlTerminar, setMaterialesAlTerminar] = useState<MaterialOrden[] | null>(null);
  // Sube con cada acción del flujo para que la tarjeta de materiales se recargue (p. ej. al aceptar la orden)
  const [versionFlujo, setVersionFlujo] = useState(0);
  const [asignandoTecnico, setAsignandoTecnico] = useState(false);
  const [tecnicoAsignado, setTecnicoAsignado] = useState<SearchableSelectOption | null>(null);
  const [firmaError, setFirmaError] = useState('');
  // PDF 06-nov: ya asignado, el técnico solo se cambia a propósito (Gerente de Mantenimiento o administración)
  const [cambiandoTecnico, setCambiandoTecnico] = useState(false);
  const [reporteDetalle, setReporteDetalle] = useState<ReporteFalla | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [uploadingItemMap, setUploadingItemMap] = useState<Record<number, boolean>>({});
  const [checklistError, setChecklistError] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistTemplateItem[]>([]);
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, { valor: string; notas?: string; cantidad?: number; fotoUrl?: string }>>({});
  const [checklistSource, setChecklistSource] = useState<'reporte' | 'vehiculo' | 'tipo' | 'default' | 'saved'>('default');
  const [dummyChecklist, setDummyChecklist] = useState<DummyChecklistRow[]>([]);
  const [dummyChecklistReporte, setDummyChecklistReporte] = useState<DummyChecklistReporte | null>(null);
  const [dummyChecklistTipo, setDummyChecklistTipo] = useState<string>('general');

  // Cámara para la evidencia de una actividad del checklist
  const [activeCameraItem, setActiveCameraItem] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  const buildImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_URL || '';
    const base = apiBase && apiBase.includes('http') ? apiBase.replace(/\/api\/?$/, '') : '';
    if (base) return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    try {
      const current = new URL(window.location.origin);
      if (current.port === '5173') current.port = '5110';
      return `${current.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  };

  const openImagePreview = (url?: string, title?: string) => {
    const src = buildImageUrl(url);
    if (!src) return;
    setImagePreview({ src, title });
    setImageOpen(true);
  };

  const prioridadOptions = useMemo(
    () =>
      Object.entries(PrioridadNombres).map(([value, label]) => ({
        value,
        label
      })),
    []
  );

  const estadoOptions = useMemo(
    () =>
      Object.entries(EstadoOrdenNombres).map(([value, label]) => ({
        value,
        label
      })),
    []
  );


  const buildDummyChecklist = useCallback((key: string) => {
    const template = dummyChecklistCatalog[key] || dummyChecklistCatalog.general;
    return template.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      costo: item.costo,
      reportado: item.preset?.reportado ?? false,
      reparado: item.preset?.reparado ?? false,
      verificado: item.preset?.verificado ?? false
    }));
  }, []);

  const loadChecklist = useCallback(async () => {
    if (!detalle) return;
    setLoadingChecklist(true);
    setChecklistError('');
    setChecklistSource('default');
    try {
      let items: ChecklistTemplateItem[] = [];

      // 0) Items ya guardados en OrdenTrabajoChecklistItem (Prioridad Máxima)
      if (detalle.itemsChecklist && detalle.itemsChecklist.length > 0) {
        items = (detalle.itemsChecklist as any[]).map((ic, idx) => ({
          id: ic.checklistItemId && ic.checklistItemId > 0 ? ic.checklistItemId : -ic.id, // ID del ChecklistItem para matching (negativo si es actividad extra)
          orden: idx + 1,
          pregunta: ic.checklistItemPregunta,
          tipoRespuesta: 0,
          obligatorio: true,
          requiereFoto: false,
          costoEstimado: 0,
          // Extra meta
          metaId: ic.id, // ID de la relación para updates
          tipo: ic.tipo // Tipo para distinguir actividades adicionales
        })) as unknown as ChecklistTemplateItem[];
        setChecklistSource('saved');
      }

      // 0.1) Checklist capturado en el reporte de falla (solo los items seleccionados)
      if (!items.length && detalle.itemsChecklistReporte && detalle.itemsChecklistReporte.length > 0) {
        items = (detalle.itemsChecklistReporte as any[]).map((ic, idx) => ({
          id: (ic as any).checklistItemId || ic.id || idx + 1,
          orden: idx + 1,
          pregunta: (ic as any).checklistItemPregunta || (ic as any).pregunta || `Item ${idx + 1}`,
          tipoRespuesta: 0,
          obligatorio: true,
          requiereFoto: false,
          costoEstimado: undefined
        })) as unknown as ChecklistTemplateItem[];
        setChecklistSource('reporte');
      }

      // 0.2) Si ya hay respuestas guardadas con preguntas, usa eso antes de llamar APIs
      if (!items.length && detalle.respuestasChecklist?.length) {
        items = (detalle.respuestasChecklist as any[]).map((r, idx) => ({
          id: r.checklistItemId || idx + 1,
          orden: idx + 1,
          pregunta: r.pregunta || `Item ${idx + 1}`,
          tipoRespuesta: 0,
          obligatorio: true,
          requiereFoto: false,
          costoEstimado: r.costoEstimado
        })) as unknown as ChecklistTemplateItem[];
        setChecklistSource('reporte');
      }

      if (!items.length) {
      // 1) Checklist del tipo del vehículo (12.3: ya no hay asignación por vehículo)
      const tplRes = await checklistService.getPorVehiculo(detalle.vehiculoId);
      if (tplRes.success && tplRes.data) {
        items = (tplRes.data.items || []).slice().sort((a, b) => a.orden - b.orden);
        setChecklistSource('tipo');
      }

      // 2) Ultimo recurso: checklist basico por defecto
      if (!items.length) {
        items = checklistService.getDefaultInspectionChecklist() as unknown as ChecklistTemplateItem[];
        setChecklistSource('default');
      }

      // Si los items no tienen id valido, no permitir guardado
      if (!items.every((i) => typeof i.id === 'number' && i.id > 0)) {
        items = checklistService.getDefaultInspectionChecklist() as unknown as ChecklistTemplateItem[];
        setChecklistSource('default');
      }
      } // cierre if !items.length

      const map: Record<number, { valor: string; notas?: string; cantidad?: number; fotoUrl?: string }> = {};
      
      // Mapear desde OrdenTrabajoChecklistItem si existe
      if (detalle.itemsChecklist) {
        detalle.itemsChecklist.forEach(ic => {
          const respuestaKey =
            ic.checklistItemId && ic.checklistItemId > 0
              ? ic.checklistItemId
              : -ic.id;

          map[respuestaKey] = { 
            valor: ic.estado === 'Completado' ? 'OK' : '', 
            notas: ic.notas || '', 
            cantidad: ic.cantidad,
            fotoUrl: (ic as any).fotoUrl
          };
        });
      }

      // Mapear desde respuestas (legacy o complementario)
      detalle.respuestasChecklist?.forEach((r) => {
        if (!map[r.checklistItemId] || !map[r.checklistItemId].valor) {
          map[r.checklistItemId] = { 
            ...map[r.checklistItemId], 
            valor: r.valor || '', 
            notas: r.notas || map[r.checklistItemId]?.notas || '', 
            cantidad: r.cantidad || map[r.checklistItemId]?.cantidad,
            fotoUrl: r.fotoUrl || (map[r.checklistItemId] as any)?.fotoUrl
          };
        }
      });

      items.forEach((i) => {
        if (!map[i.id]) map[i.id] = { valor: '' };
      });

      setChecklistItems(items);
      setChecklistRespuestas(map);
    } catch (err) {
      console.error('No se pudo cargar checklist', err);
      setChecklistError('No se pudo cargar el checklist');
    } finally {
      setLoadingChecklist(false);
    }
  }, [detalle]);

  const loadTecnicos = async () => {
    try {
      // Primer intento: usuariosService.getTecnicos
      const res = await usuariosService.getTecnicos();
      let lista: { id: number; nombre: string }[] = [];
      if (res.success && res.data) {
        const data: any = res.data;
        const listaRaw: any[] =
          (data.items as any[]) ||
          (data.Items as any[]) ||
          (Array.isArray(data) ? data : []);
        lista = listaRaw.map((t) => ({ id: t.id, nombre: t.nombreCompleto || t.username || `Tecnico ${t.id}` }));
      }

      // Fallback: catalogosService.getTecnicos (incluye inactivos si viene vacio)
      if (lista.length === 0) {
        const fallback = await catalogosService.getTecnicos(false);
        if (fallback.success && fallback.data) {
          lista = fallback.data.map((t: any) => ({
            id: t.id,
            nombre: t.nombreCompleto || t.nombre || `Tecnico ${t.id}`
          }));
        }
      }

      setTecnicos(lista);
      const currentTechId =
        detalle?.tecnicoAsignadoId ??
        detalle?.tecnicoId ??
        detalle?.firmadoPorId ??
        (detalle as any)?.asignadoAId ??
        detalle?.tecnicoAsignado?.id;
      
      if (lista.length > 0) {
        if (currentTechId) {
          const found = lista.find((t) => t.id === currentTechId);
          if (found) {
            setTecnicoAsignado({ value: found.id, label: found.nombre });
          }
        } else if (detalle && (detalle as any).tecnicoAsignadoId) {
           // Si el backend asignó uno automáticamente
           const autoId = (detalle as any).tecnicoAsignadoId;
           const found = lista.find((t) => t.id === autoId);
           if (found) {
             setTecnicoAsignado({ value: found.id, label: found.nombre });
           }
        }
      }
    } catch (err) {
      console.error('No se pudieron cargar tecnicos', err);
      setTecnicos([]);
    }
  };

  const loadOrdenes = async () => {
    setLoading(true);
    setError('');
    try {
      if (ordenId) {
        const res = await ordenesService.getById(ordenId);
        if (res.success && res.data) {
          setDetalle(res.data);
          if (res.data.reporteFallaId) {
            try {
              const rep = await reportesService.getById(res.data.reporteFallaId);
              if (rep.success && rep.data) {
                let repData = rep.data as ReporteFalla;
                try {
                  const evid = await reportesService.getEvidencias(repData.id);
                  if (evid.success && evid.data) {
                    repData = { ...repData, evidencias: evid.data as Evidencia[] };
                  }
                } catch {
                  // ignore evid error
                }
                setReporteDetalle(repData);
              } else {
                setReporteDetalle(null);
              }
            } catch {
              setReporteDetalle(null);
            }
          } else {
            setReporteDetalle(null);
          }
        } else {
          setDetalle(null);
          setError(res.message || 'No se pudo cargar la orden');
        }
      } else if (isMisOrdenes) {
        const res = await ordenesService.getMisOrdenes();
        if (res.success && res.data) {
          setOrdenes(res.data || []);
        } else {
          setOrdenes([]);
          setError(res.message || 'No se pudieron cargar tus ordenes');
        }
      } else {
        const res = await ordenesService.getAll({
          busqueda: filters.busqueda || undefined,
          estado: filters.estado ? Number(filters.estado) : undefined,
          prioridad: filters.prioridad ? Number(filters.prioridad) : undefined,
          page: 1,
          pageSize: 20
        });
        if (res.success && res.data) {
          const data: unknown = res.data as unknown;
          const items =
            (data as { items?: OrdenTrabajoList[]; Items?: OrdenTrabajoList[] }).items ||
            (data as { items?: OrdenTrabajoList[]; Items?: OrdenTrabajoList[] }).Items ||
            (Array.isArray(data) ? (data as OrdenTrabajoList[]) : []);
          setOrdenes(items);
        } else {
          setOrdenes([]);
          setError(res.message || 'No se pudo cargar la lista de ordenes');
        }
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de ordenes');
      setOrdenes([]);
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La lista de técnicos solo se usa para asignar (Líder y Operador consultan)
    if (puedeTrabajarOrden) loadTecnicos();
  }, []);

  useEffect(() => {
    loadOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId, isMisOrdenes]);

  useEffect(() => {
    if (!detalle) {
      setDummyChecklist([]);
      setDummyChecklistReporte(null);
      setDummyChecklistTipo('general');
      setChecklistSource('default');
      return;
    }
    loadChecklist();
    setCambiandoTecnico(false);
    const key = resolveChecklistKey(detalle.vehiculoTipo || detalle.tipoMantenimiento || detalle.vehiculoCodigo);
    setDummyChecklistTipo(key);
    setDummyChecklist(buildDummyChecklist(key));
    setDummyChecklistReporte(null);
  }, [detalle, buildDummyChecklist, loadChecklist]);

  // Foto del tipo de vehiculo, para dibujar encima los componentes con falla del reporte.
  // Resolvemos el tipo por ID (leyendo el vehiculo), que es lo unico confiable; el
  // nombre que viene en la orden es el nombre del enum y no siempre casa con el catalogo.
  useEffect(() => {
    const vehiculoId = detalle?.vehiculoId;
    if (!vehiculoId) {
      setVehicleImageUrl(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [vehRes, catRes] = await Promise.all([
          vehiculosService.getById(vehiculoId),
          catalogosService.getTiposVehiculo(),
        ]);
        if (cancelled) return;

        const tipos = catRes.success && Array.isArray(catRes.data) ? catRes.data : [];
        if (!tipos.length) {
          setVehicleImageUrl(undefined);
          return;
        }

        const tipoId = vehRes.success && vehRes.data ? Number(vehRes.data.tipo) : NaN;
        let tipo = Number.isFinite(tipoId) ? tipos.find((t) => t.id === tipoId) : undefined;

        // Respaldo: casar por nombre normalizado (sin acentos, espacios ni mayusculas).
        if (!tipo) {
          const norm = (s?: string) =>
            (s || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '')
              .toLowerCase();
          const objetivo = norm(detalle?.vehiculoTipo);
          if (objetivo) tipo = tipos.find((t) => norm(t.nombre) === objetivo);
        }

        const preferida = tipo?.imagenFallasUrl || tipo?.imagenUrl;
        setVehicleImageUrl(preferida ? getFullImageUrl(preferida) : undefined);
      } catch {
        if (!cancelled) setVehicleImageUrl(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detalle?.id, detalle?.vehiculoId, detalle?.vehiculoTipo]);

  const updateChecklistRespuesta = (id: number, changes: { valor?: string; notas?: string; cantidad?: number; fotoUrl?: string }) => {
    setChecklistRespuestas((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  /** PDF 06-nov: el avance se captura solo con la reparación iniciada */
  const enReparacion =
    detalle?.estado === EstadoOrdenTrabajo.EnProceso || detalle?.estado === EstadoOrdenTrabajo.EsperandoRefacciones;

  /**
   * PDF 06-nov: no se puede terminar hasta que todas las actividades estén completadas y con su evidencia.
   * (El checklist básico de respaldo no se guarda en la orden, así que no detiene el cierre.)
   */
  const actividadesFaltantes = checklistSource === 'default'
    ? []
    : checklistItems.filter((i) => checklistRespuestas[i.id]?.valor !== 'OK' || !checklistRespuestas[i.id]?.fotoUrl);
  const bloqueoTerminar = actividadesFaltantes.length > 0
    ? `Para terminar la reparación marca como completadas todas las actividades del checklist con su foto de evidencia (faltan ${actividadesFaltantes.length}).`
    : undefined;

  /**
   * Guarda al momento el avance de una actividad (ya no hay botón "Guardar checklist", PDF 06-nov).
   * Si la actividad todavía no existe en la orden (checklist tomado del reporte o del tipo), la crea.
   */
  const persistirItem = async (
    item: ChecklistTemplateItem,
    cambios: { estado?: string; cantidad?: number; notas?: string }
  ): Promise<boolean> => {
    if (!detalle || checklistSource === 'default') return true;
    let metaId = (item as any).metaId as number | undefined;
    const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
    try {
      if (!metaId && tipoItem === 'Checklist' && item.id > 0) {
        const resp = checklistRespuestas[item.id];
        const creado = await ordenTrabajoChecklistItemService.create({
          ordenTrabajoId: detalle.id,
          checklistItemId: item.id,
          cantidad: resp?.cantidad,
          notas: resp?.notas
        });
        if (!creado.success || !creado.data) {
          toast.error(creado.message || 'No se pudo guardar el avance');
          return false;
        }
        metaId = creado.data.id;
        (item as any).metaId = metaId;
        if (resp?.fotoUrl) await ordenTrabajoChecklistItemService.update(metaId, { fotoUrl: resp.fotoUrl, tipo: 'Checklist' });
      }
      if (!metaId) return true;
      const res = await ordenTrabajoChecklistItemService.update(metaId, { ...cambios, tipo: tipoItem });
      if (!res.success) {
        toast.error(res.message || 'No se pudo guardar el avance');
        return false;
      }
      return true;
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar el avance. Revisa tu conexión.');
      return false;
    }
  };

  /**
   * Al terminar la reparación: guarda el checklist completo (cantidades y notas de cada actividad y las respuestas
   * que usa el cálculo de la orden de pago). Así ya no hace falta el botón "Guardar checklist".
   */
  const guardarChecklistAlTerminar = async (): Promise<{ success: boolean; message?: string }> => {
    if (!detalle) return { success: false };
    for (const item of checklistItems) {
      const resp = checklistRespuestas[item.id];
      if (!resp) continue;
      const ok = await persistirItem(item, {
        estado: resp.valor === 'OK' ? 'Completado' : 'Pendiente',
        cantidad: resp.cantidad,
        notas: resp.notas
      });
      if (!ok) return { success: false, message: 'No se pudo guardar el checklist; revisa tu conexión e inténtalo de nuevo.' };
    }
    const respuestas = checklistItems
      .filter((i) => i.id && i.id > 0)
      .map((i) => ({
        checklistItemId: i.id,
        valor: (checklistRespuestas[i.id]?.valor || '').toString(),
        notas: checklistRespuestas[i.id]?.notas || undefined,
        cantidad: checklistRespuestas[i.id]?.cantidad && checklistRespuestas[i.id]!.cantidad! > 0 ? checklistRespuestas[i.id]?.cantidad : undefined,
        fotoUrl: checklistRespuestas[i.id]?.fotoUrl
      }));
    if (respuestas.length > 0) {
      const res = await checklistService.guardarRespuestas({ ordenTrabajoId: detalle.id, respuestas });
      if (!res.success) return { success: false, message: res.message || 'No se pudo guardar el checklist' };
    }
    return { success: true };
  };

  const applyFilters = () => {
    if (!ordenId) {
      loadOrdenes();
    }
  };

  // "Limpiar": la recarga va en un efecto para que use los filtros ya vacíos. Antes se llamaba
  // directo y tomaba los filtros anteriores, así que la lista seguía filtrada.
  const [limpiezas, setLimpiezas] = useState(0);
  useEffect(() => {
    if (limpiezas > 0 && !ordenId) loadOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limpiezas]);

  const resetFilters = () => {
    setFilters({ busqueda: '' });
    setLimpiezas((n) => n + 1);
  };

  /**
   * Ejecuta una acción de la orden y devuelve si salió bien. El error va dentro de la ventana activa
   * (alFallar) o en un aviso visible; antes iba al banner de la página, que quedaba detrás de la
   * ventana y además ocultaba el detalle de la orden. Al salir bien muestra el aviso de éxito.
   */
  const doAccion = async (
    fn: () => Promise<unknown>,
    opciones: { exito?: string; alFallar?: (mensaje: string) => void } = {}
  ): Promise<boolean> => {
    const fallar = (mensaje: string) => (opciones.alFallar ? opciones.alFallar(mensaje) : toast.error(mensaje));
    setAccionando(true);
    try {
      const result = await fn();
      if (result && typeof result === 'object' && 'success' in (result as any)) {
        const r = result as any;
        if (!r.success) {
          fallar(r.message || 'No se pudo completar la acción');
          return false;
        }
      }
      if (result === false) return false;
      if (opciones.exito) toast.exito(opciones.exito);
      await loadOrdenes();
      return true;
    } catch (err) {
      console.error(err);
      fallar('No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setAccionando(false);
    }
  };

  /**
   * Impresión de la Orden de Trabajo (PDF 06-nov, propósito operativo, sin importes): folios, fechas, vehículo,
   * técnico y empresa, tipo y prioridad, actividades con su evidencia, refacciones utilizadas y fecha de finalización.
   */
  const imprimirOrden = async () => {
    if (!detalle) return;
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
      toast.aviso('Permite las ventanas emergentes para imprimir la orden.');
      return;
    }
    ventana.document.write('<p style="font-family:Arial">Preparando la orden...</p>');
    const mat = await flujoService.materiales(detalle.id);
    const materiales = mat.success && mat.data ? mat.data.items.filter((m) => m.descontado) : [];
    const esc = (t?: string | number | null) =>
      String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fecha = (f?: string | null) => (f ? new Date(f).toLocaleString('es-MX') : '—');
    const actividades = checklistItems.map((item, idx) => {
      const r = checklistRespuestas[item.id] || { valor: '' };
      return `<tr>
        <td>${idx + 1}</td>
        <td>${esc(item.pregunta)}${r.notas ? `<div class="nota">${esc(r.notas)}</div>` : ''}</td>
        <td class="c">${esc(r.cantidad ?? 1)}</td>
        <td class="c">${r.valor === 'OK' ? 'Completada' : 'Pendiente'}</td>
        <td class="c">${r.fotoUrl ? `<img src="${esc(buildImageUrl(r.fotoUrl))}" alt="Evidencia" />` : '—'}</td>
      </tr>`;
    }).join('');
    const filasMateriales = materiales.map((m) =>
      `<tr><td>${esc(m.nombre)}</td><td>${esc(m.codigo)}</td><td class="c">${esc(m.cantidad)} ${esc(m.unidad)}</td></tr>`
    ).join('');
    const empresa = detalle.empresaNombre || '—';
    const dato = (etiqueta: string, valor: string) => `<div class="dato"><span>${etiqueta}</span><b>${valor}</b></div>`;
    ventana.document.open();
    ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Orden de trabajo ${esc(detalle.folio)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
        h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; }
        .cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; }
        .datos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 24px; margin-top: 12px; font-size: 13px; }
        .dato span { color: #555; margin-right: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 5px; vertical-align: top; text-align: left; }
        th { background: #f0f0f0; } .c { text-align: center; } .nota { color: #555; font-size: 11px; }
        img { max-width: 120px; max-height: 90px; object-fit: cover; }
      </style></head><body>
      <div class="cab"><div><h1>Orden de Trabajo ${esc(detalle.folio)}</h1><div>Continental · Mantenimiento de flota</div></div>
        <div>Estado: <b>${esc(detalle.estadoNombre || EstadoOrdenNombres[detalle.estado])}</b></div></div>
      <div class="datos">
        ${dato('Folio de orden de trabajo:', esc(detalle.folio))}
        ${dato('Folio de reporte de falla:', esc(detalle.reporteFallaFolio || '—'))}
        ${dato('Fecha del reporte:', fecha(detalle.reporteFechaReporte))}
        ${dato('Fecha de la orden:', fecha(detalle.fechaCreacion))}
        ${dato('Vehículo:', `${esc(detalle.vehiculoCodigo)}${detalle.vehiculoTipo ? ` · ${esc(detalle.vehiculoTipo)}` : ''}`)}
        ${dato('Técnico responsable:', esc(detalle.tecnicoNombre || '—'))}
        ${dato('Empresa responsable:', esc(empresa))}
        ${dato('Tipo de mantenimiento:', esc(detalle.tipoMantenimiento))}
        ${dato('Prioridad:', esc(detalle.prioridadNombre || PrioridadNombres[detalle.prioridad]))}
        ${dato('Fecha de finalización:', fecha(detalle.fechaFinalizacion))}
      </div>
      <h2>Actividades realizadas</h2>
      ${actividades ? `<table><thead><tr><th>#</th><th>Actividad</th><th class="c">Cantidad</th><th class="c">Estado</th><th class="c">Evidencia</th></tr></thead><tbody>${actividades}</tbody></table>` : '<p>Sin actividades registradas.</p>'}
      <h2>Refacciones utilizadas</h2>
      ${filasMateriales ? `<table><thead><tr><th>Material</th><th>Código</th><th class="c">Cantidad</th></tr></thead><tbody>${filasMateriales}</tbody></table>` : '<p>Sin refacciones ni consumibles registrados.</p>'}
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    ventana.document.close();
  };

  const startGeneralCamera = async (itemId?: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (itemId) setActiveCameraItem(itemId);
      // Wait for state update and ref render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo acceder a la cámara. Revisa los permisos del navegador o usa la galería.');
    }
  };

  const stopGeneralCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setActiveCameraItem(null);
  };

  const captureChecklistItemPhoto = () => {
    if (!videoRef.current || !detalle || !activeCameraItem) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    const item = checklistItems.find(i => i.id === activeCameraItem);
    if (!item) return;

    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `checklist-${item.id}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setUploadingItemMap(prev => ({...prev, [item.id]: true}));
        
        try {
          const res = await ordenesService.uploadEvidencia(
            detalle.id, 
            file, 
            `Evidencia ítem: ${item.pregunta}`,
            'checklist'
          );
          if (!res.success || !res.data) {
            toast.error(res.message || 'No se pudo subir la foto');
            return;
          }
          {
            const newUrl = res.data.urlImagen;
            updateChecklistRespuesta(item.id, { fotoUrl: newUrl });
            
            // Actualizar inmediatamente en el backend
            let metaId = (item as any).metaId;
            const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
            if (
              !metaId &&
              tipoItem === 'Checklist' &&
              (checklistSource === 'reporte' || checklistSource === 'vehiculo' || checklistSource === 'tipo')
            ) {
                const created = await ordenTrabajoChecklistItemService.create({
                  ordenTrabajoId: detalle.id,
                  checklistItemId: item.id
                });
                if (created.success && created.data) {
                  metaId = created.data.id;
                  (item as any).metaId = metaId;
                }
            }

            if (metaId) {
              const upd = await ordenTrabajoChecklistItemService.update(metaId, {
                fotoUrl: newUrl,
                tipo: tipoItem
              });
              if (!upd.success) {
                toast.error(upd.message || 'La foto se subió, pero no se pudo ligar al punto del checklist');
                return;
              }
            }
            toast.exito('Evidencia guardada');
            stopGeneralCamera();
          }
        } catch (err) {
          console.error('Error al subir foto de checklist', err);
          toast.error('No se pudo subir la foto. Revisa tu conexión.');
        } finally {
          setUploadingItemMap(prev => ({...prev, [item.id]: false}));
        }
      }
    }, 'image/jpeg', 0.9);
  };

  const renderDetalle = () => {
    if (!detalle) return null;

    const descripcionMostrar = () => {
      if (!detalle.descripcion || detalle.descripcion.trim().length === 0) return 'Inspeccion rapida (ver checklist)';
      if (detalle.descripcion.toLowerCase().includes('checklist de inspeccion rapida')) return 'Inspeccion rapida (ver checklist)';
      return detalle.descripcion;
    };

    const tiempos = [
      { label: 'Horas trabajadas', value: detalle.horasTrabajadas },
      { label: 'Horas herramienta', value: detalle.horasHerramienta },
      { label: 'Tiempo de espera (h)', value: detalle.tiempoEsperaHoras },
      { label: 'Tiempo en reparacion (h)', value: detalle.tiempoReparacionHoras },
      { label: 'Tiempo en transicion (h)', value: detalle.tiempoTransicionHoras }
    ].filter((t) => t.value !== undefined && t.value !== null);

    // "Terminar reparación" (PDF 06-nov): solo con el checklist completo; la vista previa es folio, checklist y materiales
    const abrirCompletar = () => {
      if (bloqueoTerminar) {
        toast.aviso(bloqueoTerminar);
        return;
      }
      setShowCompletar(true);
      setCompError('');
      setCompHoras(detalle.horasTrabajadas ? String(detalle.horasTrabajadas) : '1');
      setMaterialesAlTerminar(null);
      void flujoService.materiales(detalle.id).then((r) => setMaterialesAlTerminar(r.success && r.data ? r.data.items.filter((m) => !m.descontado) : []));
    };

    const nombreTecnicoAsignado =
      detalle.tecnicoNombre ||
      detalle.tecnicoAsignadoNombre ||
      detalle.firmadoPorNombre ||
      detalle.tecnicoAsignado?.nombreCompleto ||
      detalle.tecnicoAsignado?.nombre ||
      detalle.tecnicoAsignado?.username ||
      (typeof detalle.tecnicoAsignado === 'string' ? detalle.tecnicoAsignado : '') ||
      (detalle as any)?.asignadoA ||
      detalle.firmaAsignacionTexto ||
      'No asignado';

    const buildUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      const apiBase = import.meta.env.VITE_API_URL || '';
      const base = apiBase && apiBase.includes('http') ? apiBase.replace(/\/api\/?$/, '') : '';
      if (base) return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
      // fallback: if running on 5173, try 5110
      try {
        const current = new URL(window.location.origin);
        if (current.port === '5173') current.port = '5110';
        return `${current.origin}${url.startsWith('/') ? '' : '/'}${url}`;
      } catch {
        return url;
      }
    };

    const formatCurrency = (value: number) =>
      value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const resetDummyChecklist = () => {
      const template = dummyChecklistCatalog[dummyChecklistTipo] || dummyChecklistCatalog.general;
      setDummyChecklist(
        template.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          costo: item.costo,
          reportado: item.preset?.reportado ?? false,
          reparado: item.preset?.reparado ?? false,
          verificado: item.preset?.verificado ?? false
        }))
      );
      setDummyChecklistReporte(null);
    };

    const toggleDummyChecklist = (id: string, field: 'reportado' | 'reparado' | 'verificado') => {
      setDummyChecklist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: !item[field] } : item))
      );
      setDummyChecklistReporte(null);
    };

    const costoAplicado = (item: DummyChecklistRow) => (item.reparado || item.verificado ? item.costo : 0);
    const totalCostoChecklist = dummyChecklist.reduce((acc, item) => acc + costoAplicado(item), 0);
    const completadosChecklist = dummyChecklist.filter((item) => item.reparado || item.verificado).length;

    return (
      <div className="space-y-4">
              <Button variant="ghost" className="flex items-center gap-2">
                <Link to={isMisOrdenes ? '/mis-ordenes' : '/ordenes'}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver al listado
                </Link>
              </Button>

        {/* Seguimiento del flujo de 7 etapas con las acciones del usuario (PDF 23-oct-2026) */}
        <Card className="p-6" data-testid="seguimiento-orden">
          <p className="mb-3 text-sm uppercase tracking-[0.25em] text-continental-gray-1">Seguimiento · {detalle.folio}</p>
          <PanelFlujo
            ordenId={detalle.id}
            onTerminar={abrirCompletar}
            onCambio={() => { setVersionFlujo((v) => v + 1); void loadOrdenes(); }}
            version={`${detalle.estado}-${detalle.tecnicoAsignadoId ?? ''}`}
            bloqueoTerminar={bloqueoTerminar}
          />
        </Card>

        {/* Refacciones y consumibles usados (PDF 06-nov): solo informativos, sin costos. Los consulta el Gerente de
            Mantenimiento; el técnico solo ve la sección mientras los captura en TALLER */}
        {hasRole(['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico']) && (
          <MaterialesOrden
            ordenId={detalle.id}
            version={`${detalle.estado}-${detalle.tecnicoAsignadoId ?? ''}-${versionFlujo}`}
            soloCaptura={!hasRole(['SuperUsuario', 'Administrador', 'Supervisor'])}
          />
        )}

        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-continental-gray-1">Orden de trabajo</p>
              <h2 className="text-2xl font-semibold text-continental-black">
                {detalle.folio} - {detalle.vehiculoCodigo}
              </h2>
              <p className="text-continental-gray-1">Prioridad {detalle.prioridadNombre || PrioridadNombres[detalle.prioridad]}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary">{detalle.estadoNombre || EstadoOrdenNombres[detalle.estado]}</Badge>
              {canEliminar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEliminarOrden}
                  disabled={eliminandoOrden}
                  className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50 print:hidden"
                >
                  {eliminandoOrden ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar orden
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* PDF 06-nov: una sola versión del reporte (antes "Descripción" y "Reporte asociado" repetían lo mismo) */}
            <div className="space-y-2 text-sm text-continental-gray-1" data-testid="datos-reporte">
              <p className="font-semibold text-continental-black">
                {detalle.reporteFallaFolio ? `Reporte de falla ${detalle.reporteFallaFolio}` : 'Descripción'}
              </p>
              <p className="text-continental-black">{reporteDetalle?.descripcion || descripcionMostrar()}</p>
              {reporteDetalle && (
                <p className="text-xs text-continental-gray-1">
                  Reportado {new Date(reporteDetalle.fechaReporte).toLocaleString()}
                  {reporteDetalle.reportadoPorNombre ? ` por ${reporteDetalle.reportadoPorNombre}` : ''}
                  {reporteDetalle.ubicacion ? ` · Ubicación: ${reporteDetalle.ubicacion}` : ''}
                </p>
              )}
              {detalle.trabajoRealizado && (
                <>
                  <p className="font-semibold text-continental-black mt-2">Trabajo realizado</p>
                  <p className="text-continental-black">{detalle.trabajoRealizado}</p>
                </>
              )}
            </div>
            <div className="space-y-2 text-sm text-continental-gray-1">
              <p>Tipo: {detalle.tipoMantenimiento}</p>
              <p data-testid="tecnico-orden">Técnico: {nombreTecnicoAsignado}</p>
              <p>Creada: {new Date(detalle.fechaCreacion).toLocaleString()}</p>
              {detalle.fechaFinalizacion && <p>Finalizada: {new Date(detalle.fechaFinalizacion).toLocaleString()}</p>}
              {detalle.herramientasUsadas && <p>Herramientas: {detalle.herramientasUsadas}</p>}
              {tiempos.length > 0 && (
                <div className="space-y-1">
                  {tiempos.map((t) => (
                    <p key={t.label}>{t.label}: {t.value}</p>
                  ))}
                </div>
              )}
              {/* PDF 06-nov: solo se asigna con "Confirmar y asignar"; ya asignado, solo el Gerente de Mantenimiento
                  (o administración) lo cambia, y a propósito ("Cambiar técnico") */}
              {puedeAsignarYCancelar && detalle.estado !== EstadoOrdenTrabajo.Completada && detalle.estado !== EstadoOrdenTrabajo.Validada
                && detalle.estado !== EstadoOrdenTrabajo.Entregado && detalle.estado !== EstadoOrdenTrabajo.Cancelada
                && detalle.tecnicoAsignadoId && !cambiandoTecnico && (
                <Button size="sm" variant="outline" className="print:hidden" onClick={() => { setTecnicoAsignado(null); setFirmaError(''); setCambiandoTecnico(true); }}>
                  Cambiar técnico
                </Button>
              )}
              {puedeAsignarYCancelar && detalle.estado !== EstadoOrdenTrabajo.Completada && detalle.estado !== EstadoOrdenTrabajo.Validada
                && detalle.estado !== EstadoOrdenTrabajo.Entregado && detalle.estado !== EstadoOrdenTrabajo.Cancelada
                && (!detalle.tecnicoAsignadoId || cambiandoTecnico) && (
                <div className="space-y-2 pt-2" data-testid="asignar-tecnico">
                  <p className="font-semibold text-continental-black">
                    {detalle.tecnicoAsignadoId ? 'Cambiar técnico' : 'Asignar técnico'}
                  </p>
                  <p className="text-xs text-continental-gray-2">
                    {detalle.tecnicoAsignadoId
                      ? 'Elige al nuevo técnico y confirma. El cambio queda registrado.'
                      : 'Elige al técnico y confirma con "Confirmar y asignar". También puede aceptarla un técnico desde su lista.'}
                  </p>
                  <SearchableSelect
                    placeholder="Buscar tecnico"
                    selected={tecnicoAsignado}
                    onSelect={(opt) => setTecnicoAsignado(opt)}
                  fetchOptions={async (q) =>
                    tecnicos
                      .filter((t: any) => t.nombre.toLowerCase().includes((q || '').toLowerCase()))
                      .map((t: any) => ({ value: t.id, label: t.nombre }))
                  }
                    noResultsText="Sin tecnicos"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!detalle || !tecnicoAsignado) return;
                      
                      setAsignandoTecnico(true);
                      setFirmaError('');
                      
                      const targetTechId = Number(tecnicoAsignado.value);
                      const nombreFirma = user?.nombreCompleto || user?.username || 'Sistema';

                      try {
                        const asignRes = await ordenesService.asignarTecnico(detalle.id, {
                          tecnicoId: targetTechId,
                          tecnicoAsignadoId: targetTechId,
                          firmadoPorId: user?.id,
                          firmaAsignacionTexto: nombreFirma
                        });

                        if (!asignRes?.success) {
                          setFirmaError(asignRes?.message || 'No se pudo asignar el tecnico');
                          return;
                        }

                        toast.exito(`Técnico asignado: ${tecnicoAsignado.label}`);
                        setCambiandoTecnico(false);
                        await loadOrdenes();
                      } catch (err) {
                        setFirmaError('Error de conexión');
                      } finally {
                        setAsignandoTecnico(false);
                      }
                    }}
                    disabled={accionando || asignandoTecnico || !tecnicoAsignado}
                    className="flex items-center gap-2 bg-continental-gradient text-white"
                  >
                    {asignandoTecnico ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Confirmar y Asignar
                  </Button>
                  {cambiandoTecnico && (
                    <Button size="sm" variant="ghost" onClick={() => setCambiandoTecnico(false)} disabled={asignandoTecnico}>
                      No cambiar
                    </Button>
                  )}
                  {firmaError && <p className="text-xs text-red-600">{firmaError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* En solo lectura se ven las respuestas y fotos, pero no se pueden cambiar. PDF 06-nov: el avance se guarda
              solo (sin "Guardar checklist") y solo se captura con la reparación iniciada */}
          <fieldset disabled={!puedeTrabajarOrden || !enReparacion} className="min-w-0 space-y-2" data-testid="checklist-orden">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-continental-black">Checklist</p>
            </div>
            {puedeTrabajarOrden && !enReparacion && checklistItems.length > 0
              && (detalle.estado === EstadoOrdenTrabajo.Pendiente || detalle.estado === EstadoOrdenTrabajo.Asignada) && (
              <p className="text-sm text-continental-gray-1" data-testid="checklist-bloqueado">
                El avance del checklist se registra después de "Iniciar reparación".
              </p>
            )}
            {loadingChecklist && <p className="text-sm text-continental-gray-1">Cargando checklist...</p>}
            {checklistError && <p className="text-sm text-red-600">{checklistError}</p>}
            {checklistSource === 'default' && !loadingChecklist && (
              <p className="text-sm text-continental-gray-2">
                Checklist basico de respaldo. Asigna un checklist al vehiculo para poder guardarlo.
              </p>
            )}
            {!loadingChecklist && checklistItems.length === 0 && (
              <p className="text-sm text-continental-gray-2">Checklist no disponible.</p>
            )}
            {!loadingChecklist && checklistItems.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-2 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left text-continental-black">#</th>
                      <th className="px-4 py-2 text-left text-continental-black">Actividad</th>
                      <th className="px-4 py-2 text-center text-continental-black">Completado</th>
                      <th className="px-4 py-2 text-center text-continental-black">Cantidad</th>
                      <th className="px-4 py-2 text-center text-continental-black">Evidencia*</th>
                      <th className="px-4 py-2 text-left text-continental-black">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistItems.map((item) => {
                      const resp = checklistRespuestas[item.id] || { valor: '', notas: '' };
                      const checked = resp.valor === 'OK';
                      
                      return (
                        <tr key={item.id} className="border-t border-continental-gray-3/60">
                          <td className="px-4 py-2 font-semibold text-continental-black">#{item.orden}</td>
                          <td className="px-4 py-2 text-continental-black">
                            <div className="flex flex-col">
                              <span>{item.pregunta}</span>
                              {resp.cantidad !== undefined && resp.cantidad !== null && resp.cantidad > 0 && (
                                <span className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider bg-yellow-50 px-1 rounded w-fit mt-0.5">
                                  Solicitado: {resp.cantidad}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              aria-label={`Completado: ${item.pregunta}`}
                              onChange={async (e) => {
                                const marcado = e.target.checked;
                                if (marcado && !resp.fotoUrl) {
                                  toast.aviso('Debes subir una foto de evidencia antes de marcar como completado.');
                                  return;
                                }
                                updateChecklistRespuesta(item.id, { valor: marcado ? 'OK' : '' });
                                const guardado = await persistirItem(item, { estado: marcado ? 'Completado' : 'Pendiente' });
                                if (!guardado) updateChecklistRespuesta(item.id, { valor: marcado ? '' : 'OK' });
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="w-20 rounded border border-continental-gray-3 px-2 py-1 text-center"
                              value={resp.cantidad ?? ''}
                              aria-label={`Cantidad: ${item.pregunta}`}
                              onChange={(e) =>
                                updateChecklistRespuesta(item.id, {
                                  cantidad: e.target.value === '' ? undefined : Number(e.target.value)
                                })
                              }
                              onBlur={() => {
                                if (resp.cantidad !== undefined && resp.cantidad > 0) void persistirItem(item, { cantidad: resp.cantidad });
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-3">
                              {uploadingItemMap[item.id] ? (
                                <div className="w-12 h-12 flex items-center justify-center bg-continental-bg rounded-lg">
                                  <Loader2 className="h-5 w-5 animate-spin text-continental-blue" />
                                </div>
                              ) : resp.fotoUrl ? (
                                <div className="flex items-center gap-2">
                                  <div className="relative group w-12 h-12">
                                    <img 
                                      src={buildUrl(resp.fotoUrl)} 
                                      alt="Evidencia" 
                                      className="w-full h-full object-cover rounded-md border border-continental-gray-300 shadow-sm cursor-pointer hover:brightness-75 transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openImagePreview(resp.fotoUrl, item.pregunta || 'Evidencia checklist');
                                      }}
                                    />
                                  <label className="absolute inset-0 cursor-pointer z-0">
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="hidden" 
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file && detalle) {
                                            setUploadingItemMap(prev => ({...prev, [item.id]: true}));
                                            try {
                                              const res = await ordenesService.uploadEvidencia(
                                                detalle.id, 
                                                file, 
                                                `Evidencia ítem: ${item.pregunta}`,
                                                'checklist'
                                              );
                                              if (res.success && res.data) {
                                                const newUrl = res.data.urlImagen;
                                                updateChecklistRespuesta(item.id, { fotoUrl: newUrl });
                                                
                                                // Actualizar inmediatamente en el backend
                                                let metaId = (item as any).metaId;
                                                const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
                                                if (
                                                  !metaId &&
                                                  tipoItem === 'Checklist' &&
                                                  (checklistSource === 'reporte' || checklistSource === 'vehiculo' || checklistSource === 'tipo')
                                                ) {
                                                   const created = await ordenTrabajoChecklistItemService.create({
                                                      ordenTrabajoId: detalle.id,
                                                      checklistItemId: item.id
                                                   });
                                                   if (created.success && created.data) {
                                                      metaId = created.data.id;
                                                      (item as any).metaId = metaId;
                                                   }
                                                }

                                                if (metaId) {
                                                  await ordenTrabajoChecklistItemService.update(metaId, {
                                                    fotoUrl: newUrl,
                                                    tipo: tipoItem
                                                  });
                                                }
                                              }
                                            } catch (err) {
                                              console.error('Error al reemplazar foto de checklist', err);
                                            } finally {
                                              setUploadingItemMap(prev => ({...prev, [item.id]: false}));
                                            }
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="p-1.5 bg-white text-continental-black rounded-lg border border-continental-gray-3/80 shadow-sm hover:bg-continental-bg transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startGeneralCamera(item.id);
                                      }}
                                      title="Reemplazar foto con cámara"
                                    >
                                      <Camera className="h-4 w-4 text-continental-blue" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1.5 bg-white text-continental-black rounded-lg border border-continental-gray-3/80 shadow-sm hover:bg-continental-bg transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openImagePreview(resp.fotoUrl, item.pregunta || 'Evidencia checklist');
                                      }}
                                      title="Ampliar imagen"
                                    >
                                      <Search className="h-4 w-4" />
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        const confirmDelete = await confirmar({
                                          titulo: 'Eliminar evidencia',
                                          mensaje: `¿Eliminar la foto de evidencia de "${item.pregunta || 'este punto'}"?`,
                                          textoConfirmar: 'Eliminar',
                                          tono: 'peligro'
                                        });
                                        if (!confirmDelete) return;

                                        setUploadingItemMap(prev => ({...prev, [item.id]: true}));
                                        try {
                                          const metaId = (item as any).metaId;
                                          const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
                                          if (metaId) {
                                            // Quitar la foto de la pantalla solo si el servidor la borró (antes se quitaba aunque fallara)
                                            const res = await ordenTrabajoChecklistItemService.update(metaId, {
                                              fotoUrl: '',
                                              tipo: tipoItem
                                            });
                                            if (!res.success) {
                                              toast.error(res.message || 'No se pudo eliminar la evidencia');
                                              return;
                                            }
                                          }
                                          updateChecklistRespuesta(item.id, { fotoUrl: '' });
                                          toast.exito('Evidencia eliminada');
                                        } catch (err) {
                                          console.error(err);
                                          toast.error('No se pudo eliminar la evidencia');
                                        } finally {
                                          setUploadingItemMap(prev => ({...prev, [item.id]: false}));
                                        }
                                      }}
                                      className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                                      title="Borrar foto"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <label className="cursor-pointer flex flex-col items-center justify-center w-12 h-12 bg-continental-bg hover:bg-continental-gray-4 rounded-lg border-2 border-dashed border-continental-gray-2 transition-all hover:border-continental-blue group" title="Subir imagen">
                                    <Plus className="h-5 w-5 text-continental-gray-1 group-hover:text-continental-blue" />
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      capture="environment"
                                      className="hidden" 
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file && detalle) {
                                          setUploadingItemMap(prev => ({...prev, [item.id]: true}));
                                          try {
                                            const res = await ordenesService.uploadEvidencia(
                                              detalle.id, 
                                              file, 
                                              `Evidencia ítem: ${item.pregunta}`,
                                              'checklist'
                                            );
                                            if (res.success && res.data) {
                                              const newUrl = res.data.urlImagen;
                                              updateChecklistRespuesta(item.id, { fotoUrl: newUrl });
                                              
                                              // Actualizar inmediatamente en el backend
                                              let metaId = (item as any).metaId;
                                              const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
                                              if (
                                                !metaId &&
                                                tipoItem === 'Checklist' &&
                                                (checklistSource === 'reporte' || checklistSource === 'vehiculo' || checklistSource === 'tipo')
                                              ) {
                                                 const created = await ordenTrabajoChecklistItemService.create({
                                                    ordenTrabajoId: detalle.id,
                                                    checklistItemId: item.id
                                                 });
                                                 if (created.success && created.data) {
                                                    metaId = created.data.id;
                                                    (item as any).metaId = metaId;
                                                 }
                                              }

                                              if (metaId) {
                                                await ordenTrabajoChecklistItemService.update(metaId, {
                                                  fotoUrl: newUrl,
                                                  tipo: tipoItem
                                                });
                                              }
                                            }
                                          } catch (err) {
                                            console.error('Error al subir foto de checklist', err);
                                          } finally {
                                            setUploadingItemMap(prev => ({...prev, [item.id]: false}));
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                  <button
                                    className="cursor-pointer flex flex-col items-center justify-center w-12 h-12 bg-continental-bg hover:bg-continental-gray-4 rounded-lg border-2 border-dashed border-continental-gray-2 transition-all hover:border-continental-blue group"
                                    onClick={() => startGeneralCamera(item.id)}
                                    title="Tomar foto"
                                  >
                                    <Camera className="h-5 w-5 text-continental-gray-1 group-hover:text-continental-blue" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <textarea
                              className="w-full rounded-lg border border-continental-gray-3 px-3 py-2 text-sm"
                              placeholder="Notas u observaciones (opcional)"
                              value={resp.notas || ''}
                              onChange={(e) => updateChecklistRespuesta(item.id, { notas: e.target.value })}
                              onBlur={() => void persistirItem(item, { notas: resp.notas || '' })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>

          {(() => {
            // Componentes con falla marcados sobre la foto del carro al crear el reporte.
            // Vienen en la orden (detalle.imageFaults) y, si no, en el reporte ligado.
            const faults = (detalle.imageFaults?.length ? detalle.imageFaults : reporteDetalle?.imageFaults) || [];
            if (!faults.length) return null;

            const puntos: VehicleImagePoint[] = faults
              .filter((f) => typeof f.xPct === 'number' && typeof f.yPct === 'number')
              .map((f) => ({
                id: f.vehicleImagePointId ?? f.id,
                imageKey: '',
                xPct: f.xPct as number,
                yPct: f.yPct as number,
                imageFaultId: f.imageFaultId,
                imageFaultName: f.imageFaultName,
                active: true,
              }));
            const numeros: Record<number, number> = {};
            puntos.forEach((p, i) => {
              numeros[p.id] = i + 1;
            });

            return (
              <div className="mt-4">
                <p className="font-semibold text-continental-black mb-2">Componentes con falla (imagen)</p>
                <div className="rounded-lg border p-4 bg-continental-gray-5 space-y-4">
                  {puntos.length > 0 && (
                    <InteractiveVehicleImage
                      imageUrl={vehicleImageUrl}
                      points={puntos}
                      pointNumbers={numeros}
                      showPointLabels={false}
                      readonly
                      emptyMessage="No hay componentes con posicion para dibujar."
                    />
                  )}
                  <ul className="space-y-2">
                    {faults.map((f) => {
                      const numero = numeros[f.vehicleImagePointId ?? f.id];
                      return (
                        <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm text-continental-gray-1">
                          {numero ? (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-600 text-[11px] font-bold tabular-nums text-white">
                              {numero}
                            </span>
                          ) : (
                            <span className="font-bold text-continental-yellow">•</span>
                          )}
                          <span className="font-medium text-continental-black">
                            {f.imageFaultName || `Falla #${f.imageFaultId}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })()}

          {reporteDetalle?.evidencias?.length ? (
            <div className="mt-4">
              <p className="font-semibold text-continental-black mb-2">Evidencias del reporte</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {reporteDetalle.evidencias.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-continental-gray-3/60 bg-continental-bg p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <img
                        src={buildUrl(ev.urlImagen)}
                        alt={ev.descripcion || 'Evidencia'}
                        className="h-24 w-full object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImagePreview(ev.urlImagen, ev.descripcion);
                        }}
                      />
                    </div>
                    {ev.descripcion && (
                      <div className="px-1 text-xs text-continental-gray-1">{ev.descripcion}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {false && dummyChecklist.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Checklist del carrito (dummy)</p>
                  <p className="font-semibold text-continental-black">Reportado / Reparado / Verificacion</p>
                  <p className="text-sm text-continental-gray-1">
                    Checklist precargado por tipo de carrito. Marca reparado o verificacion para calcular el costo estimado automaticamente.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-continental-gray-1">Items completados</p>
                  <p className="text-2xl font-semibold text-continental-black">
                    {completadosChecklist} / {dummyChecklist.length}
                  </p>
                  <p className="text-sm text-continental-gray-2">Costo estimado: {formatCurrency(totalCostoChecklist)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-continental-black">Tarea</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Reportado</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Reparado</th>
                      <th className="px-4 py-3 text-center font-semibold text-continental-black">Verificacion</th>
                      <th className="px-4 py-3 text-right font-semibold text-continental-black">Costo aplicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dummyChecklist.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-continental-gray-3/60 hover:bg-continental-gray-4/40"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-continental-black">{item.nombre}</p>
                          <p className="text-xs text-continental-gray-2">Base: {formatCurrency(item.costo)}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-continental-yellow"
                            checked={item.reportado}
                            onChange={() => toggleDummyChecklist(item.id, 'reportado')}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-continental-green"
                            checked={item.reparado}
                            onChange={() => toggleDummyChecklist(item.id, 'reparado')}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-continental-blue"
                            checked={item.verificado}
                            onChange={() => toggleDummyChecklist(item.id, 'verificado')}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-continental-black">
                          {formatCurrency(costoAplicado(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" onClick={resetDummyChecklist}>
                  Reiniciar checklist
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setDummyChecklistReporte({
                      fecha: new Date().toISOString(),
                      total: totalCostoChecklist,
                      items: dummyChecklist.map((i) => ({ ...i })),
                      tipo: detalle?.vehiculoTipo || dummyChecklistTipo
                    })
                  }
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Generar reporte dummy
                </Button>
                <p className="text-xs text-continental-gray-2">Solo demostracion local, no se envia al API.</p>
              </div>

              {dummyChecklistReporte && (() => {
                const reporte = dummyChecklistReporte!;
                return (
                <div className="rounded-xl border border-continental-gray-3/60 bg-continental-bg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-continental-gray-1" />
                      <p className="font-semibold text-continental-black">
                        Reporte generado {new Date(reporte.fecha).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary">{formatCurrency(reporte.total)}</Badge>
                  </div>
                  <p className="text-xs text-continental-gray-2">
                    Items incluidos:{' '}
                    {reporte.items.filter((i) => i.reparado || i.verificado).length} /{' '}
                    {reporte.items.length}. Checklist base: {reporte.tipo}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {reporte.items
                      .filter((i) => i.reparado || i.verificado)
                      .map((item) => (
                        <div key={item.id} className="rounded-lg border border-continental-gray-3/60 bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-continental-black">{item.nombre}</p>
                              <p className="text-xs text-continental-gray-2">
                                Reportado: {item.reportado ? 'Si' : 'No'} | Reparado: {item.reparado ? 'Si' : 'No'} | Verificacion:{' '}
                                {item.verificado ? 'Si' : 'No'}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-continental-black">{formatCurrency(costoAplicado(item))}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {detalle.respuestasChecklist?.length && checklistItems.length === 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-semibold text-continental-black mb-2">Checklist de reparacion</p>
              <div className="space-y-2">
                {detalle.respuestasChecklist.map((r) => (
                  <div key={r.id} className="rounded-lg border border-continental-gray-3/60 p-3 bg-continental-bg">
                    <div className="flex justify-between text-sm items-center">
                      <span className="font-semibold text-continental-black">{r.pregunta || `Item ${r.id}`}</span>
                      <div className="flex items-center gap-2">
                        {r.cantidad !== undefined && r.cantidad !== null && (
                          <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-100">
                            Cant: {r.cantidad}
                          </Badge>
                        )}
                        <span className="text-continental-gray-1 font-medium">{r.valor || 'N/D'}</span>
                      </div>
                    </div>
                    {r.notas && <p className="text-sm text-continental-gray-1 mt-1">{r.notas}</p>}
                    {r.fotoUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={buildUrl(r.fotoUrl)}
                          alt="Evidencia checklist"
                          className="h-20 w-full object-cover rounded-md border border-continental-gray-300 shadow-sm cursor-pointer hover:brightness-75 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            openImagePreview(r.fotoUrl, r.pregunta || 'Evidencia checklist');
                          }}
                        />
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-continental-black border border-continental-gray-3/80 shadow-sm hover:bg-continental-bg z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openImagePreview(r.fotoUrl, r.pregunta || 'Evidencia checklist');
                          }}
                          aria-label="Ver imagen completa"
                        >
                          <Search className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Modal
            isOpen={activeCameraItem !== null}
            onClose={stopGeneralCamera}
            title="Captura de evidencia"
            description="Toma una foto para completar el item"
          >
             <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-gray-200 aspect-video bg-black w-full">
                   <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                </div>
             </div>
             <ModalFooter>
                <Button variant="outline" onClick={stopGeneralCamera}>
                  Cancelar
                </Button>
                <Button className="bg-continental-gradient text-white" onClick={captureChecklistItemPhoto} disabled={uploadingItemMap[activeCameraItem!]}>
                  {uploadingItemMap[activeCameraItem!] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Capturar'}
                </Button>
             </ModalFooter>
          </Modal>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" onClick={loadOrdenes} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
            {/* PDF 06-nov: la impresión solo cuando la orden llegó a DISPONIBLE y está terminada */}
            {(detalle.estado === EstadoOrdenTrabajo.Validada || detalle.estado === EstadoOrdenTrabajo.Entregado) && (
              <Button variant="outline" onClick={() => void imprimirOrden()} className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Imprimir orden de trabajo
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  };

  const renderList = () => (
        <div className="space-y-3">
          {ordenes.map((orden) => (
            <Link key={orden.id} to={`/ordenes/${orden.id}`} className="block">
          <Card className="px-8 py-7 hover:-translate-y-1 transition-all duration-200 border-l-4 border-continental-blue">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-continental-blue" />
                  <p className="font-semibold text-continental-black">
                    {orden.folio} - {orden.tipoMantenimiento}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-continental-gray-1">
                  <p>Vehiculo: {orden.vehiculoCodigo}</p>
                  <UbicacionBadge ubicacion={orden.vehiculoUbicacion || 1} size="sm" />
                </div>
                <p className="text-sm text-continental-gray-1">
                  Prioridad: {orden.prioridadNombre || PrioridadNombres[orden.prioridad]}
                </p>
                <p className="text-xs text-continental-gray-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Creada: {new Date(orden.fechaCreacion).toLocaleString()}
                </p>
              </div>
              <Badge variant={(orden.prioridad === Prioridad.Alta || orden.prioridad === Prioridad.Urgente) ? 'alta' : 'default'}>
                {orden.estadoNombre || EstadoOrdenNombres[orden.estado]}
              </Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">
            {isMisOrdenes ? 'Mis Ordenes' : 'Ordenes de Trabajo'}
          </p>
          <h1 className="text-3xl font-semibold text-continental-black">
            {ordenId ? 'Detalle de la orden' : 'Listado de ordenes'}
          </h1>
          <p className="text-continental-gray-1">Gestiona y da seguimiento a las ordenes activas.</p>
        </div>
        {!ordenId && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={applyFilters}>
              <Filter className="h-4 w-4" />
              Filtrar
            </Button>
            {canCreate && (
              <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva orden
              </Button>
            )}
          </div>
        )}
      </div>

      {!ordenId && (
        <div className="grid gap-3 md:grid-cols-4">
          <SearchInput
            placeholder="Buscar por folio, vehiculo o texto"
            value={filters.busqueda}
            onChange={(e) => setFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
            onBuscar={applyFilters}
          />
          <Select
            options={[{ value: '', label: 'Todos los estados' }, ...estadoOptions]}
            value={filters.estado || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, estado: value }))}
          />
          <Select
            options={[{ value: '', label: 'Todas las prioridades' }, ...prioridadOptions]}
            value={filters.prioridad || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, prioridad: value }))}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={resetFilters}>
              Limpiar
            </Button>
            <Button className="w-full" onClick={applyFilters}>
              Aplicar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : error ? null : ordenId ? (
        renderDetalle()
      ) : ordenes.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay ordenes</p>
          <p className="text-continental-gray-1">Aun no se han registrado ordenes de trabajo.</p>
          {canCreate && (
            <div className="flex justify-center gap-2">
              <Button onClick={() => setCreateOpen(true)} className="bg-continental-gradient text-white flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Crear orden
              </Button>
              <Button variant="outline" onClick={loadOrdenes}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </div>
          )}
        </Card>
      ) : (
        renderList()
      )}


      {/* Terminar reparación (PDF 06-nov): vista previa con folio, checklist completado y materiales utilizados */}
      <Modal
        isOpen={showCompletar}
        onClose={() => setShowCompletar(false)}
        title="Terminar reparación"
        description="Vista previa de lo que se registra al terminar."
      >
        <div className="space-y-4" data-testid="vista-previa-terminar">
          {compError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{compError}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-continental-gray-1">
            Folio OT: <span className="font-semibold text-continental-black">{detalle?.folio}</span>
          </p>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-continental-black flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-continental-green" />
              Checklist completado
            </p>
            <div className="bg-continental-bg/40 rounded-lg p-3 border border-continental-gray-3/60 max-h-48 overflow-y-auto">
              {checklistItems.filter(i => checklistRespuestas[i.id]?.valor === 'OK').length > 0 ? (
                <ul className="space-y-1">
                  {checklistItems
                    .filter(i => checklistRespuestas[i.id]?.valor === 'OK')
                    .map(item => (
                      <li key={item.id} className="text-xs text-continental-black flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-continental-green" />
                        {item.pregunta}
                        {checklistRespuestas[item.id]?.cantidad ? ` · Cant: ${checklistRespuestas[item.id]?.cantidad}` : ''}
                      </li>
                    ))
                  }
                </ul>
              ) : (
                <p className="text-xs text-continental-gray-1 italic">Sin actividades en el checklist.</p>
              )}
            </div>
          </div>

          {/* Lo que se descuenta del inventario al terminar (PDF 29-oct, 5.1) */}
          <div className="border rounded-lg p-3 space-y-2 bg-continental-bg/60" data-testid="materiales-al-terminar">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-continental-gray-1" />
              <p className="text-sm font-semibold text-continental-black">Materiales utilizados (se descuentan del inventario)</p>
            </div>
            {materialesAlTerminar === null ? (
              <p className="text-sm text-continental-gray-1">Cargando...</p>
            ) : materialesAlTerminar.length === 0 ? (
              <p className="text-sm text-continental-gray-1">
                Sin refacciones ni consumibles. Si usaste alguno, regístralo en "Refacciones y consumibles utilizados" antes de terminar.
              </p>
            ) : (
              <ul className="list-disc pl-5 text-sm text-continental-black">
                {materialesAlTerminar.map((m) => (
                  <li key={m.id}>{m.nombre} ({m.codigo}): {m.cantidad} {m.unidad}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCompletar(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!detalle) return;
              setCompError('');
              if (bloqueoTerminar) {
                setCompError(bloqueoTerminar);
                return;
              }
              const pendientes = (detalle.solicitudesRefaccion || []).filter(
                (s) => s.estado !== 'Entregada' && s.estado !== 'Rechazada'
              );
              if (pendientes.length > 0) {
                setCompError('No puedes terminar la reparación: hay refacciones solicitadas pendientes de entrega (consúltalas en Refacciones).');
                return;
              }

              // Descripción automática con lo hecho en el checklist
              const itemsOk = checklistItems
                .filter(i => checklistRespuestas[i.id]?.valor === 'OK')
                .map(i => i.pregunta);
              const descripcionAutomatica = itemsOk.length > 0
                ? `Trabajo completado según checklist: ${itemsOk.join(', ')}`
                : 'Trabajo completado (ver checklist)';
              const horas = Number(compHoras) || 1;

              const completada = await doAccion(async () => {
                // El checklist se guarda al terminar (ya no hay botón "Guardar checklist")
                const guardado = await guardarChecklistAlTerminar();
                if (!guardado.success) return guardado;
                return ordenesService.completarTrabajo(detalle.id, {
                  trabajoRealizado: descripcionAutomatica,
                  horasTrabajadas: horas
                });
              }, { exito: 'Reparación terminada', alFallar: setCompError });
              if (completada) setShowCompletar(false);
            }}
            disabled={accionando}
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terminar reparación'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={imageOpen && !!imagePreview}
        onClose={() => {
          setImageOpen(false);
          setImagePreview(null);
        }}
        title="Vista de imagen"
        description={imagePreview?.title || 'Evidencia'}
        size="lg"
      >
        <div className="flex justify-center">
          {imagePreview && (
            <img
              src={imagePreview.src}
              alt={imagePreview.title || 'Evidencia'}
              className="max-h-[70vh] w-full object-contain rounded-lg border border-continental-gray-3/60"
            />
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setImageOpen(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>

      <ReportFailureModal 
        isOpen={createOpen} 
        onClose={() => setCreateOpen(false)} 
        onSuccess={() => {
          // Si el reporte se creó con éxito, podría haber creado una orden automáticamente.
          // Recargamos la lista para ver si aparece.
          setCreateOpen(false);
          loadOrdenes();
        }} 
      />

    </div>
  );
}

