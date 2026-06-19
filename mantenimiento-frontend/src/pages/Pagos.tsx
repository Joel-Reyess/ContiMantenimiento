import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, RefreshCcw, CheckCircle, XCircle, Plus, Loader2, Printer, Save, FileText } from 'lucide-react';
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
  Textarea
} from '@/components/ui';
import { pagosService } from '@/services/pagosService';
import { ordenesService } from '@/services/ordenesService';
import { reportesService } from '@/services/reportesService';
import { usuariosService } from '@/services/usuariosService';
import { useAuth } from '@/contexts/AuthContext';
import { Undo } from 'lucide-react';
import { ordenesCompraService } from '@/services/ordenesCompraService';
import type { RegistroPago } from '@/services/pagosService';
import { EstadoPago, EstadoOrdenTrabajo } from '@/interfaces/Api.interface';
import type { OrdenTrabajo, ReporteFalla, Evidencia } from '@/interfaces';

const estadoOpciones = [
  { value: '', label: 'Todos los estados' },
  { value: String(EstadoPago.Pendiente), label: 'Pendiente' },
  { value: String(EstadoPago.EnRevision), label: 'En revision' },
  { value: String(EstadoPago.Aprobado), label: 'Aprobado' },
  { value: String(EstadoPago.Pagado), label: 'Pagado' },
  { value: String(EstadoPago.Rechazado), label: 'Rechazado' }
];

interface FiltersState {
  estado?: string;
}

interface CrearPagoForm {
  ordenTrabajoId: string;
  tecnicoId: string;
  notas: string;
}

interface EditarPagoForm {
  notas: string;
}

type OrdenOption = SearchableSelectOption<{
  folio?: string;
  VehiculoCodigo?: string;
  prioridad?: string;
}>;

type TecnicoOption = SearchableSelectOption<{
  numeroEmpleado?: string;
}>;

