// Lógica pura del simulador "¿Y si…?" (sin DOM ni localStorage). Usa el motor de correlativas
// tal cual: acá solo se decide qué acciones ofrecer por fila, qué filas muestra cada filtro,
// los escenarios rápidos y la comparación entre el estado real y el escenario.
import { MATERIAS_PLAN } from '../data/plan.js';
import { CATALOGO_ELECTIVAS } from '../data/trayectos.js';
import * as M from './motor.js';

/** Acciones del control segmentado. 'real' = sin cambios. */
export const ACCIONES = ['real', 'regular', 'aprobada', 'libre'];
export const ETIQUETA_ACCION = { real: 'Como está', regular: 'Regularizo', aprobada: 'Apruebo', libre: 'Quedo libre' };

const REGULARIZADA = new Set(['regular', 'recursando', 'promocion', 'aprobada']);
/** Estados que todavía "debés": la cursás, la tenés regular (falta el final) o la tenés que retomar. */
const DEBE = new Set(['cursando', 'recursando', 'regular', 'promocion', 'libre']);
export const debe = (estado) => DEBE.has(estado);

/**
 * Acciones que cambian algo respecto del estado real (sin 'real').
 * - Aprobada: ninguna (no hay nada que simular).
 * - Regularizo: solo si todavía no está regularizada (regular/recursando/promoción ya cuentan como cursada).
 * - Apruebo: siempre que no esté aprobada.
 * - Quedo libre: solo si hoy la cursás o la tenés regular (perder la cursada). Para pendiente, libre o
 *   abandono no cambia nada; la promoción no se pierde por vencimiento.
 * Los demás estados (cursando, promoción, abandono) no se ofrecen: para correlativas equivalen a
 * "Como está", "Regularizo" o "Quedo libre".
 */
export function accionesPara(estado) {
  if (estado === 'aprobada') return [];
  const out = [];
  if (!REGULARIZADA.has(estado)) out.push('regular');
  out.push('aprobada');
  if (estado === 'cursando' || estado === 'recursando' || estado === 'regular') out.push('libre');
  return out;
}

/** Filtros: 'debo' (lo que debés), 'cursar' (habilitadas hoy), 'todas' (sin aprobadas). */
export const FILTROS = ['debo', 'cursar', 'todas'];
export function enFiltro(filtro, estadoReal, habilitadaHoy = false) {
  if (estadoReal === 'aprobada') return false;
  if (filtro === 'debo') return debe(estadoReal);
  if (filtro === 'cursar') return Boolean(habilitadaHoy);
  return true;
}
/** Filtro inicial: lo que debés si hay algo; si no, todas. */
export const filtroInicial = (estadosReales) => (estadosReales.some(debe) ? 'debo' : 'todas');

/**
 * Escenarios rápidos sobre { id: estadoReal } -> { id: acción }.
 * - 'regularizar-cursando': lo que cursás pasa a regular.
 * - 'aprobar-debo': todo lo que debés pasa a aprobada.
 */
export function escenarioRapido(tipo, reales) {
  const c = {};
  for (const [id, e] of Object.entries(reales)) {
    if (tipo === 'regularizar-cursando' && e === 'cursando') c[id] = 'regular';
    if (tipo === 'aprobar-debo' && debe(e)) c[id] = 'aprobada';
  }
  return c;
}

/** Diferencias de habilitaciones inmediatas entre el estado real y el escenario. */
export function diferencias(real, sim, candidatas) {
  const paraCursar = (est) => candidatas.filter((n) => M.estaHabilitada(est, n));
  const paraFinal = (est) => candidatas.filter((n) => M.puedeRendirFinal(est, n));
  const antesC = paraCursar(real); const antesF = paraFinal(real);
  const despuesC = paraCursar(sim); const despuesF = paraFinal(sim);
  return {
    cursar: despuesC.filter((n) => !antesC.includes(n)),
    finales: despuesF.filter((n) => !antesF.includes(n)),
    perdidas: [
      ...antesC.filter((n) => !despuesC.includes(n) && M.sinCursar(M.estadoDe(sim, n))).map((n) => ({ n, tipo: 'cursar' })),
      ...antesF.filter((n) => !despuesF.includes(n) && M.estadoDe(sim, n) !== 'aprobada').map((n) => ({ n, tipo: 'final' })),
    ],
  };
}

/** Cifras del avance: aprobadas y cursadas de las 36, créditos de Ingeniería y de Analista.
 *  `electivas`: las del catálogo que aplican (sin las de otras licenciaturas). */
export function cifras(est, electivas, licenciatura) {
  const elect = Object.fromEntries(electivas.map((e) => [M.slug(e.nombre), M.estadoDe(est, M.idElectiva(e))]));
  const cr = M.creditos(elect, CATALOGO_ELECTIVAS, est, licenciatura);
  return {
    aprobadas: M.resumen(est).aprobadas,
    cursadas: MATERIAS_PLAN.filter((m) => REGULARIZADA.has(M.estadoDe(est, m.n))).length,
    creditos: cr.ing,
    analista: cr.analista,
  };
}

/** "+2", "−1" (signo menos tipográfico) o "Igual". */
export const textoDelta = (d) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : 'Igual');
