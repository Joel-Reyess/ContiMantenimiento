import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Upload, QrCode, Check, AlertTriangle, Info, ScanLine } from 'lucide-react';
import {
  Button,
  SearchableSelect,
  type SearchableSelectOption,
  Spinner,
  QrScannerButton
} from '@/components/ui';
import {
  reportesService,
  vehiculosService,
  checklistService,
  vehiculoPrefijoConfigsService,
  catalogosService,
  vehicleImagePointsService
} from '@/services';
import { Prioridad } from '@/interfaces/Api.interface';
import type {
  ReporteFallaCreateRequest,
  ReportImageFaultCreateRequest,
  VehicleImagePoint,
} from '@/interfaces';
import { getFullImageUrl } from '@/lib/utils';
import { InteractiveVehicleImage } from '@/components/vehiculos/InteractiveVehicleImage';

interface ChecklistItem {
  id: number;
  orden: number;
  pregunta: string;
  tipoRespuesta: number;
  tipoRespuestaNombre?: string;
  opciones?: string;
  obligatorio: boolean;
  requiereFoto: boolean;
  costoEstimado?: number;
}

type VehiculoOption = SearchableSelectOption<{
  codigo: string;
  tipo?: string;
  area?: string;
  tipoId?: number;
  isCreate?: boolean;
}>;

interface ReportFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialVehiculoId?: number | null;
  initialVehiculoCodigo?: string | null;
  initialTipoMantenimiento?: 'Preventivo' | 'Correctivo';
  forceFormStep?: boolean;
}

