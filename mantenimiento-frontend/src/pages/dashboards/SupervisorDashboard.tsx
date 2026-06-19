import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, LoadingCard } from '@/components/ui';
import { dashboardService, usuariosService, refaccionesService } from '@/services';
import type { KPIs } from '@/interfaces';
import type { OrdenSinFirma, ReporteAnual } from '@/services/dashboardService';
import { getInitials, cn } from '@/lib/utils';
import {
  Truck,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Clock,
  Users,
  ArrowRight,
  Check,
  X,
  Info,
  CircleDot,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  EquipmentStatusPanel, 
  RecurrentFailuresChart, 
  LocationMatrix,
  FailuresByTypeChart
} from '@/components/dashboard';

interface TeamMember {
  id: number;
  nombre: string;
  rol: string;
  estado: 'Disponible' | 'Ocupado' | 'Fuera de Servicio';
  tareasActivas: number;
}

interface Equipment {
  id: number;
  codigo: string;
  tipo: string;
  estado: 'Operativo' | 'En Mantenimiento' | 'Fuera de Servicio';
  ubicacion: string;
  ultimoMantenimiento?: string;
  proximoMantenimiento?: string;
  tecnicoAsignado?: string;
  marca?: string;
  modelo?: string;
  capacidadCarga?: number;
  horasOperacion?: number;
  kilometraje?: number;
}

