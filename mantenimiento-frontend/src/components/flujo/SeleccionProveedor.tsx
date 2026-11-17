import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, RefreshCcw } from 'lucide-react';
import { Button, Modal, ModalFooter, Textarea } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { flujoService, type EmpresaSeleccion, type SeleccionOrden } from '@/services/flujoService';
import { COLOR_SEMAFORO, colorDisponibilidad, colorFinanciero, moneda } from '@/services/presupuestoService';

interface SeleccionProveedorProps {
  ordenId: number;
  abierta: boolean;
  onClose: () => void;
  /** Se reasignó la orden: la pantalla recarga el flujo */
  onReasignada: (mensaje: string) => void;
}

const TEXTO_ESTADO: Record<SeleccionOrden['estado'], string> = {
  pendiente: 'La empresa se asigna automáticamente cuando la unidad se entrega en la Zona de Transición.',
  asignada: 'Empresa asignada automáticamente. Puede reasignarse mientras el taller no acepte la orden.',
  sinDisponibilidad: 'Sin disponibilidad: ninguna empresa cumple las condiciones (activa, con saldo y con capacidad). La asignación se reintenta sola.',
  aceptada: 'El taller ya aceptó la orden: la empresa y el técnico ya no se pueden cambiar.',
};

function Dato({ etiqueta, children, testid }: { etiqueta: string; children: React.ReactNode; testid?: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }} data-testid={testid}>
      <span className="text-xs uppercase tracking-wide text-continental-gray-1">{etiqueta}</span>
      <span className="text-sm font-semibold text-continental-black">{children}</span>
    </div>
  );
}

