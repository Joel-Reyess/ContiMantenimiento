import { CheckCircle2, ClipboardList, FileText, ShieldCheck, Truck, Wrench, Search } from 'lucide-react';
import type { EstadoEtapa, EtapaFlujo } from '@/services/flujoService';

/** Colores del PDF: verde completada, naranja parpadeante pendiente, rojo rechazada, azul sin espacio */
// eslint-disable-next-line react-refresh/only-export-components
export const COLOR_ETAPA: Record<EstadoEtapa, string> = {
  completada: '#2db928',
  pendiente: '#ff8c00',
  rechazada: '#ff2d37',
  bloqueada: '#004eaf',
  inactiva: '#cdcdcd',
};

const TEXTO_ESTADO: Record<EstadoEtapa, string> = {
  completada: 'Completada',
  pendiente: 'Pendiente',
  rechazada: 'Rechazada / devuelta',
  bloqueada: 'Sin espacio en la Zona de Transición',
  inactiva: 'Aún no inicia',
};

const ICONO: Record<EtapaFlujo['clave'], typeof FileText> = {
  REPORTE: FileText,
  INSPECCION: Search,
  TRASLADO: Truck,
  TALLER: Wrench,
  TRASLADO_RETORNO: Truck,
  VALIDACION: ShieldCheck,
  DISPONIBLE: CheckCircle2,
};

interface FlujoEtapasProps {
  etapas: EtapaFlujo[];
  /** Muestra abajo el detalle de la etapa en curso (por defecto sí) */
  conDetalle?: boolean;
}

/**
 * Seguimiento visual de la orden: REPORTE › INSPECCIÓN › TRASLADO › TALLER › TRASLADO › VALIDACIÓN › DISPONIBLE.
 * Bajo cada ícono va el rol o usuario responsable (o "En espera", "Sin espacio"...).
 */
export function FlujoEtapas({ etapas, conDetalle = true }: FlujoEtapasProps) {
  const actual = etapas.find((e) => e.estado !== 'completada' && e.estado !== 'inactiva');
  return (
    <div className="space-y-3" data-testid="flujo-etapas">
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[640px] items-start">
          {etapas.map((e, i) => {
            const Icono = ICONO[e.clave] ?? ClipboardList;
            const color = COLOR_ETAPA[e.estado];
            const siguiente = etapas[i + 1];
            return (
              <li
                key={e.clave}
                className="relative flex flex-1 flex-col items-center text-center"
                data-etapa={e.clave}
                data-estado={e.estado}
                title={[TEXTO_ESTADO[e.estado], e.responsable, e.mensaje].filter(Boolean).join(' · ')}
              >
                {siguiente && (
                  <span
                    aria-hidden
                    className="absolute top-6 h-1 rounded-full"
                    style={{
                      left: 'calc(50% + 26px)',
                      right: 'calc(-50% + 26px)',
                      backgroundColor: e.estado === 'completada' ? COLOR_ETAPA.completada : COLOR_ETAPA.inactiva,
                    }}
                  />
                )}
                <span
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-white ${e.estado === 'pendiente' ? 'flujo-parpadeo' : ''}`}
                  style={{ backgroundColor: color }}
                >
                  <Icono className="h-6 w-6" />
                </span>
                <span className="mt-2 text-[11px] font-bold tracking-wide text-continental-black">{e.nombre}</span>
                <span
                  className="mt-0.5 max-w-[7.5rem] text-xs font-medium leading-tight"
                  style={{ color: e.estado === 'inactiva' ? '#969696' : e.estado === 'completada' ? '#057855' : color }}
                >
                  {e.etiqueta}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {conDetalle && actual && (
        <div
          className="rounded-lg border-l-4 bg-continental-bg px-4 py-3 text-sm"
          style={{ borderLeftColor: COLOR_ETAPA[actual.estado] }}
          data-testid="flujo-etapa-actual"
        >
          <p className="font-semibold text-continental-black">
            {actual.nombre}: {actual.etiqueta}
            {actual.responsable ? <span className="font-normal text-continental-gray-1"> · Responsable: {actual.responsable}</span> : null}
          </p>
          {actual.mensaje && <p className="text-continental-gray-1">{actual.mensaje}</p>}
        </div>
      )}
    </div>
  );
}
