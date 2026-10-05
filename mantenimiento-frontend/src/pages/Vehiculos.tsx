import { useEffect, useMemo, useState } from 'react';
import { Truck, Search, Plus, Loader2, RefreshCw, Info, Package, Trash2, CheckCircle2, Download, Upload } from 'lucide-react';
import { formatDate, getFullImageUrl } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, Input, Modal, ModalFooter, Select, Spinner, Textarea } from '@/components/ui';
import { vehiculosService } from '@/services/vehiculosService';
import { catalogosService } from '@/services/catalogosService';
import type { Area, ValidacionCodigoVehiculo, VehiculoFoto, VehiculoList } from '@/interfaces';
import { EstadoVehiculoNombres, TipoVehiculoNombres, TipoVehiculo } from '@/interfaces/Api.interface';
import { useAuth } from '@/contexts/AuthContext';
import { UbicacionLegend, UbicacionBadge } from '@/components/vehiculos/UbicacionLegend';
import { VehiculoFotosInput } from '@/components/vehiculos/VehiculoFotosInput';
import { ExcelImportModal } from '@/components/excel/ExcelImportModal';
import { excelService } from '@/services/excelService';
import { useAllowedTipoVehiculo } from '@/hooks/useAllowedTipoVehiculo';

interface FiltersState {
  busqueda: string;
  tipo?: string;
  areaId?: string;
}

interface CrearVehiculoForm {
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  notas: string;
  documentacionDibujos: string;
  documentacionEspecificaciones: string;
  listaMateriales: string;
  registroModificaciones: string;
  areaId: string;
  id?: number;
}

const FORM_VACIO: CrearVehiculoForm = {
  codigo: '',
  tipo: '',
  marca: '',
  modelo: '',
  notas: '',
  documentacionDibujos: '',
  documentacionEspecificaciones: '',
  listaMateriales: '',
  registroModificaciones: '',
  areaId: ''
};