interface PendingApproval {
  id: number;
  tipo: 'refaccion' | 'reprogramacion' | 'tecnico_externo';
  titulo: string;
  tecnico: string;
  equipo: string;
  descripcion: string;
  costoEstimado?: string;
}

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accionPendienteId, setAccionPendienteId] = useState<number | null>(null);
  const [ordenesSinFirma, setOrdenesSinFirma] = useState<OrdenSinFirma[]>([]);
  const [reporteAnual, setReporteAnual] = useState<ReporteAnual[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      const res = await refaccionesService.getPendientes();
      if (res.success && res.data) {
        const mapped = res.data.map((item) => ({
          id: item.id,
          tipo: 'refaccion' as const,
          titulo: item.nombreRefaccion,
          tecnico: item.solicitadoPorNombre || 'Tecnico',
          equipo: item.ordenTrabajoFolio ? `OT ${item.ordenTrabajoFolio}` : `OT #${item.ordenTrabajoId}`,
          descripcion: item.justificacion || 'Sin descripcion',
          costoEstimado: item.costoEstimado ? `$${item.costoEstimado}` : undefined,
        }));
        setPendingApprovals(mapped);
      } else {
        setPendingApprovals([]);
      }
    } catch (error) {
      console.error('Error al cargar pendientes de aprobacion:', error);
      setPendingApprovals([]);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [kpisRes, resumenRes, usuariosRes, sinFirmaRes, anualRes] = await Promise.all([
        dashboardService.getKPIs(),
        dashboardService.getResumen(),
        usuariosService.getAll({ pageSize: 20 }),
        dashboardService.getOrdenesSinFirma(),
        dashboardService.getReporteAnual()
      ]);

      if (kpisRes.success && kpisRes.data) {
        setKpis(kpisRes.data);
      }

      if (resumenRes.success && resumenRes.data) {
        setEquipment(
          (resumenRes.data.equipos || []).map((v: any) => ({
            id: v.id,
            codigo: v.codigo,
            tipo: v.tipoNombre || 'N/D',
            estado:
              v.estadoNombre?.includes('Mantenimiento')
                ? 'En Mantenimiento'
                : v.estadoNombre?.includes('Fuera')
                ? 'Fuera de Servicio'
                : 'Operativo',
            ubicacion: v.areaNombre || 'Sin asignar',
            ultimoMantenimiento: v.ultimoMantenimiento,
            proximoMantenimiento: v.proximoMantenimiento,
            tecnicoAsignado: v.tecnicoAsignado,
            marca: v.marca,
            modelo: v.modelo,
            capacidadCarga: v.capacidadCarga,
            horasOperacion: v.horasOperacion,
            kilometraje: v.kilometraje,
          }))
        );
      } else {
        setEquipment([]);
      }

      if (usuariosRes.data?.items) {
        const tecnicos = usuariosRes.data.items.filter(
          (u: any) => u.rolNombre === 'Tecnico' || u.rolNombre === 'Técnico'
        );
        setTeam(
          tecnicos.map((u: any) => ({
            id: u.id,
            nombre: u.nombreCompleto,
            rol: u.rolNombre,
            estado: 'Disponible',
            tareasActivas: Math.floor(Math.random() * 5),
          }))
        );
      }
      if (sinFirmaRes.success && sinFirmaRes.data) {
        setOrdenesSinFirma(sinFirmaRes.data);
      }
      if (anualRes.success && anualRes.data) {
        setReporteAnual(anualRes.data);
      }
      await loadPendingApprovals();
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setAccionPendienteId(id);
    try {
      await refaccionesService.aprobar(id);
      await loadPendingApprovals();
    } catch (error) {
      console.error('No se pudo aprobar la solicitud', error);
    } finally {
      setAccionPendienteId(null);
    }
  };

  const handleReject = async (id: number) => {
    const motivo = window.prompt('Motivo de rechazo:') || '';
    if (!motivo.trim()) return;
    setAccionPendienteId(id);
    try {
      await refaccionesService.rechazar(id, motivo);
      await loadPendingApprovals();
    } catch (error) {
      console.error('No se pudo rechazar la solicitud', error);
    } finally {
      setAccionPendienteId(null);
    }
  };

  if (isLoading) {
    return <LoadingCard message="Cargando dashboard..." />;
  }

  const operativos = equipment.filter((e) => e.estado === 'Operativo').length;
  const enMantenimiento = equipment.filter((e) => e.estado === 'En Mantenimiento').length;
  const todayLabel = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());

  return (
    <div className="dashboard-wrapper mt-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Portal de Supervisor</p>
          <h1 className="text-3xl font-semibold text-continental-black">Area Produccion B</h1>
          <p className="text-continental-gray-1">
            Hola, {user?.nombreCompleto || 'Supervisor'} - monitorea tus equipos y tecnicos.
          </p>
        </div>
        <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-continental-gray-1 shadow">
          {todayLabel}
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        <OverviewCard
          icon={<Truck className="h-8 w-8" />}
          value={equipment.length}
          label="Equipos en mi Area"
          onClick={() => navigate('/vehiculos')}
        />
        <OverviewCard
          icon={<CheckCircle className="h-8 w-8 text-continental-green" />}
          value={operativos}
          label="Operativos"
          variant="green"
          onClick={() => navigate('/vehiculos')}
        />
        <OverviewCard
          icon={<Wrench className="h-8 w-8 text-continental-yellow" />}
          value={enMantenimiento}
          label="En Mantenimiento"
          variant="yellow"
          onClick={() => navigate('/ordenes')}
        />
        <OverviewCard
          icon={<Users className="h-8 w-8 text-continental-blue" />}
          value={team.length}
          label="Tecnicos Activos"
          variant="blue"
        />
        <OverviewCard
          icon={<Clock className="h-8 w-8 text-continental-yellow" />}
          value={pendingApprovals.length}
          label="Pendientes Aprobacion"
          variant="yellow"
          onClick={() => navigate('/aprobaciones')}
        />
      </div>

      <div className="space-y-6 mt-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <RecurrentFailuresChart data={kpis?.fallasRecurrentesChecklist} />
          <FailuresByTypeChart data={kpis?.fallasPorTipo?.map(f => ({ name: f.tipoNombre || '', value: f.cantidadFallas }))} />
        </div>

        <LocationMatrix data={kpis?.matrizUbicacion || []} />

        <div className="grid gap-6 lg:grid-cols-2">
          <EquipmentStatusPanel />
          
          {ordenesSinFirma.length > 0 && (
            <section className="dashboard-card p-7 space-y-4 border-l-4 border-l-continental-red h-fit">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Atención Requerida</p>
                <h3 className="text-xl font-semibold text-continental-black">Carros Terminados sin Firma</h3>
                <p className="text-sm text-continental-gray-1">Pendientes de firma del líder.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-continental-bg text-continental-gray-1">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-continental-black">Folio</th>
                      <th className="px-4 py-2 text-left font-semibold text-continental-black">Vehiculo</th>
                      <th className="px-4 py-2 text-center font-semibold text-continental-black">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesSinFirma.slice(0, 5).map((orden) => (
                      <tr key={orden.id} className="border-t border-continental-gray-3/60">
                        <td className="px-4 py-2 font-medium">
                          {orden.folio}
                          <span className="block text-[10px] text-gray-500 font-normal">
                             {orden.estado === 'Validada' ? 'Falta Firma (Líder)' : 'Falta Validación (Sup.)'}
                          </span>
                        </td>
                        <td className="px-4 py-2">{orden.vehiculoCodigo}</td>
                        <td className="px-4 py-2 text-center">
                          <Link to={`/ordenes/${orden.id}`} className="text-continental-blue hover:underline">
                            {orden.estado === 'Validada' ? 'Firmar' : 'Validar'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {reporteAnual.length > 0 && (
          <section className="dashboard-card p-7 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-continental-gray-2">Reportes</p>
              <h3 className="text-xl font-semibold text-continental-black">Mantenimientos Anuales por Tipo</h3>
            </div>
            <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60">
              <table className="min-w-full text-sm">
                <thead className="bg-continental-bg text-continental-gray-1 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Mes</th>
                    <th className="px-4 py-3 text-left font-semibold text-continental-black">Tipo de Vehículo</th>
                    <th className="px-4 py-3 text-right font-semibold text-continental-black">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {reporteAnual.map((item, idx) => (
                    <tr key={idx} className="border-t border-continental-gray-3/60 hover:bg-continental-gray-4/40">
                      <td className="px-4 py-3 font-semibold text-continental-black">{item.mesNombre}</td>
                      <td className="px-4 py-3 text-continental-gray-1">{item.tipoVehiculo}</td>
                      <td className="px-4 py-3 text-right text-continental-black font-bold">{item.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-continental-black flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Equipos en mi Area
            </h2>
            <Link
              to="/vehiculos"
              className="text-sm text-continental-yellow hover:text-continental-yellow-dark flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {equipment.map((equip) => (
              <EquipmentCard key={equip.id} equipment={equip} />
            ))}
          </div>
        </div>

        <div className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-continental-black flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mi Equipo de Tecnicos
            </h2>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {team.length === 0 ? (
              <p className="text-center text-continental-gray-1 py-8">No hay tecnicos asignados</p>
            ) : (
              team.map((member) => <TeamMemberCard key={member.id} member={member} />)
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-card px-12 py-9 dashboard-full-card">
        <h2 className="text-lg font-semibold text-continental-black flex items-center gap-4 mb-8">
          <AlertTriangle className="h-5 w-5 text-continental-yellow" />
          Solicitudes Pendientes de Aprobacion
          {pendingApprovals.length > 0 && (
            <span className="ml-5 px-5 py-2 bg-continental-yellow text-continental-black text-sm font-bold rounded-full">
              {pendingApprovals.length}
            </span>
          )}
        </h2>

        {pendingApprovals.length === 0 ? (
          <div className="text-center py-8 text-continental-gray-1">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-continental-green" />
            <p>No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={() => handleApprove(approval.id)}
                onReject={() => handleReject(approval.id)}
                isActionLoading={accionPendienteId === approval.id}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  value,
  label,
  variant: _variant = 'default',
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant?: 'default' | 'green' | 'yellow' | 'blue' | 'red';
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'dashboard-card p-6 text-center transition-all duration-300 hover:-translate-y-1',
        onClick && 'cursor-pointer hover:shadow-md active:scale-[0.98]'
      )}
    >
      <div className="flex justify-center mb-3">{icon}</div>
      <div className="text-3xl font-bold text-continental-black mb-1">{value}</div>
      <div className="text-sm text-continental-gray-1">{label}</div>
    </div>
  );
}

function EquipmentCard({ equipment }: { equipment: Equipment }) {
  const getStatusStyle = (estado: string) => {
    switch (estado) {
      case 'Operativo':
        return { border: 'border-l-continental-green', badge: 'bg-green-100 text-green-800' };
      case 'En Mantenimiento':
        return { border: 'border-l-continental-yellow', badge: 'bg-yellow-100 text-yellow-800' };
      default:
        return { border: 'border-l-continental-red', badge: 'bg-red-100 text-red-800' };
    }
  };

  const style = getStatusStyle(equipment.estado);

  return (
    <Link
      to={`/vehiculos/${equipment.id}`}
      className={cn(
        'block bg-continental-bg rounded-lg px-7 py-6 border-l-4 transition-all hover:bg-continental-gray-4 hover:translate-x-1',
        style.border
      )}
    >
      <div className="flex items-center justify-between mb-3 gap-4">
        <span className="font-semibold text-continental-black">{equipment.codigo}</span>
        <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', style.badge)}>{equipment.estado}</span>
      </div>
      <div className="text-sm text-continental-gray-1 space-y-2 leading-relaxed">
        <p>Tipo: {equipment.tipo}</p>
        <p>Ubicacion: {equipment.ubicacion}</p>
        {(equipment.marca || equipment.modelo) && <p>Equipo: {[equipment.marca, equipment.modelo].filter(Boolean).join(' ')}</p>}
        {equipment.tecnicoAsignado && <p>Tecnico: {equipment.tecnicoAsignado}</p>}
        {equipment.ultimoMantenimiento && <p>Ultimo Mtto: {equipment.ultimoMantenimiento}</p>}
        {equipment.proximoMantenimiento && <p>Proximo Mtto: {equipment.proximoMantenimiento}</p>}
        {(equipment.horasOperacion || equipment.kilometraje) && (
          <p>
            Uso: {equipment.horasOperacion ? `${equipment.horasOperacion} h` : ''}{' '}
            {equipment.kilometraje ? `${equipment.kilometraje} km` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'Disponible':
        return 'text-continental-green';
      case 'Ocupado':
        return 'text-continental-yellow';
      default:
        return 'text-continental-red';
    }
  };

  return (
    <div className="bg-continental-bg rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-continental-yellow to-continental-yellow-dark flex items-center justify-center text-white font-bold">
          {getInitials(member.nombre)}
        </div>
        <div>
          <h4 className="font-semibold text-continental-black">{member.nombre}</h4>
          <p className="text-sm text-continental-gray-1">{member.rol}</p>
          <p className={cn('text-sm font-medium flex items-center gap-1', getStatusColor(member.estado))}>
            <CircleDot className="h-3 w-3" />
            {member.estado}
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-continental-black">{member.tareasActivas}</div>
        <div className="text-xs text-continental-gray-1">Tareas Activas</div>
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
  isActionLoading,
  isAdmin,
}: {
  approval: PendingApproval;
  onApprove: () => void;
  onReject: () => void;
  isActionLoading?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <div className="bg-continental-yellow/10 rounded-xl px-16 py-9 border-l-4 border-l-continental-yellow">
      <div className="flex items-start justify-between gap-6 mb-5">
        <h3 className="font-semibold text-continental-black leading-relaxed pl-3">{approval.titulo}</h3>
      </div>
      <div className="text-sm text-continental-gray-1 space-y-3 mb-6 leading-relaxed pl-3">
        <p className="flex gap-3">
          <strong className="text-continental-black">Tecnico:</strong>
          <span>{approval.tecnico}</span>
        </p>
        <p className="flex gap-3">
          <strong className="text-continental-black">Equipo:</strong>
          <span>{approval.equipo}</span>
        </p>
        <p className="flex gap-3">
          <strong className="text-continental-black">Descripcion:</strong>
          <span>{approval.descripcion}</span>
        </p>
        {approval.costoEstimado && isAdmin && (
          <p className="flex gap-3">
            <strong className="text-continental-black">Costo estimado:</strong>
            <span>{approval.costoEstimado}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-4 pl-3 pr-2">
        <Button
          onClick={onApprove}
          size="sm"
          disabled={isActionLoading}
          className="bg-continental-green hover:bg-continental-green/90 px-6 py-2"
        >
          <Check className="h-4 w-4 mr-2" />
          {isActionLoading ? 'Procesando...' : 'Aprobar'}
        </Button>
        <Button
          onClick={onReject}
          size="sm"
          disabled={isActionLoading}
          variant="outline"
          className="border-continental-red text-continental-red hover:bg-continental-red/10 px-6 py-2"
        >
          <X className="h-4 w-4 mr-2" />
          Rechazar
        </Button>
        <Button variant="ghost" size="sm" className="px-6 py-2">
          <Info className="h-4 w-4 mr-2" />
          Mas Info
        </Button>
      </div>
    </div>
  );
}
