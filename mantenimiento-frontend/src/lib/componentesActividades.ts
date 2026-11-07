import type { VehicleImagePoint } from '@/interfaces';

/** Lo mínimo de una actividad del checklist que se necesita para ligarla a un componente */
export interface ActividadChecklist {
  id: number;
  pregunta: string;
  orden?: number;
}

// Palabras que no distinguen un componente de otro
const VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'E', 'O', 'U', 'A', 'EN', 'CON', 'PARA', 'POR', 'AL']);
// Verbos con los que empiezan las actividades ("REPARAR RODILLOS PRINCIPALES", "CAMBIO DE CHUMACERAS")
const ACCIONES = new Set([
  'REPARAR', 'REPARACION', 'CAMBIO', 'CAMBIAR', 'REEMPLAZAR', 'REEMPLAZO', 'COLOCAR', 'COLOCACION', 'REVISAR', 'REVISION',
  'AJUSTAR', 'AJUSTE', 'LIMPIAR', 'LIMPIEZA', 'SOLDAR', 'INSTALAR', 'INSTALACION', 'SUSTITUIR', 'SUSTITUCION'
]);

/** Palabras significativas en mayúsculas, sin acentos y en singular simple (RODILLOS → RODILLO) */
const palabras = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w && !VACIAS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('S') ? w.slice(0, -1) : w));

/**
 * Actividad que corresponde al componente por nombre: todas las palabras del componente deben estar en la
 * actividad ("RODILLOS PRINCIPALES" → "REPARAR RODILLOS PRINCIPALES"). Si varias cumplen, la más parecida.
 */
export function actividadPorNombre<T extends ActividadChecklist>(nombreComponente: string | undefined, actividades: T[]): T | undefined {
  const c = palabras(nombreComponente || '');
  if (c.length === 0) return undefined;
  let mejor: { a: T; extra: number } | undefined;
  for (const a of actividades) {
    const p = palabras(a.pregunta).filter((w) => !ACCIONES.has(w));
    if (!c.every((w) => p.includes(w))) continue;
    const extra = p.filter((w) => !c.includes(w)).length;
    if (!mejor || extra < mejor.extra) mejor = { a, extra };
  }
  return mejor?.a;
}

/**
 * Actividad del checklist que genera el componente al reportarlo (PDF 06-nov: una sola sección
 * "componente + cantidad"). Primero la que se ligó a mano en Fallas visuales; si no hay, la de nombre igual.
 */
export function actividadDeComponente<T extends ActividadChecklist>(punto: VehicleImagePoint, actividades: T[]): T | undefined {
  if (punto.checklistItemId) {
    const ligada = actividades.find((a) => a.id === punto.checklistItemId);
    if (ligada) return ligada;
  }
  return actividadPorNombre(punto.imageFaultName, actividades);
}
