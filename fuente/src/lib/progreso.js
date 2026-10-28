// Persistencia en localStorage (prefijo `corr:v1:`) + exportar/importar. ÚNICO lugar que toca localStorage
// (salvo el tema, que lo maneja el Layout). Siempre en try/catch: si está bloqueado o roto, la app sigue
// funcionando en memoria durante la visita.
import { MATERIAS, ELECTIVAS, ESTADOS, ESTADO_INICIAL } from '../data/plan.js';
import { slug, admiteNota } from './motor.js';

export const PREFIJO = 'corr:v1:';
// Los 3 primeros se ven siempre; el resto (hasta recibirse) aparece al usarlo o al proponer un plan.
export const CUATRIS = ['2026-2C', '2027-1C', '2027-2C', '2028-1C', '2028-2C', '2029-1C', '2029-2C', '2030-1C', '2030-2C'];
export const CUATRIS_VISIBLES = 3;
export const TURNOS_EDITABLES = ['feb-mar-2027', 'jul-2027'];
const NS = new Set(MATERIAS.map((m) => m.n));
const IDS_ELECTIVAS = new Set(ELECTIVAS.map((e) => slug(e.nombre)));
const IDS_PLAN = new Set([...NS, ...ELECTIVAS.map((e) => `e:${slug(e.nombre)}`)]); // materias (Nº) + electivas ('e:<slug>')
const MAX_BYTES = 200_000;

const memoria = new Map();
let alm; // undefined = usar globalThis.localStorage; los tests inyectan uno
export const usarAlmacen = (a) => { alm = a; memoria.clear(); };
const almacen = () => { try { return alm !== undefined ? alm : globalThis.localStorage ?? null; } catch { return null; } };

export function leer(clave) {
  try { const v = almacen()?.getItem(PREFIJO + clave); if (v != null) return JSON.parse(v); } catch { /* roto o bloqueado */ }
  return memoria.has(clave) ? memoria.get(clave) : null;
}
export function guardar(clave, valor) {
  memoria.set(clave, valor);
  try { almacen()?.setItem(PREFIJO + clave, JSON.stringify(valor)); return true; } catch { return false; }
}

const esObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00`)) && new Date(`${s}T00:00:00`).toISOString().slice(0, 10) === s;

// ---------- Sanitizado (sirve para lo guardado y para lo importado) ----------
export function limpiarEstado(obj) {
  const out = {};
  if (!esObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(k);
    if (!NS.has(n) || !esObj(v)) continue;
    const estado = v.estado; // un estado desconocido se descarta (cae en 'pendiente')
    if (!ESTADOS.includes(estado)) continue;
    out[n] = { estado };
    if (admiteNota(estado) && Number.isFinite(v.nota) && v.nota >= 1 && v.nota <= 10) out[n].nota = v.nota;
  }
  return out;
}
export function limpiarPlan(obj) {
  const out = {};
  if (!esObj(obj)) return out;
  const vistos = new Set();
  for (const id of CUATRIS) {
    if (!Array.isArray(obj[id])) continue;
    out[id] = obj[id].filter((n) => IDS_PLAN.has(n) && !vistos.has(n) && vistos.add(n));
  }
  return out;
}
/** Ítems del plan marcados "Recursar": lista sin repetidos de ids válidos (materia Nº o 'e:<slug>'). */
export function limpiarRecursar(arr) {
  if (!Array.isArray(arr)) return [];
  const vistos = new Set();
  return arr.filter((n) => IDS_PLAN.has(n) && !vistos.has(n) && vistos.add(n));
}
export function limpiarFechas(obj) {
  const out = {};
  if (esObj(obj)) for (const id of TURNOS_EDITABLES) if (esFecha(obj[id])) out[id] = obj[id];
  return out;
}
export function limpiarElectivas(obj) {
  const out = {};
  if (esObj(obj)) for (const [k, v] of Object.entries(obj)) if (IDS_ELECTIVAS.has(k) && (v === 'aprobada' || v === 'cursando')) out[k] = v;
  return out;
}

// ---------- Carga / guardado ----------
const semilla = () => limpiarEstado(JSON.parse(JSON.stringify(ESTADO_INICIAL)));
export function cargarEstado() {
  const g = leer('estado');
  return esObj(g) ? limpiarEstado(g) : semilla(); // nada guardado (o roto) -> semilla
}
export const guardarEstado = (est) => guardar('estado', est);
/** null = nunca editado (el planificador usa su valor por defecto). */
export const cargarPlan = () => { const g = leer('plan'); return esObj(g) ? limpiarPlan(g) : null; };
export const guardarPlan = (p) => guardar('plan', p);
export const cargarRecursar = () => limpiarRecursar(leer('recursar'));
export const guardarRecursar = (r) => guardar('recursar', r);
export const cargarFechas = () => limpiarFechas(leer('fechas'));
export const guardarFechas = (f) => guardar('fechas', f);
export const cargarElectivas = () => limpiarElectivas(leer('electivas'));
export const guardarElectivas = (e) => guardar('electivas', e);

// ---------- Exportar / importar ----------
export function armarExport() {
  return { app: 'correlativas', version: 1, exportado: new Date().toISOString(), estado: cargarEstado(), plan: cargarPlan() ?? {}, recursar: cargarRecursar(), fechas: cargarFechas(), electivas: cargarElectivas() };
}
/** Valida el texto de un archivo. -> { ok:true, datos } | { ok:false, error } */
export function validarImport(texto) {
  if (typeof texto !== 'string' || texto.length > MAX_BYTES) return { ok: false, error: 'El archivo es muy grande o no es de texto.' };
  let j;
  try { j = JSON.parse(texto); } catch { return { ok: false, error: 'El archivo no es un JSON válido.' }; }
  if (!esObj(j) || j.app !== 'correlativas' || j.version !== 1) return { ok: false, error: 'No parece un respaldo de Correlativas (versión 1).' };
  if (!esObj(j.estado)) return { ok: false, error: 'Al respaldo le falta el estado de las materias.' };
  const estado = limpiarEstado(j.estado);
  if (Object.keys(j.estado).length && !Object.keys(estado).length) return { ok: false, error: 'Ninguna materia del archivo es válida.' };
  return { ok: true, datos: { estado, plan: limpiarPlan(j.plan), recursar: limpiarRecursar(j.recursar), fechas: limpiarFechas(j.fechas), electivas: limpiarElectivas(j.electivas) } };
}
export function aplicarImport({ estado, plan, recursar = [], fechas, electivas }) {
  guardarEstado(estado); guardarPlan(plan); guardarRecursar(recursar); guardarFechas(fechas); guardarElectivas(electivas);
}
