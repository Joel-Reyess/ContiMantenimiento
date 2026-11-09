import { useEffect, useRef, useState } from 'react';
import { DollarSign, RefreshCcw, CheckCircle, XCircle, Loader2, Printer, Save, FileText, Trash2, Building2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Modal,
  ModalFooter,
  Select,
  Spinner,
  Textarea,
  useConfirm,
  useToast
} from '@/components/ui';
import { pagosService } from '@/services/pagosService';
import { ordenesService } from '@/services/ordenesService';
import { empresasService, type Empresa } from '@/services/empresasService';
import { useAuth } from '@/contexts/AuthContext';
import { BotonExportar } from '@/components/excel/BotonExportar';
import { excelService } from '@/services/excelService';
import { Undo } from 'lucide-react';
import type { DetalleOrdenPago, RegistroPago } from '@/services/pagosService';
import { EstadoPago } from '@/interfaces/Api.interface';
import { formatCurrency } from '@/lib/utils';
import type { OrdenTrabajo } from '@/interfaces';

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
  /** '' = todas, '0' = técnicos sin empresa, o el id de la empresa */
  empresa?: string;
}

/** Texto seguro para la hoja de impresión */
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/D');

const SIN_EMPRESA = 'Sin empresa (tarifa base)';

interface EditarPagoForm {
  notas: string;
}

