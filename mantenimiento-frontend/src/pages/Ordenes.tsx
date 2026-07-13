import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
  SearchableSelect,
  type SearchableSelectOption,
  Select,
  Spinner,
  Textarea,
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
  ShieldCheck,
  XCircle,
  Package,
  ClipboardList,
  FileText,
  Trash2,
  Search,
  PlayIcon,
  AlertTriangle,
  Camera
} from 'lucide-react';
import { catalogosService, solicitudCambioService } from '@/services';
import { UbicacionBadge } from '@/components/vehiculos/UbicacionLegend';
import { ordenesService } from '@/services/ordenesService';
import { usuariosService } from '@/services/usuariosService';
import { reportesService } from '@/services/reportesService';
import { consumiblesService } from '@/services/consumiblesService';
import { checklistService } from '@/services/checklistService';
import { refaccionesService } from '@/services/refaccionesService';
import { solicitudActividadAdicionalService } from '@/services/solicitudActividadAdicionalService';
import { ordenTrabajoChecklistItemService } from '@/services/ordenTrabajoChecklistItemService';
import { ReportFailureModal, RequestActivityModal } from '@/components/tecnico';
import { OrdenFlowStatus } from '@/components/ordenes/OrdenFlowStatus';
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
  const location = useLocation();
  const { id: ordenIdParam } = useParams();
  const ordenId = ordenIdParam ? Number(ordenIdParam) : undefined;
  const isMisOrdenes = location.pathname.includes('mis-ordenes');
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(['Administrador', 'Superusuario', 'Supervisor']);

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
  const [showValidar, setShowValidar] = useState(false);
  const [validarObs, setValidarObs] = useState('');
  const [validarDecision, setValidarDecision] = useState<'aprobar' | 'devolver'>('aprobar');
  const [showCompletar, setShowCompletar] = useState(false);
  const [, setCompTrabajo] = useState('');
  const [compHoras, setCompHoras] = useState('1');
  const [compEvidFile, setCompEvidFile] = useState<File | null>(null);
  const [compEvidDesc, setCompEvidDesc] = useState('');
  const [compError, setCompError] = useState('');
  const [showRefModal, setShowRefModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [refItems, setRefItems] = useState<
    Array<{ nombre: string; cantidad: string; justificacion: string; seleccion?: SearchableSelectOption | null }>
  >([{ nombre: '', cantidad: '1', justificacion: '', seleccion: null }]);
  const [consumibles, setConsumibles] = useState<{ value: number; label: string; stock: number }[]>([]);
  const [consumos, setConsumos] = useState<{ consumibleId?: number; cantidad: string }[]>([]);
  const [loadingConsumibles, setLoadingConsumibles] = useState(false);
  const [asignandoTecnico, setAsignandoTecnico] = useState(false);
  const [tecnicoAsignado, setTecnicoAsignado] = useState<SearchableSelectOption | null>(null);
  const [firmaError, setFirmaError] = useState('');
  const [showIniciar, setShowIniciar] = useState(false);
  const [diagInicio, setDiagInicio] = useState('');
  const [showCancelar, setShowCancelar] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [reporteDetalle, setReporteDetalle] = useState<ReporteFalla | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [uploadingItemMap, setUploadingItemMap] = useState<Record<number, boolean>>({});
  const [checklistError, setChecklistError] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistTemplateItem[]>([]);
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, { valor: string; notas?: string; cantidad?: number; fotoUrl?: string }>>({});
  const [checklistSource, setChecklistSource] = useState<'reporte' | 'vehiculo' | 'tipo' | 'default' | 'saved'>('default');
  const [dummyChecklist, setDummyChecklist] = useState<DummyChecklistRow[]>([]);
  const [dummyChecklistReporte, setDummyChecklistReporte] = useState<DummyChecklistReporte | null>(null);
  const [dummyChecklistTipo, setDummyChecklistTipo] = useState<string>('general');

  // Camera capture state for general evidence
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeCameraItem, setActiveCameraItem] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Aprobaciones de cambio (Actividades adicionales)
  const [solicitudesCambio, setSolicitudesCambio] = useState<any[]>([]);
  const [, setLoadingCambios] = useState(false);


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
      let templateId: number | undefined;

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
      // 1) Checklist asignado al vehiculo (preferido)
      const asignRes = await checklistService.getAsignaciones(detalle.vehiculoId);
      if (asignRes.success && asignRes.data) {
        const listaAsignaciones: any[] = (Array.isArray(asignRes.data) ? asignRes.data : []) as any[];
        if (listaAsignaciones.length > 0) {
          const first = listaAsignaciones[0];
          templateId = first.checklistTemplateId ?? first.ChecklistTemplateId;
        }
      }

      // 2) Si hay asignacion, obtener plantilla completa
      if (templateId) {
        const tplById = await checklistService.getTemplateById(templateId);
        if (tplById.success && tplById.data) {
          items = (tplById.data.items || []).slice().sort((a, b) => a.orden - b.orden);
          setChecklistSource('vehiculo');
        }
      }

      // 3) Fallback: plantilla por tipo de mantenimiento
      if (!items.length) {
        const tplRes = await checklistService.getTemplates(undefined, detalle.tipoMantenimiento);
        if (tplRes.success && tplRes.data && tplRes.data.length > 0) {
          items = (tplRes.data[0].items || []).slice().sort((a, b) => a.orden - b.orden);
          setChecklistSource('tipo');
        }
      }

      // 4) Ultimo recurso: checklist basico por defecto
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

  const loadConsumibles = async () => {
    setLoadingConsumibles(true);
    try {
      const res = await consumiblesService.getDisponibles();
      if (res.success && res.data) {
        const lista = res.data as any[];
        setConsumibles(
          lista.map((c) => ({
            value: c.id,
            label: `${c.nombre} (${c.codigo}) - Stock: ${c.stockActual}`,
            stock: c.stockActual
          }))
        );
      } else {
        setConsumibles([]);
      }
    } catch (err) {
      console.error('No se pudieron cargar consumibles', err);
      setConsumibles([]);
    } finally {
      setLoadingConsumibles(false);
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
    loadTecnicos();
  }, []);

  useEffect(() => {
    loadOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId, isMisOrdenes]);

  useEffect(() => {
    if (user && tecnicos.length > 0 && !tecnicoAsignado) {
      const found = tecnicos.find((t) => t.id === user.id);
      if (found) {
        setTecnicoAsignado({ value: found.id, label: found.nombre });
      }
    }
  }, [user, tecnicos, tecnicoAsignado]);

  const loadSolicitudesCambio = useCallback(async () => {
    if (!detalle) return;
    setLoadingCambios(true);
    try {
      // 1) Cargar solicitudes de cambio (legacy/vehiculo)
      if (detalle.vehiculoId) {
        const res = await solicitudCambioService.getAll(detalle.vehiculoId);
        if (res.success && res.data) {
          setSolicitudesCambio(res.data.filter(s => s.descripcion.startsWith('ACTIVIDAD_EXTRA:') && s.estado === 0));
        }
      }
      
      // 2) Las nuevas solicitudes adicionales ya vienen el el objeto detalle.solicitudesActividadAdicional
      // tras recargar la orden.
    } catch (err) {
      console.error('Error cargando solicitudes de cambio', err);
    } finally {
      setLoadingCambios(false);
    }
  }, [detalle]);

  useEffect(() => {
    if (!detalle) {
      setDummyChecklist([]);
      setDummyChecklistReporte(null);
      setDummyChecklistTipo('general');
      setChecklistSource('default');
      setSolicitudesCambio([]);
      return;
    }
    loadChecklist();
    loadSolicitudesCambio();
    const key = resolveChecklistKey(detalle.vehiculoTipo || detalle.tipoMantenimiento || detalle.vehiculoCodigo);
    setDummyChecklistTipo(key);
    setDummyChecklist(buildDummyChecklist(key));
    setDummyChecklistReporte(null);
  }, [detalle, buildDummyChecklist, loadChecklist, loadSolicitudesCambio]);

  // Foto del tipo de vehiculo, para dibujar encima los componentes con falla del reporte.
  useEffect(() => {
    const tipoNombre = (detalle?.vehiculoTipo || '').trim().toLowerCase();
    if (!tipoNombre) {
      setVehicleImageUrl(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await catalogosService.getTiposVehiculo();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const tipo = res.data.find((t) => (t.nombre || '').trim().toLowerCase() === tipoNombre);
          const preferida = tipo?.imagenFallasUrl || tipo?.imagenUrl;
          setVehicleImageUrl(preferida ? getFullImageUrl(preferida) : undefined);
        } else {
          setVehicleImageUrl(undefined);
        }
      } catch {
        if (!cancelled) setVehicleImageUrl(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detalle?.id, detalle?.vehiculoTipo]);

  const updateChecklistRespuesta = (id: number, changes: { valor?: string; notas?: string; cantidad?: number; fotoUrl?: string }) => {
    setChecklistRespuestas((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  const handleGuardarChecklist = async () => {
    if (!detalle) return;
    const tieneIdsInvalidosChecklist = checklistItems.some(
      (i) => (i as any).tipo !== 'ActividadAdicional' && (!i.id || i.id <= 0)
    );
    if (tieneIdsInvalidosChecklist) {
      setChecklistError('Asigna un checklist al vehiculo en Configuracion para poder guardarlo.');
      return;
    }

    setSavingChecklist(true);
    setChecklistError('');
    try {
      // Si usamos OrdenTrabajoChecklistItem (saved source), actualizamos esas entidades
      if (checklistSource === 'saved' || checklistSource === 'reporte' || checklistSource === 'vehiculo' || checklistSource === 'tipo') {
        const promises = checklistItems.map(async (item) => {
          let metaId = (item as any).metaId;
          const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
          const resp = checklistRespuestas[item.id];
          if (!resp) return;

          // Si no tiene metaId pero es fuente reporte/vehiculo/tipo, intentamos crearlo para que sea persistente
          if (
            !metaId &&
            tipoItem === 'Checklist' &&
            item.id > 0 &&
            (checklistSource === 'reporte' || checklistSource === 'vehiculo' || checklistSource === 'tipo')
          ) {
             try {
                const created = await ordenTrabajoChecklistItemService.create({
                  ordenTrabajoId: detalle.id,
                  checklistItemId: item.id,
                  cantidad: resp.cantidad,
                  notas: resp.notas
                });
                if (created.success && created.data) {
                  metaId = created.data.id;
                  (item as any).metaId = metaId; // Guardar para futuras actualizaciones
                  
                  await ordenTrabajoChecklistItemService.update(metaId, {
                    estado: resp.valor === 'OK' ? 'Completado' : 'Pendiente',
                    fotoUrl: resp.fotoUrl,
                    tipo: 'Checklist'
                  });
                }
                return;
             } catch (e) {
                console.error("Error auto-creando item durante guardado masivo", e);
             }
          }

          if (!metaId) return;
          
          try {
            await ordenTrabajoChecklistItemService.update(metaId, {
              estado: resp.valor === 'OK' ? 'Completado' : 'Pendiente',
              notas: resp.notas,
              cantidad: resp.cantidad,
              fotoUrl: resp.fotoUrl, // REFORZADO: Incluir siempre la fotoUrl actual
              tipo: tipoItem
            });
          } catch (err) {
            console.error(`Error actualizando item ${metaId}`, err);
            if (tipoItem !== 'Checklist' || item.id <= 0) {
              return;
            }
            // Si falla el update (ej. 404), intentamos CREAR el registro en la tabla nueva para restaurar consistencia
            try {
              const created = await ordenTrabajoChecklistItemService.create({
                ordenTrabajoId: detalle.id,
                checklistItemId: item.id,
                cantidad: resp.cantidad,
                notas: resp.notas
              });
              // Si se creó, intentamos actualizar el estado y foto inmediatamente si es necesario
              if (created.success && created.data) {
                await ordenTrabajoChecklistItemService.update(created.data.id, {
                  estado: resp.valor === 'OK' ? 'Completado' : 'Pendiente',
                  fotoUrl: resp.fotoUrl,
                  tipo: 'Checklist'
                });
              }
            } catch (createErr) {
              console.error(`Error al intentar auto-reparar item ${item.id}`, createErr);
            }
          }
        });
        
        await Promise.all(promises);
      }

      // SIEMPRE guardar tambien en legacy (ChecklistRespuestas) para asegurar compatibilidad
      // con reportes y calculo de costos que aun usan la tabla vieja.
      {
        const respuestas = checklistItems
          .filter((i) => i.id && i.id > 0)
          .map((i) => ({
            checklistItemId: i.id,
            valor: (checklistRespuestas[i.id]?.valor || '').toString(),
            notas: checklistRespuestas[i.id]?.notas || undefined,
            cantidad: checklistRespuestas[i.id]?.cantidad,
            fotoUrl: checklistRespuestas[i.id]?.fotoUrl // Preservar foto en legacy backup
          }));

        if (respuestas.length > 0) {
          await checklistService.guardarRespuestas({ ordenTrabajoId: detalle.id, respuestas });
        }
      }

      if (checklistSource === 'default') {
        // Fallback a guardar respuestas (legacy) - redundant but keep structure logic if needed specific
        const respuestas = checklistItems
          .filter((i) => i.id && i.id > 0)
          .map((i) => ({
            checklistItemId: i.id,
            valor: (checklistRespuestas[i.id]?.valor || '').toString(),
            notas: checklistRespuestas[i.id]?.notas || undefined,
            cantidad:
              checklistRespuestas[i.id]?.cantidad && checklistRespuestas[i.id]?.cantidad! > 0
                ? checklistRespuestas[i.id]?.cantidad
                : undefined,
            fotoUrl: checklistRespuestas[i.id]?.fotoUrl // Preservar foto en legacy
          }));

        if (respuestas.length > 0) {
          const res = await checklistService.guardarRespuestas({ ordenTrabajoId: detalle.id, respuestas });
          if (!res.success) throw new Error(res.message);
        }
      }
      
      await loadOrdenes();
    } catch (err) {
      console.error(err);
      setChecklistError(err instanceof Error ? err.message : 'No se pudo guardar el checklist');
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleAprobar = async (aprobado: boolean) => {
    if (!detalle) return;
    setAccionando(true);
    try {
      const rol = hasRole(['Lider']) ? 'Lider' : 'Supervisor';
      // Si es ambos, preferir Supervisor si esta en estado de validacion, o Lider si es cierre inicial?
      // Por simplicidad, el backend confía en lo que enviamos, pero valida permisos.
      
      const res = await ordenesService.aprobarOrden(detalle.id, {
        aprobado,
        rolAprobador: rol as 'Lider' | 'Supervisor',
        comentarios: 'Aprobación digital'
      });
      
      if (res.success) {
        await loadOrdenes();
      } else {
        setError(res.message || 'Error al aprobar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setAccionando(false);
    }
  };

  const applyFilters = () => {
    if (!ordenId) {
      loadOrdenes();
    }
  };

  const resetFilters = () => {
    setFilters({ busqueda: '' });
    if (!ordenId) {
      loadOrdenes();
    }
  };

  const doAccion = async (fn: () => Promise<unknown>) => {
    setAccionando(true);
    setError('');
    try {
       const result = await fn();
      if (result && typeof result === 'object' && 'success' in (result as any)) {
        const r = result as any;
        if (!r.success) {
          setError(r.message || 'No se pudo completar la accion');
          return;
        }
      }
      if (result === false) return;
      await loadOrdenes();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la accion');
    } finally {
      setAccionando(false);
    }
  };

  const handleIniciar = (id: number, diag?: string) => {
    doAccion(() => ordenesService.iniciarTrabajo(id, diag ? { diagnostico: diag } : {}));
  };

  const handleValidar = (id: number, aprobado: boolean, observaciones?: string) => {
    doAccion(() => ordenesService.validarOrden(id, { aprobado, observaciones }));
  };

  const handleCancelar = (id: number, motivo: string) => {
    doAccion(() => ordenesService.cancelarOrden(id, motivo));
  };

  const generarReporteOrden = () => {
    if (!detalle) return;
    
    const refacciones = (detalle.solicitudesRefaccion || [])
      .filter((s) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente')
      .map(
        (s) =>
          `<tr><td>${s.nombreRefaccion}</td><td>x${s.cantidad}</td><td>${s.estado}</td></tr>`
      )
      .join('');
    const checklist = (detalle.respuestasChecklist || [])
      .filter((r) => (r.valor || '').trim() !== '')
      .map(
        (r) =>
          `<tr><td>${r.pregunta || ''}</td><td>${r.valor || ''}</td>${hasRole(['Administrador']) ? `<td style="text-align:right;">$${(
            r.costoEstimado || 0
          ).toFixed(2)}</td>` : ''}</tr>`
      )
      .join('');
    
    const costoChecklist = detalle.respuestasChecklist?.reduce((acc, r: any) => {
      const val = (r.valor ?? '').toString().trim().toLowerCase();
      if (val !== '' && val !== 'no' && val !== 'false' && val !== '0') {
        const c = Number(r.costoEstimado || r.checklistItem?.costoEstimado || 0);
        return acc + (Number.isNaN(c) ? 0 : c);
      }
      return acc;
    }, 0) || 0;
    
    const total = costoChecklist;
    
    const ord = detalle;
    
    // Crear una ventana nueva para el reporte
    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) return;
    
    // Construir URLs para las imágenes
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

    // HTML para las imágenes del reporte
    let imagenesHtml = '';
    if (reporteDetalle?.evidencias?.length) {
      imagenesHtml += `<h3 class="section-title">Evidencias del Reporte</h3>
        <div class="imagenes-container">
          ${reporteDetalle.evidencias.map(ev => 
            `<div class="imagen-item">
              <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" class="imagen-reporte" />
              ${ev.descripcion ? `<p class="imagen-descripcion">${ev.descripcion}</p>` : ''}
            </div>`
          ).join('')}
        </div>`;
    }

    if (detalle.evidencias?.length) {
      // Separar evidencias por tipo para mejor organización
      const evidenciasIniciales = detalle.evidencias.filter(e => !e.tipoEvidencia || e.tipoEvidencia === 'inicial' || e.tipoEvidencia === 'antes');
      const evidenciasFinales = detalle.evidencias.filter(e => e.tipoEvidencia === 'completado' || e.tipoEvidencia === 'despues');
      const evidenciasEntrega = detalle.evidencias.filter(e => e.tipoEvidencia === 'entrega');
      const evidenciasOtras = detalle.evidencias.filter(e => 
        e.tipoEvidencia && 
        !['inicial', 'antes', 'completado', 'despues', 'entrega'].includes(e.tipoEvidencia)
      );

      if (evidenciasIniciales.length > 0) {
        imagenesHtml += `<h3 class="section-title">Evidencias Iniciales/Reporte</h3>
          <div class="imagenes-container">
            ${evidenciasIniciales.map(ev => 
              `<div class="imagen-item">
                <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" class="imagen-reporte" />
                ${ev.descripcion ? `<p class="imagen-descripcion">${ev.descripcion}</p>` : ''}
              </div>`
            ).join('')}
          </div>`;
      }

      if (evidenciasFinales.length > 0) {
        imagenesHtml += `<h3 class="section-title">Evidencias Finales/Después</h3>
          <div class="imagenes-container">
            ${evidenciasFinales.map(ev => 
              `<div class="imagen-item">
                <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" class="imagen-reporte" />
                ${ev.descripcion ? `<p class="imagen-descripcion">${ev.descripcion}</p>` : ''}
              </div>`
            ).join('')}
          </div>`;
      }

      if (evidenciasEntrega.length > 0) {
        imagenesHtml += `<h3 class="section-title">Evidencias de Entrega</h3>
          <div class="imagenes-container">
            ${evidenciasEntrega.map(ev => 
              `<div class="imagen-item">
                <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" class="imagen-reporte" />
                ${ev.descripcion ? `<p class="imagen-descripcion">${ev.descripcion}</p>` : ''}
              </div>`
            ).join('')}
          </div>`;
      }

      if (evidenciasOtras.length > 0) {
        imagenesHtml += `<h3 class="section-title">Otras Evidencias</h3>
          <div class="imagenes-container">
            ${evidenciasOtras.map(ev => 
              `<div class="imagen-item">
                <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" class="imagen-reporte" />
                ${ev.descripcion ? `<p class="imagen-descripcion">${ev.descripcion}</p>` : ''}
              </div>`
            ).join('')}
          </div>`;
      }
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Orden ${detalle.folio}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; background: #f6f7fb; }
            .card { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: 700; margin: 0; }
            .badge { padding: 4px 10px; border-radius: 999px; background: linear-gradient(135deg, #f7b733, #fc4a1a); color: #fff; font-weight: 600; font-size: 12px; }
            .section-title { font-weight: 700; margin: 18px 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            th { text-align: left; background: #f3f4f6; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin: 12px 0; }
            .pill { background: #f3f4f6; border-radius: 8px; padding: 10px; }
            .label { color: #6b7280; font-size: 12px; margin: 0; }
            .value { font-weight: 700; margin: 2px 0 0; }
            .imagenes-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
            .imagen-item { text-align: center; }
            .imagen-reporte { width: 100%; height: auto; max-height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; }
            .imagen-descripcion { margin-top: 5px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <p style="margin:0; color:#6b7280; font-size:12px;">Reporte de Orden de Trabajo</p>
                <h2 class="title">OT ${detalle.folio} - ${detalle.vehiculoCodigo}</h2>
                <p style="margin:0; color:#6b7280;">${ord?.vehiculoCodigo || ''} ${ord?.vehiculoTipo || ''}</p>
              </div>
              <div class="badge">${detalle.estadoNombre || 'Estado'}</div>
            </div>
            <div class="summary">
              <div class="pill">
                <p class="label">Técnico</p>
                <p class="value">${detalle.tecnicoNombre || detalle.tecnicoId}</p>
              </div>
              <div class="pill">
                <p class="label">Tipo de Mantenimiento</p>
                <p class="value">${detalle.tipoMantenimiento}</p>
              </div>
              <div class="pill">
                <p class="label">Prioridad</p>
                <p class="value">${detalle.prioridadNombre || PrioridadNombres[detalle.prioridad]}</p>
              </div>
              ${hasRole(['Administrador']) ? `
              <div class="pill">
                <p class="label">Total calculado</p>
                <p class="value">$${total.toFixed(2)}</p>
              </div>` : ''}
            </div>
            <p class="label">Descripción</p>
            <p style="margin-top:4px;">${detalle.descripcion || 'Sin descripción'}</p>
            ${detalle.trabajoRealizado ? `<p class="label">Trabajo Realizado</p><p style="margin-top:4px;">${detalle.trabajoRealizado}</p>` : ''}
            ${detalle.diagnostico ? `<p class="label">Diagnóstico</p><p style="margin-top:4px;">${detalle.diagnostico}</p>` : ''}
            <h3 class="section-title">Refacciones usadas</h3>
            ${
              refacciones
                ? `<table><thead><tr><th>Refacción</th><th>Cant.</th><th>Estado</th></tr></thead><tbody>${refacciones}</tbody></table>`
                : '<p style="color:#6b7280;">Sin refacciones</p>'
            }
            <h3 class="section-title">Checklist aplicado</h3>
            ${
              checklist
                ? `<table><thead><tr><th>Item</th><th>Valor</th>${hasRole(['Administrador']) ? '<th style="text-align:right;">Costo</th>' : ''}</tr></thead><tbody>${checklist}</tbody></table>`
                : '<p style="color:#6b7280;">Sin respuestas</p>'
            }
            ${hasRole(['Administrador']) ? `
            <h3 class="section-title">Costo de Reparación</h3>
            <table>
              <tbody>
                <tr><td style="font-weight:700;">Total Checklist</td><td style="text-align:right; font-weight:700;">$${total.toFixed(2)}</td></tr>
              </tbody>
            </table>` : ''}
            ${imagenesHtml}
          </div>
          <script>
            window.print(); 
            setTimeout(() => window.close(), 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleAprobarActividadExtra = async (solicitud: { id: number; descripcion: string }, aprobado: boolean) => {
    setAccionando(true);
    try {
      const res = await (solicitudCambioService as any).responder({
        id: solicitud.id,
        aprobado,
        comentarios: aprobado ? 'Aprobado desde orden de trabajo' : 'Rechazado'
      });

      if (res.success && aprobado) {
        await loadOrdenes();
        await loadSolicitudesCambio();
      } else {
        await loadSolicitudesCambio();
      }
    } catch (err) {
      setError('Error al procesar solicitud de cambio');
    } finally {
      setAccionando(false);
    }
  };

  const handleResponderActividadAdicional = async (id: number, aprobado: boolean) => {
    setAccionando(true);
    try {
      const res = await solicitudActividadAdicionalService.responder({
        id,
        aprobado,
        comentarios: aprobado ? 'Aprobada por supervisor' : 'Rechazada por supervisor'
      });
      if (res.success) {
        await loadOrdenes();
      } else {
        setError(res.message || 'Error al responder a la solicitud');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setAccionando(false);
    }
  };

  const startGeneralCamera = async (itemId?: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (itemId) {
        setActiveCameraItem(itemId);
      } else {
        setIsCameraActive(true);
      }
      // Wait for state update and ref render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      alert('No se pudo acceder a la cámara');
    }
  };

  const stopGeneralCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsCameraActive(false);
    setActiveCameraItem(null);
  };

  const captureGeneralPhoto = () => {
    if (!videoRef.current || !detalle) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `evidencia-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setAccionando(true);
        try {
          const res = await ordenesService.uploadEvidencia(
            detalle.id,
            file,
            'Captura directa desde cámara',
            'proceso'
          );
          if (res.success) {
            await loadOrdenes();
            stopGeneralCamera();
          }
        } finally {
          setAccionando(false);
        }
      }
    }, 'image/jpeg', 0.9);
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
            stopGeneralCamera();
          }
        } catch (err) {
          console.error('Error al subir foto de checklist', err);
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

    const costoTotalEstimado = checklistItems.reduce(
      (acc, item) => acc + (Number((item as any).costoEstimado || 0) || 0),
      0
    );

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
        <OrdenFlowStatus orden={detalle} reportadaPorNombre={reporteDetalle?.reportadoPorNombre} />

              <Button variant="ghost" className="flex items-center gap-2">
                <Link to={isMisOrdenes ? '/mis-ordenes' : '/ordenes'}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver al listado
                </Link>
              </Button>

        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-continental-gray-1">Orden de trabajo</p>
              <h2 className="text-2xl font-semibold text-continental-black">
                {detalle.folio} - {detalle.vehiculoCodigo}
              </h2>
              <p className="text-continental-gray-1">Prioridad {detalle.prioridadNombre || PrioridadNombres[detalle.prioridad]}</p>
            </div>
            <Badge variant="secondary">{detalle.estadoNombre || EstadoOrdenNombres[detalle.estado]}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 text-sm text-continental-gray-1">
              <p className="font-semibold text-continental-black">Descripcion</p>
              <p className="text-continental-black">{descripcionMostrar()}</p>
              {detalle.trabajoRealizado && (
                <>
                  <p className="font-semibold text-continental-black mt-2">Trabajo realizado</p>
                  <p className="text-continental-black">{detalle.trabajoRealizado}</p>
                </>
              )}
              {reporteDetalle && (
                <>
                  <p className="font-semibold text-continental-black mt-3">Reporte asociado</p>
                  <p className="text-continental-black">{reporteDetalle.descripcion}</p>
                  <p className="text-xs text-continental-gray-1">
                    Categoria: {reporteDetalle.categoriaNombre || 'N/D'} - Prioridad: {reporteDetalle.prioridadNombre}
                  </p>
                  {reporteDetalle.ubicacion && (
                    <p className="text-xs text-continental-gray-1">Ubicacion: {reporteDetalle.ubicacion}</p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2 text-sm text-continental-gray-1">
              <p>Tipo: {detalle.tipoMantenimiento}</p>
              <p>Tecnico: {nombreTecnicoAsignado}</p>
              <p>Creada: {new Date(detalle.fechaCreacion).toLocaleString()}</p>
              {hasRole(['Administrador']) && (
                <p>Costo estimado (Checklist): {formatCurrency(costoTotalEstimado)}</p>
              )}
              {detalle.fechaFinalizacion && <p>Finalizada: {new Date(detalle.fechaFinalizacion).toLocaleString()}</p>}
              {detalle.herramientasUsadas && <p>Herramientas: {detalle.herramientasUsadas}</p>}
              {tiempos.length > 0 && (
                <div className="space-y-1">
                  {tiempos.map((t) => (
                    <p key={t.label}>{t.label}: {t.value}</p>
                  ))}
                </div>
              )}
                            {hasRole(['Administrador', 'SuperUsuario', 'Supervisor', 'Tecnico']) && (
                <div className="space-y-2 pt-2">
              <p className="font-semibold text-continental-black">
                {detalle.tecnicoAsignadoId ? 'Técnico Asignado' : 'Asignar tecnico (requiere firma)'}
              </p>
                  <p className="text-xs text-continental-gray-2">
                    {detalle.tecnicoAsignadoId 
                      ? 'Esta orden ya tiene un técnico asignado. Puedes cambiarlo si es necesario firmando nuevamente.' 
                      : 'La orden se asignara al tecnico que firme la autorizacion. Usa tu usuario o selecciona uno y pide su firma.'}
                  </p>
                  {detalle.estado === EstadoOrdenTrabajo.Asignada && !detalle.tecnicoAsignadoId && (
                    <Alert variant="warning" className="py-2">
                      <AlertDescription className="text-xs">
                        Asignación automática detectada. Por favor confirme el técnico.
                      </AlertDescription>
                    </Alert>
                  )}
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
                  {firmaError && <p className="text-xs text-red-600">{firmaError}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-continental-black">Checklist</p>
              <Button size="sm" onClick={handleGuardarChecklist} disabled={savingChecklist || loadingChecklist}>
                {savingChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar checklist'}
              </Button>
            </div>
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
                              onChange={(e) => {
                                if (e.target.checked && !resp.fotoUrl) {
                                  alert('Debes subir una foto de evidencia antes de marcar como completado.');
                                  return;
                                }
                                updateChecklistRespuesta(item.id, { valor: e.target.checked ? 'OK' : '' });
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
                              onChange={(e) =>
                                updateChecklistRespuesta(item.id, {
                                  cantidad: e.target.value === '' ? undefined : Number(e.target.value)
                                })
                              }
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
                                        const confirmDelete = window.confirm("¿Estás seguro de eliminar esta evidencia?");
                                        if (!confirmDelete) return;

                                        setUploadingItemMap(prev => ({...prev, [item.id]: true}));
                                        try {
                                          updateChecklistRespuesta(item.id, { fotoUrl: '' });
                                          const metaId = (item as any).metaId;
                                          const tipoItem = (item as any).tipo === 'ActividadAdicional' ? 'ActividadAdicional' : 'Checklist';
                                          if (metaId) {
                                            await ordenTrabajoChecklistItemService.update(metaId, {
                                              fotoUrl: '',
                                              tipo: tipoItem
                                            });
                                          }
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
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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

            {detalle.evidencias?.length ? (
              <div className="mt-4 space-y-3">
                <p className="font-semibold text-continental-black mb-2">Evidencias de la orden</p>
              {(() => {
                const evidencias = detalle.evidencias || [];
                // Excluir evidencias de tipo 'checklist' ya que se muestran en sus respectivos renglones
                const evidenciasFiltradas = evidencias.filter(e => e.tipoEvidencia !== 'checklist');
                
                const iniciales = evidenciasFiltradas.filter((e) => !e.tipoEvidencia || e.tipoEvidencia === 'inicial' || e.tipoEvidencia === 'antes');
                const completadas = evidenciasFiltradas.filter((e) => e.tipoEvidencia === 'completado' || e.tipoEvidencia === 'despues');
                const entrega = evidenciasFiltradas.filter((e) => e.tipoEvidencia === 'entrega');
                const otras = evidenciasFiltradas.filter(
                  (e) =>
                    e.tipoEvidencia &&
                    e.tipoEvidencia !== 'inicial' &&
                    e.tipoEvidencia !== 'antes' &&
                    e.tipoEvidencia !== 'completado' &&
                    e.tipoEvidencia !== 'entrega'
                );

                const renderBlock = (title: string, list: typeof evidencias) =>
                  list.length ? (
                    <div className="space-y-2" key={title}>
                      <p className="text-sm font-semibold text-continental-black">{title}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {list.map((ev) => (
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
                  ) : null;

                return (
                  <>
                    {renderBlock('Inicial / reporte', iniciales)}
                    {renderBlock('Completado', completadas)}
                    {renderBlock('Entrega', entrega)}
                    {renderBlock('Otras', otras)}
                  </>
                );
              })()}
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

          <div className="grid gap-6 md:grid-cols-2 mt-4">
            {/* Refacciones */}
            <div className="space-y-3">
              <p className="font-semibold text-continental-black">Refacciones Solicitadas</p>
              {detalle.solicitudesRefaccion?.length ? (
                <div className="space-y-2">
                  {detalle.solicitudesRefaccion.map((s) => (
                    <div key={s.id} className="rounded-lg border border-continental-gray-3/60 p-3 bg-white shadow-sm">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-continental-black">{s.nombreRefaccion}</span>
                        <Badge variant={s.estado === 'Pendiente' ? 'outline' : s.estado === 'Aprobada' ? 'default' : 'destructive'}>
                          {s.estado}
                        </Badge>
                      </div>
                      <p className="text-xs text-continental-gray-1 mt-1">
                        Cantidad: {s.cantidad} {s.numeroParte ? `| Parte: ${s.numeroParte}` : ''}
                      </p>
                      {s.justificacion && <p className="text-xs text-continental-gray-2 mt-1 italic">"{s.justificacion}"</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-continental-gray-2 italic">Sin refacciones solicitadas.</p>
              )}
              {hasRole(['Administrador', 'SuperUsuario', 'Supervisor', 'Tecnico']) && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRefModal(true)}>
                  <Package className="h-4 w-4 mr-2" /> Solicitar Refacciones
                </Button>
              )}
            </div>

            {/* Actividades Adicionales */}
            <div className="space-y-3">
              <p className="font-semibold text-continental-black">Actividades Adicionales</p>
              {detalle.solicitudesActividadAdicional?.length ? (
                <div className="space-y-2">
                  {detalle.solicitudesActividadAdicional.map((s) => (
                    <div key={s.id} className="rounded-lg border border-continental-gray-3/60 p-3 bg-white shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <span className="text-sm font-semibold text-continental-black truncate">{s.descripcion}</span>
                            <Badge variant={s.estado === 'Pendiente' ? 'outline' : s.estado === 'Aprobada' ? 'default' : 'destructive'}>
                              {s.estado}
                            </Badge>
                          </div>
                          {s.justificacion && <p className="text-xs text-continental-gray-1 mt-1">{s.justificacion}</p>}
                          
                          {/* Botones de acción para supervisor/admin si está pendiente */}
                          {s.estado === 'Pendiente' && hasRole(['Supervisor', 'Administrador', 'SuperUsuario']) && (
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" className="h-7 text-[10px] bg-green-600 px-2 py-0" onClick={() => handleResponderActividadAdicional(s.id, true)}>Aprobar</Button>
                              <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2 py-0" onClick={() => handleResponderActividadAdicional(s.id, false)}>Rechazar</Button>
                            </div>
                          )}
                        </div>
                        {s.fotoUrl && (
                          <img 
                            src={buildUrl(s.fotoUrl)} 
                            className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80" 
                            onClick={() => openImagePreview(s.fotoUrl, s.descripcion)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-continental-gray-2 italic">Sin actividades adicionales.</p>
              )}
              {hasRole(['Administrador', 'SuperUsuario', 'Supervisor', 'Tecnico']) && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowActivityModal(true)}>
                  <ClipboardList className="h-4 w-4 mr-2" /> Solicitar Actividad Extra
                </Button>
              )}
            </div>
          </div>

          {/* Sección de Aprobaciones de Cambio (Legacy ACTIVIDAD_EXTRA) */}
          {solicitudesCambio.length > 0 && (
            <div className="mt-6 border-t border-continental-gray-3/60 pt-4 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-semibold text-sm">Cambios en Vehículo Pendientes (Legacy)</p>
              </div>
              <div className="grid gap-2">
                {solicitudesCambio.map((s) => (
                  <div key={s.id} className="p-3 bg-amber-50/30 border border-amber-200 rounded-lg flex justify-between items-center">
                    <p className="text-xs text-continental-black">
                      {s.descripcion.replace('ACTIVIDAD_EXTRA: ', '')}
                    </p>
                    {hasRole(['Lider', 'Supervisor', 'Administrador']) && (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-6 text-[10px] bg-green-600 px-2 py-0" onClick={() => handleAprobarActividadExtra(s, true)}>Aprobar</Button>
                        <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2 py-0" onClick={() => handleAprobarActividadExtra(s, false)}>Rechazar</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Section */}
          {(hasRole(['Lider', 'Supervisor', 'SuperUsuario', 'Administrador'])) && detalle.estado === EstadoOrdenTrabajo.Completada && (
            <div className="mt-4 border-t border-continental-gray-3/60 pt-4">
              <p className="font-semibold text-continental-black mb-2">Aprobación de Cierre</p>
              
              <div className="flex flex-wrap gap-3 items-center">
                {/* Mostrar botones solo si el usuario tiene el rol y aún no ha aprobado */}
                {((hasRole(['Lider']) && detalle.estadoAprobacionLider === 0) || 
                  (hasRole(['Supervisor', 'SuperUsuario', 'Administrador']) && detalle.estadoAprobacionSupervisor === 0)) && (
                  <>
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                      onClick={() => handleAprobar(true)}
                      disabled={accionando}
                    >
                      <CheckCircle className="h-4 w-4" /> Aceptar
                    </Button>
                    <Button 
                      variant="destructive"
                      className="flex items-center gap-2"
                      onClick={() => handleAprobar(false)}
                      disabled={accionando}
                    >
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                  </>
                )}

                {/* Indicador de cierre completo si ambas aprobaciones están listas */}
                {detalle.estadoAprobacionLider === 1 && detalle.estadoAprobacionSupervisor === 1 && (
                  <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <ShieldCheck className="h-5 w-5" />
                    <span>Orden plenamente firmada y válida para pagos</span>
                  </div>
                )}

                <div className="text-sm text-continental-gray-1 ml-2 flex gap-4">
                  {detalle.estadoAprobacionLider !== undefined && (
                     <div className="flex items-center gap-1.5">
                       <span className="text-xs font-medium">Lider:</span>
                       <Badge variant={detalle.estadoAprobacionLider === 1 ? 'default' : detalle.estadoAprobacionLider === 2 ? 'destructive' : 'outline'}>
                         {detalle.estadoAprobacionLider === 1 ? 'Aprobado' : detalle.estadoAprobacionLider === 2 ? 'Rechazado' : 'Pendiente'}
                       </Badge>
                     </div>
                  )}
                   {detalle.estadoAprobacionSupervisor !== undefined && (
                     <div className="flex items-center gap-1.5">
                       <span className="text-xs font-medium">Supervisor:</span>
                       <Badge variant={detalle.estadoAprobacionSupervisor === 1 ? 'default' : detalle.estadoAprobacionSupervisor === 2 ? 'destructive' : 'outline'}>
                         {detalle.estadoAprobacionSupervisor === 1 ? 'Aprobado' : detalle.estadoAprobacionSupervisor === 2 ? 'Rechazado' : 'Pendiente'}
                       </Badge>
                     </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isCameraActive && (
            <Card className="mt-4 p-4 border-2 border-continental-blue bg-continental-bg/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4 text-continental-blue" /> Cámara en vivo
                  </p>
                  <Button variant="ghost" size="sm" onClick={stopGeneralCamera}>Cerrar</Button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 aspect-video bg-black max-w-md mx-auto">
                   <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                </div>
                <div className="flex justify-center gap-3">
                  <Button className="px-8 bg-continental-gradient text-white" onClick={captureGeneralPhoto} disabled={accionando}>
                    {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Capturar Foto y Subir'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

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
              {detalle && (
                <Button 
                  variant="outline" 
                  onClick={generarReporteOrden} 
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Crear Reporte
                </Button>
              )}
            {detalle.estado === EstadoOrdenTrabajo.Pendiente && (
              <Button
                onClick={() => {
                  setShowIniciar(true);
                  setDiagInicio(detalle.diagnostico || '');
                }}
                disabled={accionando}
                className="flex items-center gap-2"
              >
                {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayIcon />}
                Iniciar
              </Button>
            )}
            {(detalle.estado === EstadoOrdenTrabajo.Asignada || detalle.estado === EstadoOrdenTrabajo.EnProceso) && (
              <Button
                onClick={() => {
                  setShowCompletar(true);
                  setCompError('');
                  setCompTrabajo(detalle.trabajoRealizado || '');
                  setCompHoras(detalle.horasTrabajadas ? String(detalle.horasTrabajadas) : '1');
                  setConsumos([{ consumibleId: undefined, cantidad: '1' }]);
                  setCompEvidFile(null);
                  setCompEvidDesc('');
                  loadConsumibles();
                }}
                disabled={accionando}
                className="flex items-center gap-2"
              >
                {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Completar
              </Button>
            )}
            {detalle.estado === EstadoOrdenTrabajo.Completada && hasRole(['Supervisor', 'SuperUsuario', 'Administrador']) && (
              <Button variant="outline" className="flex items-center gap-2">
                <Link to="/entregas">
                  <ShieldCheck className="h-4 w-4" />
                  Validar en panel de entregas
                </Link>
              </Button>
            )}
            {detalle.estado !== EstadoOrdenTrabajo.Cancelada && (
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCancelar(true);
                  setMotivoCancelar('');
                }}
                disabled={accionando}
                className="flex items-center gap-2 text-red-600"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
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
          <Input
            placeholder="Buscar por folio, vehiculo o texto"
            value={filters.busqueda}
            onChange={(e) => setFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
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


      {/* Modal Validar/Devolver */}
      <Modal isOpen={showValidar} onClose={() => setShowValidar(false)} title="Validar orden" description="Aprueba o devuelve la orden con observaciones.">
        <div className="space-y-4">
          <p className="text-sm text-continental-gray-1">
            Folio: <span className="font-semibold text-continental-black">{detalle?.folio}</span> - Vehiculo: {detalle?.vehiculoCodigo}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-continental-black">Trabajo realizado</p>
            <p className="text-sm text-continental-gray-1">{detalle?.trabajoRealizado || 'Sin registro'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-continental-black">Decision</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm text-continental-black">
                <input
                  type="radio"
                  checked={validarDecision === 'aprobar'}
                  onChange={() => setValidarDecision('aprobar')}
                />
                Aprobar
              </label>
              <label className="flex items-center gap-2 text-sm text-continental-black">
                <input
                  type="radio"
                  checked={validarDecision === 'devolver'}
                  onChange={() => setValidarDecision('devolver')}
                />
                Devolver con correcciones
              </label>
            </div>
          </div>
          <Textarea
            label="Observaciones (opcional)"
            placeholder="Notas para el tecnico/supervisor"
            value={validarObs}
            onChange={(e) => setValidarObs(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowValidar(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!detalle) return;
              setShowValidar(false);
              handleValidar(detalle.id, validarDecision === 'aprobar', validarObs || undefined);
            }}
            disabled={accionando}
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Completar */}
      <Modal
        isOpen={showCompletar}
        onClose={() => setShowCompletar(false)}
        title="Completar trabajo"
        description="Resumen de puntos completados y registro de consumibles."
      >
        <div className="space-y-4">
          {compError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{compError}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-continental-gray-1">
            Folio: <span className="font-semibold text-continental-black">{detalle?.folio}</span>
          </p>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-continental-black flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-continental-green" />
              Vista previa del checklist realizado
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
                      </li>
                    ))
                  }
                </ul>
              ) : (
                <p className="text-xs text-continental-gray-1 italic">No se han marcado puntos como completados.</p>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3 bg-continental-bg/60">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-continental-gray-1" />
              <p className="text-sm font-semibold text-continental-black">Consumibles usados (opcional)</p>
            </div>
            {consumos.map((c, idx) => (
              <div key={idx} className="grid md:grid-cols-2 gap-2 items-center">
                <SearchableSelect
                  label={`Consumible ${idx + 1}`}
                  placeholder="Buscar por nombre o codigo"
                  selected={
                    c.consumibleId
                      ? consumibles
                          .map((opt) => ({ value: opt.value, label: opt.label }))
                          .find((opt) => opt.value === c.consumibleId) || null
                      : null
                  }
                  onSelect={(opt) =>
                    setConsumos((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, consumibleId: opt ? Number(opt.value) : undefined } : item))
                    )
                  }
                  fetchOptions={async (q) =>
                    consumibles
                      .filter((opt) => opt.label.toLowerCase().includes(q.toLowerCase()))
                      .map((opt) => ({ value: opt.value, label: opt.label }))
                  }
                  noResultsText={loadingConsumibles ? 'Cargando...' : 'Sin consumibles'}
                />
                <div className="flex items-center gap-2">
                  <Input
                    label="Cantidad"
                    type="number"
                    min="0"
                    value={c.cantidad}
                    onChange={(e) =>
                      setConsumos((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, cantidad: e.target.value } : item))
                      )
                    }
                  />
                  {consumos.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConsumos((prev) => prev.filter((_, i) => i !== idx))}
                      className="mt-6 text-red-600"
                    >
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setConsumos((prev) => [...prev, { consumibleId: undefined, cantidad: '1' }])}>
              <Plus className="h-4 w-4" /> Agregar consumible
            </Button>
          </div>
          <div className="space-y-2 border-t pt-3 mt-3">
            <p className="text-sm font-semibold text-continental-black">Evidencias adicionales (opcional)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCompEvidFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-sm text-continental-black"
            />
            <Input
              label="Descripcion de la evidencia"
              placeholder="Ej. Foto del trabajo terminado"
              value={compEvidDesc}
              onChange={(e) => setCompEvidDesc(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCompletar(false)}>
            Cancelar
          </Button>
            <Button
              onClick={() => {
                if (!detalle) return;
                setCompError('');

                // Validar que todos los ítems del checklist tengan foto si están marcados como OK
                const faltanFotos = checklistItems.some(item => {
                  const resp = checklistRespuestas[item.id];
                  return resp?.valor === 'OK' && !resp.fotoUrl;
                });

                if (faltanFotos) {
                  setCompError('No puedes completar la orden: hay ítems marcados como completados que no tienen foto de evidencia.');
                  return;
                }

                const pendientes = (detalle.solicitudesRefaccion || []).filter(
                  (s) => s.estado !== 'Entregada' && s.estado !== 'Rechazada'
                );
                if (pendientes.length > 0) {
                  setCompError('No puedes completar la orden: hay refacciones pendientes de entrega.');
                  return;
                }
                setShowCompletar(false);

                // Generar descripción automática basada en el checklist para el backend
                const itemsOk = checklistItems
                  .filter(i => checklistRespuestas[i.id]?.valor === 'OK')
                  .map(i => i.pregunta);
                
                const descripcionAutomatica = itemsOk.length > 0 
                  ? `Trabajo completado según checklist: ${itemsOk.join(', ')}` 
                  : 'Trabajo completado (ver checklist)';

                const horas = Number(compHoras) || 1; // Default a 1 si estaba vacío
                const consumosValidos = consumos.filter((c) => c.consumibleId && Number(c.cantidad) > 0);

              doAccion(async () => {
                if (compEvidFile) {
                  const evRes = await ordenesService.uploadEvidencia(
                    detalle.id,
                    compEvidFile,
                    compEvidDesc || 'Evidencia de mantenimiento',
                    'despues'
                  );
                  if (!evRes.success) {
                    setError(evRes.message || 'No se pudo subir la evidencia');
                    // Continuar con el cierre aunque la evidencia falle
                  }
                }
                await ordenesService.completarTrabajo(detalle.id, {
                  trabajoRealizado: descripcionAutomatica,
                  horasTrabajadas: horas
                });
                for (const c of consumosValidos) {
                  try {
                    await consumiblesService.registrarConsumo(c.consumibleId!, {
                      ordenTrabajoId: detalle.id,
                      cantidad: Number(c.cantidad),
                      comentario: `Consumo OT ${detalle.folio}`
                    });
                  } catch (err) {
                    console.error('No se pudo registrar consumo', err);
                  }
                }
              });
            }}
            disabled={accionando}
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Completar'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Solicitar refacciones */}
      <Modal
        isOpen={showRefModal}
        onClose={() => setShowRefModal(false)}
      title="Solicitar refacciones"
      description="Agrega una o varias refacciones para esta orden."
    >
      <div className="space-y-3">
        {refItems.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-continental-black">Refaccion #{idx + 1}</p>
                        {refItems.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setRefItems((prev) => prev.filter((_, i) => i !== idx))}>
                            Quitar
                          </Button>
                        )}
                      </div>
                      <SearchableSelect
                        placeholder="Buscar refaccion disponible"
                        selected={item.seleccion || null}
                        onSelect={(opt) =>
                          setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, seleccion: opt, nombre: opt?.label || '' } : it)))
                        }
                        fetchOptions={fetchRefacciones}
                        noResultsText="Sin refacciones"
                      />
                      <Input
                        label="Nombre"
                        value={item.nombre}
                        onChange={(e) => setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, nombre: e.target.value } : it)))}
                        placeholder="O escribe otra refaccion"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Cantidad"
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) =>
                            setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, cantidad: e.target.value } : it)))
                          }
                        />
                        <Input
                          label="Justificacion"
                          value={item.justificacion}
                          onChange={(e) =>
                            setRefItems((prev) => prev.map((it, i) => (i === idx ? { ...it, justificacion: e.target.value } : it)))
                          }
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefItems((prev) => [...prev, { nombre: '', cantidad: '1', justificacion: '' }])}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Agregar refaccion
          </Button>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowRefModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!detalle) return;
              const payloadItems = refItems
                .map((it) => ({
                  ordenTrabajoId: detalle.id,
                  nombreRefaccion: (it.seleccion?.label || it.nombre).trim(),
                  cantidad: Number(it.cantidad) || 1,
                  justificacion: it.justificacion.trim() || undefined
                }))
                .filter((it) => it.nombreRefaccion.length > 0);
              if (payloadItems.length === 0) {
                setError('Captura al menos una refaccion');
                return;
              }
              doAccion(async () => {
                if (payloadItems.length === 1) {
                  await refaccionesService.create(payloadItems[0]);
                } else {
                  await refaccionesService.createBatch({ solicitudes: payloadItems });
                }
                setShowRefModal(false);
                setRefItems([{ nombre: '', cantidad: '1', justificacion: '' }]);
              });
            }}
            disabled={accionando}
            className="flex items-center gap-2"
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Enviar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Iniciar */}
      <Modal
        isOpen={showIniciar}
        onClose={() => setShowIniciar(false)}
        title="Iniciar orden"
        description="Agrega un diagnostico inicial (opcional) y marca la orden en proceso."
      >
        <div className="space-y-3">
          <p className="text-sm text-continental-gray-1">
            Folio: <span className="font-semibold text-continental-black">{detalle?.folio}</span>
          </p>
          <Textarea
            label="Diagnostico inicial (opcional)"
            placeholder="Notas breves del estado al iniciar"
            value={diagInicio}
            onChange={(e) => setDiagInicio(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowIniciar(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!detalle) return;
              setShowIniciar(false);
              handleIniciar(detalle.id, diagInicio || undefined);
            }}
            disabled={accionando}
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar'}
          </Button>
        </ModalFooter>
      </Modal>


      {/* Modal Cancelar */}
      <Modal
        isOpen={showCancelar}
        onClose={() => setShowCancelar(false)}
        title="Cancelar orden"
        description="Indica el motivo de cancelacion."
      >
        <div className="space-y-3">
          <p className="text-sm text-continental-gray-1">
            Folio: <span className="font-semibold text-continental-black">{detalle?.folio}</span>
          </p>
          <Textarea
            label="Motivo"
            placeholder="Describe el motivo de cancelacion"
            value={motivoCancelar}
            onChange={(e) => setMotivoCancelar(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCancelar(false)}>
            Volver
          </Button>
          <Button
            onClick={() => {
              if (!detalle || !motivoCancelar.trim()) return;
              setShowCancelar(false);
              handleCancelar(detalle.id, motivoCancelar.trim());
            }}
            disabled={accionando || !motivoCancelar.trim()}
          >
            {accionando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancelar orden'}
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

      <RequestActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        ordenTrabajoId={detalle?.id}
        vehiculoId={detalle?.vehiculoId}
        tipoMantenimiento={detalle?.tipoMantenimiento}
        onSuccess={() => loadOrdenes()}
      />
    </div>
  );
}

const fetchRefacciones = async (q?: string): Promise<SearchableSelectOption[]> => {
    try {
      // Endpoint accesible para tecnico: disponibles
      const resDisp = await consumiblesService.getDisponibles();
      let lista: any[] = [];
      if (resDisp.success && resDisp.data && Array.isArray(resDisp.data)) {
        lista = resDisp.data as any[];
      } else {
        // Fallback solo si disponible falla (requiere roles elevados)
        const res = await consumiblesService.getAll({ q: q?.trim() || undefined });
        if (res.success && res.data) {
          lista = res.data as any[];
        }
      }

    const term = (q || '').toLowerCase();
    const filtrada = lista
      .filter((c) => (c.categoria || '').toLowerCase().includes('refac'))
      .filter(
        (c) =>
          !term ||
          (c.nombre || '').toLowerCase().includes(term) ||
          (c.codigo || '').toLowerCase().includes(term)
      );

    return filtrada.map((r) => ({
      value: r.id,
      label: `${r.nombre} (${r.codigo})`,
      description: `Stock: ${r.stockActual ?? 0}`,
      meta: { stock: r.stockActual ?? 0 }
    }));
  } catch (err) {
    console.error('No se pudieron cargar refacciones', err);
  }
  return [];
};