export function VehiculosPage() {
  const { hasRole } = useAuth();
  const { allowedTipoIds } = useAllowedTipoVehiculo();
  const [activeTab, setActiveTab] = useState<'general' | 'tuggers'>('general');
  const [filters, setFilters] = useState<FiltersState>({ busqueda: '' });
  const [vehiculos, setVehiculos] = useState<VehiculoList[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<CrearVehiculoForm>(FORM_VACIO);
  const [formError, setFormError] = useState('');
  // Fotos: las nuevas se suben y las quitadas se borran al guardar
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<VehiculoFoto[]>([]);
  const [fotosQuitadas, setFotosQuitadas] = useState<number[]>([]);
  // Alta: validación del código (duplicado + tipo detectado por prefijo)
  const [validacion, setValidacion] = useState<ValidacionCodigoVehiculo | null>(null);
  const [validando, setValidando] = useState(false);

  const [tiposVehiculo, setTiposVehiculo] = useState<{ value: string; label: string }[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);

  const canDelete = hasRole(['SuperUsuario', 'Administrador']);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<VehiculoList[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [exportando, setExportando] = useState(false);

  const handleExportar = async () => {
    setExportando(true);
    setError('');
    try {
      await excelService.exportar('vehiculos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  };

  useEffect(() => {
    const fetchTiposVehiculo = async () => {
      try {
        const res = await catalogosService.getTiposVehiculo();
        if (res.success && res.data) {
          const options = res.data.map((tipo: any) => ({
            value: String(tipo.id),
            label: tipo.nombre
          }));
          setTiposVehiculo(options);
        }
        setLoadingTipos(false);
      } catch (error) {
        console.error('Error al cargar tipos de vehículo:', error);
        setLoadingTipos(false);
      }
    };

    fetchTiposVehiculo();
  }, []);

  const [areas, setAreas] = useState<Area[]>([]);

  useEffect(() => {
    catalogosService
      .getAreas()
      .then((res) => {
        if (res.success && res.data) setAreas(res.data);
      })
      .catch((err) => console.error('Error al cargar áreas:', err));
  }, []);

  // Solo áreas activas, pero conservando la que ya tenga asignada el vehículo en edición
  const areaFormOptions = useMemo(
    () => [
      { value: '', label: 'Sin área asignada' },
      ...areas
        .filter((a) => a.activa || String(a.id) === form.areaId)
        .map((a) => ({ value: String(a.id), label: a.nombre }))
    ],
    [areas, form.areaId]
  );

  const areaFilterOptions = useMemo(
    () => [{ value: '', label: 'Todas las áreas' }, ...areas.map((a) => ({ value: String(a.id), label: a.nombre }))],
    [areas]
  );

  const tipoOptions = useMemo(() => {
    if (loadingTipos) {
      return [{ value: '', label: 'Cargando...' }];
    }
    const filteredTipos =
      allowedTipoIds && allowedTipoIds.length > 0
        ? tiposVehiculo.filter((t) => allowedTipoIds.includes(Number(t.value)))
        : tiposVehiculo;
    return [{ value: '', label: 'Todos los tipos' }, ...filteredTipos];
  }, [tiposVehiculo, loadingTipos, allowedTipoIds]);

  const tipoFormOptions = useMemo(
    () => [{ value: '', label: 'Selecciona un tipo' }, ...tipoOptions.filter((t) => t.value !== '')],
    [tipoOptions]
  );

  // Al escribir el código en el alta: ¿ya existe? ¿qué tipo le corresponde por prefijo?
  useEffect(() => {
    if (!createOpen) return;
    const codigo = form.codigo.trim();
    if (!codigo) {
      setValidacion(null);
      setValidando(false);
      return;
    }
    setValidando(true);
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const res = await vehiculosService.validarCodigo(codigo);
        if (!vigente) return;
        const data = res.success ? res.data : null;
        setValidacion(data);
        setForm((prev) => ({ ...prev, tipo: data?.tipoDetectado ? String(data.tipoDetectado) : '' }));
      } finally {
        if (vigente) setValidando(false);
      }
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [form.codigo, createOpen]);

  const loadVehiculos = async (page = 1, f: FiltersState = filters) => {
    setLoading(true);
    setError('');
    setSelectedIds(new Set());
    try {
      // Determine type filter based on tab
      // If 'tuggers' tab, force type Tugger.
      // If 'general' tab, use selected filter OR undefined (which returns all).
      // Note: If 'general', we will filter OUT tuggers client-side to separate them.
      let typeFilter = f.tipo ? Number(f.tipo) : undefined;
      if (activeTab === 'tuggers') {
        typeFilter = TipoVehiculo.Tugger;
      }

      const res = await vehiculosService.getAll({
        busqueda: f.busqueda || undefined,
        tipo: typeFilter,
        areaId: f.areaId ? Number(f.areaId) : undefined,
        page: page,
        pageSize: 100 // Request more items to handle client-side filtering if needed
      });
      
      if (res.success && res.data) {
        const paginatedData = res.data; 
        let items = paginatedData.items || [];
        
        // Filter by allowed types if necessary
        if (allowedTipoIds && allowedTipoIds.length > 0) {
           items = items.filter((v) => allowedTipoIds.includes(Number(v.tipo)));
        }

        // Handle Tab Logic
        if (activeTab === 'general') {
          // Exclude Tuggers from General tab to keep them separate
          items = items.filter(v => Number(v.tipo) !== TipoVehiculo.Tugger);
        } else if (activeTab === 'tuggers') {
          // Ensure only Tuggers (already filtered by API usually, but safe double check)
          items = items.filter(v => Number(v.tipo) === TipoVehiculo.Tugger);
        }

        setVehiculos(items);
        setPagination(prev => ({
          ...prev,
          page: paginatedData.page,
          totalPages: paginatedData.totalPages, // Note: Total pages might be inaccurate due to client filtering
          totalItems: paginatedData.totalItems
        }));
      } else {
        setVehiculos([]);
        setError(res.message || 'No se pudo cargar el listado de vehiculos');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servicio de vehiculos');
      setVehiculos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehiculos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadVehiculos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTipoIds, activeTab]);

  const applyFilters = () => loadVehiculos(1);

  const resetFilters = () => {
    const vacios = { busqueda: '' };
    setFilters(vacios);
    loadVehiculos(1, vacios);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
        loadVehiculos(newPage);
    }
  };

  const resetFormState = () => {
    setForm(FORM_VACIO);
    setFormError('');
    setFotosNuevas([]);
    setFotosExistentes([]);
    setFotosQuitadas([]);
    setValidacion(null);
    setValidando(false);
  };

  const openCreate = () => {
    resetFormState();
    setSuccessMessage('');
    setCreateOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const res = await vehiculosService.getById(id);
      if (res.success && res.data) {
        const data = res.data;
        resetFormState();
        setSuccessMessage('');
        setForm({
          id: data.id,
          codigo: data.codigo,
          tipo: String(data.tipo),
          marca: data.marca || '',
          modelo: data.modelo || '',
          notas: data.notas || '',
          documentacionDibujos: data.documentacionDibujos || '',
          documentacionEspecificaciones: data.documentacionEspecificaciones || '',
          listaMateriales: data.listaMateriales || '',
          registroModificaciones: data.registroModificaciones || '',
          areaId: data.areaId ? String(data.areaId) : ''
        });
        setFotosExistentes(data.fotos || []);
        setEditOpen(true);
      } else {
        setError(res.message || 'No se pudo cargar el vehiculo');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el vehiculo');
    }
  };

  /** Sube las fotos una por una (cada petición queda bajo el límite de IIS) y regresa las que fallaron */
  const subirFotos = async (vehiculoId: number, files: File[]) => {
    const fallidas: string[] = [];
    for (const file of files) {
      const res = await vehiculosService.uploadFoto(vehiculoId, file);
      if (!res.success) fallidas.push(`${file.name}${res.message ? ` (${res.message})` : ''}`);
    }
    return fallidas;
  };

  const terminarGuardado = (mensaje: string, fallidas: string[]) => {
    resetFormState();
    if (fallidas.length > 0) {
      setError(`${mensaje}, pero no se pudieron subir estas fotos: ${fallidas.join(', ')}`);
    } else {
      setSuccessMessage(mensaje);
    }
    loadVehiculos();
  };

  const handleCreate = async () => {
    setCreando(true);
    setFormError('');
    try {
      const res = await vehiculosService.create({
        codigo: form.codigo.trim(),
        // Si no se eligió, el backend lo detecta por prefijo
        tipo: form.tipo ? (Number(form.tipo) as TipoVehiculo) : undefined,
        areaId: form.areaId ? Number(form.areaId) : undefined
      });
      if (!res.success || !res.data) {
        setFormError(res.message || 'No se pudo crear el vehiculo');
        return;
      }
      const fallidas = await subirFotos(res.data.id, fotosNuevas);
      setCreateOpen(false);
      terminarGuardado(`Vehículo ${form.codigo.trim()} registrado correctamente`, fallidas);
    } catch (err) {
      console.error(err);
      setFormError('Error al crear el vehiculo');
    } finally {
      setCreando(false);
    }
  };

  const handleEdit = async () => {
    if (!form.id) return;
    setCreando(true);
    setFormError('');
    try {
      const payload = {
        tipo: Number(form.tipo),
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        notas: form.notas.trim() || undefined,
        // 0 = quitar el área asignada
        areaId: form.areaId ? Number(form.areaId) : 0
      };
      const res = await vehiculosService.update(form.id, payload as any);
      if (!res.success) {
        setFormError(res.message || 'No se pudo actualizar el vehiculo');
        return;
      }
      const fallidas: string[] = [];
      for (const fotoId of fotosQuitadas) {
        const r = await vehiculosService.deleteFoto(form.id, fotoId);
        if (!r.success) fallidas.push(`foto #${fotoId} (no se pudo quitar)`);
      }
      fallidas.push(...(await subirFotos(form.id, fotosNuevas)));
      setEditOpen(false);
      terminarGuardado('Vehículo actualizado correctamente', fallidas);
    } catch (err) {
      console.error(err);
      setFormError('Error al actualizar el vehiculo');
    } finally {
      setCreando(false);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = vehiculos.length > 0 && vehiculos.every((v) => selectedIds.has(v.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(vehiculos.map((v) => v.id)));
  };

  const openDeleteModal = (targets: VehiculoList[]) => {
    if (targets.length === 0) return;
    setDeleteError('');
    setSuccessMessage('');
    setDeleteTargets(targets);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await vehiculosService.deleteMany(deleteTargets.map((v) => v.id));
      if (res.success) {
        setSuccessMessage(res.message || 'Vehiculos eliminados correctamente');
        setDeleteTargets(null);
        setEditOpen(false);
        loadVehiculos();
      } else {
        setDeleteError(res.message || 'No se pudieron eliminar los vehiculos');
      }
    } catch (err) {
      console.error(err);
      setDeleteError('Error al eliminar los vehiculos');
    } finally {
      setDeleting(false);
    }
  };

  const targetsConHistorial = (deleteTargets || []).filter((v) => (v.totalReportes ?? 0) > 0);

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Contenedores</p>
          <h1 className="text-3xl font-semibold text-continental-black">Gestión de Flota</h1>
          <p className="text-continental-gray-1">
            Listado en vivo de contenedores con su estado actual, ubicación y área asignada. Administre la información técnica y operativa de cada unidad.
          </p>
          <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 items-start mt-4">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              Utilice este panel para supervisar la disponibilidad de los contenedores en tiempo real. Puede filtrar por código o tipo, y gestionar los detalles técnicos de cada unidad para asegurar su correcto mantenimiento.
            </p>
          </Card>
          <UbicacionLegend className="mt-3" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExportar} disabled={exportando}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar Excel
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                setSuccessMessage('');
                setImportOpen(true);
              }}
            >
              <Upload className="h-4 w-4" />
              Importar Excel
            </Button>
          )}
          {hasRole(['SuperUsuario', 'Administrador', 'Supervisor']) && (
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo vehiculo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Custom Implementation */}
      <div className="flex border-b border-gray-200">
        <button
          className={`py-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'general'
              ? 'border-continental-blue text-continental-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => {
            setActiveTab('general');
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          Contenedores
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'tuggers'
              ? 'border-continental-blue text-continental-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => {
            setActiveTab('tuggers');
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          Tuggers
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Button variant="outline" className="flex items-center gap-2 w-full md:w-auto" onClick={applyFilters}>
            <Search className="h-4 w-4" />
            Buscar
        </Button>
        <Input
          placeholder="Buscar por codigo, modelo o marca"
          value={filters.busqueda}
          onChange={(e) => setFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
        />
        <Select
          options={tipoOptions}
          value={filters.tipo || ''}
          onChange={(value) => setFilters((prev) => ({ ...prev, tipo: value }))}
        />
        <Select
          options={areaFilterOptions}
          value={filters.areaId || ''}
          onChange={(value) => setFilters((prev) => ({ ...prev, areaId: value }))}
        />
        <div className="flex gap-2 md:col-span-2 lg:col-span-1">
          <Button variant="secondary" className="w-full" onClick={resetFilters}>
            Limpiar
          </Button>
          <Button className="w-full" onClick={applyFilters}>
            Aplicar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage('')}>
          <AlertTitle>Listo</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {canDelete && !loading && vehiculos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-continental-gray-3 bg-white px-4 py-3">
          {/* style inline: index.css define label { display: block } fuera de capa y le gana a las utilidades */}
          <label
            className="items-center gap-2 text-sm font-medium text-continental-black cursor-pointer select-none"
            style={{ display: 'flex', marginBottom: 0 }}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-orange-500 cursor-pointer"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
            Seleccionar todos ({vehiculos.length})
          </label>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-continental-gray-1">{selectedIds.size} seleccionado(s)</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Quitar seleccion
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
              disabled={selectedIds.size === 0}
              onClick={() => openDeleteModal(vehiculos.filter((v) => selectedIds.has(v.id)))}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar seleccionados
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : vehiculos.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-continental-black">No hay contenedores</p>
          <p className="text-continental-gray-1">Aún no se han registrado contenedores en el sistema.</p>
          <div className="flex justify-center gap-2">
            <Button className="bg-continental-gradient text-white flex items-center gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Crear vehiculo
            </Button>
            <Button variant="outline" onClick={() => loadVehiculos(1)}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {vehiculos.map((v) => {
            const ubicacionActual = v.ubicacion ?? v.ubicacionNombre ?? null;
            return (
            <Card
              key={v.id}
              className={`relative px-10 py-8 border-l-4 border-continental-yellow shadow-sm space-y-4 ${
                selectedIds.has(v.id) ? 'ring-2 ring-orange-400 bg-orange-50' : ''
              }`}
            >
              {canDelete && (
                <input
                  type="checkbox"
                  aria-label={`Seleccionar ${v.codigo}`}
                  className="absolute left-2 top-2 h-4 w-4 accent-orange-500 cursor-pointer"
                  checked={selectedIds.has(v.id)}
                  onChange={() => toggleSelected(v.id)}
                />
              )}
              <div className="relative flex items-start gap-6 pr-8">
                <div className="flex gap-4 min-w-0">
                  {v.fotoUrl || (v as any).tipoImagenUrl || (v as any).imagenUrl ? (
                    <div className="h-16 w-16 rounded-lg overflow-hidden border border-continental-gray-3/30 bg-white flex-shrink-0">
                      <img
                        src={getFullImageUrl(v.fotoUrl || (v as any).tipoImagenUrl || (v as any).imagenUrl)}
                        alt={v.codigo}
                        className={`h-full w-full ${v.fotoUrl ? 'object-cover' : 'object-contain'}`}
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-continental-bg flex items-center justify-center border border-dashed border-continental-gray-3 flex-shrink-0">
                       <Package className="h-8 w-8 text-continental-gray-2" />
                    </div>
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="text-lg font-semibold text-continental-black">{v.codigo}</p>
                    <p className="text-sm text-continental-gray-1 leading-relaxed">
                      {v.tipoNombre || 
                        (tiposVehiculo.length > 0 
                          ? tiposVehiculo.find(t => t.value === String(v.tipo))?.label
                          : (v.tipo && typeof v.tipo === 'number' 
                              ? TipoVehiculoNombres[v.tipo] || String(v.tipo)
                              : String(v.tipo)))}
                    </p>
                  </div>
                </div>
                <Truck className="h-5 w-5 text-continental-yellow absolute right-0 top-1" />
              </div>
              <div className="mt-4 space-y-2 text-sm text-continental-gray-1 leading-relaxed">
                <div className="flex flex-col items-start gap-1">
                  <span>Ubicacion actual:</span>
                  <UbicacionBadge ubicacion={ubicacionActual} size="sm" />
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span>Estado operativo:</span>
                  <Badge
                    variant="outline"
                    className={
                      (v.estadoNombre || '').toLowerCase().includes('aprob') ||
                      (v.estadoNombre || '').toLowerCase().includes('activo') ||
                      (v.estadoNombre || '').toLowerCase().includes('dispon')
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }
                  >
                    {v.estadoNombre || EstadoVehiculoNombres[v.estado]}
                  </Badge>
                </div>
                <p>Area: {v.areaNombre || 'No asignada'}</p>
                <p>Reportes: {v.totalReportes ?? 0}</p>
                {v.notas && typeof v.notas === 'string' && <p>Notas: {v.notas}</p>}
              </div>
              {hasRole(['SuperUsuario', 'Administrador', 'Supervisor']) && (
                <div className="pt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(v.id)}>
                    Editar
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => openDeleteModal([v])}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  )}
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {vehiculos.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 px-4">
            <div className="text-sm text-gray-500">
                Pagina {pagination.page} de {pagination.totalPages} ({pagination.totalItems} registros)
            </div>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                >
                    Anterior
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                >
                    Siguiente
                </Button>
            </div>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          if (!creando) setCreateOpen(false);
        }}
        title="Nuevo vehiculo"
        description="Captura el código y el área; el tipo se detecta por el prefijo."
      >
        <div className="space-y-3">
          <Input
            label="Codigo"
            placeholder="Ej. MTC-045"
            value={form.codigo}
            onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
            autoFocus
          />
          {form.codigo.trim() && validando && (
            <p className="flex items-center gap-2 text-xs text-continental-gray-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verificando código...
            </p>
          )}
          {!validando && validacion?.existe && (
            <Alert variant="warning">
              <AlertTitle>Este vehículo ya está dado de alta</AlertTitle>
              <AlertDescription>
                Tipo: <strong>{validacion.tipoNombre || 'N/D'}</strong> · Área: <strong>{validacion.areaNombre || 'Sin área'}</strong> ·
                Registrado: <strong>{validacion.fechaRegistro ? formatDate(validacion.fechaRegistro) : 'N/D'}</strong>
              </AlertDescription>
            </Alert>
          )}
          {!validando && validacion && !validacion.existe && validacion.tipoDetectado && (
            <div>
              <p className="mb-1 text-sm font-semibold text-continental-black">Tipo</p>
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold">{validacion.tipoDetectadoNombre}</span>
                <span className="text-xs">(detectado por el prefijo)</span>
              </div>
            </div>
          )}
          {!validando && validacion && !validacion.existe && !validacion.tipoDetectado && (
            <>
              <Alert variant="info">
                <AlertDescription>No hay un prefijo configurado para este código. Selecciona el tipo manualmente.</AlertDescription>
              </Alert>
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(value) => setForm((prev) => ({ ...prev, tipo: value }))}
                options={tipoFormOptions}
              />
            </>
          )}
          <Select
            label="Área"
            value={form.areaId}
            onChange={(value) => setForm((prev) => ({ ...prev, areaId: value }))}
            options={areaFormOptions}
          />
          <VehiculoFotosInput
            nuevas={fotosNuevas}
            onAgregar={(files) => setFotosNuevas((prev) => [...prev, ...files])}
            onQuitarNueva={(i) => setFotosNuevas((prev) => prev.filter((_, idx) => idx !== i))}
            disabled={creando}
          />
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creando}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creando || validando || !form.codigo.trim() || !form.tipo || !!validacion?.existe}
            className="flex items-center gap-2"
          >
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creando ? 'Guardando...' : 'Guardar'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => {
          if (!creando) setEditOpen(false);
        }}
        title="Editar vehiculo"
        description="Actualiza los datos del equipo."
      >
        <div className="space-y-3">
          {/* El backend no permite cambiar el código; para corregirlo se elimina y se registra de nuevo */}
          <Input label="Codigo" value={form.codigo} disabled readOnly />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(value) => setForm((prev) => ({ ...prev, tipo: value }))}
            options={tipoFormOptions}
          />
          <Select
            label="Área"
            value={form.areaId}
            onChange={(value) => setForm((prev) => ({ ...prev, areaId: value }))}
            options={areaFormOptions}
          />
          <Input
            label="Marca"
            placeholder="Marca"
            value={form.marca}
            onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))}
          />
          <Input
            label="Modelo"
            placeholder="Modelo"
            value={form.modelo}
            onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))}
          />
          <Textarea
            label="Notas"
            placeholder="Notas adicionales"
            value={form.notas}
            onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
          />
          <VehiculoFotosInput
            existentes={fotosExistentes.filter((f) => !fotosQuitadas.includes(f.id))}
            onQuitarExistente={(id) => setFotosQuitadas((prev) => [...prev, id])}
            nuevas={fotosNuevas}
            onAgregar={(files) => setFotosNuevas((prev) => [...prev, ...files])}
            onQuitarNueva={(i) => setFotosNuevas((prev) => prev.filter((_, idx) => idx !== i))}
            disabled={creando}
          />
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>
        <ModalFooter>
          {canDelete && form.id && (
            <Button
              variant="outline"
              className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => {
                const actual = vehiculos.find((v) => v.id === form.id);
                openDeleteModal([actual ?? ({ id: form.id, codigo: form.codigo } as VehiculoList)]);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(false)} disabled={creando}>
            Cancelar
          </Button>
          <Button onClick={handleEdit} disabled={creando || !form.tipo} className="flex items-center gap-2">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={deleteTargets !== null}
        onClose={() => {
          if (!deleting) setDeleteTargets(null);
        }}
        title={deleteTargets && deleteTargets.length > 1 ? `Eliminar ${deleteTargets.length} vehiculos` : 'Eliminar vehiculo'}
        description="Esta accion no se puede deshacer."
      >
        <div className="space-y-3">
          <p className="text-sm text-continental-black">Se eliminaran definitivamente:</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-continental-gray-3 bg-continental-gray-4/40 px-3 py-2">
            <ul className="space-y-1 text-sm text-continental-black">
              {(deleteTargets || []).map((v) => (
                <li key={v.id} className="flex justify-between gap-3">
                  <span className="font-medium">{v.codigo}</span>
                  {(v.totalReportes ?? 0) > 0 && (
                    <span className="text-xs text-red-700">{v.totalReportes} reporte(s)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {targetsConHistorial.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>Tiene historial</AlertTitle>
              <AlertDescription>
                {targetsConHistorial.length === 1 ? '1 vehiculo tiene' : `${targetsConHistorial.length} vehiculos tienen`} reportes registrados.
                Tambien se borraran sus reportes, ordenes de trabajo, evidencias, checklists y pagos asociados.
              </AlertDescription>
            </Alert>
          )}
          {deleteError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteTargets(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Eliminando...' : 'Si, eliminar'}
          </Button>
        </ModalFooter>
      </Modal>
      <ExcelImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        entidad="vehiculos"
        titulo="vehículos"
        onImportado={(r) => {
          setSuccessMessage(`Importación completada: ${r.nuevos} vehículo(s) nuevo(s) y ${r.actualizados} actualizado(s)`);
          loadVehiculos();
        }}
      />
    </div>
  );
}
