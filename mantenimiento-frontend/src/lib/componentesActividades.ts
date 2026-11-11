import type { VehicleImagePoint } from '@/interfaces';

/** Lo mínimo de una actividad del checklist que se necesita para ligarla a un punto de la foto */
export interface ActividadChecklist {
  id: number;
  /** Descripción del ítem */
  pregunta: string;
  /** Título corto (FV-03) */
  titulo?: string | null;
  orden?: number;
}

/** Nombre con el que se ve la actividad: su título, o su descripción si no tiene (FV-03) */
export const nombreActividad = (a: ActividadChecklist) => a.titulo?.trim() || a.pregunta;

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

const igual = (a: string | null | undefined, b: string | null | undefined) => {
  const x = palabras(a || '').join(' ');
  return x !== '' && x === palabras(b || '').join(' ');
};

/**
 * Actividad que corresponde al componente por nombre: todas las palabras del componente deben estar en la
 * actividad (título o descripción: "RODILLOS PRINCIPALES" → "REPARAR RODILLOS PRINCIPALES"). Si varias cumplen, la más parecida.
 */
export function actividadPorNombre<T extends ActividadChecklist>(nombreComponente: string | undefined, actividades: T[]): T | undefined {
  const c = palabras(nombreComponente || '');
  if (c.length === 0) return undefined;
  let mejor: { a: T; extra: number } | undefined;
  for (const a of actividades) {
    const p = palabras(`${a.titulo || ''} ${a.pregunta}`).filter((w) => !ACCIONES.has(w));
    if (!c.every((w) => p.includes(w))) continue;
    const extra = p.filter((w) => !c.includes(w)).length;
    if (!mejor || extra < mejor.extra) mejor = { a, extra };
  }
  return mejor?.a;
}

/**
 * Sugerencia para un punto anterior sin actividad (FV-03): la actividad cuya descripción es la descripción del
 * componente (ej. ENSAMBLE / "DESARMADO Y ARMADO DE CARRO"), o la de título o nombre igual, o la que contiene su nombre.
 */
export function sugerirActividad<T extends ActividadChecklist>(punto: VehicleImagePoint, actividades: T[]): T | undefined {
  if (punto.imageFaultDescription) {
    const porDescripcion = actividades.filter((a) => igual(a.pregunta, punto.imageFaultDescription));
    if (porDescripcion.length === 1) return porDescripcion[0];
  }
  const porNombre = actividades.filter((a) => igual(a.titulo, punto.imageFaultName) || igual(a.pregunta, punto.imageFaultName));
  if (porNombre.length === 1) return porNombre[0];
  return actividadPorNombre(punto.imageFaultName, actividades);
}

/**
 * Actividad del checklist que representa el punto de la foto al reportarlo. FV-03: la que se ubicó en Fallas visuales;
 * para un punto anterior todavía sin ligar, la sugerida por nombre (si no hay ninguna, el punto no se ofrece).
 */
export function actividadDeComponente<T extends ActividadChecklist>(punto: VehicleImagePoint, actividades: T[]): T | undefined {
  if (punto.checklistItemId && !punto.sinActividad) {
    const ligada = actividades.find((a) => a.id === punto.checklistItemId);
    if (ligada) return ligada;
  }
  return sugerirActividad(punto, actividades);
}
