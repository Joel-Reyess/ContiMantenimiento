import { useEffect, useState } from 'react';
import { Card, Input, Button, Spinner, Alert, AlertTitle, AlertDescription, Modal, ModalFooter, Textarea, Select, SearchableSelect, type SearchableSelectOption, Badge } from '@/components/ui';
import { vehiculosService } from '@/services/vehiculosService';
import { vehiculoDocumentosService, type VehiculoDocumento } from '@/services/vehiculoDocumentosService';
import { solicitudCambioService, type SolicitudCambio } from '@/services/solicitudCambioService';
import type { VehiculoList } from '@/interfaces';
import { Upload, Trash2, FileImage, ExternalLink, GitPullRequest, Plus, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useAllowedTipoVehiculo } from '@/hooks/useAllowedTipoVehiculo';

export function ArchivoPage() {
  const [vehiculos, setVehiculos] = useState<VehiculoList[]>([]);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<SearchableSelectOption | null>(null);
  const [docs, setDocs] = useState<VehiculoDocumento[]>([]);
  const [cambios, setCambios] = useState<SolicitudCambio[]>([]);
  const [activeTab, setActiveTab] = useState<'docs' | 'requests'>('docs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { filterVehiculos } = useAllowedTipoVehiculo();
  
  // Upload State
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('Plano');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  // Change Request State
  const [showCambioModal, setShowCambioModal] = useState(false);
  const [cambioDesc, setCambioDesc] = useState('');
  const [sendingCambio, setSendingCambio] = useState(false);
  const [processingCambioId, setProcessingCambioId] = useState<number | null>(null);

  const vehiculoId = vehiculoSeleccionado ? Number(vehiculoSeleccionado.value) : undefined;
  const quickVehiculos = useMemo(() => vehiculos.slice(0, 6), [vehiculos]);

  const loadVehiculos = async () => {
    try {
      const res = await vehiculosService.getAll({ soloActivos: true, page: 1, pageSize: 10 });
      if (res.success && res.data) {
        const data: any = res.data as any;
        const items = (data.items as any[]) || (data.Items as any[]) || (Array.isArray(data) ? data : []);
        setVehiculos(filterVehiculos(items));
      }
    } catch (err) {
      console.error('No se pudieron cargar vehiculos', err);
    }
  };

  const loadDocs = async (id?: number) => {
    if (!id) {
      setDocs([]);
      setCambios([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [docsRes, cambiosRes] = await Promise.all([
        vehiculoDocumentosService.getByVehiculo(id),
        solicitudCambioService.getAll(id)
      ]);

      if (docsRes.success && docsRes.data) setDocs(docsRes.data);
      else setDocs([]);

      if (cambiosRes.success && cambiosRes.data) setCambios(cambiosRes.data);
      else setCambios([]);

    } catch (err) {
      setDocs([]);
      setCambios([]);
      setError('No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const apiBase = import.meta.env.VITE_API_URL || '';
  const buildFileUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (apiBase && apiBase.startsWith('http')) {
      return `${apiBase.replace(/\/api\/?$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    try {
      const current = new URL(window.location.origin);
      if (current.port === '5173') current.port = '5110';
      return `${current.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  };

  const esImagen = (url: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);

  useEffect(() => {
    loadVehiculos();
  }, []);

  useEffect(() => {
    loadDocs(vehiculoId);
  }, [vehiculoId]);

  const tiposArchivoOpcional = ['bom', 'especificacion', 'modificacion'];

  const handleUpload = async () => {
    const nombreTipo = (tipo || '').toLowerCase();
    const archivoOpcional = tiposArchivoOpcional.includes(nombreTipo);
    if (!vehiculoId || !nombre.trim()) {
      setError('Selecciona vehiculo y nombre');
      return;
    }
    if (!archivoOpcional && !file) {
      setError('Selecciona un archivo para este tipo de documento');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await vehiculoDocumentosService.upload(
        { vehiculoId, nombre: nombre.trim(), tipo: tipo || undefined, descripcion: descripcion.trim() || undefined },
        file
      );
      if (res.success) {
        setShowUpload(false);
        setFile(null);
        setNombre('');
        setTipo('Plano');
        setDescripcion('');
        loadDocs(vehiculoId);
      } else {
        setError(res.message || 'No se pudo subir el archivo');
      }
    } catch (err) {
      setError('No se pudo subir el archivo');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCambio = async () => {
    if (!vehiculoId || !cambioDesc.trim()) {
      setError('Captura una descripcion');
      return;
    }
    setSendingCambio(true);
    setError('');
    try {
      const res = await solicitudCambioService.create({
        vehiculoId,
        descripcion: cambioDesc
      });
      if (res.success) {
        setShowCambioModal(false);
        setCambioDesc('');
        loadDocs(vehiculoId);
      } else {
        setError(res.message || 'Error al crear solicitud');
      }
    } catch (err) {
      console.error(err);
      setError('Error al crear solicitud');
    } finally {
      setSendingCambio(false);
    }
  };

  const handleResponderCambio = async (id: number, aprobado: boolean) => {
    const comentarios = window.prompt(aprobado ? 'Comentarios de aprobación (opcional):' : 'Motivo del rechazo (obligatorio):');
    if (!aprobado && !comentarios) return;

    setProcessingCambioId(id);
    setError('');
    try {
      const res = await solicitudCambioService.responder({
        id,
        aprobado,
        comentarios: comentarios || undefined
      });
      if (res.success) {
        loadDocs(vehiculoId);
      } else {
        setError(res.message || 'Error al responder solicitud');
      }
    } catch (err) {
      console.error(err);
      setError('Error al responder solicitud');
    } finally {
      setProcessingCambioId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!vehiculoId) return;
    await vehiculoDocumentosService.delete(vehiculoId, id);
    loadDocs(vehiculoId);
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

  return (
    <div className="dashboard-wrapper space-y-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Archivo</p>
        <h1 className="text-3xl font-semibold text-continental-black">Documentos por contenedor</h1>
        <p className="text-continental-gray-1">Dibujos, especificaciones y planos por vehiculo.</p>
        <div className="mt-3">
          <SearchableSelect
            placeholder="Buscar vehiculo por código o tipo"
            selected={vehiculoSeleccionado}
            onSelect={(opt) => {
              setVehiculoSeleccionado(opt);
              setError('');
            }}
            fetchOptions={async (q) => {
              if (!q || q.length < 2) {
                 return vehiculos.map((v) => ({ value: v.id, label: `${v.codigo} - ${v.tipoNombre || ''}` }));
              }
              try {
                const res = await vehiculosService.getAll({ 
                  search: q, 
                  soloActivos: true, 
                  page: 1, 
                  pageSize: 20 
                } as any);
                if (res.success && res.data) {
                  const data: any = res.data as any;
                  const items = (data.items as any[]) || (data.Items as any[]) || (Array.isArray(data) ? data : []);
                  return filterVehiculos(items).map((v) => ({ 
                    value: v.id, 
                    label: `${v.codigo} - ${v.tipoNombre || ''}` 
                  }));
                }
              } catch (err) {
                console.error('Error buscando vehiculos', err);
              }
              return [];
            }}
            noResultsText="Sin vehiculos"
          />
        </div>
        {quickVehiculos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {quickVehiculos.map((v) => (
              <Button
                key={v.id}
                variant={vehiculoId === v.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setVehiculoSeleccionado({ value: v.id, label: `${v.codigo} - ${v.tipoNombre || ''}` });
                  setError('');
                }}
              >
                {v.codigo} {v.tipoNombre ? `- ${v.tipoNombre}` : ''}
              </Button>
            ))}
            <span className="text-xs text-continental-gray-2 flex items-center">(Si no está en la lista, búscalo arriba)</span>
          </div>
        )}
      </div>

      {vehiculoId && (
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex gap-2">
            <Button variant={activeTab === 'docs' ? 'default' : 'outline'} onClick={() => setActiveTab('docs')} className="gap-2">
              <FileText className="h-4 w-4" /> Documentos
            </Button>
            <Button variant={activeTab === 'requests' ? 'default' : 'outline'} onClick={() => setActiveTab('requests')} className="gap-2">
              <GitPullRequest className="h-4 w-4" /> Solicitudes de Cambio
            </Button>
          </div>
          {activeTab === 'docs' && (
            <Button
              className="flex items-center gap-2"
              onClick={() => setShowUpload(true)}
            >
              <Upload className="h-4 w-4" />
              Subir documento
            </Button>
          )}
          {activeTab === 'requests' && (
            <Button
              className="flex items-center gap-2"
              onClick={() => setShowCambioModal(true)}
            >
              <Plus className="h-4 w-4" />
              Solicitar Cambio
            </Button>
          )}
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
      ) : activeTab === 'docs' ? (
        docs.length === 0 ? (
          <Card className="p-6 text-center text-continental-gray-1">Sin documentos para este vehiculo.</Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {docs.map((d) => (
              <Card key={d.id} className="p-4 flex gap-3 items-start">
                <FileImage className="h-6 w-6 text-continental-yellow mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-continental-black">{d.nombre}</p>
                    {(d as any).version && <Badge variant="secondary" className="h-5 text-[10px]">v{(d as any).version}</Badge>}
                  </div>
                  <p className="text-xs text-continental-gray-2">
                    {d.tipo || 'Plano'} · {formatDate(d.createdAt.toString())}
                  </p>
                  {d.descripcion && <p className="text-sm text-continental-gray-1 mt-1">{d.descripcion}</p>}
                  {d.urlArchivo ? (
                    esImagen(d.urlArchivo) ? (
                      <a href={buildFileUrl(d.urlArchivo)} target="_blank" rel="noreferrer">
                        <img
                          src={buildFileUrl(d.urlArchivo)}
                          alt={d.nombre}
                          className="mt-2 rounded-lg border border-continental-gray-3 max-h-40 object-contain"
                        />
                      </a>
                    ) : (
                      <a
                        href={buildFileUrl(d.urlArchivo)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-continental-blue text-sm underline inline-flex items-center gap-1 mt-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ver archivo
                      </a>
                    )
                  ) : (
                    <p className="text-xs text-continental-gray-2 mt-2">Sin archivo adjunto</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </Card>
            ))}
          </div>
        )
      ) : (
        cambios.length === 0 ? (
          <Card className="p-6 text-center text-continental-gray-1">Sin solicitudes de cambio.</Card>
        ) : (
          <div className="space-y-3">
            {cambios.map(c => (
              <Card key={c.id} className={`p-4 space-y-2 border-l-4 ${c.estado === 0 ? 'border-l-continental-blue' : c.estado === 1 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-continental-black">Solicitud #{c.id}</p>
                    <Badge variant={c.estado === 0 ? 'secondary' : c.estado === 1 ? 'default' : 'destructive'}>
                      {c.estadoNombre}
                    </Badge>
                  </div>
                  {c.estado === 0 && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-700 border-green-200 bg-green-50 hover:bg-green-100 flex items-center gap-1 px-3 h-9"
                        onClick={() => handleResponderCambio(c.id, true)}
                        disabled={processingCambioId === c.id}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Aprobar</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-700 border-red-200 bg-red-50 hover:bg-red-100 flex items-center gap-1 px-3 h-9"
                        onClick={() => handleResponderCambio(c.id, false)}
                        disabled={processingCambioId === c.id}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Rechazar</span>
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-800">{c.descripcion}</p>
                <div className="text-xs text-gray-500 flex justify-between pt-2 border-t mt-2">
                  <span>Por: {c.solicitadoPorNombre} - {formatDate(c.fechaSolicitud)}</span>
                  {c.fechaRespuesta && <span>Resp: {formatDate(c.fechaRespuesta)}</span>}
                </div>
                {c.comentariosRespuesta && (
                  <div className="text-xs bg-gray-50 p-2 rounded text-gray-700 border border-gray-100">
                    <strong>Respuesta:</strong> {c.comentariosRespuesta}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Subir documento" description="Planos o documentos del contenedor.">
        <div className="space-y-3">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Select
            label="Tipo"
            value={tipo}
            onChange={(v) => setTipo(v)}
            options={[
              { value: 'Plano', label: 'Plano' },
              { value: 'Especificacion', label: 'Especificacion' },
              { value: 'BOM', label: 'Lista de materiales' },
              { value: 'Modificacion', label: 'Modificacion' }
            ]}
          />
          <Textarea
            label="Descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Notas o referencias"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-continental-black">
              Archivo (imagen o PDF)
              {tiposArchivoOpcional.includes((tipo || '').toLowerCase()) ? ' — opcional' : ''}
            </p>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowUpload(false)}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={saving}>
            {saving ? 'Guardando...' : 'Subir'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showCambioModal} onClose={() => setShowCambioModal(false)} title="Solicitar Cambio" description="Describe los cambios requeridos para los planos.">
        <div className="space-y-3">
          <Textarea 
            placeholder="Descripción detallada del cambio solicitado..." 
            value={cambioDesc}
            onChange={e => setCambioDesc(e.target.value)}
            rows={5}
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCambioModal(false)}>Cancelar</Button>
          <Button onClick={handleCreateCambio} disabled={sendingCambio || !cambioDesc.trim()}>
            {sendingCambio ? 'Enviando...' : 'Enviar Solicitud'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
