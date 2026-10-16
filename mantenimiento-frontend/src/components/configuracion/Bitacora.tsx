import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, History, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Card, Input, SearchInput, Select, Spinner } from '@/components/ui';
import { adminService } from '@/services';
import type { FiltrosBitacora, RegistroBitacora } from '@/services/adminService';

const POR_PAGINA = 50;

const MODULOS: Record<string, string> = {
  ReporteFalla: 'Reporte de falla',
  OrdenTrabajo: 'Orden de trabajo',
  Vehiculo: 'Vehículo',
  Area: 'Área',
  Consumible: 'Inventario',
  ChecklistTemplate: 'Checklist',
  TipoVehiculo: 'Tipo de vehículo',
  RegistroPago: 'Pago',
  OrdenCompra: 'Orden de compra',
  SolicitudRefaccion: 'Solicitud de refacción',
  SolicitudActividadAdicional: 'Actividad adicional',
  SolicitudCambio: 'Solicitud de cambio',
  Sistema: 'Sistema'
};

const ACCIONES: Record<string, string> = {
  Eliminar: 'Eliminación',
  Reiniciar: 'Reinicio de datos'
};

// index.css anula los padding/margin de Tailwind (`* { padding: 0; margin: 0 }`): celdas con estilo en línea
const celda: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

const fechaLocal = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Inicio o fin del día local, en ISO con zona horaria, para que el servidor compare en UTC */
const limiteDia = (fecha: string, fin: boolean) => new Date(`${fecha}T${fin ? '23:59:59.999' : '00:00:00'}`).toISOString();

/**
 * Bitácora: quién eliminó o reinició qué y cuándo (requerimiento 9.3). Solo lectura.
 */
export function Bitacora() {
  const [registros, setRegistros] = useState<RegistroBitacora[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  // La búsqueda de texto se aplica con la lupa o Enter; los selectores y fechas, al cambiar
  const busquedaAplicada = useRef('');
  const peticion = useRef(0);

  const cargar = async (p = 1) => {
    const id = ++peticion.current;
    setLoading(true);
    setError('');
    const filtros: FiltrosBitacora = {
      accion: accion || undefined,
      entidad: entidad || undefined,
      busqueda: busquedaAplicada.current || undefined,
      desde: desde ? limiteDia(desde, false) : undefined,
      hasta: hasta ? limiteDia(hasta, true) : undefined,
      page: p,
      pageSize: POR_PAGINA
    };
    try {
      const res = await adminService.getBitacora(filtros);
      if (id !== peticion.current) return;
      if (!res.success || !res.data) {
        setError(res.message || 'No se pudo cargar la bitácora');
        setRegistros([]);
        return;
      }
      setRegistros(res.data.items);
      setTotal(res.data.totalItems);
      setTotalPaginas(Math.max(1, res.data.totalPages));
      setPagina(res.data.page);
    } catch (err) {
      console.error(err);
      if (id === peticion.current) setError('No se pudo conectar para cargar la bitácora');
    } finally {
      if (id === peticion.current) setLoading(false);
    }
  };

  useEffect(() => {
    void cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion, entidad, desde, hasta]);

  const buscar = () => {
    busquedaAplicada.current = busqueda.trim();
    void cargar(1);
  };

  const limpiar = () => {
    setBusqueda('');
    busquedaAplicada.current = '';
    const sinCambios = !accion && !entidad && !desde && !hasta;
    setAccion('');
    setEntidad('');
    setDesde('');
    setHasta('');
    // Si los filtros ya estaban vacíos el efecto no se dispara
    if (sinCambios) void cargar(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-continental-yellow" />
          <div>
            <h2 className="text-xl font-semibold text-continental-black">Bitácora</h2>
            <p className="text-sm text-continental-gray-1">
              Quién eliminó o reinició qué y cuándo. Las eliminaciones no se pueden deshacer; aquí queda la constancia.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void cargar(pagina)} className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 items-end">
          <div className="xl:col-span-2">
            <SearchInput
              label="Buscar"
              placeholder="Folio, vehículo, usuario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onBuscar={buscar}
            />
          </div>
          <Select
            label="Acción"
            value={accion}
            onChange={setAccion}
            options={[{ value: '', label: 'Todas' }, ...Object.entries(ACCIONES).map(([value, label]) => ({ value, label }))]}
          />
          <Select
            label="Módulo"
            value={entidad}
            onChange={setEntidad}
            options={[{ value: '', label: 'Todos' }, ...Object.entries(MODULOS).map(([value, label]) => ({ value, label }))]}
          />
          <Input label="Desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
          <Input label="Hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex justify-end" style={{ marginTop: 12 }}>
          <Button variant="ghost" size="sm" onClick={limpiar}>
            Limpiar filtros
          </Button>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Spinner />
      ) : registros.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-continental-gray-1">No hay registros con esos filtros.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-continental-gray-3/60 bg-white">
          <table className="min-w-full text-sm" data-testid="tabla-bitacora">
            <thead className="bg-continental-bg text-left text-continental-black">
              <tr>
                <th style={celda} className="font-semibold whitespace-nowrap">Fecha</th>
                <th style={celda} className="font-semibold">Usuario</th>
                <th style={celda} className="font-semibold">Acción</th>
                <th style={celda} className="font-semibold">Módulo</th>
                <th style={celda} className="font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-continental-gray-3/60">
                  <td style={celda} className="whitespace-nowrap text-continental-gray-1">{fechaLocal(r.fecha)}</td>
                  <td style={celda} className="text-continental-black">{r.usuario || 'Desconocido'}</td>
                  <td style={celda}>
                    <Badge variant={r.accion === 'Reiniciar' ? 'destructive' : 'secondary'}>{ACCIONES[r.accion] ?? r.accion}</Badge>
                  </td>
                  <td style={celda} className="whitespace-nowrap text-continental-black">{MODULOS[r.entidad] ?? r.entidad}</td>
                  <td style={celda} className="text-continental-black">{r.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-continental-gray-1">
          <span>
            {total} registro(s) · página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => void cargar(pagina - 1)} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => void cargar(pagina + 1)} className="flex items-center gap-1">
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
