import { useState, useEffect } from 'react';
import { tecnicoKPIsService, TecnicoKpi } from '@/services/tecnicoKPIsService';
import { Card, Button, Input, Badge, Spinner, Alert, AlertDescription, Modal } from '@/components/ui';
import { Users, Target, Clock, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export function TechniciansTab() {
  const [kpis, setKpis] = useState<TecnicoKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Para el detalle
  const [selectedTecnico, setSelectedTecnico] = useState<TecnicoKpi | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const loadKPIs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tecnicoKPIsService.getKPIs(currentMonth, currentYear);
      if (res.success && res.data) {
        setKpis(res.data);
      } else {
        setError(res.message || 'Error al cargar KPIs de técnicos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKPIs();
  }, []);

  const handleUpdateMeta = async (tecnicoId: number, meta: number) => {
    setUpdatingId(tecnicoId);
    setSuccessMsg('');
    try {
      const res = await tecnicoKPIsService.upsertMeta({
        tecnicoId,
        mes: currentMonth,
        anio: currentYear,
        metaMantenimientos: meta
      });
      if (res.success) {
        setSuccessMsg('Meta actualizada');
        setTimeout(() => setSuccessMsg(''), 3000);
        await loadKPIs();
      }
    } catch (err) {
      alert('Error al actualizar meta');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShowDetail = async (tecnico: TecnicoKpi) => {
    setLoadingDetail(true);
    setSelectedTecnico(tecnico);
    setIsDetailModalOpen(true);
    try {
      const res = await tecnicoKPIsService.getDetalleKPI(tecnico.tecnicoId, currentMonth, currentYear);
      if (res.success && res.data) {
        setSelectedTecnico(res.data);
      }
    } catch (error) {
      console.error("Error cargando detalle:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-continental-black">Evaluación de Desempeño Técnico</h3>
          <p className="text-sm text-continental-gray-1">Seguimiento de KPIs y cumplimiento de metas mensuales.</p>
        </div>
        <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-800">
            Analice el rendimiento individual de los técnicos (Proveedores), establezca metas mensuales de reparación y monitoree la eficiencia en el cumplimiento de los tiempos de entrega.
          </p>
        </Card>
      </header>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {successMsg && <Alert className="bg-green-50 border-green-200 text-green-700"><AlertDescription>{successMsg}</AlertDescription></Alert>}

      <div className="grid gap-6 md:grid-cols-4">
        <KPICardLite 
          label="Técnicos Activos" 
          value={kpis.length} 
          icon={<Users className="h-5 w-5" />} 
          color="blue" 
        />
        <KPICardLite 
          label="Cumplimiento Promedio" 
          value={`${(kpis.reduce((a, b) => a + b.porcentajeCumplimientoMeta, 0) / (kpis.length || 1)).toFixed(1)}%`} 
          icon={<Target className="h-5 w-5" />} 
          color="yellow" 
        />
        <KPICardLite 
          label="Eficiencia Temporal" 
          value={`${(kpis.reduce((a, b) => a + b.porcentajeMantenimientosATiempo, 0) / (kpis.length || 1)).toFixed(1)}%`} 
          icon={<Clock className="h-5 w-5" />} 
          color="green" 
        />
        <KPICardLite 
          label="Mantenimientos Mes" 
          value={kpis.reduce((a, b) => a + b.mantenimientosCompletados, 0)} 
          icon={<CheckCircle className="h-5 w-5" />} 
          color="red" 
        />
      </div>

      <div className="rounded-xl border border-continental-gray-3/60 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-continental-gray-4/50 text-continental-gray-1 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Técnico</th>
                <th className="px-6 py-4 text-center font-semibold">Completados</th>
                <th className="px-6 py-4 text-center font-semibold">Fijar Meta de Mantenimientos por mes</th>
                <th className="px-6 py-4 text-center font-semibold">% Meta</th>
                <th className="px-6 py-4 text-center font-semibold">A Tiempo (≤7d)</th>
                <th className="px-6 py-4 text-center font-semibold">Activas</th>
                <th className="px-6 py-4 text-center font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-continental-gray-3/60">
              {kpis.map((t) => (
                <tr key={t.tecnicoId} className="hover:bg-continental-gray-4/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-continental-black">{t.nombreCompleto}</div>
                    <div className="text-xs text-continental-gray-2">ID: {t.tecnicoId}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-lg">{t.mantenimientosCompletados}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Input 
                            type="number" 
                            defaultValue={t.metaMensual}
                            className="w-20 h-8 text-center px-1"
                            onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== t.metaMensual) {
                                    handleUpdateMeta(t.tecnicoId, val);
                                }
                            }}
                            disabled={updatingId === t.tecnicoId}
                        />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{t.porcentajeCumplimientoMeta}%</span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all ${t.porcentajeCumplimientoMeta >= 100 ? 'bg-green-500' : 'bg-continental-yellow'}`}
                                style={{ width: `${Math.min(t.porcentajeCumplimientoMeta, 100)}%` }}
                            />
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge className={t.porcentajeMantenimientosATiempo >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {t.porcentajeMantenimientosATiempo}%
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                        <span className="font-medium text-continental-black">{t.ordenesActivas}</span>
                        {t.ordenesVencidas > 0 && (
                            <span className="text-[10px] text-red-600 flex items-center gap-0.5">
                                <AlertTriangle className="h-2 w-2" /> {t.ordenesVencidas} vencidas
                            </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-continental-blue"
                        onClick={() => handleShowDetail(t)}
                    >
                        Ver Detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)}
        title={`Detalle de Meta: ${selectedTecnico?.nombreCompleto}`}
        size="lg"
      >
        {loadingDetail ? (
            <div className="flex justify-center p-8"><Spinner /></div>
        ) : (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-bold">Completados</p>
                        <p className="text-2xl font-bold">{selectedTecnico?.mantenimientosCompletados}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-bold">Meta Mensual</p>
                        <p className="text-2xl font-bold">{selectedTecnico?.metaMensual}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-bold">Cumplimiento</p>
                        <p className="text-2xl font-bold">{selectedTecnico?.porcentajeCumplimientoMeta}%</p>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Mantenimientos que cuentan para la meta
                    </h4>
                    {selectedTecnico?.mantenimientosDetalle && selectedTecnico.mantenimientosDetalle.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 text-gray-600 uppercase">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Folio</th>
                                        <th className="px-4 py-2 text-left">Vehículo</th>
                                        <th className="px-4 py-2 text-left">Tipo</th>
                                        <th className="px-4 py-2 text-center">Fecha Fin</th>
                                        <th className="px-4 py-2 text-center">Días</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedTecnico.mantenimientosDetalle.map((m: any) => (
                                        <tr key={m.id}>
                                            <td className="px-4 py-2 font-medium">{m.folio}</td>
                                            <td className="px-4 py-2">{m.vehiculoCodigo}</td>
                                            <td className="px-4 py-2">{m.tipoMantenimiento}</td>
                                            <td className="px-4 py-2 text-center">{formatDateTime(m.fechaFinalizacion)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <Badge className={m.diasTranscurridos <= 7 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                                    {m.diasTranscurridos}d
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center py-8 text-gray-500">No hay mantenimientos finalizados en este periodo.</p>
                    )}
                </div>
                
                <div className="flex justify-end">
                    <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
}

function KPICardLite({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
    const colors: any = {
        blue: 'text-blue-600 bg-blue-50',
        yellow: 'text-yellow-600 bg-yellow-50',
        green: 'text-green-600 bg-green-50',
        red: 'text-red-600 bg-red-50',
    };
    return (
        <Card className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${colors[color] || 'bg-gray-50'}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs text-continental-gray-1 uppercase font-semibold">{label}</p>
                <p className="text-xl font-bold text-continental-black">{value}</p>
            </div>
        </Card>
    );
}
