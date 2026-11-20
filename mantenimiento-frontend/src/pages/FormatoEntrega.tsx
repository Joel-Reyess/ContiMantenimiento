import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import continentalLogo from '@/assets/continental_real.png';
import { flujoService, type Flujo } from '@/services/flujoService';
import { formatDateTime } from '@/lib/utils';

const celda: React.CSSProperties = { padding: '6px 10px', border: '1px solid #999', verticalAlign: 'top' };

/**
 * Formato de entrega imprimible del flujo de equipos eléctricos (EQE-08): datos del equipo y de la orden, trabajo
 * realizado y espacio para las firmas. Se puede imprimir desde que el equipo está en su área (es la excepción a
 * "imprimir solo en DISPONIBLE"): el Líder lo firma y el taller sube el documento firmado.
 */
export function FormatoEntregaPage() {
  const { id } = useParams();
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    void flujoService.deOrden(Number(id)).then((r) => {
      if (!vigente) return;
      if (r.success && r.data) setFlujo(r.data);
      else setError(r.message || 'No se pudo cargar la orden');
    });
    return () => { vigente = false; };
  }, [id]);

  if (error) return <p style={{ padding: 24 }}>{error}</p>;
  if (!flujo) return <p style={{ padding: 24 }}>Cargando…</p>;
  const e = flujo.electrico;
  const malos = e?.checklist.flatMap((c) => c.actividades.filter((a) => a.resultado === 'Malo').map((a) => ({ ...a, categoria: c.nombre }))) ?? [];
  const revisadas = e?.checklist.reduce((n, c) => n + c.actividades.filter((a) => a.resultado).length, 0) ?? 0;
  const total = e?.checklist.reduce((n, c) => n + c.actividades.length, 0) ?? 0;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 24, color: '#000', fontSize: 13 }} data-testid="formato-entrega-pagina">
      <style>{'@media print { .no-imprimir { display: none !important; } @page { size: letter; margin: 14mm; } }'}</style>
      <div className="no-imprimir" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" onClick={() => window.print()} style={{ padding: '8px 16px', border: '1px solid #333', borderRadius: 8 }}>Imprimir</button>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '3px solid #ffa500', paddingBottom: 8 }}>
          <img src={continentalLogo} alt="Continental" style={{ height: 34 }} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>FORMATO DE ENTREGA DE EQUIPO</p>
            <p style={{ margin: 0 }}>{e?.esPreventivo ? `Mantenimiento preventivo ${e?.tipoRevision ?? ''}` : 'Mantenimiento correctivo'}</p>
          </div>
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr><td style={celda}><strong>Orden de trabajo</strong></td><td style={celda}>{flujo.ordenFolio}</td><td style={celda}><strong>Reporte</strong></td><td style={celda}>{flujo.reporteFolio ?? '—'}</td></tr>
            <tr><td style={celda}><strong>Equipo</strong></td><td style={celda}>{flujo.vehiculoTipo} {flujo.vehiculoCodigo}</td><td style={celda}><strong>Número económico</strong></td><td style={celda}>{e?.numeroEconomico ?? '—'}</td></tr>
            <tr><td style={celda}><strong>Horómetro</strong></td><td style={celda}>{e?.horometro != null ? `${e.horometro} h` : '—'}</td><td style={celda}><strong>Proveedor</strong></td><td style={celda}>{e?.empresa ?? '—'}</td></tr>
            <tr><td style={celda}><strong>Técnico</strong></td><td style={celda}>{e?.tecnico ?? '—'}</td><td style={celda}><strong>Fecha de impresión</strong></td><td style={celda}>{formatDateTime(new Date().toISOString())}</td></tr>
          </tbody>
        </table>
        {!e?.esPreventivo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>Falla reportada</p>
            <p style={{ margin: 0 }}>{flujo.reporteDescripcion ?? '—'}</p>
            <p style={{ fontWeight: 700, margin: 0 }}>Diagnóstico y trabajo realizado</p>
            <p style={{ margin: 0 }}>{e?.trabajoRealizado || e?.diagnostico || '—'}</p>
            {e?.resultadoPruebas && (<><p style={{ fontWeight: 700, margin: 0 }}>Pruebas operativas</p><p style={{ margin: 0 }}>{e.resultadoPruebas}</p></>)}
          </div>
        )}
        {e?.esPreventivo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>Checklist: {revisadas} de {total} actividades revisadas · {malos.length} en mal estado</p>
            {malos.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {malos.map((a) => <li key={a.id}>{a.numero} {a.descripcion}{a.observacion ? ` — ${a.observacion}` : ''}</li>)}
              </ul>
            )}
            <p style={{ margin: 0 }}>
              Código de falla: {e.codigoFallaEncontrado == null ? '—' : e.codigoFallaEncontrado ? `Sí (${e.codigoFalla ?? ''}), resuelto: ${e.codigoFallaResuelto ? 'Sí' : 'No'}` : 'No'}
            </p>
            {e.trabajoRealizado && <p style={{ margin: 0 }}>Notas: {e.trabajoRealizado}</p>}
          </div>
        )}
        <p style={{ margin: 0 }}>El área recibe el equipo en condiciones de operar y firma de conformidad.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40 }}>
          <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Entrega: técnico del taller</div><div>{e?.tecnico ?? ''}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Recibe: Líder del área</div><div>{e?.aproboEntrega ?? ''}</div></div>
        </div>
      </div>
    </div>
  );
}