export function PagosPage() {
  const { confirmar, pedirTexto } = useConfirm();
  const toast = useToast();
  const { hasRole } = useAuth();
  // Montos y cambio de estatus: administración y Gerente de Mantenimiento (Supervisor) (PDF 29-oct)
  const isAdmin = hasRole(['SuperUsuario', 'Administrador', 'Supervisor']);
  const canRevert = hasRole(['SuperUsuario', 'Administrador', 'Supervisor']);
  const puedeGenerarPendientes = hasRole(['SuperUsuario', 'Administrador']);
  // Órdenes validadas antes de la orden de pago automática: se generan con un botón
  const [sinGenerar, setSinGenerar] = useState(0);
  const [generando, setGenerando] = useState(false);
  // Lo que la orden de pago hereda de la orden (actividades, materiales, totales)
  const [detalleOP, setDetalleOP] = useState<DetalleOrdenPago | null>(null);
  const pagoAbierto = useRef<number | null>(null);
  // Eliminar sigue siendo solo de administración (el Gerente no elimina datos)
  const puedeEliminarPago = hasRole(['SuperUsuario', 'Administrador']);
  const [filters, setFilters] = useState<FiltersState>({});
  const [pagos, setPagos] = useState<RegistroPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Error de la ventana abierta (nuevo pago / detalle): se muestra dentro de ella, no en el banner de la página (queda detrás)
  const [errorVentana, setErrorVentana] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [detallePago, setDetallePago] = useState<RegistroPago | null>(null);
  // Empresas proveedoras para el filtro (PDF 06-nov)
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [ordenInfoMap, setOrdenInfoMap] = useState<Record<number, { vehiculo?: string; descripcion?: string }>>({});
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

  const loadPagos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await pagosService.getAll({
        estado: filters.estado ? Number(filters.estado) : undefined,
        empresaId: filters.empresa ? Number(filters.empresa) : undefined,
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

  const cargarSinGenerar = async () => {
    const res = await pagosService.sinGenerar();
    setSinGenerar(res.success && typeof res.data === 'number' ? res.data : 0);
  };

  useEffect(() => {
    loadPagos();
    void cargarSinGenerar();
    empresasService.getAll().then((r) => {
      if (r.success && r.data) setEmpresas(r.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generarPendientes = async () => {
    const ok = await confirmar({
      titulo: 'Generar órdenes de pago pendientes',
      mensaje: `Se generarán ${sinGenerar} orden(es) de pago de órdenes de trabajo que ya estaban validadas, con sus actividades y las tarifas de la empresa de cada técnico.`,
      textoConfirmar: 'Generar',
      tono: 'info'
    });
    if (!ok) return;
    setGenerando(true);
    try {
      const res = await pagosService.generarPendientes();
      if (res.success) toast.exito(res.message || 'Órdenes de pago generadas');
      else toast.error(res.message || 'No se pudieron generar las órdenes de pago');
      await Promise.all([loadPagos(), cargarSinGenerar()]);
    } finally {
      setGenerando(false);
    }
  };

  useEffect(() => {
    // Recargar pagos cuando cambia el filtro de estado o de empresa
    loadPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.estado, filters.empresa]);

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

  const abrirDetallePago = async (pago: RegistroPago) => {
    setErrorVentana('');
    setDetallePago(pago);
    setDetalleOpen(true);
    setFormDetalle({
      notas: pago.notas || ''
    });
    setDetalleOP(null);
    pagoAbierto.current = pago.id;
    const op = await pagosService.detalle(pago.id);
    // Si mientras tanto se abrió otro pago, esta respuesta ya no le corresponde (no mezclar montos)
    if (pagoAbierto.current !== pago.id) return;
    if (op.success && op.data) setDetalleOP(op.data);
    else setErrorVentana(op.message || 'No se pudo cargar el detalle de la orden de pago');
  };

  const guardarDetalle = async () => {
    if (!detallePago) return;
    setGuardandoDetalle(true);
    setErrorVentana('');
    try {
      // Los montos no cambian (tarifas de la empresa al generarse): aquí solo se guardan las notas
      const payload = {
        montoManoObra: Number(detallePago.montoManoObra ?? 0),
        notas: formDetalle.notas.trim() || undefined
      };
      const res = await pagosService.update(detallePago.id, payload);
      if (res.success) {
        await loadPagos();
        setDetallePago({ ...detallePago, notas: payload.notas });
        toast.exito('Pago actualizado');
      } else {
        setErrorVentana(res.message || 'No se pudo actualizar el pago');
      }
    } catch (err) {
      console.error('Error al actualizar pago', err);
      setErrorVentana('No se pudo actualizar el pago');
    } finally {
      setGuardandoDetalle(false);
    }
  };

  /**
   * Hoja de la ORDEN DE PAGO (PDF 06-nov, PAG-02): formato propio, distinto al de la orden de trabajo. Lleva folio,
   * OT y reporte asociados, fechas, vehículo, técnico y empresa responsables, actividades con cantidades e importes,
   * refacciones solo informativas (sin costos) y el total general.
   */
  const imprimirDetalle = async () => {
    if (!detallePago) return;
    let op = detalleOP;
    if (!op) {
      const r = await pagosService.detalle(detallePago.id);
      op = r.success && r.data ? r.data : null;
    }
    if (!op) {
      setErrorVentana('No se pudo cargar la orden de pago para imprimir');
      return;
    }

    const actividades = op.actividades
      .map(
        (a, i) =>
          `<tr><td class="text-center">${i + 1}</td><td>${esc(a.descripcion)}</td><td class="text-center">${esc(a.cantidad)}</td>` +
          `<td class="text-right">${esc(formatCurrency(a.costoUnitario))}</td><td class="text-right">${esc(formatCurrency(a.subtotal))}</td></tr>`
      )
      .join('');
    const refacciones = op.materiales
      .map(
        (m) =>
          `<tr><td>${esc(m.nombre)}</td><td>${esc(m.codigo || '—')}</td><td class="text-center">${esc(m.cantidad)} ${esc(m.unidad)}</td></tr>`
      )
      .join('');
    // Solo órdenes de pago aprobadas antes del cambio pueden traer cargo por refacciones
    const cargoAnterior =
      op.costoMateriales > 0
        ? `<tr><td colspan="4" class="text-right">Refacciones (cargo de una orden de pago anterior al cambio)</td><td class="text-right">${esc(formatCurrency(op.costoMateriales))}</td></tr>`
        : '';
    const empresa = op.empresa ? `${esc(op.empresa)}${op.empresaIdentificador ? ` · RFC/ID ${esc(op.empresaIdentificador)}` : ''}` : esc(SIN_EMPRESA);
    const dato = (etiqueta: string, valor: string) => `<div class="dato"><span>${etiqueta}</span><strong>${valor}</strong></div>`;
    const logoSrc = 'https://1000marcas.net/wp-content/uploads/2022/12/Continental-Logo-768x432.png';

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      setErrorVentana('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${esc(op.folio)} · Orden de pago</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 20px; color: #111; font-size: 12px; }
            .hoja { border: 1px solid #000; padding: 16px; }
            .encabezado { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; }
            .encabezado img { height: 40px; }
            .encabezado h1 { font-size: 20px; margin: 0; letter-spacing: 2px; }
            .folio { text-align: right; }
            .folio .num { color: #c00; font-size: 18px; font-weight: bold; }
            .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-top: 10px; border: 1px solid #000; border-bottom: none; }
            .dato { display: flex; border-bottom: 1px solid #000; }
            .dato:nth-child(odd) { border-right: 1px solid #000; }
            .dato span { width: 42%; background: #f3f3f3; padding: 4px 6px; font-weight: bold; border-right: 1px solid #000; }
            .dato strong { width: 58%; padding: 4px 6px; font-weight: normal; }
            .titulo { font-weight: 700; text-transform: uppercase; margin: 14px 0 4px 0; font-size: 12px; }
            .nota { font-size: 10px; color: #555; margin: 2px 0 0 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 4px 6px; }
            th { background: #eee; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total td { font-weight: bold; font-size: 13px; background: #f3f3f3; }
            .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
            .firma { border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="hoja">
            <div class="encabezado">
              <img src="${logoSrc}" alt="Continental" onerror="this.outerHTML='<strong>CONTINENTAL</strong>';" />
              <h1>ORDEN DE PAGO</h1>
              <div class="folio"><div class="num">${esc(op.folio)}</div><div>Estado: ${esc(estadoNombre(op.estadoId))}</div></div>
            </div>
            <div class="datos">
              ${dato('Orden de trabajo', esc(op.ordenTrabajoFolio))}
              ${dato('Reporte de falla', esc(op.reporteFolio || 'N/D'))}
              ${dato('Fecha del reporte', esc(fecha(op.fechaReporte)))}
              ${dato('Fecha de la orden de trabajo', esc(fecha(op.fechaCreacionOrden)))}
              ${dato('Fecha de conclusión', esc(fecha(op.fechaFinalizacionOrden)))}
              ${dato('Fecha de validación', esc(fecha(op.fechaValidacionOrden)))}
              ${dato('Fecha de la orden de pago', esc(fecha(op.fechaRegistro)))}
              ${dato('Fecha de pago', esc(op.fechaPago ? fecha(op.fechaPago) : 'Pendiente'))}
              ${dato('Vehículo atendido', `${esc(op.vehiculoCodigo)}${op.tipoVehiculo ? ` · ${esc(op.tipoVehiculo)}` : ''}${op.area ? ` · ${esc(op.area)}` : ''}`)}
              ${dato('Técnico responsable', esc(op.tecnico || op.tecnicoId))}
              ${dato('Empresa responsable', empresa)}
              ${dato('Factura', esc(op.numeroFactura || 'N/D'))}
            </div>

            <div class="titulo">Actividades realizadas</div>
            ${
              actividades
                ? `<table>
                    <thead><tr><th style="width:5%">#</th><th style="text-align:left">Actividad</th><th style="width:10%">Cantidad</th><th style="width:16%">Importe unitario</th><th style="width:16%">Importe</th></tr></thead>
                    <tbody>${actividades}${cargoAnterior}
                      <tr class="total"><td colspan="4" class="text-right">TOTAL GENERAL</td><td class="text-right">${esc(formatCurrency(op.total))}</td></tr>
                    </tbody>
                  </table>`
                : `<table><tbody>${cargoAnterior}<tr class="total"><td class="text-right">TOTAL GENERAL (sin actividades registradas)</td><td class="text-right">${esc(formatCurrency(op.total))}</td></tr></tbody></table>`
            }

            <div class="titulo">Refacciones utilizadas</div>
            <p class="nota">Solo informativo: el importe de cada actividad ya contempla materiales y mano de obra.</p>
            ${
              refacciones
                ? `<table><thead><tr><th style="text-align:left">Refacción / consumible</th><th style="text-align:left;width:22%">Código</th><th style="width:16%">Cantidad</th></tr></thead><tbody>${refacciones}</tbody></table>`
                : '<p>Sin refacciones registradas.</p>'
            }

            <div class="titulo">Observaciones</div>
            <p>${esc(formDetalle.notas || op.notas || 'Sin observaciones')}</p>

            <div class="firmas">
              <div class="firma">Empresa responsable<br/>${op.empresa ? esc(op.empresa) : '&nbsp;'}</div>
              <div class="firma">Autoriza<br/>Gerente de Mantenimiento</div>
            </div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 300);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /** Ejecuta la acción, avisa éxito o error (antes el error de la API se ignoraba) y recarga la lista */
  const doAccion = async (fn: () => Promise<{ success?: boolean; message?: string } | unknown>, mensajeExito: string) => {
    setAccionando(true);
    setError('');
    try {
      const res = (await fn()) as { success?: boolean; message?: string } | undefined;
      if (res && res.success === false) toast.error(res.message || 'No se pudo completar la acción');
      else toast.exito(mensajeExito);
      await loadPagos();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo completar la acción');
    } finally {
      setAccionando(false);
    }
  };

  const handleAprobar = (id: number) => doAccion(() => pagosService.aprobar(id), 'Pago aprobado');
  const handleRechazar = async (id: number) => {
    const motivo = await pedirTexto({
      titulo: 'Rechazar pago',
      etiqueta: 'Motivo de rechazo',
      requerido: true,
      textoConfirmar: 'Rechazar',
      tono: 'peligro'
    });
    if (!motivo) return;
    doAccion(() => pagosService.rechazar(id, motivo), 'Pago rechazado');
  };
  const handlePagar = async (id: number) => {
    const factura = await pedirTexto({
      titulo: 'Marcar como pagado',
      etiqueta: 'Número de factura (opcional)',
      textoConfirmar: 'Marcar pagado'
    });
    if (factura === null) return;
    doAccion(() => pagosService.marcarPagado(id, factura || undefined), 'Pago marcado como pagado');
  };

  const handleRevertir = async (id: number) => {
    const ok = await confirmar({
      titulo: 'Revertir pago',
      mensaje: '¿Regresar este pago a estado Pendiente?',
      textoConfirmar: 'Revertir',
      tono: 'advertencia'
    });
    if (!ok) return;
    doAccion(() => pagosService.revertir(id), 'Pago regresado a Pendiente');
  };

  /** Eliminar pago (solo administradores). Uno que ya está en una orden de compra se libera eliminando la OC. */
  const handleEliminar = async (pago: RegistroPago) => {
    if (pago.ordenCompraId) {
      toast.aviso(
        `Este pago está en una orden de compra${pago.ordenCompraFolio ? ` (${pago.ordenCompraFolio})` : ''}. Elimina primero esa orden de compra en "Órdenes de compra": sus pagos vuelven a quedar aprobados.`
      );
      return false;
    }
    const monto = `$${Number(pago.montoTotal || 0).toFixed(2)}`;
    const ok = await confirmar({
      titulo: 'Eliminar pago',
      mensaje: (
        <div className="flex flex-col gap-2">
          <p>
            ¿Eliminar el pago de {pago.tecnicoNombre ?? 'este técnico'} por {monto}
            {pago.ordenTrabajoFolio ? ` (orden ${pago.ordenTrabajoFolio})` : ''}?
          </p>
          {pago.estado === EstadoPago.Pagado && <p className="font-semibold text-red-700">Este pago ya está marcado como pagado.</p>}
          <p>Esta acción no se puede deshacer. Quedará registrado quién la realizó y cuándo.</p>
        </div>
      ),
      textoConfirmar: 'Eliminar',
      tono: 'peligro'
    });
    if (!ok) return false;
    setAccionando(true);
    try {
      const res = await pagosService.delete(pago.id);
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar el pago');
        return false;
      }
      toast.exito(res.message || 'Pago eliminado');
      await loadPagos();
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el pago');
      return false;
    } finally {
      setAccionando(false);
    }
  };

  const handlePagarDetalle = async () => {
    if (!detallePago) return;
    setPagando(true);
    setErrorVentana('');
    try {
      const res = await pagosService.marcarPagado(detallePago.id);
      if (res.success) {
        await loadPagos();
        setDetallePago({ ...detallePago, estado: EstadoPago.Pagado, fechaPago: new Date().toISOString() });
        toast.exito('Pago marcado como pagado');
      } else {
        setErrorVentana(res.message || 'No se pudo marcar como pagado');
      }
    } catch (err) {
      console.error('Error al marcar pagado', err);
      setErrorVentana('No se pudo marcar como pagado');
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

  const handleVerResumen = () => {
    const selectedPagos = pagos.filter(p => selectedIds.has(p.id));
    // Agrupar por empresa proveedora (PDF 06-nov, PAG-04): cada una cobra con sus tarifas
    const grouped = selectedPagos.reduce((acc, p) => {
      const key = p.empresaId ? String(p.empresaId) : 'sin-empresa';
      if (!acc[key]) {
        acc[key] = {
          tecnicoNombre: p.empresaNombre || SIN_EMPRESA,
          items: [],
          total: 0
        };
      }
      acc[key].items.push(p);
      acc[key].total += Number(p.montoTotal || 0);
      return acc;
    }, {} as Record<string, any>);

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
          <Select
            aria-label="Empresa"
            options={[
              { value: '', label: 'Todas las empresas' },
              ...empresas.map((e) => ({ value: String(e.id), label: e.nombre })),
              { value: '0', label: SIN_EMPRESA }
            ]}
            value={filters.empresa || ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, empresa: value }))}
          />
          <Button variant="outline" onClick={loadPagos} className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <BotonExportar onExportar={(formato) => excelService.exportar('pagos', formato)} />
          {puedeGenerarPendientes && sinGenerar > 0 && (
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={() => void generarPendientes()} disabled={generando}>
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generar órdenes de pago pendientes ({sinGenerar})
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-continental-gray-1" style={{ marginBottom: 0 }}>
        Las órdenes de pago se generan automáticamente cuando la orden de trabajo se valida (DISPONIBLE), con las actividades realizadas y las tarifas de la empresa del técnico. Las refacciones se listan solo como referencia.
      </p>

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
          <p className="text-lg font-semibold text-continental-black">No hay órdenes de pago</p>
          <p className="text-continental-gray-1">Se generan solas al validar la reparación de una orden de trabajo.</p>
          <div className="flex justify-center gap-2">
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
                          <p className="font-semibold text-continental-black">
                            {pago.folio ? `${pago.folio} · ` : ''}OT {pago.ordenTrabajoFolio || pago.ordenTrabajoId}
                          </p>
                        </div>
                        {vehiculo && <p className="text-sm text-continental-gray-1">Vehiculo: {vehiculo}</p>}
                        {falla && <p className="text-sm text-continental-gray-1">Falla: {falla}</p>}
                      </>
                    );
                  })()}
                  {pago.ordenCompraId && pago.ordenCompraFolio && (
                    <p className="text-sm text-continental-gray-1">Orden de compra: {pago.ordenCompraFolio}</p>
                  )}
                  <p className="text-sm text-continental-gray-1">Tecnico: {pago.tecnicoNombre || pago.tecnicoId}</p>
                  <p className="text-sm text-continental-gray-1">
                    <Building2 className="inline h-4 w-4" /> Empresa: {pago.empresaNombre || SIN_EMPRESA}
                  </p>
                  {isAdmin && (
                    <p className="text-sm text-continental-gray-1">
                      Total: {formatCurrency(Number(pago.montoTotal || 0))}
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
                    {/* Las órdenes de pago nacen Pendientes: desde ahí se aprueban o se cancelan (rechazan) */}
                    {(pago.estado === EstadoPago.Pendiente || pago.estado === EstadoPago.EnRevision) && (
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
                    {puedeEliminarPago && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleEliminar(pago)}
                        disabled={accionando}
                        aria-label={`Eliminar pago ${pago.id}`}
                        title="Eliminar pago"
                        className="text-red-700 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
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
        description="Órdenes seleccionadas agrupadas por empresa proveedora, con los importes de sus tarifas."
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
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={detalleOpen}
        onClose={() => {
          setDetalleOpen(false);
          setDetallePago(null);
          setDetalleOP(null);
        }}
        title={`Orden de pago ${detallePago?.folio || ''} · OT ${detallePago?.ordenTrabajoFolio || detallePago?.ordenTrabajoId || ''}`}
        description="Generada automáticamente al validar la orden de trabajo, con las tarifas de la empresa del técnico. Consulta, cambia el estatus e imprime."
      >
        {detallePago ? (
          <div className="space-y-3">
            {errorVentana && (
              <Alert variant="destructive">
                <AlertDescription>{errorVentana}</AlertDescription>
              </Alert>
            )}
            {!detalleOP ? (
              <Spinner />
            ) : (
              <div className="space-y-3 text-sm" data-testid="detalle-orden-pago">
                {/* Lo que hereda de la orden de trabajo (PDF 29-oct, 6.1) */}
                <div className="grid gap-x-4 gap-y-1 rounded-lg border border-continental-gray-3/60 p-3 sm:grid-cols-2">
                  <p><span className="text-continental-gray-1">Orden de pago:</span> <strong>{detalleOP.folio}</strong></p>
                  <p><span className="text-continental-gray-1">Orden de trabajo:</span> {detalleOP.ordenTrabajoFolio}</p>
                  <p><span className="text-continental-gray-1">Reporte de falla:</span> {detalleOP.reporteFolio || 'N/D'}</p>
                  <p><span className="text-continental-gray-1">Vehículo:</span> {detalleOP.vehiculoCodigo}{detalleOP.tipoVehiculo ? ` · ${detalleOP.tipoVehiculo}` : ''}</p>
                  <p><span className="text-continental-gray-1">Área:</span> {detalleOP.area || 'Sin área'}</p>
                  <p><span className="text-continental-gray-1">Técnico:</span> {detalleOP.tecnico || detalleOP.tecnicoId}</p>
                  <p data-testid="empresa-orden-pago">
                    <span className="text-continental-gray-1">Empresa:</span>{' '}
                    {detalleOP.empresa ? `${detalleOP.empresa}${detalleOP.empresaIdentificador ? ` (${detalleOP.empresaIdentificador})` : ''}` : SIN_EMPRESA}
                  </p>
                  <p><span className="text-continental-gray-1">Creación de la orden:</span> {fecha(detalleOP.fechaCreacionOrden)}</p>
                  <p><span className="text-continental-gray-1">Conclusión:</span> {fecha(detalleOP.fechaFinalizacionOrden)}</p>
                  <p><span className="text-continental-gray-1">Orden de pago:</span> {fecha(detalleOP.fechaRegistro)}</p>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-continental-black">Actividades o reparaciones realizadas</p>
                  {detalleOP.actividades.length === 0 ? (
                    <p className="text-continental-gray-1">Sin actividades registradas.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="text-left text-xs uppercase text-continental-gray-1">
                        <tr><th className="py-1">Actividad</th><th className="py-1 text-right">Cant.</th>{isAdmin && <th className="py-1 text-right">Importe unitario</th>}{isAdmin && <th className="py-1 text-right">Importe</th>}</tr>
                      </thead>
                      <tbody>
                        {detalleOP.actividades.map((a, idx) => (
                          <tr key={idx} className="border-t border-continental-gray-3/60">
                            <td className="py-1">{a.descripcion}</td>
                            <td className="py-1 text-right">{a.cantidad}</td>
                            {isAdmin && <td className="py-1 text-right">{formatCurrency(a.costoUnitario)}</td>}
                            {isAdmin && <td className="py-1 text-right">{formatCurrency(a.subtotal)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <p className="mb-1 font-semibold text-continental-black">Refacciones y consumibles utilizados</p>
                  <p className="text-xs text-continental-gray-1" style={{ marginBottom: 4 }}>
                    Solo informativo: el importe de cada actividad ya contempla materiales y mano de obra.
                  </p>
                  {detalleOP.materiales.length === 0 ? (
                    <p className="text-continental-gray-1">Sin refacciones ni consumibles.</p>
                  ) : (
                    <table className="w-full" data-testid="materiales-orden-pago">
                      <thead className="text-left text-xs uppercase text-continental-gray-1">
                        <tr><th className="py-1">Material</th><th className="py-1">Código</th><th className="py-1 text-right">Cant.</th></tr>
                      </thead>
                      <tbody>
                        {detalleOP.materiales.map((m, idx) => (
                          <tr key={idx} className="border-t border-continental-gray-3/60">
                            <td className="py-1">{m.nombre} · {m.esRefaccion ? 'Refacción' : 'Consumible'}</td>
                            <td className="py-1">{m.codigo || '—'}</td>
                            <td className="py-1 text-right">{m.cantidad} {m.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {isAdmin && (
                  <div className="rounded-lg bg-continental-bg p-3">
                    {detalleOP.costoMateriales > 0 && (
                      <>
                        <p className="flex justify-between"><span>Actividades</span><span>{formatCurrency(detalleOP.costoActividades)}</span></p>
                        <p className="flex justify-between"><span>Refacciones (cargo de una orden de pago anterior al cambio)</span><span>{formatCurrency(detalleOP.costoMateriales)}</span></p>
                      </>
                    )}
                    <p className="flex justify-between font-semibold" data-testid="total-orden-pago"><span>Total a pagar</span><span>{formatCurrency(detalleOP.total)}</span></p>
                  </div>
                )}
              </div>
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