function Punto({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

/**
 * Vista previa de la etapa SELECCIÓN (Reporte 6, OT-32): empresa asignada, técnico responsable, saldo disponible,
 * órdenes activas, costos aplicables con el tarifario de la empresa y reasignación manual con motivo (solo antes de
 * que el taller acepte). Solo la abren el Administrador y el Gerente de Mantenimiento.
 */
export function SeleccionProveedor({ ordenId, abierta, onClose, onReasignada }: SeleccionProveedorProps) {
  const [datos, setDatos] = useState<SeleccionOrden | null>(null);
  const [error, setError] = useState('');
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [tecnicoId, setTecnicoId] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setDatos(null);
    setError('');
    setEmpresaId('');
    setTecnicoId('');
    setMotivo('');
    setErrorForm('');
    void flujoService.seleccion(ordenId).then((r) => {
      if (r.success && r.data) setDatos(r.data);
      else setError(r.message || 'No se pudo cargar la selección de proveedor');
    });
  }, [abierta, ordenId]);

  const destino: EmpresaSeleccion | undefined = datos?.empresas.find((e) => e.id === empresaId);

  const reasignar = async () => {
    if (!empresaId) return setErrorForm('Elige la empresa.');
    if (!motivo.trim()) return setErrorForm('Escribe el motivo de la reasignación.');
    setGuardando(true);
    setErrorForm('');
    try {
      const r = await flujoService.reasignar(ordenId, Number(empresaId), tecnicoId ? Number(tecnicoId) : undefined, motivo.trim());
      if (!r.success) return setErrorForm(r.message || 'No se pudo reasignar');
      onReasignada(r.data?.mensaje || r.message || 'Orden reasignada');
    } finally {
      setGuardando(false);
    }
  };

  const e = datos?.empresa;
  return (
    <Modal isOpen={abierta} onClose={onClose} title={`Selección de empresa proveedora${datos ? ` · ${datos.ordenFolio}` : ''}`}
      description="Asignación automática por turnos entre las empresas disponibles" size="lg">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!datos && !error && <p className="flex items-center text-sm text-continental-gray-1" style={{ gap: 8 }}><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</p>}
      {datos && (
        <div className="flex flex-col" style={{ gap: 16 }} data-testid="seleccion-proveedor">
          <p className="rounded-lg text-sm" data-testid="seleccion-estado"
            style={{ padding: '10px 14px', backgroundColor: datos.estado === 'sinDisponibilidad' ? '#f1ebf6' : '#f4f4f4', color: datos.estado === 'sinDisponibilidad' ? '#4b1f6f' : '#333' }}>
            {TEXTO_ESTADO[datos.estado]}
            {datos.estado === 'sinDisponibilidad' && datos.fechaSinProveedor ? ` Desde ${formatDateTime(datos.fechaSinProveedor)}.` : ''}
          </p>

          {e && (
            <div className="grid grid-cols-2 rounded-lg border border-continental-gray-3 md:grid-cols-3" style={{ padding: 14, gap: 14 }}>
              <Dato etiqueta="Empresa asignada" testid="seleccion-empresa"><span className="flex items-center" style={{ gap: 6 }}><Building2 className="h-4 w-4" />{e.nombre}</span></Dato>
              <Dato etiqueta="Técnico responsable" testid="seleccion-tecnico">{datos.tecnico || 'Sin técnico'}</Dato>
              <Dato etiqueta="Saldo disponible" testid="seleccion-saldo">
                <span style={{ color: colorFinanciero(e.estadoFinanciero) }}>{e.tienePresupuesto ? moneda(e.saldo) : 'Sin presupuesto'}</span>
              </Dato>
              <Dato etiqueta="Órdenes activas" testid="seleccion-activas">
                <span className="flex items-center" style={{ gap: 6 }}><Punto color={COLOR_SEMAFORO[e.semaforoCapacidad]} />{e.activas} de {e.capacidad}</span>
              </Dato>
              <Dato etiqueta="Estado financiero">{e.estadoFinanciero}</Dato>
              {datos.fechaSeleccion && <Dato etiqueta="Asignada">{formatDateTime(datos.fechaSeleccion)}</Dato>}
            </div>
          )}

          {e && (
            <div>
              <p className="text-sm font-semibold text-continental-black">Costos aplicables · tarifario de {e.nombre}</p>
              {datos.costosAplicables.length === 0 ? (
                <p className="text-sm text-continental-gray-1">La orden aún no tiene actividades con costo.</p>
              ) : (
                <div className="overflow-x-auto" style={{ marginTop: 6 }}>
                  <table className="w-full text-sm" data-testid="seleccion-costos">
                    <thead>
                      <tr className="text-left text-xs uppercase text-continental-gray-1">
                        <th style={{ padding: '4px 6px' }}>Actividad</th>
                        <th style={{ padding: '4px 6px' }} className="text-right">Cant.</th>
                        <th style={{ padding: '4px 6px' }} className="text-right">Tarifa</th>
                        <th style={{ padding: '4px 6px' }} className="text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.costosAplicables.map((a, i) => (
                        <tr key={i} className="border-t border-continental-gray-3/60">
                          <td style={{ padding: '4px 6px' }}>{a.descripcion}</td>
                          <td style={{ padding: '4px 6px' }} className="text-right">{a.cantidad}</td>
                          <td style={{ padding: '4px 6px' }} className="text-right">{moneda(a.costoUnitario)}</td>
                          <td style={{ padding: '4px 6px' }} className="text-right">{moneda(a.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-continental-gray-3 font-semibold">
                        <td style={{ padding: '4px 6px' }} colSpan={3}>Costo estimado</td>
                        <td style={{ padding: '4px 6px' }} className="text-right" data-testid="seleccion-costo-estimado">{moneda(datos.costoEstimado)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(datos.estado === 'sinDisponibilidad' || datos.puedeReasignar) && (
            <div>
              <p className="text-sm font-semibold text-continental-black">Empresas proveedoras</p>
              <ul className="flex flex-col text-sm" style={{ gap: 4, marginTop: 6 }} data-testid="seleccion-empresas">
                {datos.empresas.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center" style={{ gap: 8 }}>
                    <Punto color={colorDisponibilidad(x.disponibilidad)} />
                    <span className="font-medium">{x.nombre}</span>
                    <span className="text-continental-gray-1">
                      {x.elegible ? 'Disponible' : x.motivo} · saldo {x.tienePresupuesto ? moneda(x.saldo) : '—'} · {x.activas}/{x.capacidad} activas
                    </span>
                  </li>
                ))}
                {datos.empresas.length === 0 && <li className="text-continental-gray-1">No hay empresas proveedoras registradas.</li>}
              </ul>
              {datos.estado === 'sinDisponibilidad' && (
                <p className="text-xs text-continental-gray-1" style={{ marginTop: 6 }}>
                  Para continuar: asigna presupuesto en <Link className="font-medium text-continental-blue-dark underline" to="/presupuesto-empresas">Presupuesto de Empresas</Link>,
                  activa una empresa o reasigna la orden manualmente.
                </p>
              )}
            </div>
          )}

          {datos.puedeReasignar && (
            <div className="flex flex-col rounded-lg border border-continental-gray-3" style={{ padding: 14, gap: 10 }} data-testid="reasignar-proveedor">
              <p className="flex items-center text-sm font-semibold text-continental-black" style={{ gap: 6 }}><RefreshCcw className="h-4 w-4" /> Reasignar manualmente</p>
              <div className="grid md:grid-cols-2" style={{ gap: 10 }}>
                <label className="flex flex-col text-sm" style={{ gap: 4 }}>
                  Empresa
                  <select className="rounded-lg border border-continental-gray-3" style={{ padding: '8px 10px' }} value={empresaId}
                    data-testid="reasignar-empresa"
                    onChange={(ev) => { setEmpresaId(ev.target.value ? Number(ev.target.value) : ''); setTecnicoId(''); setErrorForm(''); }}>
                    <option value="">Elige la empresa</option>
                    {datos.empresas.filter((x) => x.activa).map((x) => (
                      <option key={x.id} value={x.id}>{x.nombre}{x.elegible ? '' : ` (${x.disponibilidad})`}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm" style={{ gap: 4 }}>
                  Técnico
                  <select className="rounded-lg border border-continental-gray-3" style={{ padding: '8px 10px' }} value={tecnicoId}
                    data-testid="reasignar-tecnico" disabled={!destino}
                    onChange={(ev) => setTecnicoId(ev.target.value ? Number(ev.target.value) : '')}>
                    <option value="">{destino && destino.tecnicos.length === 0 ? 'Sin técnicos activos' : 'El de menos órdenes'}</option>
                    {destino?.tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.ordenes} orden(es))</option>)}
                  </select>
                </label>
              </div>
              {destino && !destino.elegible && destino.motivo && (
                <p className="text-xs font-medium" style={{ color: '#9a6700' }}>Atención: {destino.motivo}.</p>
              )}
              <Textarea label="Motivo de la reasignación" value={motivo} onChange={(ev) => { setMotivo(ev.target.value); setErrorForm(''); }}
                placeholder="Queda registrado en el historial de la orden" />
              {errorForm && <p className="text-sm font-medium text-red-600">{errorForm}</p>}
            </div>
          )}

          {datos.historial.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-continental-black">Historial de asignación</p>
              <ol className="flex flex-col border-l-2 border-continental-gray-3 text-sm" style={{ gap: 6, marginTop: 6, paddingLeft: 12 }} data-testid="seleccion-historial">
                {[...datos.historial].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">{h.accion === 'Reasignada' ? 'Reasignación' : h.accion === 'SinDisponibilidad' ? 'Sin empresas disponibles' : 'Asignación automática'}</span>
                    <span className="text-continental-gray-1"> · {h.usuario || 'Sistema'}, {formatDateTime(h.fecha)}</span>
                    {h.detalle && <p className="text-continental-gray-1">{h.detalle}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={guardando}>Cerrar</Button>
        {datos?.puedeReasignar && (
          <Button onClick={() => void reasignar()} disabled={guardando} data-testid="confirmar-reasignar">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Reasignar
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
