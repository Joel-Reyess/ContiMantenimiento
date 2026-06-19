import { useEffect, useState } from 'react';
import { Button, LoadingCard, Card, Modal, ModalFooter } from '@/components/ui';
import { ordenesService, entregaService } from '@/services';
import { CheckCircle, PenLine, AlertCircle, ShieldCheck, Info } from 'lucide-react';
import type { OrdenTrabajo } from '@/interfaces';
import { EstadoOrdenTrabajo } from '@/interfaces/Api.interface';
import { useAuth } from '@/contexts/AuthContext';
import { useAllowedTipoVehiculo } from '@/hooks/useAllowedTipoVehiculo';

interface OrdenItem {
  id: number;
  folio: string;
  vehiculoCodigo: string;
  vehiculoTipo?: string;
  estadoNombre?: string;
  descripcion?: string;
}

export function EntregasPage() {
  const { hasRole, user } = useAuth();
  const { allowedTipoIds } = useAllowedTipoVehiculo();
  const [items, setItems] = useState<OrdenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrdenItem | null>(null);
  const [obs, setObs] = useState("");
  const [firmaLider, setFirmaLider] = useState("");
  const [firmaSupervisor, setFirmaSupervisor] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingFirmaLider, setProcessingFirmaLider] = useState(false);
  const [processingFirmaSupervisor, setProcessingFirmaSupervisor] = useState(false);
  const [detalle, setDetalle] = useState<OrdenTrabajo | null>(null);
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);
  const [evidenciaDesc, setEvidenciaDesc] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; title?: string } | null>(null);

  const isLider = hasRole(["Lider"]);
  const isSupervisor = hasRole(["Supervisor", "Administrador", "SuperUsuario"]);

  const buildUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const apiBase = import.meta.env.VITE_API_URL || "";
    const base = apiBase && apiBase.includes("http") ? apiBase.replace("/api", "") : "";
    if (base) return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
    try {
      const current = new URL(window.location.origin);
      if (current.port === "5173") current.port = "5110";
      return `${current.origin}${url.startsWith("/") ? "" : "/"}${url}`;
    } catch {
      return url;
    }
  };

  const openImagePreview = (url?: string, title?: string) => {
    const src = buildUrl(url);
    if (!src) return;
    setImagePreview({ src, title });
    setImageOpen(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const resp = await ordenesService.getAll({ estado: EstadoOrdenTrabajo.Completada, pageSize: 50 });
      const data: any = resp.data;
      let list: any[] = (data && (data.items || data.Items)) || [];

      // Si el usuario es Lider, ocultar las que ya firmó
      if (isLider) {
        list = list.filter(o => (o as any).estadoAprobacionLider !== 1);
      }

      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetalle = async (id: number) => {
    try {
      const resp = await ordenesService.getById(id);
      if (resp.success && resp.data) setDetalle(resp.data as OrdenTrabajo);
      else setDetalle(null);
    } catch {
      setDetalle(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTipoIds]);

  const finalizarSiListo = async (ordenId: number, observaciones: string) => {
    try {
      const respDetalle = await ordenesService.getById(ordenId);
      if (!respDetalle.success || !respDetalle.data) return false;
      const det = respDetalle.data as OrdenTrabajo;
      if (!(det as any).firmaLider || !(det as any).firmaSupervisor) return false;

      if (evidenciaFile) {
        const evResp = await ordenesService.uploadEvidencia(ordenId, evidenciaFile, evidenciaDesc || "Evidencia de entrega", "entrega");
        if (!evResp.success) {
          setError(evResp.message || "No se pudo subir la evidencia de entrega");
          return false;
        }
      }

      const payload: any = {
        observaciones: observaciones,
        firmaLider: (det as any).firmaLider,
        firmaLiderNombre: (det as any).firmaLiderNombre,
        firmaSupervisor: (det as any).firmaSupervisor,
        firmaSupervisorNombre: (det as any).firmaSupervisorNombre
      };

      const resp = await entregaService.registrarEntrega(ordenId, payload);
      if (!resp.success) {
        setError(resp.message || "No se pudo registrar la entrega");
        return false;
      }

      setMessage("Entrega registrada.");
      setSelected(null);
      setObs("");
      setFirmaLider("");
      setFirmaSupervisor("");
      setEvidenciaFile(null);
      setEvidenciaDesc("");
      setDetalle(null);
      load();
      return true;
    } catch {
      setError("Error al registrar entrega");
      return false;
    }
  };

  const firmarSoloLider = async (firmaAuto?: string) => {
    if (!selected) return;
    if (!isLider) {
      setError("Solo un usuario con rol Lider puede registrar esta firma.");
      return;
    }
    setProcessingFirmaLider(true);
    setError("");
    setMessage("");
    const firmaFinal = firmaAuto || firmaLider;
    try {
      if (!firmaFinal.trim()) {
        setError("La firma del lider es requerida.");
        setProcessingFirmaLider(false);
        return;
      }

      const resp = await entregaService.registrarFirmaLider(selected.id, {
        firma: firmaFinal.trim(),
        nombre: user?.nombreCompleto || "Lider",
        observaciones: obs
      });
      if (!resp.success) {
        setError(resp.message || "No se pudo registrar la firma del lider");
        setProcessingFirmaLider(false);
        return;
      }
      setMessage("Firma del lider registrada. Falta firma de supervisor/admin.");
      await loadDetalle(selected.id);
      await finalizarSiListo(selected.id, obs);
    } catch {
      setError("Error al registrar firma del lider");
    } finally {
      setProcessingFirmaLider(false);
    }
  };

  const firmarSoloSupervisor = async (firmaAuto?: string) => {
    if (!selected) return;
    if (!isSupervisor) {
      setError("Solo un usuario con rol Supervisor/Administrador puede registrar esta firma.");
      return;
    }
    setProcessingFirmaSupervisor(true);
    setError("");
    setMessage("");
    const firmaFinal = firmaAuto || firmaSupervisor;
    try {
      if (!firmaFinal.trim()) {
        setError("La firma de supervisor/admin es requerida.");
        setProcessingFirmaSupervisor(false);
        return;
      }

      const resp = await entregaService.registrarFirmaSupervisor(selected.id, {
        firma: firmaFinal.trim(),
        nombre: user?.nombreCompleto || "Supervisor/Admin",
        observaciones: obs
      });
      if (!resp.success) {
        setError(resp.message || "No se pudo registrar la firma del supervisor/admin");
        setProcessingFirmaSupervisor(false);
        return;
      }
      await loadDetalle(selected.id);
      const finalizada = await finalizarSiListo(selected.id, obs);
      if (!finalizada) {
        setMessage("Firma de supervisor/admin registrada. Falta firma del lider.");
      }
    } catch {
      setError("Error al registrar firma del supervisor/admin");
    } finally {
      setProcessingFirmaSupervisor(false);
    }
  };

  if (loading) return <LoadingCard message="Cargando ordenes para entrega..." />;

  return (
    <div className="dashboard-wrapper space-y-5">
      <div className="dashboard-card p-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-1">Entrega y Conformidad</p>
        <h1 className="text-2xl font-bold text-continental-black">Entrega y Conformidad</h1>
        <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start mt-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-800">
            Finalice el proceso de mantenimiento. Registre la firma de conformidad del líder y asegure que el contenedor esté listo para su retorno a operación. Este paso es fundamental para el control de calidad y cierre administrativo.
          </p>
        </Card>
      </div>

      <div className="grid gap-4">
        <div className="dashboard-card space-y-5 p-6">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-lg font-semibold text-continental-black">Ordenes completadas (pendientes de entrega)</h2>
            <Button variant="outline" onClick={load}>
              Actualizar
            </Button>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-4 pl-2 pt-2 pb-2">
            {items.map((o) => (
              <div
                key={o.id}
                className={`list-tile border rounded-2xl cursor-pointer shadow-sm p-4 ${selected?.id === o.id ? "border-continental-yellow" : "border-continental-gray-3/60"}`}
                onClick={() => {
                  setSelected(o);
                  setMessage("");
                  setError("");
                  setFirmaLider("");
                  setFirmaSupervisor("");
                  loadDetalle(o.id);
                  setDetailOpen(true);
                }}
              >
                <div className="flex justify-between text-sm text-continental-gray-1 mb-2">
                  <span className="tracking-[0.04em]">{o.folio || `OT #${o.id}`}</span>
                  <span className="text-continental-gray-2">{o.estadoNombre || "En proceso"}</span>
                </div>
                <div className="font-semibold text-continental-black text-base leading-7">{o.vehiculoCodigo}</div>
                {o.descripcion && <p className="text-sm text-continental-gray-1 leading-6">{o.descripcion}</p>}
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-continental-gray-1 py-8">
                <CheckCircle className="h-8 w-8 text-continental-green mx-auto mb-2" />
                No hay ordenes en proceso.
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={detailOpen && !!selected}
        onClose={() => setDetailOpen(false)}
        title="Entrega / Firma"
        description="Firma y completa el proceso de entrega de la orden."
        size="xl"
      >
        <div className="space-y-4">
          {message && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{message}</div>}
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          
          <Card className="border border-continental-gray-3/60 px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-continental-gray-1">Orden</p>
                <h4 className="text-lg font-semibold text-continental-black">{selected?.folio || `OT #${selected?.id}`}</h4>
                {detalle?.vehiculoCodigo && <p className="text-sm text-continental-gray-1">{detalle.vehiculoCodigo}</p>}
                {detalle?.descripcion && <p className="text-sm text-continental-black mt-1 whitespace-pre-line">{detalle.descripcion}</p>}
                {detalle?.diagnostico && (
                  <p className="text-xs text-continental-gray-1 mt-1">
                    <span className="font-semibold text-continental-black">Diagnóstico: </span>
                    <span>{detalle.diagnostico}</span>
                  </p>
                )}
                {detalle?.trabajoRealizado && (
                  <p className="text-xs text-continental-gray-1 mt-1">
                    <span className="font-semibold text-continental-black">Trabajo realizado: </span>
                    <span>{detalle.trabajoRealizado}</span>
                  </p>
                )}
                {detalle?.herramientasUsadas && <p className="text-xs text-continental-gray-1 mt-1">Herramientas: {detalle.herramientasUsadas}</p>}
                <div className="text-[11px] text-continental-gray-2 mt-1 space-y-0.5">
                  {detalle?.horasTrabajadas !== undefined && <p>Horas trabajadas: {detalle.horasTrabajadas}</p>}
                  {detalle?.horasHerramienta !== undefined && <p>Horas herramienta: {detalle.horasHerramienta}</p>}
                  {detalle?.tiempoEsperaHoras !== undefined && <p>Espera (h): {detalle.tiempoEsperaHoras}</p>}
                  {detalle?.tiempoReparacionHoras !== undefined && <p>Reparación (h): {detalle.tiempoReparacionHoras}</p>}
                  {detalle?.tiempoTransicionHoras !== undefined && <p>Transición (h): {detalle.tiempoTransicionHoras}</p>}
                </div>
              </div>
              <div className="text-xs text-continental-gray-2 text-right">
                <div>{selected?.estadoNombre || "En proceso"}</div>
              </div>
            </div>
            {detalle?.evidencias?.length ? (
              <div className="mt-3 space-y-3">
                {(() => {
                  const evidencias = (detalle.evidencias || []).filter(e => e.tipoEvidencia !== "checklist");
                  const iniciales = evidencias.filter((e) => !e.tipoEvidencia || e.tipoEvidencia === "inicial" || e.tipoEvidencia === "antes");
                  const completadas = evidencias.filter((e) => e.tipoEvidencia === "completado" || e.tipoEvidencia === "despues");
                  const entrega = evidencias.filter((e) => e.tipoEvidencia === "entrega");
                  const otras = evidencias.filter(
                    (e) =>
                      e.tipoEvidencia &&
                      e.tipoEvidencia !== "inicial" &&
                      e.tipoEvidencia !== "antes" &&
                      e.tipoEvidencia !== "completado" &&
                      e.tipoEvidencia !== "entrega"
                  );

                  const renderBlock = (title: string, list: typeof evidencias) =>
                    list.length ? (
                      <div className="space-y-2" key={title}>
                        <p className="text-sm font-semibold text-continental-black">{title}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {list.map((ev) => (
                            <div key={ev.id} className="rounded-lg border border-continental-gray-3/60 bg-continental-bg p-2 space-y-1">
                              <div className="flex items-center gap-2">
                                <img
                                  src={buildUrl(ev.urlImagen)}
                                  alt={ev.descripcion || "Evidencia"}
                                  className="h-12 w-full object-cover rounded-md border border-continental-gray-300 shadow-sm cursor-zoom-in hover:brightness-75 transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImagePreview(ev.urlImagen, ev.descripcion);
                                  }}
                                />
                              </div>
                              {ev.descripcion && <div className="px-1 text-[11px] text-continental-gray-1 truncate">{ev.descripcion}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;

                  return (
                    <>
                      {renderBlock("Inicial / reporte", iniciales)}
                      {renderBlock("Completado", completadas)}
                      {renderBlock("Entrega", entrega)}
                      {renderBlock("Otras", otras)}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-2 text-xs text-continental-gray-2 inline-flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Sin evidencias cargadas.
              </div>
            )}

            {(detalle?.respuestasChecklist?.length || detalle?.itemsChecklist?.length) ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-continental-black">Checklist de reparacion</p>
                <div className="overflow-x-auto rounded-lg border border-continental-gray-3/60">
                  <table className="min-w-full text-sm">
                    <thead className="bg-continental-bg text-continental-gray-2 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 text-left text-continental-black">Actividad</th>
                        <th className="px-4 py-2 text-center text-continental-black">Estado</th>
                        <th className="px-4 py-2 text-center text-continental-black">Cantidad</th>
                        <th className="px-4 py-2 text-center text-continental-black">Evidencia</th>
                        <th className="px-4 py-2 text-left text-continental-black">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(detalle?.itemsChecklist || []), ...(detalle?.respuestasChecklist || [])]
                        .filter((item, index, self) => 
                          index === self.findIndex(i => 
                            (i as any).checklistItemId === (item as any).checklistItemId || i.id === (item as any).id
                          )
                        )
                        .map((item, index) => {
                        const pregunta = (item as any).checklistItemPregunta || (item as any).pregunta || `Item ${index + 1}`;
                        const valor = (item as any).estado || (item as any).valor || ((item as any).estado === 0 ? "OK" : "N/D");
                        const cantidad = (item as any).cantidad;
                        const fotoUrl = (item as any).fotoUrl;
                        const notas = (item as any).notas;

                        return (
                          <tr key={item.id || (item as any).checklistItemId} className="border-t border-continental-gray-3/60">
                            <td className="px-4 py-2 font-semibold text-continental-black">{pregunta}</td>
                            <td className="px-4 py-2 text-center">{valor}</td>
                            <td className="px-4 py-2 text-center">{cantidad !== undefined && cantidad !== null ? cantidad : "N/A"}</td>
                            <td className="px-4 py-2 text-center">
                              {fotoUrl ? (
                                <div className="relative w-12 h-12 inline-flex items-center justify-center">
                                  <img 
                                    src={buildUrl(fotoUrl)} 
                                    alt="Evidencia" 
                                    className="w-full h-full object-cover rounded-md border border-continental-gray-300 shadow-sm cursor-zoom-in hover:brightness-75 transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImagePreview(fotoUrl, pregunta);
                                    }}
                                  />
                                </div>
                              ) : (
                                <span className="text-continental-gray-2 text-xs">Sin foto</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-continental-gray-1 text-xs">{notas || "N/D"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {detalle?.solicitudesRefaccion?.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-continental-black">Solicitudes / danos extra</p>
                <div className="space-y-2">
                  {detalle.solicitudesRefaccion.map((s) => (
                    <div key={s.id} className="rounded-lg border border-continental-gray-3/60 p-2 bg-white">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-continental-black">{s.nombreRefaccion}</span>
                        <span className="text-continental-gray-2">{s.estado}</span>
                      </div>
                      <p className="text-xs text-continental-gray-1">
                        Cantidad: {s.cantidad} {s.numeroParte ? `| Parte: ${s.numeroParte}` : ""}
                      </p>
                      {s.justificacion && <p className="text-xs text-continental-black mt-1">{s.justificacion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <label className="block text-sm font-semibold text-continental-black mb-1">Observaciones</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="w-full h-24 rounded-lg border border-continental-gray-3 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-continental-yellow/70"
            placeholder="Notas de entrega o trabajos realizados"
          />

          <div className="grid gap-4 p-4 bg-gray-50 rounded-xl border border-continental-gray-3/60">
            {(isLider || (detalle as any)?.firmaLider) && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-continental-black">Estado de Firma Lider</p>
                {(detalle as any)?.firmaLider ? (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded-lg border border-green-200">
                    <CheckCircle className="h-5 w-5" />
                    <div className="text-xs">
                      <p className="font-bold">Firmado por: {(detalle as any).firmaLiderNombre || "Lider"}</p>
                      <p className="opacity-80">Fecha: {new Date((detalle as any).firmaLiderFecha).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-xs font-medium italic">Pendiente de firma del Lider</p>
                  </div>
                )}
              </div>
            )}

            {(isSupervisor || (detalle as any)?.firmaSupervisor) && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-continental-black">Estado de Firma Supervisor</p>
                {(detalle as any)?.firmaSupervisor ? (
                  <div className="flex items-center gap-2 text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-200">
                    <ShieldCheck className="h-5 w-5" />
                    <div className="text-xs">
                      <p className="font-bold">Firmado por: {(detalle as any).firmaSupervisorNombre || "Supervisor"}</p>
                      <p className="opacity-80">Fecha: {new Date((detalle as any).firmaSupervisorFecha).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-xs font-medium italic">Pendiente de firma del Supervisor</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDetailOpen(false)}>
            Cerrar
          </Button>
          <div className="flex gap-2">
            {isLider && (
              <>
                <Button 
                  onClick={() => firmarSoloLider(user?.nombreCompleto || "Lider")} 
                  disabled={processingFirmaLider}
                  className="flex items-center gap-2 bg-continental-yellow hover:bg-continental-yellow/90 text-continental-black"
                >
                  <PenLine className="h-4 w-4" />
                  <span className="font-bold">{processingFirmaLider ? "Guardando..." : "Aceptar y firmar como Lider"}</span>
                </Button>
              </>
            )}

            {isSupervisor && (
              <Button 
                onClick={() => firmarSoloSupervisor(user?.nombreCompleto || "Supervisor/Admin")} 
                disabled={processingFirmaSupervisor}
                className="flex items-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                {processingFirmaSupervisor ? "Registrando..." : "Confirmar y aprobar como Supervisor"}
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={imageOpen && !!imagePreview}
        onClose={() => {
          setImageOpen(false);
          setImagePreview(null);
        }}
        title="Vista de imagen"
        description={imagePreview?.title || "Evidencia"}
        size="lg"
      >
        <div className="flex justify-center">
          {imagePreview && (
            <img src={imagePreview.src} alt={imagePreview.title || "Evidencia"} className="max-h-[70vh] w-full object-contain rounded-lg border border-continental-gray-3/60" />
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setImageOpen(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