export function PagosPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['Administrador']);
  const canRevert = hasRole(['Superusuario', 'Administrador']);
  const [filters, setFilters] = useState<FiltersState>({});
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenOption | null>(null);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<TecnicoOption | null>(null);
  const [detalleOrden, setDetalleOrden] = useState<OrdenTrabajo | null>(null);
  const [detalleOrdenPago, setDetalleOrdenPago] = useState<OrdenTrabajo | null>(null);
  const [reporteDetalle, setReporteDetalle] = useState<ReporteFalla | null>(null);
  const [detallePago, setDetallePago] = useState<RegistroPago | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [ordenInfoMap, setOrdenInfoMap] = useState<Record<number, { vehiculo?: string; descripcion?: string }>>({});
  const [ordenYaTienePago, setOrdenYaTienePago] = useState(false);
  const [costoCalculado, setCostoCalculado] = useState<{ checklist: number; refacciones: number; total: number }>({
    checklist: 0,
    refacciones: 0,
    total: 0
  });
  const [form, setForm] = useState<CrearPagoForm>({
    ordenTrabajoId: '',
    tecnicoId: '',
    notas: ''
  });
  const [formDetalle, setFormDetalle] = useState<EditarPagoForm>({
    notas: ''
  });
  
  // Multi-seleccion
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [resumenOpen, setResumenOpen] = useState(false);
  const [resumenData, setResumenData] = useState<any[]>([]);

  const estadoNombre = (estado: number) => {
    const match = estadoOpciones.find((o) => o.value === String(estado));
    return match ? match.label : 'Estado';
  };

    const fetchOrdenes = useCallback(async (busqueda: string): Promise<OrdenOption[]> => {
    try {
      const res = await ordenesService.getAll({
        busqueda: busqueda || undefined,
        estado: EstadoOrdenTrabajo.Validada,
        page: 1,
        pageSize: 10
      });

      if (res.success && res.data) {
        const data: unknown = res.data as unknown;
        const items =
          (data as { items?: any[]; Items?: any[] }).items ||
          (data as { items?: any[]; Items?: any[] }).Items ||
          (Array.isArray(data) ? (data as unknown[]) : []);

        return (items as any[]).map((o) => {
          const vehiculoCodigo = o.VehiculoCodigo || o.vehiculoCodigo || '';
          const vehiculoTipo = o.VehiculoTipo || o.vehiculoTipo || '';
          const descripcion = o.descripcion || o.reporteFallaDescripcion || (o as any).reporteFalla?.descripcion || '';
          const prioridad = o.prioridadNombre || '';
          const detailParts = [
            vehiculoCodigo ? `Vehiculo: ${vehiculoCodigo}${vehiculoTipo ? ` (${vehiculoTipo})` : ''}` : '',
            prioridad ? `Prioridad: ${prioridad}` : '',
            descripcion ? `Falla: ${descripcion}` : ''
          ].filter(Boolean);

          return {
            value: o.id,
            label: detailParts.join(' · '),
            description: detailParts.join(' | '),
            meta: {
              folio: o.folio,
              VehiculoCodigo: vehiculoCodigo,
              prioridad: prioridad,
              descripcion: descripcion
            }
          };
        });
      }
    } catch (err) {
      console.error('No se pudieron cargar ordenes', err);
    }
    return [];
  }, []);

  const calcularCostos = (orden?: OrdenTrabajo | null) => {
    if (!orden) return { checklist: 0, refacciones: 0, total: 0 };
    const respuestasSeleccionadas = (orden.respuestasChecklist || []).filter((r: any) => {
      const val = (r.valor ?? '').toString().trim().toLowerCase();
      return val !== '' && val !== 'no' && val !== 'false' && val !== '0';
    });
    const costoChecklist = respuestasSeleccionadas.reduce((acc, r: any) => {
      const c = Number(r.costoEstimado || r.checklistItem?.costoEstimado || 0);
      return acc + (Number.isNaN(c) ? 0 : c);
    }, 0);
    // Costo refacciones oculto en UI
    const costoRefacciones = 0;
    // Cambio: El total de la orden de pago es SOLO el checklist, sin refacciones
    const total = costoChecklist; 
    return { checklist: costoChecklist, refacciones: costoRefacciones, total };
  };

  const loadDetalleOrden = async (id: number) => {
    try {
      const res = await ordenesService.getById(id);
      if (res.success && res.data) {
        const ord = res.data as OrdenTrabajo;
        setDetalleOrden(ord);
        setTecnicoSeleccionado({
          value: ord.tecnicoAsignadoId || ord.firmadoPorId || ord.creadoPorId,
          label: ord.tecnicoNombre || ord.firmadoPorNombre || ord.creadoPorNombre || `Tecnico ${ord.tecnicoAsignadoId || ''}`
        });
        setForm((prev) => ({
          ...prev,
          tecnicoId: ord.tecnicoAsignadoId ? String(ord.tecnicoAsignadoId) : prev.tecnicoId
        }));
        const costs = calcularCostos(ord);
        setCostoCalculado(costs);
      } else {
        setDetalleOrden(null);
        setCostoCalculado({ checklist: 0, refacciones: 0, total: 0 });
      }
    } catch (err) {
      console.error('No se pudo cargar detalle de orden', err);
      setDetalleOrden(null);
      setCostoCalculado({ checklist: 0, refacciones: 0, total: 0 });
    }
  };

  const loadDetalleOrdenPago = async (id: number) => {
    try {
      const res = await ordenesService.getById(id);
      if (res.success && res.data) {
        const ord = res.data as OrdenTrabajo;
        setDetalleOrdenPago(ord);
        const costs = calcularCostos(ord);
        setCostoCalculado(costs);

        // Cargar reporte de falla (con evidencias) para el "Crear reporte"
        if (ord.reporteFallaId) {
          try {
            const rep = await reportesService.getById(ord.reporteFallaId);
            if (rep.success && rep.data) {
              let repData = rep.data as ReporteFalla;

              try {
                const evid = await reportesService.getEvidencias(repData.id);
                if (evid.success && evid.data) {
                  repData = { ...repData, evidencias: evid.data as Evidencia[] };
                }
              } catch {
                // Ignorar error de evidencias
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
        setDetalleOrdenPago(null);
        setReporteDetalle(null);
        setCostoCalculado({ checklist: 0, refacciones: 0, total: 0 });
      }
    } catch (err) {
      console.error('No se pudo cargar detalle de orden', err);
      setDetalleOrdenPago(null);
      setReporteDetalle(null);
      setCostoCalculado({ checklist: 0, refacciones: 0, total: 0 });
    }
  };

    const fetchTecnicos = useCallback(async (busqueda: string): Promise<TecnicoOption[]> => {
    const mapToOptions = (lista: any[]) => {
      const filtrados = busqueda
        ? lista.filter((t) =>
            `${t.nombreCompleto || ''} ${t.username || ''} ${t.numeroEmpleado || ''}`
              .toLowerCase()
              .includes((busqueda || '').toLowerCase())
          )
        : lista;

      return filtrados.map((u) => ({
        value: u.id,
        label: u.nombreCompleto || u.username || `Tecnico ${u.id}`,
        description: u.numeroEmpleado ? `No. Emp: ${u.numeroEmpleado}` : u.rolNombre || '',
        meta: { numeroEmpleado: u.numeroEmpleado }
      }));
    };

    try {
      // Preferimos endpoint directo de tecnicos si existe
      const res = await usuariosService.getTecnicos();
      if (res.success && res.data) {
        const data = res.data as any;
        const lista: any[] =
          (data.items as any[]) ||
          (data.Items as any[]) ||
          (data.data?.items as any[]) ||
          (data.Data?.items as any[]) ||
          (Array.isArray(data) ? data : []);
        if (lista.length) return mapToOptions(lista);
      }
      // fallback: consultar usuarios y filtrar rol tecnico
      const resAll = await usuariosService.getAll({
        busqueda: busqueda || undefined,
        rolId: 4,
        activo: true,
        page: 1,
        pageSize: 50
      });
      if (resAll.success && resAll.data) {
        const data = resAll.data as any;
        const items: any[] =
          (data.items as any[]) ||
          (data.Items as any[]) ||
          (data.data?.items as any[]) ||
          (data.Data?.items as any[]) ||
          (Array.isArray(data) ? data : []);
        return items
          .filter(
            (u) =>
              (u.rolNombre || '').toLowerCase().includes('tecnico') ||
              (u.roles || []).some((r: string) => (r || '').toLowerCase().includes('tecnico'))
          )
          .map((u) => ({
            value: u.id,
            label: u.nombreCompleto || u.username || `Tecnico ${u.id}`,
            description: u.numeroEmpleado ? `No. Emp: ${u.numeroEmpleado}` : u.rolNombre || '',
            meta: { numeroEmpleado: u.numeroEmpleado }
          }));
      }
    } catch (err) {
      console.error('No se pudieron cargar tecnicos', err);
    }
    return [];
  }, []);

  const loadPagos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await pagosService.getAll({
        estado: filters.estado ? Number(filters.estado) : undefined,
        page: 1,
        pageSize: 20
      });
      if (res.success && res.data) {
        const data: unknown = res.data as unknown;
        const items =
          (data as { items?: RegistroPago[]; Items?: RegistroPago[] }).items ||
          (data as { items?: RegistroPago[]; Items?: RegistroPago[] }).Items ||
          (Array.isArray(data) ? (data as RegistroPago[]) : []);
        setPagos(items);
      } else {
        setPagos([]);
        setError(res.message || 'No se pudieron cargar los pagos.');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de pagos.');
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Recargar pagos cuando cambia el filtro de estado
    loadPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.estado]);

  // Prefetch info de orden (vehiculo + falla) para mostrar en tarjetas
  useEffect(() => {
    const fetchMissingOrdenInfo = async () => {
      const missingIds = pagos
        .map((p) => p.ordenTrabajoId)
        .filter((id) => id && !ordenInfoMap[id]);
      if (!missingIds.length) return;
      const updates: Record<number, { vehiculo?: string; descripcion?: string }> = {};
      for (const id of missingIds.slice(0, 5)) {
        try {
          const res = await ordenesService.getById(id);
          if (res.success && res.data) {
            const ord = res.data as OrdenTrabajo;
            updates[id] = {
              vehiculo: ord.vehiculoCodigo || ord.vehiculoTipo || '',
              descripcion: ord.descripcion || ord.reporteFalla?.descripcion || ''
            };
          }
        } catch {
          // ignore individual errors
        }
      }
      if (Object.keys(updates).length) {
        setOrdenInfoMap((prev) => ({ ...prev, ...updates }));
      }
    };
    if (pagos.length) {
      fetchMissingOrdenInfo();
    }
  }, [pagos, ordenInfoMap]);

  const resetCrearForm = () => {
    setForm({ ordenTrabajoId: '', tecnicoId: '', notas: '' });
    setOrdenSeleccionada(null);
    setTecnicoSeleccionado(null);
    setDetalleOrden(null);
    setCostoCalculado({ checklist: 0, refacciones: 0, total: 0 });
    setOrdenYaTienePago(false);
  };

  const abrirDetallePago = async (pago: RegistroPago) => {
    setDetallePago(pago);
    setDetalleOpen(true);
    setFormDetalle({
      notas: pago.notas || ''
    });
    await loadDetalleOrdenPago(pago.ordenTrabajoId);
  };

  const guardarDetalle = async () => {
    if (!detallePago) return;
    setGuardandoDetalle(true);
    setError('');
    try {
      const payload = {
        montoManoObra: Number(costoCalculado.checklist || 0),
        montoRefacciones: Number(costoCalculado.refacciones || 0),
        notas: formDetalle.notas.trim() || undefined
      };
      const res = await pagosService.update(detallePago.id, payload);
      if (res.success) {
        await loadPagos();
        setDetallePago({
          ...detallePago,
          montoManoObra: payload.montoManoObra,
          montoRefacciones: payload.montoRefacciones || 0,
          notas: payload.notas
        });
      } else {
        setError(res.message || 'No se pudo actualizar el pago');
      }
    } catch (err) {
      console.error('Error al actualizar pago', err);
      setError('No se pudo actualizar el pago');
    } finally {
      setGuardandoDetalle(false);
    }
  };

  const imprimirDetalle = async () => {
    if (!detallePago) return;

    // Refrescamos la orden para asegurar firmas/evidencias actualizadas
    let ord: OrdenTrabajo | null = null;
    try {
      const res = await ordenesService.getById(detallePago.ordenTrabajoId);
      if (res.success && res.data) {
        ord = res.data as OrdenTrabajo;
        setDetalleOrdenPago(ord);
      }
    } catch {
      // fallback al estado actual
    }
    ord = ord || detalleOrdenPago;
    if (!ord) return;

    const refacciones = (ord.solicitudesRefaccion || [])
      .filter((s: any) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente')
      .map(
        (s: any) =>
          `<tr><td>${s.nombreRefaccion}</td><td class="text-center">${s.cantidad}</td><td>${s.estado}</td></tr>`
      )
      .join('');

    const checklist = (ord.respuestasChecklist || [])
      .filter((r: any) => (r.valor || '').trim() !== '')
      .map(
        (r: any) =>
          `<tr>
            <td class="uppercase">${r.pregunta || r.checklistItem?.pregunta || ''}</td>
            <td class="text-center">✓</td>
            <td class="text-center">✓</td>
            <td class="text-center">✓</td>
          </tr>`
      )
      .join('');

    const costoChecklist =
      ord.respuestasChecklist?.reduce((acc: number, r: any) => {
        const val = (r.valor ?? '').toString().trim().toLowerCase();
        if (val !== '' && val !== 'no' && val !== 'false' && val !== '0') {
          const c = Number(r.costoEstimado || r.checklistItem?.costoEstimado || 0);
          return acc + (Number.isNaN(c) ? 0 : c);
        }
        return acc;
      }, 0) || 0;

    const costoRefacciones = 0; // Oculto

    const total = costoChecklist + costoRefacciones;

    const buildUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      const apiBase =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_BASE_URL ||
        import.meta.env.BASE_URL ||
        '';
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

    const evidenciasFuente = [...(ord.evidencias || []), ...((reporteDetalle?.evidencias as any[]) || [])];

    const evidencias = evidenciasFuente
      .map((ev: any) => ({ ...ev, urlImagen: ev.urlImagen || ev.url }))
      .filter((ev: any) => ev.urlImagen)
      // No mostrar evidencias que son firmas (se guardaban como evidencia base64/imagen)
      .filter((ev: any) => {
        const desc = (ev.descripcion || '').toString().toLowerCase();
        const url = (ev.urlImagen || '').toString().toLowerCase();
        return !desc.includes('firma') && !url.includes('firma');
      })
      .slice(0, 8)
      .map(
        (ev: any) =>
          `<div class="foto">
            <img src="${buildUrl(ev.urlImagen)}" alt="${ev.descripcion || 'Evidencia'}" />
            ${ev.descripcion ? `<p>${ev.descripcion}</p>` : ''}
          </div>`
      )
      .join('');

    const resolveField = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const val = (obj || {})[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
      return '';
    };

    const firmaLider =
      resolveField(ord, ['firmaLider', 'FirmaLider', 'firma_lider', 'firmaLiderTexto']) ||
      resolveField(detallePago, ['firmaLider', 'firma_lider', 'firmaLiderTexto']);
    const firmaSup =
      resolveField(ord, ['firmaSupervisor', 'FirmaSupervisor', 'firma_supervisor', 'firmaSupervisorTexto']) ||
      resolveField(detallePago, ['firmaSupervisor', 'firma_supervisor', 'firmaSupervisorTexto']);
    const firmaLiderNombre =
      resolveField(ord, ['firmaLiderNombre', 'FirmaLiderNombre']) ||
      resolveField(detallePago, ['firmaLiderNombre']) ||
      'Lider';
    const firmaSupNombre =
      resolveField(ord, ['firmaSupervisorNombre', 'FirmaSupervisorNombre']) ||
      resolveField(detallePago, ['firmaSupervisorNombre']) ||
      'Supervisor/Admin';

    // Logo corporativo (usar URL proporcionada); fallback a texto si falla
    const logoSrc = 'https://1000marcas.net/wp-content/uploads/2022/12/Continental-Logo-768x432.png';

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>OT ${detallePago.ordenTrabajoFolio || detallePago.ordenTrabajoId}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
            .sheet { border: 1px solid #000; padding: 16px; }
            
            /* Header Style matching image */
            .header-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 10px; }
            .header-table td { border: 1px solid #000; padding: 4px; vertical-align: middle; }
            .logo-cell { text-align: center; width: 40%; }
            .logo-cell img { height: 40px; object-fit: contain; }
            .info-cell { padding: 0; }
            .info-row { display: flex; border-bottom: 1px solid #000; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; padding: 4px; border-right: 1px solid #000; width: 40%; text-align: right; background: #f9f9f9; }
            .info-value { padding: 4px; width: 60%; text-align: center; font-weight: bold; }
            .sub-header { display: flex; border: 1px solid #000; border-top: none; }
            .sub-item { flex: 1; display: flex; padding: 6px; border-right: 1px solid #000; align-items: center; justify-content: center; gap: 8px; }
            .sub-item:last-child { border-right: none; }

            .title { font-weight: 700; text-transform: uppercase; margin: 10px 0 4px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 4px; }
            th { background: #eee; font-weight: bold; text-align: center; }
            .uppercase { text-transform: uppercase; }
            
            .section { margin-top: 10px; }
            .fotos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 8px; }
            .foto { border: 1px solid #000; padding: 4px; text-align: center; height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
            .foto img { max-width: 100%; max-height: 85%; object-fit: contain; }
            .foto p { font-size: 9px; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
            
            .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .firma-box { border: 1px solid #000; height: 120px; display: flex; flex-direction: column; justify-content: flex-end; padding: 8px; }
            .firma-content { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 14px; font-style: italic; padding: 8px; }
            .firma-name { font-size: 11px; text-align: center; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; font-weight: bold; }
            .firma-empty { color: #ccc; font-style: italic; font-size: 12px; }

            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <!-- Header Structure -->
            <table class="header-table">
              <tr>
                <td class="logo-cell" rowspan="3">
                  <img src="${logoSrc}" alt="Continental" onerror="this.style.display='none'; this.parentNode.textContent='CONTINENTAL';" />
                </td>
                <td class="info-cell">
                  <div class="info-row">
                    <div class="info-label">FOLIO:</div>
                    <div class="info-value" style="color:red;">${detallePago.ordenTrabajoFolio || detallePago.ordenTrabajoId}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">FECHA DE INGRESO:</div>
                    <div class="info-value">${ord?.fechaInicio ? new Date(ord.fechaInicio).toLocaleDateString() : 'N/D'}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">FECHA DE LIBERACION:</div>
                    <div class="info-value">${ord?.fechaFinalizacion ? new Date(ord.fechaFinalizacion).toLocaleDateString() : 'N/D'}</div>
                  </div>
                </td>
              </tr>
            </table>
            <div class="sub-header">
              <div class="sub-item">
                <span class="font-bold">TIPO DE CARRO:</span>
                <span>${ord?.vehiculoTipo || ord?.vehiculoCodigo || 'N/D'}</span>
              </div>
              <div class="sub-item">
                <span class="font-bold">CODIGO DE BARRAS:</span>
                <span>${ord?.vehiculoCodigo || 'N/D'}</span>
              </div>
            </div>

            <div class="section">
              <div class="title">CHECK LIST</div>
              ${
                checklist
                  ? `<table>
                      <thead>
                        <tr>
                          <th style="width: 55%; text-align: left;">ACTIVIDAD</th>
                          <th style="width: 15%;">REPORTADO</th>
                          <th style="width: 15%;">REPARADO</th>
                          <th style="width: 15%;">VERIFICACION</th>
                        </tr>
                      </thead>
                      <tbody>${checklist}</tbody>
                    </table>`
                  : '<p style="font-size:12px;color:#666;border:1px solid #000;padding:8px;">Sin checklist.</p>'
              }
            </div>

            <div class="section">
              <div class="title">Refacciones usadas</div>
              ${
                refacciones
                  ? `<table><thead><tr><th>Refacción</th><th>Cant.</th><th>Estado</th></tr></thead><tbody>${refacciones}</tbody></table>`
                  : '<p style="font-size:12px;color:#666;">Sin refacciones registradas.</p>'
              }
            </div>

            <div class="section">
              <div class="title">Evidencias</div>
              ${
                evidencias
                  ? `<div class="fotos">${evidencias}</div>`
                  : '<p style="font-size:12px;color:#666;">Sin evidencias.</p>'
              }
            </div>

            <div class="section firmas">
              <div class="firma-box">
                <div class="firma-content">${firmaLider || '<span class="firma-empty">Sin firma</span>'}</div>
                <div class="firma-name">LIDER: ${firmaLiderNombre !== 'Lider' ? firmaLiderNombre : ''}</div>
              </div>
              <div class="firma-box">
                <div class="firma-content">${firmaSup || '<span class="firma-empty">Sin firma</span>'}</div>
                <div class="firma-name">SUPERVISOR: ${firmaSupNombre !== 'Supervisor/Admin' ? firmaSupNombre : ''}</div>
              </div>
            </div>

            <div class="section">
              <div class="title">Observaciones</div>
              <div class="box" style="margin-top:4px;">${formDetalle.notas || 'Sin notas'}</div>
            </div>

            ${isAdmin ? `
            <div class="section">
              <div class="title">Totales</div>
              <table>
                <tbody>
                  <tr><td>Checklist</td><td class="text-right">${costoChecklist.toFixed(2)}</td></tr>
                  <tr><td><strong>Total</strong></td><td class="text-right"><strong>${total.toFixed(2)}</strong></td></tr>
                </tbody>
              </table>
            </div>` : ''}
          </div>
          <script>window.print(); setTimeout(() => window.close(), 300);<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCreate = async () => {
    setCreando(true);
    setError('');
    try {
      if (!form.ordenTrabajoId || !form.tecnicoId) {
        setError('Selecciona la orden y el tecnico desde la lista');
        return;
      }
      if (ordenYaTienePago) {
        setError('Ya existe un pago para esta orden, no se puede duplicar.');
        return;
      }

      const baseManoObra = Number(costoCalculado.checklist || 0) || 0;
      // Cambio: No se incluyen costos de refacciones en la orden de pago
      const baseRef = 0; 

      const payload = {
        ordenTrabajoId: Number(form.ordenTrabajoId),
        tecnicoId: Number(form.tecnicoId),
        montoManoObra: baseManoObra,
        montoRefacciones: baseRef,
        notas: form.notas.trim() || undefined
      };
      const res = await pagosService.create(payload);
      if (res.success) {
        setCreateOpen(false);
        resetCrearForm();
        loadPagos();
      } else {
        setError(res.message || 'No se pudo crear el pago');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear el pago');
    } finally {
      setCreando(false);
    }
  };

  const doAccion = async (fn: () => Promise<unknown>) => {
    setAccionando(true);
    setError('');
    try {
      await fn();
      await loadPagos();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la accion');
    } finally {
      setAccionando(false);
    }
  };

  const handleAprobar = (id: number) => doAccion(() => pagosService.aprobar(id));
  const handleRechazar = (id: number) => {
    const motivo = window.prompt('Motivo de rechazo:');
    if (!motivo) return;
    doAccion(() => pagosService.rechazar(id, motivo));
  };
  const handlePagar = (id: number) => {
    const factura = window.prompt('Numero de factura (opcional):') || undefined;
    doAccion(() => pagosService.marcarPagado(id, factura));
  };

  const handleRevertir = (id: number) => {
    if (!window.confirm('¿Seguro que deseas revertir este pago a estado Pendiente?')) return;
    doAccion(() => pagosService.revertir(id));
  };

  const handlePagarDetalle = async () => {
    if (!detallePago) return;
    setPagando(true);
    setError('');
    try {
      const res = await pagosService.marcarPagado(detallePago.id);
      if (res.success) {
        await loadPagos();
        setDetallePago({ ...detallePago, estado: EstadoPago.Pagado, fechaPago: new Date().toISOString() });
      } else {
        setError(res.message || 'No se pudo marcar como pagado');
      }
    } catch (err) {
      console.error('Error al marcar pagado', err);
      setError('No se pudo marcar como pagado');
    } finally {
      setPagando(false);
    }
  };


  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === pagos.length && pagos.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagos.map(p => p.id)));
    }
  };

  const handleBatchPagar = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Estás seguro de generar una Orden de Compra para ${selectedIds.size} órdenes? Esto las marcará como PAGADAS.`)) return;

    setAccionando(true);
    setError('');
    try {
      // Usar servicio de Orden de Compra
      const res = await ordenesCompraService.create({ pagoIds: Array.from(selectedIds) });
      if (res.success) {
        setSelectedIds(new Set());
        await loadPagos();
        alert(`Orden de Compra generada: ${res.data?.folio}`);
      } else {
        setError(res.message || 'No se pudo generar la orden de compra');
      }
    } catch (err) {
      console.error(err);
      setError('Error al generar la orden de compra');
    } finally {
      setAccionando(false);
    }
  };

  const handleVerResumen = () => {
    const selectedPagos = pagos.filter(p => selectedIds.has(p.id));
    // Agrupar por tecnico
    const grouped = selectedPagos.reduce((acc, p) => {
      const key = p.tecnicoId;
      if (!acc[key]) {
        acc[key] = {
          tecnicoNombre: p.tecnicoNombre || `Tecnico ${p.tecnicoId}`,
          items: [],
          total: 0
        };
      }
      acc[key].items.push(p);
      acc[key].total += p.montoTotal; // Ya incluye solo checklist segun el cambio anterior (si se guardó así)
      return acc;
    }, {} as Record<number, any>);

    setResumenData(Object.values(grouped));
    setResumenOpen(true);
  };

  const badgeVariant = (estado: number) => {
    if (estado === EstadoPago.Pagado) return 'default';
    if (estado === EstadoPago.Aprobado) return 'secondary';
    if (estado === EstadoPago.Rechazado) return 'destructive';
    return 'outline';
  };

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Pagos</p>
          <h1 className="text-3xl font-semibold text-continental-black">Gestion de pagos</h1>
          <p className="text-continental-gray-1">Resumen de registros de pago y aprobaciones.</p>
        </div>
        <div className="flex gap-2">
          <Select
            options={estadoOpciones}
            value={filters.estado || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, estado: value }))}
          />
          <Button variant="outline" onClick={loadPagos} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <Link to="/ordenes-compra">
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Ver Órdenes de Compra
            </Button>
          </Link>
          <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo pago
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-10 bg-white border border-continental-gray-3 shadow-md rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-continental-black">{selectedIds.size} seleccionados</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleVerResumen}>
              Ver Resumen / Prefactura
            </Button>
            <Button className="bg-continental-gradient text-white" size="sm" onClick={handleBatchPagar} disabled={accionando}>
              {accionando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Generar Orden de Compra (Pagar)
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
      ) : pagos.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay pagos</p>
          <p className="text-continental-gray-1">Aun no se han registrado pagos.</p>
          <div className="flex justify-center gap-2">
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar pago
            </Button>
            <Button variant="outline" onClick={loadPagos}>
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1 pb-2">
            <input 
              type="checkbox" 
              checked={pagos.length > 0 && selectedIds.size === pagos.length}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 text-continental-orange focus:ring-continental-orange"
            />
            <span className="text-sm text-continental-gray-1">Seleccionar todos</span>
          </div>

          {pagos.map((pago) => (
            <Card key={pago.id} className={`px-8 py-7 border-l-4 transition-colors ${selectedIds.has(pago.id) ? 'bg-orange-50 border-continental-orange' : 'border-continental-green'}`}>
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(pago.id)}
                    onChange={() => toggleSelection(pago.id)}
                    className="h-5 w-5 rounded border-gray-300 text-continental-orange focus:ring-continental-orange cursor-pointer"
                  />
                </div>
                <div className="flex-1 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {(() => {
                    const info = ordenInfoMap[pago.ordenTrabajoId] || {};
                    const vehiculo =
                      (pago as any).vehiculoCodigo ||
                      (pago as any).vehiculo ||
                      (pago as any).vehiculoNombre ||
                      info.vehiculo ||
                      pago.vehiculoCodigo ||
                      '';
                    const falla =
                      (pago as any).descripcion ||
                      (pago as any).fallaDescripcion ||
                      (pago as any).reporteFallaDescripcion ||
                      info.descripcion ||
                      '';
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-continental-green" />
                          <p className="font-semibold text-continental-black">OT {pago.ordenTrabajoFolio || pago.ordenTrabajoId}</p>
                        </div>
                        {vehiculo && <p className="text-sm text-continental-gray-1">Vehiculo: {vehiculo}</p>}
                        {falla && <p className="text-sm text-continental-gray-1">Falla: {falla}</p>}
                      </>
                    );
                  })()}
                  {pago.ordenCompraId && pago.ordenCompraFolio && (
                    <Link to={`/ordenes-compra/${pago.ordenCompraId}`} className="text-sm text-continental-blue hover:underline">
                      Orden Compra: {pago.ordenCompraFolio}
                    </Link>
                  )}
                  <p className="text-sm text-continental-gray-1">Tecnico: {pago.tecnicoNombre || pago.tecnicoId}</p>
                  {isAdmin && (
                    <p className="text-sm text-continental-gray-1">
                      Mano de obra: ${pago.montoManoObra}
                    </p>
                  )}
                  <p className="text-xs text-continental-gray-2">Registro: {new Date(pago.fechaRegistro).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={badgeVariant(pago.estado)}>{estadoNombre(pago.estado)}</Badge>
                  <Button size="sm" variant="outline" onClick={() => abrirDetallePago(pago)} className="flex items-center gap-1">
                    <Printer className="h-4 w-4" />
                    Ver/Imprimir
                  </Button>
                  <div className="flex gap-2">
                    {pago.estado === EstadoPago.EnRevision && (
                      <>
                        <Button size="sm" onClick={() => handleAprobar(pago.id)} disabled={accionando} className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Aprobar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRechazar(pago.id)} disabled={accionando} className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Rechazar
                        </Button>
                      </>
                    )}
                    {pago.estado === EstadoPago.Aprobado && (
                      <Button size="sm" onClick={() => handlePagar(pago.id)} disabled={accionando} className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Marcar pagado
                      </Button>
                    )}
                    {canRevert && (pago.estado === EstadoPago.Pagado || pago.estado === EstadoPago.Aprobado) && (
                      <Button size="sm" variant="outline" onClick={() => handleRevertir(pago.id)} disabled={accionando} className="flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50">
                        <Undo className="h-4 w-4" />
                        Revertir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={resumenOpen}
        onClose={() => setResumenOpen(false)}
        title="Resumen por Proveedor (Prefactura)"
        description="Agrupación de órdenes seleccionadas."
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {resumenData.map((group: any, idx) => (
            <Card key={idx} className="p-4 border border-continental-gray-3">
              <div className="flex justify-between items-center mb-2 border-b pb-2">
                <h3 className="font-bold text-continental-black">{group.tecnicoNombre}</h3>
                {isAdmin && <Badge className="bg-continental-black text-white text-lg">${group.total.toFixed(2)}</Badge>}
              </div>
              <ul className="space-y-1 text-sm">
                {group.items.map((item: any) => (
                  <li key={item.id} className="flex justify-between text-continental-gray-1">
                    <span>OT {item.ordenTrabajoFolio || item.ordenTrabajoId}</span>
                    {isAdmin && <span>${item.montoTotal.toFixed(2)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {resumenData.length === 0 && <p className="text-center text-gray-500">No hay datos para mostrar.</p>}
        </div>
        <ModalFooter>
          <Button onClick={() => setResumenOpen(false)}>Cerrar</Button>
          <Button className="bg-continental-gradient text-white" onClick={() => {
            setResumenOpen(false);
            handleBatchPagar();
          }}>
            Generar Órdenes de Compra
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCrearForm();
        }}
        title="Nuevo registro de pago"
        description="Captura un pago ligado a una orden de trabajo."
      >
        <div className="space-y-3">
          <SearchableSelect
            label="Orden de trabajo"
            placeholder="Buscar por folio, Vehiculo o texto"
            selected={ordenSeleccionada}
            onSelect={(option) => {
              setOrdenSeleccionada(option);
              setForm((prev) => ({ ...prev, ordenTrabajoId: option ? String(option.value) : '' }));
              if (option?.value) {
                const yaExiste = pagos.some((p) => p.ordenTrabajoId === Number(option.value));
                setOrdenYaTienePago(yaExiste);
                loadDetalleOrden(Number(option.value));
              } else {
                setOrdenYaTienePago(false);
              }
            }}
            fetchOptions={fetchOrdenes}
            noResultsText="No se encontraron ordenes"
          />
            {ordenYaTienePago && (
              <div className="w-full rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-red-900 shadow-sm">
                <p className="m-0 font-semibold leading-tight">Pago existente</p>
                <p className="m-0 mt-1 text-sm leading-relaxed">
                  Ya existe un pago registrado para esta orden. Selecciona otra orden o revisa el pago existente.
                </p>
              </div>
            )}
          {detalleOrden && (
            <Card className="p-3 border border-continental-gray-3/60 text-sm space-y-1">
              <p className="font-semibold text-continental-black">Orden seleccionada</p>
              <p>Folio: {detalleOrden.folio || detalleOrden.id}</p>
              <p>Vehiculo: {detalleOrden.vehiculoCodigo || 'Sin dato'} {detalleOrden.vehiculoTipo ? `(${detalleOrden.vehiculoTipo})` : ''}</p>
              {detalleOrden.descripcion && <p>Descripcion: {detalleOrden.descripcion}</p>}
              {(detalleOrden as any).reporteFalla?.descripcion && <p>Falla reportada: {(detalleOrden as any).reporteFalla.descripcion}</p>}
              {(detalleOrden as any).reporteFalla?.folio && <p>Folio falla: {(detalleOrden as any).reporteFalla.folio}</p>}
              {detalleOrden.prioridadNombre && <p>Prioridad: {detalleOrden.prioridadNombre}</p>}
            </Card>
          )}
          {detalleOrden && isAdmin && (
            <Card className="p-3 bg-continental-bg border border-continental-gray-3/60 text-sm space-y-1">
              <p className="font-semibold text-continental-black">Costo estimado</p>
              <p>Checklist: ${costoCalculado.checklist.toFixed(2)}</p>
              <p className="font-semibold">Total base: ${costoCalculado.total.toFixed(2)}</p>
            </Card>
          )}
          {detalleOrden && (
            <Card className="p-3 border border-continental-gray-3/60 text-sm space-y-2">
              <p className="font-semibold text-continental-black">Refacciones usadas</p>
              {(detalleOrden.solicitudesRefaccion || []).filter((s) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente').length === 0 ? (
                <p className="text-continental-gray-1">Sin refacciones registradas</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {(detalleOrden.solicitudesRefaccion || [])
                    .filter((s) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente')
                    .map((s) => (
                      <li key={s.id}>
                        {s.nombreRefaccion} (x{s.cantidad}) [{s.estado}]
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          )}
          {detalleOrden && (
            <Card className="p-3 border border-continental-gray-3/60 text-sm space-y-2">
              <p className="font-semibold text-continental-black">Checklist aplicado</p>
              {(detalleOrden.respuestasChecklist || []).filter((r: any) => (r.valor || '').trim() !== '').length === 0 ? (
                <p className="text-continental-gray-1">Sin respuestas de checklist.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {(detalleOrden.respuestasChecklist || [])
                    .filter((r: any) => (r.valor || '').trim() !== '')
                    .map((r: any, idx: number) => (
                      <li key={`${r.id || idx}-${r.checklistItemId || idx}`}>
                        {r.pregunta || r.checklistItem?.pregunta || 'Item'}: {r.valor || 'N/D'}
                        {r.costoEstimado && isAdmin ? ` ($${Number(r.costoEstimado).toFixed(2)})` : ''}
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          )}
          <SearchableSelect
            label="Tecnico"
            placeholder="Buscar por nombre o numero de empleado"
            selected={tecnicoSeleccionado}
            onSelect={(option) => {
              setTecnicoSeleccionado(option);
              setForm((prev) => ({ ...prev, tecnicoId: option ? String(option.value) : '' }));
            }}
            fetchOptions={fetchTecnicos}
            noResultsText="No se encontraron tecnicos"
          />
      
          <Textarea
            label="Notas"
            value={form.notas}
            onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creando} className="flex items-center gap-2">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={detalleOpen}
        onClose={() => {
          setDetalleOpen(false);
          setDetallePago(null);
          setDetalleOrdenPago(null);
          setReporteDetalle(null);
        }}
        title={`Pago OT ${detallePago?.ordenTrabajoFolio || detallePago?.ordenTrabajoId || ''}`}
        description="Consulta, edita e imprime el detalle del pago."
      >
        {detallePago ? (
          <div className="space-y-3">
            {isAdmin && (
              <Card className="p-3 bg-continental-bg border border-continental-gray-3/60 text-sm space-y-1">
                <p className="font-semibold text-continental-black">Desglose calculado</p>
                <p>Checklist: ${costoCalculado.checklist.toFixed(2)}</p>
                <p className="font-semibold">Total: ${costoCalculado.total.toFixed(2)}</p>
              </Card>
            )}
            {detalleOrdenPago && (
              <Card className="p-3 border border-continental-gray-3/60 text-sm space-y-2">
                <p className="font-semibold text-continental-black">Refacciones usadas</p>
                {(detalleOrdenPago.solicitudesRefaccion || []).filter((s) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente').length === 0 ? (
                  <p className="text-continental-gray-1">Sin refacciones registradas</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {(detalleOrdenPago.solicitudesRefaccion || [])
                      .filter((s) => s.estado === 'Entregada' || s.estado === 'Aprobada' || s.estado === 'Pendiente')
                      .map((s) => (
                        <li key={s.id}>
                          {s.nombreRefaccion} (x{s.cantidad}) [{s.estado}]
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            )}
            {detalleOrdenPago && (
              <Card className="p-3 border border-continental-gray-3/60 text-sm space-y-2">
                <p className="font-semibold text-continental-black">Checklist aplicado</p>
                {(detalleOrdenPago.respuestasChecklist || []).filter((r: any) => (r.valor || '').trim() !== '').length === 0 ? (
                  <p className="text-continental-gray-1">Sin respuestas de checklist.</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {(detalleOrdenPago.respuestasChecklist || [])
                      .filter((r: any) => (r.valor || '').trim() !== '')
                      .map((r: any, idx: number) => (
                        <li key={`${r.id || idx}-${r.checklistItemId || idx}`}>
                          {r.pregunta || r.checklistItem?.pregunta || 'Item'}: {r.valor || 'N/D'}
                          {r.costoEstimado ? ` ($${Number(r.costoEstimado).toFixed(2)})` : ''}
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            )}

            <Textarea
              label="Notas"
              value={formDetalle.notas}
              onChange={(e) => setFormDetalle((prev) => ({ ...prev, notas: e.target.value }))}
            />
          </div>
        ) : (
          <Spinner />
        )}
        <ModalFooter className="flex-wrap gap-x-2 gap-y-2 justify-end sm:flex-row flex-col items-stretch sm:items-center">
          <Button variant="outline" size="sm" onClick={() => imprimirDetalle()} disabled={!detallePago} className="flex-1 sm:flex-none">
            <Printer className="h-3.5 w-3.5 mr-1" />
            Imprimir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePagarDetalle}
            disabled={pagando || !detallePago || detallePago.estado === EstadoPago.Pagado}
            className="flex items-center gap-1.5 flex-1 sm:flex-none"
          >
            {pagando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            Pagado
          </Button>
          {canRevert && detallePago && (detallePago.estado === EstadoPago.Pagado || detallePago.estado === EstadoPago.Aprobado) && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                if(detallePago) {
                  handleRevertir(detallePago.id);
                  setDetalleOpen(false);
                }
              }} 
              disabled={accionando} 
              className="flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 flex-1 sm:flex-none"
            >
              <Undo className="h-3.5 w-3.5" />
              Revertir
            </Button>
          )}
          <Button size="sm" onClick={guardarDetalle} disabled={guardandoDetalle || !detallePago} className="flex items-center gap-1.5 flex-1 sm:flex-none">
            {guardandoDetalle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
