import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { vehiculosService } from '@/services/vehiculosService';
import { Button, Card, Badge, Spinner, Alert, AlertTitle, AlertDescription } from '@/components/ui';
import { ArrowLeft, Truck, AlertTriangle, Info, Calendar, Wrench, Clock } from 'lucide-react';
import { EstadoVehiculoNombres, TipoVehiculoNombres } from '@/interfaces/Api.interface';
import { UbicacionBadge } from '@/components/vehiculos/UbicacionLegend';
import { HistorialMantenimiento } from '@/components/vehiculos/HistorialMantenimiento';

export function VehiculoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [todosLosVehiculos, setTodosLosVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (vehiculoId: number) => {
    setLoading(true);
    setError('');
    try {
      const [vehiculoRes, allRes] = await Promise.all([
        vehiculosService.getById(vehiculoId),
        vehiculosService.getAll({ page: 1, pageSize: 1000 })
      ]);

      if (vehiculoRes.success && vehiculoRes.data) {
        setVehiculo(vehiculoRes.data);
      } else {
        setError(vehiculoRes.message || 'Error al cargar el vehículo');
      }

      if (allRes.success && allRes.data) {
        const raw = allRes.data as any;
        setTodosLosVehiculos(raw.items || raw.Items || (Array.isArray(raw) ? raw : []));
      }

    } catch (err) {
      console.error(err);
      setError('Error de conexión al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/D';
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  // Desde Flota ("Historial" o el contador de reportes) se llega directo a la sección del historial
  useEffect(() => {
    if (!loading && vehiculo && location.hash === '#historial') {
      document.getElementById('historial')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, vehiculo, location.hash]);

  const alertasMantenimiento = useMemo(() => {
    if (!vehiculo || todosLosVehiculos.length === 0) return [];
    
    // Filtrar vehículos del mismo tipo que el actual
    const delMismoTipo = todosLosVehiculos.filter(v => v.tipo === vehiculo.tipo || v.tipoNombre === vehiculo.tipoNombre);
    
    const hoy = new Date();
    return delMismoTipo.filter(v => {
      if (!v.proximoMantenimiento) return false;
      const fechaProx = new Date(v.proximoMantenimiento);
      return fechaProx <= hoy;
    });
  }, [vehiculo, todosLosVehiculos]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !vehiculo) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Vehículo no encontrado'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Regresar
        </Button>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper space-y-6 animate-in fade-in duration-500">
      {/* Alerts */}
      {alertasMantenimiento.length > 0 && (
        <Alert variant="destructive" className="border-red-600 bg-red-50 animate-pulse">
          <Clock className="h-4 w-4" />
          <AlertTitle className="font-bold">¡ALERTA DE MANTENIMIENTO PREVENTIVO!</AlertTitle>
          <AlertDescription>
            Existen {alertasMantenimiento.length} vehículos de tipo <span className="font-bold uppercase">{vehiculo.tipoNombre || 'este tipo'}</span> que ya requieren mantenimiento preventivo según su fecha programada.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-continental-black flex items-center gap-2">
              <Truck className="h-6 w-6 text-continental-red" />
              {vehiculo.codigo}
            </h1>
            <p className="text-continental-gray-1">Ficha del vehículo e historial de mantenimiento</p>
          </div>
        </div>
        <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-800">
            Consulte la ficha técnica detallada del contenedor, su ubicación actual en planta y el registro histórico de todas las intervenciones de mantenimiento realizadas.
          </p>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Información General</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Tipo:</span>
              <span className="font-medium">{vehiculo.tipoNombre || TipoVehiculoNombres[vehiculo.tipo]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Marca/Modelo:</span>
              <span className="font-medium">{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' / ') || 'N/D'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Número de Serie:</span>
              <span className="font-medium">{vehiculo.numeroSerie || 'N/D'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Año:</span>
              <span className="font-medium">{vehiculo.anio || 'N/D'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Estado Actual</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-continental-gray-1">Estado:</span>
              <Badge variant={vehiculo.estado === 1 ? 'default' : 'secondary'}>
                {vehiculo.estadoNombre || EstadoVehiculoNombres[vehiculo.estado]}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-continental-gray-1">Ubicación:</span>
              <UbicacionBadge ubicacion={vehiculo.ubicacion} />
            </div>
            <div className="flex justify-between">
              <span className="text-continental-gray-1">Área:</span>
              <span className="font-medium">{vehiculo.areaNombre || 'No asignada'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-continental-black border-b pb-2">Mantenimiento</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-continental-gray-2" />
                <span className="text-continental-gray-1">Último Mtto:</span>
              </div>
              <span className="font-medium">{formatDate(vehiculo.ultimoMantenimiento)}</span>
            </div>
            <div className="flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-continental-gray-2" />
                <span className="text-continental-gray-1">Próximo Mtto:</span>
              </div>
              <span className="font-medium text-continental-blue">{formatDate(vehiculo.proximoMantenimiento)}</span>
            </div>
            {vehiculo.notas && (
              <div className="pt-2">
                <span className="text-continental-gray-1 block mb-1">Notas:</span>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">{vehiculo.notas}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Historial de mantenimiento individual (Reporte 6, FLT-11 a FLT-16) */}
      <HistorialMantenimiento vehiculoId={vehiculo.id} />
    </div>
  );
}