export function ReportFailureModal({
  isOpen,
  onClose,
  onSuccess,
  initialVehiculoId = null,
  initialVehiculoCodigo = null,
  initialTipoMantenimiento,
  forceFormStep = false
}: ReportFailureModalProps) {
  const [step, setStep] = useState<'scan' | 'form'>('scan');
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoOption | null>(null);
  const [codigoVehiculo, setCodigoVehiculo] = useState('');
  const [prioridad, setPrioridad] = useState('Media');
  const [tipoMantenimiento, setTipoMantenimiento] = useState('Correctivo');
  const [fotos, setFotos] = useState<File[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<number[]>([]);
  const [checklistQuantities, setChecklistQuantities] = useState<Record<number, number>>({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [loadingPrefijo, setLoadingPrefijo] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastTimer, setToastTimer] = useState<number | null>(null);
  const [showConfirmDuplicate, setShowConfirmDuplicate] = useState(false);
  const [duplicateOrderInfo, setDuplicateOrderInfo] = useState<{ folio: string; id: number } | null>(null);
  const [tiposVehiculoCatalogo, setTiposVehiculoCatalogo] = useState<Array<{ id: number; nombre: string; imagenUrl?: string; imagenFallasUrl?: string }>>([]);
  const [tipoVehiculoIdSeleccionado, setTipoVehiculoIdSeleccionado] = useState<number | null>(null);
  const [tipoVehiculoNombreSeleccionado, setTipoVehiculoNombreSeleccionado] = useState('');
  const [vehicleImageUrl, setVehicleImageUrl] = useState<string | undefined>(undefined);
  const [vehicleImagePoints, setVehicleImagePoints] = useState<VehicleImagePoint[]>([]);
  const [selectedImageFaults, setSelectedImageFaults] = useState<ReportImageFaultCreateRequest[]>([]);
  const [loadingImagePoints, setLoadingImagePoints] = useState(false);
  const [showImageSelectorModal, setShowImageSelectorModal] = useState(false);

  // Numeracion estable de los componentes: se ordena por id (orden de carga) y se enumera 1..N.
  // Ese numero es el que se pinta sobre la foto y en la lista lateral (estilo cajitas de la presentacion).
  const orderedImagePoints = [...vehicleImagePoints].sort((a, b) => a.id - b.id);
  const imagePointNumbers: Record<number, number> = {};
  orderedImagePoints.forEach((point, index) => {
    imagePointNumbers[point.id] = index + 1;
  });

  const isDuplicateError = (res: any) => {
    const code = res?.errorCode || (res?.errors && res.errors.length > 0 ? res.errors[0] : null);
    const msg = res?.message || '';
    return code === 'DuplicateActiveOrder' || msg.toLowerCase().includes('ya tiene una orden de trabajo activa');
  };

  const showGlobalToast = (message: string) => {
    if (typeof document === 'undefined') return;
    const wrapper = document.createElement('div');
    wrapper.className =
      'fixed top-6 right-6 z-[2000] transition-opacity duration-200 ease-out';
    wrapper.innerHTML = `<div class="bg-green-50 border border-green-200 text-green-800 px-8 py-6 rounded-xl shadow-2xl flex items-center gap-4 min-w-[350px]">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <div class="text-lg leading-snug font-bold">${message}</div>
    </div>`;
    document.body.appendChild(wrapper);
    setTimeout(() => {
      wrapper.style.opacity = '0';
      setTimeout(() => wrapper.remove(), 300);
    }, 5000);
  };
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const evidenceVideoRef = useRef<HTMLVideoElement>(null);
  const evidenceStreamRef = useRef<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

const vehiculosFetchSeqRef = useRef(0);
const vehiculosDebounceRef = useRef<number | null>(null);

const prefijoConfigCacheRef = useRef(new Map<string, { tipoId?: number; templateId?: number } | null>());
const templatesCacheRef = useRef(new Map<string, ChecklistItem[]>());
const templateByIdCacheRef = useRef(new Map<number, ChecklistItem[]>());
const checklistReqSeqRef = useRef(0);
const lastChecklistReloadKeyRef = useRef('');

  const buildImageKey = useCallback((tipoVehiculoId?: number | null) => {
    if (!tipoVehiculoId || Number.isNaN(Number(tipoVehiculoId))) return '';
    return `tipo_${Number(tipoVehiculoId)}`;
  }, []);

  const loadTiposVehiculoCatalogo = useCallback(async () => {
    try {
      const res = await catalogosService.getTiposVehiculo();
      if (res.success && Array.isArray(res.data)) {
        setTiposVehiculoCatalogo(
          res.data.map((t) => ({
            id: t.id,
            nombre: t.nombre,
            imagenUrl: t.imagenUrl,
            imagenFallasUrl: t.imagenFallasUrl,
          }))
        );
      } else {
        setTiposVehiculoCatalogo([]);
      }
    } catch (err) {
      console.error('No se pudo cargar catálogo de tipos de vehículo', err);
      setTiposVehiculoCatalogo([]);
    }
  }, []);

  const loadVehicleImagePointsByTipo = useCallback(async (tipoVehiculoId?: number | null) => {
    if (!tipoVehiculoId) {
      setVehicleImagePoints([]);
      return;
    }

    const imageKey = buildImageKey(tipoVehiculoId);
    if (!imageKey) {
      setVehicleImagePoints([]);
      return;
    }

    setLoadingImagePoints(true);
    try {
      const res = await vehicleImagePointsService.getAll({ imageKey, onlyActive: true });
      if (res.success && Array.isArray(res.data)) {
        setVehicleImagePoints(res.data);
      } else {
        setVehicleImagePoints([]);
      }
    } catch (err) {
      console.error('No se pudieron cargar puntos de imagen del vehículo', err);
      setVehicleImagePoints([]);
    } finally {
      setLoadingImagePoints(false);
    }
  }, [buildImageKey]);

  const handleToggleImagePoint = useCallback((point: VehicleImagePoint) => {
    setSelectedImageFaults((prev) => {
      const idx = prev.findIndex(
        (x) =>
          x.imageFaultId === point.imageFaultId &&
          (x.vehicleImagePointId || 0) === point.id
      );
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, { imageFaultId: point.imageFaultId, vehicleImagePointId: point.id }];
    });
  }, []);

  const applyTipoVehiculoContext = useCallback((tipoVehiculoId?: number | null) => {
    const parsed = tipoVehiculoId ? Number(tipoVehiculoId) : null;
    setTipoVehiculoIdSeleccionado(parsed);
    void loadVehicleImagePointsByTipo(parsed);
  }, [loadVehicleImagePointsByTipo]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopCameraEvidence();
      resetForm();
      setSuccess('');
      setShowToast(false);
      if (toastTimer) {
        window.clearTimeout(toastTimer);
        setToastTimer(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void loadTiposVehiculoCatalogo();
  }, [isOpen, loadTiposVehiculoCatalogo]);

  useEffect(() => {
    if (!tipoVehiculoIdSeleccionado) {
      setTipoVehiculoNombreSeleccionado('');
      setVehicleImageUrl(undefined);
      return;
    }

    const tipo = tiposVehiculoCatalogo.find((t) => t.id === tipoVehiculoIdSeleccionado);
    setTipoVehiculoNombreSeleccionado(tipo?.nombre || `Tipo ${tipoVehiculoIdSeleccionado}`);
    const preferredImage = tipo?.imagenFallasUrl || tipo?.imagenUrl;
    if (!preferredImage) {
      setVehicleImageUrl(undefined);
      return;
    }
    const full = getFullImageUrl(preferredImage);
    const sep = full.includes('?') ? '&' : '?';
    setVehicleImageUrl(`${full}${sep}v=${Date.now()}`);
  }, [tipoVehiculoIdSeleccionado, tiposVehiculoCatalogo]);

  useEffect(() => {
    if (!isOpen) return;

    const codigoInicial = (initialVehiculoCodigo || '').trim();
    const tienePrefill = Boolean(initialVehiculoId || codigoInicial);

    if (!tienePrefill && !forceFormStep) return;

    const mantenimientoInicial = initialTipoMantenimiento || (tienePrefill ? 'Preventivo' : tipoMantenimiento);

    setStep('form');
    setTipoMantenimiento(mantenimientoInicial);
    setError('');

    const prefillVehiculo = async () => {
      if (initialVehiculoId && codigoInicial) {
        const option: VehiculoOption = {
          value: String(initialVehiculoId),
          label: codigoInicial,
          description: '',
          meta: { codigo: codigoInicial },
        };
        setVehiculoSeleccionado(option);
        setCodigoVehiculo(codigoInicial);
        await loadChecklistItems(initialVehiculoId, undefined, false, mantenimientoInicial);
        return;
      }

      if (initialVehiculoId) {
        try {
          const vehiculoRes = await vehiculosService.getById(initialVehiculoId);
          if (vehiculoRes.success && vehiculoRes.data) {
            const codigo = (vehiculoRes.data.codigo || '').trim();
            const option: VehiculoOption = {
              value: String(initialVehiculoId),
              label: codigo,
              description: vehiculoRes.data.areaNombre || vehiculoRes.data.estadoNombre || '',
              meta: {
                codigo,
                tipo: vehiculoRes.data.tipoNombre,
                area: vehiculoRes.data.areaNombre,
                tipoId: vehiculoRes.data.tipo,
              },
            };
            setVehiculoSeleccionado(option);
            setCodigoVehiculo(codigo);
            applyTipoVehiculoContext(vehiculoRes.data.tipo);
            await loadChecklistItems(initialVehiculoId, undefined, false, mantenimientoInicial);
            return;
          }
        } catch (err) {
          console.error('No se pudo precargar el vehiculo en reporte de falla', err);
        }
      }

      if (codigoInicial) {
        setVehiculoSeleccionado(null);
        setCodigoVehiculo(codigoInicial);
        await loadChecklistByCodigo(codigoInicial, false, mantenimientoInicial);
      }
    };

    void prefillVehiculo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialVehiculoId, initialVehiculoCodigo, initialTipoMantenimiento, forceFormStep]);


  const fetchVehiculos = useCallback((busqueda: string): Promise<VehiculoOption[]> => {
    const typed = (busqueda || '').trim();

    const buildCreateOption = (): VehiculoOption[] => {
      if (!typed) return [];
      return [
        {
          value: `__create__:${typed}`,
          label: `Crear "${typed}"`,
          description: 'Se creará al enviar',
          meta: { codigo: typed, isCreate: true },
        } as VehiculoOption,
      ];
    };

    vehiculosFetchSeqRef.current += 1;
    const mySeq = vehiculosFetchSeqRef.current;

    if (vehiculosDebounceRef.current) {
      window.clearTimeout(vehiculosDebounceRef.current);
    }

    return new Promise((resolve) => {
      vehiculosDebounceRef.current = window.setTimeout(async () => {
        if (mySeq !== vehiculosFetchSeqRef.current) {
          resolve([]);
          return;
        }

        try {
          const res = await vehiculosService.getAll({
            busqueda: typed || undefined,
            soloActivos: true,
            page: 1,
            pageSize: 10,
          });

          const options: VehiculoOption[] = [];
          if (res.success && res.data) {
            const data = res.data as any;
            const items =
              (data && (data.items || data.Items)) ||
              (Array.isArray(data) ? data : []);

            (items || []).forEach((v: any) => {
              options.push({
                value: v.id.toString(),
                label: `${v.codigo}${v.tipoNombre ? ` - ${v.tipoNombre}` : ''}`,
                description: v.areaNombre || v.estadoNombre || '',
                meta: { codigo: v.codigo, tipo: v.tipoNombre, area: v.areaNombre, tipoId: v.tipo },
              });
            });
          }

          const exactExists = typed ? options.some((o) => (o.meta?.codigo || '').toLowerCase() === typed.toLowerCase()) : true;
          const finalOptions = exactExists ? options : [...buildCreateOption(), ...options];

          resolve(finalOptions);
        } catch (err) {
          console.error('No se pudo cargar vehiculos', err);
          const fallback = buildCreateOption();
          resolve(fallback);
        }
      }, 250);
    });
  }, []);

  const resetForm = () => {
    setStep('scan');
    setVehiculoSeleccionado(null);
    setCodigoVehiculo('');
    setPrioridad('Media');
    setTipoMantenimiento('Correctivo');
    setFotos([]);
    setChecklistItems([]);
    setSelectedChecklistItems([]);
    setChecklistQuantities({});
    setTipoVehiculoIdSeleccionado(null);
    setTipoVehiculoNombreSeleccionado('');
    setVehicleImageUrl(undefined);
    setVehicleImagePoints([]);
    setSelectedImageFaults([]);
    setShowImageSelectorModal(false);
    setError('');
    setShowConfirmDuplicate(false);
    setDuplicateOrderInfo(null);
  };


  const stopCamera = () => {
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) {
      scanVideoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setIsCameraOn(false);
  };

  const handleManualEntry = () => {
    setStep('form');
    stopCamera();
  };

    const loadChecklistItems = async (
    vehiculoId?: number,
    tipoVehiculoId?: number,
    autoSelect = false,
    mantenimientoOverride?: string
  ) => {
    if (!vehiculoId && tipoVehiculoId === undefined) return;

    const mantenimiento = mantenimientoOverride ?? tipoMantenimiento;
    const reqSeq = ++checklistReqSeqRef.current;
    let tipoVehiculo = tipoVehiculoId;

    setLoadingChecklist(true);
    try {
      if (vehiculoId) {
        try {
          const vehiculoRes = await vehiculosService.getById(vehiculoId);
          if (vehiculoRes.success && vehiculoRes.data) {
            tipoVehiculo = vehiculoRes.data.tipo;
            applyTipoVehiculoContext(Number(vehiculoRes.data.tipo));
          }
        } catch (vehiculoErr) {
          console.error('Error al obtener el tipo de vehiculo:', vehiculoErr);
        }
      } else if (tipoVehiculo !== undefined && tipoVehiculo !== null) {
        applyTipoVehiculoContext(Number(tipoVehiculo));
      }

      if (vehiculoId) {
        try {
          const asignacionesRes = await checklistService.getAsignaciones(vehiculoId);
          if (asignacionesRes.success && asignacionesRes.data && asignacionesRes.data.length > 0) {
            const templateId = asignacionesRes.data[0]?.checklistTemplateId;
            if (templateId) {
              const cachedItems = templateByIdCacheRef.current.get(templateId);
              let items: ChecklistItem[] = cachedItems || [];
              if (!cachedItems) {
                const templateRes = await checklistService.getTemplateById(templateId);
                if (templateRes.success && templateRes.data) {
                  items = (templateRes.data.items || []) as ChecklistItem[];
                  templateByIdCacheRef.current.set(templateId, items);
                }
              }

              if (reqSeq !== checklistReqSeqRef.current) return;

              setChecklistItems(items);
              if (autoSelect) setSelectedChecklistItems(items.map((i) => i.id));
              else setSelectedChecklistItems([]);
              setError('');
              return;
            }
          }
        } catch (asignacionesErr) {
          console.error('Error al obtener asignaciones de checklist para el vehiculo:', asignacionesErr);
        }
      }

      if (tipoVehiculo === undefined || tipoVehiculo === null || Number.isNaN(Number(tipoVehiculo))) {
        applyTipoVehiculoContext(null);
        setChecklistItems([]);
        setSelectedChecklistItems([]);
        setError('No se pudo determinar el tipo de vehiculo para cargar el checklist.');
        return;
      }

      const pickTemplate = (templates: any[]) => {
        if (!Array.isArray(templates) || templates.length === 0) return undefined;
        return (
          templates.find((t) => t?.predeterminado || t?.isDefault || t?.default) ??
          templates.find((t) => t?.activo || t?.isActive) ??
          templates[0]
        );
      };

      const tryLoad = async (mant: string) => {
        const cacheKey = `${Number(tipoVehiculo)}:${mant}`;
        const cached = templatesCacheRef.current.get(cacheKey);
        if (cached) {
          if (reqSeq !== checklistReqSeqRef.current) return true;
          setChecklistItems(cached);
          if (autoSelect) setSelectedChecklistItems(cached.map((i) => i.id));
          else setSelectedChecklistItems([]);
          setError('');
          return true;
        }

        const res = await checklistService.getTemplates(Number(tipoVehiculo), mant);
        if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
          const template = pickTemplate(res.data as any[]);
          const items: ChecklistItem[] = (template?.items || []) as ChecklistItem[];

          templatesCacheRef.current.set(cacheKey, items);

          if (reqSeq !== checklistReqSeqRef.current) return true;

          setChecklistItems(items);
          if (autoSelect) setSelectedChecklistItems(items.map((i) => i.id));
          else setSelectedChecklistItems([]);
          setChecklistQuantities({});
          setError('');
          return true;
        }
        return false;
      };

      let loaded = await tryLoad(mantenimiento);

      if (!loaded && mantenimiento === 'Correctivo') {
        loaded = await tryLoad('Preventivo');
        if (loaded) setTipoMantenimiento('Preventivo');
      }

      if (!loaded) {
        setChecklistItems([]);
        setSelectedChecklistItems([]);
        setError('No se encontri checklist para el tipo de vehiculo y mantenimiento seleccionado.');
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Error al cargar los items del checklist:', err);
      setChecklistItems([]);
      setSelectedChecklistItems([]);
      setError('Error al cargar el checklist.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const loadChecklistByCodigo = async (codigo: string, autoSelect = false, mantenimientoOverride?: string) => {
    const raw = (codigo || '').trim();
    if (!raw) return;

    const normalized = raw.toUpperCase().replace(/\s+/g, '');
    const token = normalized.includes('-') ? normalized.split('-')[0] : normalized;
    const base = token.replace(/[^A-Z0-9]/g, '');

const candidatePrefijos = Array.from(
  new Set(
    Array.from({ length: base.length }, (_, idx) => base.slice(0, base.length - idx)).filter((p) => p.length >= 2)
  )
).slice(0, 15);
    const mantenimiento = mantenimientoOverride ?? tipoMantenimiento;


    const extractConfig = (d: any, mant: string): { tipoId?: number; templateId?: number } => {
      const toNum = (v: any): number | undefined => {
        if (v === undefined || v === null) return undefined;
        if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : undefined;
        if (typeof v === 'string') {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        }
        if (typeof v === 'object') {
          const n = Number((v as any).id ?? (v as any).value);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        }
        return undefined;
      };

      const directTipo = toNum(d);
      if (directTipo !== undefined && (typeof d === 'number' || typeof d === 'string')) {
        return { tipoId: directTipo };
      }

      const obj = d ?? {};
      const tipoId =
        toNum(obj.tipoVehiculoId) ??
        toNum(obj.tipoId) ??
        toNum(obj.tipo) ??
        toNum(obj.vehiculoTipoId) ??
        toNum(obj.id);

      const mantKey = (mant || '').toLowerCase();
      const isPrev = mantKey === 'preventivo';
      const isCorr = mantKey === 'correctivo';

      const templateId =
        toNum(obj[`checklistTemplateId${isPrev ? 'Preventivo' : isCorr ? 'Correctivo' : ''}`]) ??
        toNum(obj[`templateId${isPrev ? 'Preventivo' : isCorr ? 'Correctivo' : ''}`]) ??
        toNum(obj[`${mantKey}ChecklistTemplateId`]) ??
        toNum(obj[`${mantKey}TemplateId`]) ??
        toNum(obj[`${isPrev ? 'checklistTemplatePreventivoId' : isCorr ? 'checklistTemplateCorrectivoId' : ''}`]) ??
        toNum(obj[`${isPrev ? 'checklistPreventivoTemplateId' : isCorr ? 'checklistCorrectivoTemplateId' : ''}`]) ??
        toNum(obj[`${isPrev ? 'templatePreventivoId' : isCorr ? 'templateCorrectivoId' : ''}`]) ??
        toNum(obj[`${isPrev ? 'checklist_template_id_preventivo' : isCorr ? 'checklist_template_id_correctivo' : ''}`]) ??
        toNum(obj[`${isPrev ? 'template_id_preventivo' : isCorr ? 'template_id_correctivo' : ''}`]) ??
        toNum(obj.checklistTemplateId) ??
        toNum(obj.templateId);

      return { tipoId: tipoId ?? undefined, templateId: templateId ?? undefined };
    };

    setLoadingPrefijo(true);
    const reqSeq = ++checklistReqSeqRef.current;
    try {
let config: { tipoId?: number; templateId?: number } | undefined;

for (const pref of candidatePrefijos) {
  const cacheKey = `${pref}:${mantenimiento}`;
  const cached = prefijoConfigCacheRef.current.get(cacheKey);

  if (cached === null) {
    continue;
  }
  if (cached !== undefined) {
    config = cached;
    break;
  }

  let tipoRes = await vehiculoPrefijoConfigsService.getTipoVehiculoIdByCodigo(pref as any);
  if (!tipoRes?.success && /^\d+$/.test(pref)) {
    tipoRes = await vehiculoPrefijoConfigsService.getTipoVehiculoIdByCodigo(Number(pref) as any);
  }

  if (tipoRes?.success) {
    const parsed = extractConfig(tipoRes.data, mantenimiento);
    if (parsed.tipoId !== undefined || parsed.templateId !== undefined) {
      config = { tipoId: parsed.tipoId, templateId: parsed.templateId };
      prefijoConfigCacheRef.current.set(cacheKey, config);
      break;
    }
  }

  prefijoConfigCacheRef.current.set(cacheKey, null);
}

const tipoId = config?.tipoId;
const templateId = config?.templateId;


if (reqSeq !== checklistReqSeqRef.current) return;

      if (tipoId !== undefined && tipoId !== null) {
        applyTipoVehiculoContext(tipoId);
      }

      if (tipoId === undefined && !templateId) {
        applyTipoVehiculoContext(null);
        setChecklistItems([]);
        setSelectedChecklistItems([]);
        setError(`No hay checklist configurado para el prefijo de "${raw}".`);
        return;
      }

      setError('');

      if (templateId) {
        const cachedItems = templateByIdCacheRef.current.get(templateId);
        let items: ChecklistItem[] = cachedItems || [];
        if (!cachedItems) {
          const templateRes = await checklistService.getTemplateById(templateId);
          if (templateRes.success && templateRes.data) {
            items = (templateRes.data.items || []) as ChecklistItem[];
            templateByIdCacheRef.current.set(templateId, items);
          }
        }

        if (reqSeq !== checklistReqSeqRef.current) return;

        setChecklistItems(items);
        if (autoSelect) setSelectedChecklistItems(items.map((i) => i.id));
        else setSelectedChecklistItems([]);
        setChecklistQuantities({});
        return;
      }

      await loadChecklistItems(undefined, tipoId, autoSelect, mantenimiento);
    } catch (err) {
      console.error('No se pudo cargar checklist por prefijo', err);
      if (reqSeq !== checklistReqSeqRef.current) return;
      setChecklistItems([]);
      setSelectedChecklistItems([]);
      setError('No se pudo determinar checklist por prefijo.');
    } finally {
      if (reqSeq === checklistReqSeqRef.current) setLoadingPrefijo(false);
    }
  };

  useEffect(() => {
    if (!isOpen || step !== 'form') return;

    const code = (vehiculoSeleccionado?.meta?.codigo || codigoVehiculo).trim();
    if (!code) return;

    const selectedKey =
      vehiculoSeleccionado && !vehiculoSeleccionado.meta?.isCreate ? vehiculoSeleccionado.value : 'new';

    const key = `${selectedKey}:${code}:${tipoMantenimiento}`;
    if (lastChecklistReloadKeyRef.current === key) return;
    lastChecklistReloadKeyRef.current = key;

    if (vehiculoSeleccionado && !vehiculoSeleccionado.meta?.isCreate) {
      void loadChecklistItems(Number(vehiculoSeleccionado.value), undefined, false, tipoMantenimiento);
    } else {
      void loadChecklistByCodigo(code, false, tipoMantenimiento);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoMantenimiento]);




    const handleScanResult
 = async (codigo: string) => {
    stopCamera();
    try {
      const response = await vehiculosService.getAll({ busqueda: codigo });
      const data: any = response.data;
      const items = (data && (data.items || data.Items)) || (Array.isArray(data) ? data : []);
      const vehiculo = items[0];

      if (vehiculo) {
        const option: VehiculoOption = {
          value: vehiculo.id.toString(),
          label: `${vehiculo.codigo}${vehiculo.tipoNombre ? ` - ${vehiculo.tipoNombre}` : ''}`,
          description: vehiculo.areaNombre || vehiculo.estadoNombre || '',
          meta: { codigo: vehiculo.codigo, tipo: vehiculo.tipoNombre, area: vehiculo.areaNombre, tipoId: vehiculo.tipo },
        };

        setVehiculoSeleccionado(option);
        setCodigoVehiculo(vehiculo.codigo);
        setSelectedImageFaults([]);
        applyTipoVehiculoContext(vehiculo.tipo);
        setStep('form');
        await loadChecklistItems(vehiculo.id, undefined, false);
      } else {
        setVehiculoSeleccionado(null);
        setCodigoVehiculo(codigo);
        setSelectedImageFaults([]);
        applyTipoVehiculoContext(null);
        setStep('form');
        setTipoMantenimiento('Preventivo');
      await loadChecklistByCodigo(codigo, false, 'Preventivo');
        setError(`Vehiculo "${codigo}" no encontrado, se creara si el prefijo coincide`);
      }
    } catch (err) {
      setVehiculoSeleccionado(null);
      setCodigoVehiculo(codigo);
      setSelectedImageFaults([]);
      applyTipoVehiculoContext(null);
      setStep('form');
      setTipoMantenimiento('Preventivo');
      await loadChecklistByCodigo(codigo, false, 'Preventivo');
      setError('Error al buscar vehiculo, se intentara crear con el codigo capturado');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const stopCameraEvidence = () => {
    if (evidenceStreamRef.current) {
      evidenceStreamRef.current.getTracks().forEach((t) => t.stop());
      evidenceStreamRef.current = null;
    }
    if (evidenceVideoRef.current) {
      evidenceVideoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const startCameraEvidence = async () => {
    try {
      if (evidenceStreamRef.current) {
        evidenceStreamRef.current.getTracks().forEach((t) => t.stop());
        evidenceStreamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      evidenceStreamRef.current = stream;
      setIsCameraOn(true);
      if (evidenceVideoRef.current) {
        evidenceVideoRef.current.srcObject = stream;
        evidenceVideoRef.current.onloadedmetadata = () => {
          evidenceVideoRef.current?.play().catch(() => {});
        };
      }
    } catch {
      setError('No se pudo acceder a la camara. Usa la galeria.');
      setIsCameraOn(false);
    }
  };

  useEffect(() => {
    if (isScanning && scanStreamRef.current && scanVideoRef.current) {
      scanVideoRef.current.srcObject = scanStreamRef.current;
      scanVideoRef.current.onloadedmetadata = () => {
        scanVideoRef.current?.play().catch(() => {});
      };
    }
  }, [isScanning]);

  useEffect(() => {
    if (isCameraOn && evidenceStreamRef.current && evidenceVideoRef.current) {
      evidenceVideoRef.current.srcObject = evidenceStreamRef.current;
      evidenceVideoRef.current.onloadedmetadata = () => {
        evidenceVideoRef.current?.play().catch(() => {});
      };
    }
    if (!isCameraOn && evidenceVideoRef.current) {
      evidenceVideoRef.current.srcObject = null;
    }
  }, [isCameraOn]);

  const capturePhoto = () => {
    if (!evidenceVideoRef.current || !isCameraOn) return;
    const video = evidenceVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFotos((prev) => [...prev, file]);
      }
    }, 'image/jpeg', 0.92);
  };

  const removePhoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (force: boolean = false) => {
    const code = (vehiculoSeleccionado?.meta?.codigo || codigoVehiculo).trim();
    if (!code) {
      setError('Debe capturar el codigo del vehiculo');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    setShowToast(false);
    if (!force) setShowConfirmDuplicate(false);

    try {
      const checklistItemsPayload = selectedChecklistItems.map(id => ({
        id,
        cantidad: checklistQuantities[id] || undefined
      }));

      const itemsSummary = selectedChecklistItems
        .map(id => checklistItems.find(i => i.id === id)?.pregunta)
        .filter(Boolean)
        .join(', ');

      const visualNames = Array.from(
        new Set(
          selectedImageFaults
            .map((fault) => {
              const point = vehicleImagePoints.find((p) => p.id === fault.vehicleImagePointId);
              return point?.imageFaultName;
            })
            .filter(Boolean) as string[]
        )
      );
      const visualSummary = visualNames.length > 0 ? `Fallas visuales: ${visualNames.join(', ')}` : '';
      const descripcionCompuesta = [itemsSummary, visualSummary].filter(Boolean).join(' | ');

      const reporteData: ReporteFallaCreateRequest = {
        codigoVehiculo: code,
        descripcion: descripcionCompuesta || 'Reporte de falla generado desde selector visual/checklist',
        prioridad: Prioridad[prioridad as keyof typeof Prioridad] || Prioridad.Media,
        puedeOperar: prioridad !== 'Alta' && prioridad !== 'Urgente',
        tipoMantenimiento,
        checklistItemIds: [], // Legacy
        checklistItems: checklistItemsPayload, // New structure
        imageFaults: selectedImageFaults
      };

      const response = await reportesService.createWithAutoChecklist(reporteData, force);

      if (response.success && response.data?.id) {
        const reporteId = response.data.id;
        if (fotos.length > 0) {
          try {
            await Promise.all(
              fotos.map((foto) =>
                reportesService.uploadEvidencia(reporteId, foto, `Evidencia de falla: ${foto.name}`, 'antes')
              )
            );
          } catch (uploadErr) {
            console.error('Error subiendo evidencia:', uploadErr);
            setError('El reporte se creo pero no se pudo subir la evidencia. Intente nuevamente.');
            setIsSubmitting(false);
            return;
          }
        }

        setSuccess('Reporte de falla creado con éxito');
        setShowToast(true);
        showGlobalToast('Reporte de falla creado con éxito');
        const timerId = window.setTimeout(() => {
          setShowToast(false);
          setSuccess('');
          if (isOpen) onClose();
        }, 7000);
        setToastTimer(timerId);
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
        onSuccess?.();
      } else if (isDuplicateError(response)) {
        const metadata = response.metadata || (response as any).data?.metadata || (response as any).data;
        setDuplicateOrderInfo({
          folio: metadata?.existingOrderFolio || metadata?.ExistingOrderFolio || metadata?.folio || 'N/A',
          id: metadata?.existingOrderId || metadata?.ExistingOrderId || metadata?.id || 0
        });
        setError('');
        setShowConfirmDuplicate(true);
      } else {
        setError(response.message || 'Error al crear reporte');
      }
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      const resData = err.response?.data || err;
      if (isDuplicateError(resData)) {
        const metadata = resData.metadata || resData.data?.metadata || resData.data || resData;
        setDuplicateOrderInfo({
          folio: metadata?.existingOrderFolio || metadata?.ExistingOrderFolio || metadata?.folio || 'N/A',
          id: metadata?.existingOrderId || metadata?.ExistingOrderId || metadata?.id || 0
        });
        setError('');
        setShowConfirmDuplicate(true);
      } else {
        setError(resData?.message || err.message || 'No se pudo crear el reporte. Revise su conexion.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipAndSubmit = () => {
    void handleSubmit(true);
  };

  if (!isOpen && !showToast) return null;

  const toastNode =
    showToast &&
    createPortal(
      <div className="fixed top-6 right-6 z-[1000]">
        <div className="bg-green-50 border border-green-200 text-green-800 px-8 py-6 rounded-xl shadow-2xl flex items-center gap-4 min-w-[350px]">
          <Check className="h-8 w-8 text-green-600" />
          <div className="text-lg leading-snug font-bold">
            {success || 'Reporte de falla creado con éxito'}
          </div>
          <button
            className="ml-auto text-green-700 hover:text-green-900"
            onClick={() => setShowToast(false)}
            aria-label="Cerrar">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {toastNode}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-300">
        {showConfirmDuplicate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-6">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="h-8 w-8" />
                <h3 className="text-xl font-bold">Orden Activa Detectada</h3>
              </div>
              
              <div className="space-y-4 text-gray-600">
                <p>
                  El vehículo seleccionado ya tiene una orden de trabajo activa:
                  {duplicateOrderInfo && (
                    <span className="block mt-1 font-mono font-bold text-gray-900 bg-gray-100 p-2 rounded text-center">
                      {duplicateOrderInfo.folio}
                    </span>
                  )}
                </p>
                <p className="text-sm">¿Desea crear este nuevo reporte de falla de todos modos?</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowConfirmDuplicate(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={skipAndSubmit}
                >
                  Sí, Reportar
                </Button>
              </div>
            </div>
          </div>
        )}
        {showImageSelectorModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Selección de componentes</h3>
                  <p className="text-sm text-gray-600">
                    {tipoVehiculoNombreSeleccionado
                      ? `Tipo de vehículo: ${tipoVehiculoNombreSeleccionado}`
                      : 'Toca un número sobre la foto o en la lista para reportar el componente con falla.'}
                  </p>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-gray-100"
                  onClick={() => setShowImageSelectorModal(false)}
                  aria-label="Cerrar selección de componentes"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {loadingImagePoints ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm text-gray-600">Cargando componentes...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-start">
                    {/* Columna izquierda: foto del carro con los números encima */}
                    <div className="md:sticky md:top-0">
                      <InteractiveVehicleImage
                        imageUrl={vehicleImageUrl}
                        points={orderedImagePoints}
                        selectedPointIds={selectedImageFaults
                          .map((f) => f.vehicleImagePointId)
                          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))}
                        onTogglePoint={handleToggleImagePoint}
                        pointNumbers={imagePointNumbers}
                        showPointLabels={false}
                        className="space-y-2"
                        emptyMessage="No hay componentes configurados para este tipo de vehículo."
                      />
                    </div>

                    {/* Columna derecha: lista numerada de componentes */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                      <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500">
                        <span>Componentes</span>
                        <span className="text-continental-blue-dark">{selectedImageFaults.length} seleccionado(s)</span>
                      </p>
                      {orderedImagePoints.length === 0 ? (
                        <p className="py-6 text-center text-sm italic text-gray-500">
                          No hay componentes configurados para este tipo de vehículo.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1">
                          {orderedImagePoints.map((point) => {
                            const numero = imagePointNumbers[point.id];
                            const checked = selectedImageFaults.some(
                              (f) =>
                                f.imageFaultId === point.imageFaultId &&
                                (f.vehicleImagePointId || 0) === point.id
                            );
                            return (
                              <button
                                key={point.id}
                                type="button"
                                onClick={() => handleToggleImagePoint(point)}
                                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors min-h-[48px] ${
                                  checked
                                    ? 'border-continental-yellow bg-yellow-50 text-yellow-900'
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${
                                    checked
                                      ? 'bg-continental-yellow text-continental-blue-dark ring-2 ring-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {numero}
                                </span>
                                <span className="flex-1 text-sm leading-5">
                                  {point.imageFaultName || `Componente #${point.imageFaultId}`}
                                </span>
                                {checked && (
                                  <Check className="h-5 w-5 shrink-0 text-continental-blue-dark" strokeWidth={3} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedImageFaults([])}
                  disabled={selectedImageFaults.length === 0}
                  className="!min-h-10 !px-4 !py-2 !text-sm rounded-lg"
                >
                  Limpiar selección
                </Button>
                <Button size="sm" onClick={() => setShowImageSelectorModal(false)} className="!min-h-10 !px-5 !py-2 !text-sm rounded-lg">
                  Aceptar
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between" style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem' }}>
          <h2 className="text-xl font-semibold text-gray-800">Reportar Falla</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-14 pt-4">
          <div className="p-4 bg-blue-50 border-blue-200 rounded-xl flex gap-3 items-start">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800">
              Registre una nueva solicitud de mantenimiento. Escanee el código QR o busque la unidad por su código. Describa detalladamente el problema para facilitar el diagnóstico.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-10 space-y-6" style={{ padding: '3rem 3.5rem' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          {step === 'scan' ? (
            <div className="space-y-8">
              <div className="bg-gray-50 border-2 border-dashed border-yellow-500 rounded-xl p-8 text-center flex flex-col items-center gap-4">
                <QrCode className="h-16 w-16 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Escanear Código de Barras / QR
                </h3>
                <p className="text-gray-600">
                  Utiliza la cámara o sube una foto del código del vehículo. Acepta QR y Códigos de Barras.
                </p>
                
                <QrScannerButton 
                  onResult={(code) => handleScanResult(code)}
                  className="w-full flex justify-center"
                />

                {import.meta.env.DEV && (
                  <div className="flex flex-col gap-2 mt-2 w-full">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold text-center">Simulación de Escaneo</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleScanResult('9162100001')} 
                      className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 w-full"
                    >
                      <ScanLine className="h-4 w-4 mr-2" /> 9162100001 (Código de Barras)
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center text-gray-500">- O -</div>

              <Button variant="outline" onClick={handleManualEntry} className="w-full">
                Ingresar Manualmente
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehiculo *
                  </label>
                  <SearchableSelect
                    placeholder="Buscar por codigo, tipo o area"
                    selected={vehiculoSeleccionado}
                    fetchOptions={fetchVehiculos}
                    onSelect={async (option) => {
                      if (!option) return;

                      if (option.meta?.isCreate) {
                        const code = (option.meta?.codigo || '').trim();
                        setVehiculoSeleccionado(null);
                        setCodigoVehiculo(code);
                        setSelectedImageFaults([]);
                        applyTipoVehiculoContext(null);
                        setError('');
                        setTipoMantenimiento('Preventivo');
                        await loadChecklistByCodigo(code, false, 'Preventivo');
                        return;
                      }

                      setVehiculoSeleccionado(option);
                      setCodigoVehiculo(option.meta?.codigo || '');
                      setSelectedImageFaults([]);
                      applyTipoVehiculoContext(option.meta?.tipoId);
                      setError('');
                      await loadChecklistItems(Number(option.value), undefined, false);
                    }}
                  />
                  {loadingPrefijo && (
                    <span className="text-xs text-gray-500">
                      Determinando checklist por prefijo...
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de mantenimiento
                    </label>
                    <select
                      value={tipoMantenimiento}
                      onChange={(e) => {
                        const m = e.target.value;
                        setTipoMantenimiento(m);
                        setError('');
                        const vehId =
                          vehiculoSeleccionado && !vehiculoSeleccionado.meta?.isCreate
                            ? Number(vehiculoSeleccionado.value)
                            : undefined;

                        if (vehId) {
                          void loadChecklistItems(vehId, undefined, false, m);
                        } else {
                          const code = (codigoVehiculo || '').trim();
                          if (code) void loadChecklistByCodigo(code, false, m);
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                    >
                      <option value="Preventivo">Preventivo</option>
                      <option value="Correctivo">Correctivo</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Componentes con falla
                  </label>
                  <div className="rounded-xl border border-gray-300 bg-white p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-gray-600">
                        {tipoVehiculoIdSeleccionado
                          ? `Tipo detectado: ${tipoVehiculoNombreSeleccionado || `Tipo ${tipoVehiculoIdSeleccionado}`}`
                          : 'Selecciona un vehiculo para habilitar el selector de componentes.'}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!tipoVehiculoIdSeleccionado}
                        onClick={() => {
                          setShowImageSelectorModal(true);
                          if (tipoVehiculoIdSeleccionado) {
                            void loadVehicleImagePointsByTipo(tipoVehiculoIdSeleccionado);
                          }
                        }}
                      >
                        Seleccionar componentes
                      </Button>
                    </div>

                    <p className="text-xs text-gray-500">
                      Seleccionadas: {selectedImageFaults.length}
                    </p>

                    {selectedImageFaults.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from(
                          new Set(
                            selectedImageFaults
                              .map((fault) => vehicleImagePoints.find((p) => p.id === fault.vehicleImagePointId)?.imageFaultName)
                              .filter(Boolean) as string[]
                          )
                        ).map((name) => (
                          <span key={name} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Evidencia Fotografica
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 space-y-6 bg-white shadow-sm">
                    <div className="flex flex-wrap gap-3 items-center justify-center">
                        <Button variant="outline" size="sm" onClick={startCameraEvidence}>
                          <Camera className="h-4 w-4 mr-2" /> Usar camara
                        </Button>
                        <Button variant="secondary" size="sm" onClick={capturePhoto} disabled={!isCameraOn}>
                          Capturar foto
                        </Button>
                        {isCameraOn && (
                          <Button variant="ghost" size="sm" onClick={stopCameraEvidence}>
                            Cerrar camara
                          </Button>
                        )}
                    </div>
                    {isCameraOn && (
                      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                        <video
                          ref={evidenceVideoRef}
                          className="w-full h-64 max-h-64 object-cover bg-black"
                          muted
                          playsInline
                          autoPlay
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center justify-center gap-4 cursor-pointer py-12 w-full hover:bg-gray-50 transition-colors rounded-xl mb-0"
                    >
                      <Upload className="text-gray-300" style={{ width: '6rem', height: '6rem' }} />
                      <span className="text-lg text-gray-600 font-medium text-center">Click para subir fotos (galería)</span>
                    </label>
                  </div>
                  {fotos.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {fotos.map((foto, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(foto)}
                            alt={`Foto ${index + 1}`}
                            className="h-16 w-16 object-cover rounded"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    items del checklist a realizar
                  </label>
                  {loadingChecklist ? (
                    <div className="flex items-center justify-center p-4">
                      <Spinner size="sm" />
                      <span className="ml-2 text-sm text-gray-600">Cargando checklist...</span>
                    </div>
                  ) : checklistItems.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-xl p-4 space-y-2 shadow-sm">
                      {checklistItems.map((item) => {
                        const isSelected = selectedChecklistItems.includes(item.id);
                        const toggleItem = () => {
                          const id = item.id;
                          setSelectedChecklistItems((prev) => {
                            const isAdded = !prev.includes(id);
                            if (isAdded && !checklistQuantities[id]) {
                                setChecklistQuantities(q => ({ ...q, [id]: 1 }));
                            }
                            return isAdded ? [...prev, id] : prev.filter((x) => x !== id);
                          });
                        };

                        return (
                          <div
                            key={item.id}
                            className={`flex flex-row items-center justify-between gap-2 p-2 hover:bg-gray-50 rounded-lg border ${isSelected ? 'border-yellow-200 bg-yellow-50/50' : 'border-gray-200'}`}
                          >
                            <div 
                              onClick={toggleItem}
                              className="flex flex-row items-center gap-2 cursor-pointer flex-1 min-w-0"
                            >
                              <div className="relative flex items-center justify-center shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={toggleItem}
                                  className="h-4 w-4 text-yellow-600 border-gray-400 focus:ring-yellow-500 rounded min-h-0 p-0 shadow-none cursor-pointer"
                                  style={{ width: '1rem', height: '1rem' }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <span className="text-sm text-gray-700 truncate">{item.pregunta}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-gray-700' : 'text-gray-400'}`}>Cant:</span>
                                <input
                                  type="number"
                                  min="1"
                                  disabled={!isSelected}
                                  className={`w-14 p-1 text-sm border rounded focus:outline-none text-center ${isSelected ? 'border-gray-300 bg-white focus:border-yellow-500' : 'border-gray-200 bg-gray-100 text-gray-400'}`}
                                  value={checklistQuantities[item.id] || ''}
                                  placeholder={isSelected ? "1" : ""}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : undefined;
                                    setChecklistQuantities(prev => ({ ...prev, [item.id]: val || 0 }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No hay items de checklist disponibles
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('scan')}
                  className="flex-1"
                >
                  Atras
                </Button>
                <Button
                  onClick={() => void handleSubmit(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      )}
    </>
  );
}
