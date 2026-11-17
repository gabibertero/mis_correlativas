// Persistencia en localStorage (prefijo `corr:v1:`) + exportar/importar. ÚNICO lugar que toca localStorage
// (salvo el tema, que lo maneja el Layout). Siempre en try/catch: si está bloqueado o roto, la app sigue
// funcionando en memoria durante la visita.
import { MATERIAS, ESTADOS } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS, ESTADOS_ELECTIVAS } from '../data/trayectos.js';
import { slug, admiteNota } from './motor.js';

export const PREFIJO = 'corr:v1:';
// Los veranos son períodos opcionales de febrero, anteriores al 1º cuatrimestre.
// Mantener los IDs antiguos permite recuperar los planes ya guardados.
export const CUATRIS = ['2026-2C', ...Array.from({ length: 7 }, (_, i) => `${2027 + i}`).flatMap((anio) => [`${anio}-VER`, `${anio}-1C`, `${anio}-2C`])];
export const CUATRIS_VISIBLES = 3;
export const TURNOS_EDITABLES = ['feb-mar-2027', 'jul-2027'];
const NS = new Set(MATERIAS.map((m) => m.n));
const IDS_ELECTIVAS = new Set(CATALOGO_ELECTIVAS.map((e) => slug(e.nombre)));
const IDS_PLAN = new Set([...NS, ...CATALOGO_ELECTIVAS.map((e) => `e:${slug(e.nombre)}`)]); // materias (Nº) + electivas ('e:<slug>')
const IDS_LICENCIATURAS = new Set(LICENCIATURAS.map((l) => l.id));
const MAX_BYTES = 200_000;

const memoria = new Map();
let alm; // undefined = usar globalThis.localStorage; los tests inyectan uno
export const usarAlmacen = (a) => { alm = a; memoria.clear(); };
const almacen = () => { try { return alm !== undefined ? alm : globalThis.localStorage ?? null; } catch { return null; } };

// Otra pestaña puede reemplazar o borrar el progreso. El respaldo en memoria no
// debe resucitar valores anteriores cuando la clave ya no existe en localStorage.
globalThis.addEventListener?.('storage', (ev) => {
  if (ev.storageArea !== almacen()) return;
  if (ev.key === null) memoria.clear();
  else if (ev.key.startsWith(PREFIJO)) memoria.delete(ev.key.slice(PREFIJO.length));
});

export function leer(clave) {
  try { const v = almacen()?.getItem(PREFIJO + clave); if (v != null) return JSON.parse(v); } catch { /* roto o bloqueado */ }
  return memoria.has(clave) ? memoria.get(clave) : null;
}
let alCambiar = null; // hook para la sincronización en la nube (sync.js)
export const onCambio = (fn) => { alCambiar = fn; };
export function guardar(clave, valor) {
  memoria.set(clave, valor);
  try { almacen()?.setItem(PREFIJO + clave, JSON.stringify(valor)); } catch { return false; }
  try { alCambiar?.(); } catch { /* la nube no debe romper el guardado local */ }
  return true;
}

/** Borra el progreso local (claves con PREFIJO, menos el tema). Al cerrar sesión, para no filtrar datos a la próxima cuenta. */
export function limpiarLocal() {
  memoria.clear();
  try {
    const a = almacen();
    const claves = [];
    for (let i = 0; i < (a?.length ?? 0); i++) claves.push(a.key(i));
    for (const k of claves) if (k.startsWith(PREFIJO) && k !== `${PREFIJO}tema`) a.removeItem(k);
  } catch { /* bloqueado: nada que limpiar */ }
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
/** Fecha de final por materia: { <Nº>: 'YYYY-MM-DD' }. Descarta Nº inválidos y fechas inexistentes. */
export function limpiarFinales(obj) {
  const out = {};
  if (esObj(obj)) for (const [k, v] of Object.entries(obj)) if (NS.has(Number(k)) && esFecha(v)) out[Number(k)] = v;
  return out;
}
export function limpiarElectivas(obj) {
  const out = {};
  // Pendiente se representa por ausencia, igual que en los respaldos anteriores.
  if (esObj(obj)) for (const [k, v] of Object.entries(obj)) if (IDS_ELECTIVAS.has(k) && ESTADOS_ELECTIVAS.includes(v) && v !== 'pendiente') out[k] = v;
  return out;
}

/** Una única elección por cuenta; cambiarla no borra estados de otros trayectos. */
export const limpiarLicenciatura = (id) => IDS_LICENCIATURAS.has(id) ? id : null;

/** Hipótesis explícitas del plan: por defecto terminar un cursado lo deja regular. */
export function limpiarOpcionesPlan(obj) {
  const o = esObj(obj) ? obj : {};
  const listaIds = (lista, validos) => Array.isArray(lista) ? [...new Set(lista.filter((id) => validos.has(id)))] : [];
  const resultados = {};
  if (esObj(o.resultados)) for (const [key, resultado] of Object.entries(o.resultados)) {
    const id = /^\d+$/.test(key) ? Number(key) : key;
    if (IDS_PLAN.has(id) && (resultado === 'regular' || resultado === 'aprobada')) resultados[id] = resultado;
  }
  const veranoExtrasPorAnio = {};
  if (esObj(o.veranoExtrasPorAnio)) for (const [anio, lista] of Object.entries(o.veranoExtrasPorAnio)) {
    if (/^20\d{2}$/.test(anio) && CUATRIS.includes(`${anio}-VER`)) veranoExtrasPorAnio[anio] = listaIds(lista, NS);
  }
  return {
    incluirVerano: o.incluirVerano === true,
    // La lista plana es compatibilidad del primer verano (2027). Las nuevas
    // confirmaciones se guardan por año: la oferta excepcional no se repite sola.
    veranoExtras: listaIds(o.veranoExtras, NS),
    veranoExtrasPorAnio,
    resultado: o.resultado === 'aprobada' ? 'aprobada' : 'regular',
    resultados,
    finalesPrevistos: listaIds(o.finalesPrevistos, IDS_PLAN),
  };
}

/** Perfil (viaja con la cuenta): nombre (máx 40), color de la whitelist, modo claro/oscuro (null = seguir al sistema). */
export const TEMAS_COLOR = ['verde', 'oceano', 'violeta', 'indigo', 'rosa', 'coral', 'ambar', 'grafito'];
export const limpiarNombre = (x) => (typeof x === 'string' ? x.trim().slice(0, 40).trim() : '');
export const limpiarTemaColor = (x) => (TEMAS_COLOR.includes(x) ? x : 'verde');
export const limpiarTemaModo = (x) => (x === 'claro' || x === 'oscuro' ? x : null);

// ---------- Carga / guardado ----------
const semilla = () => ({}); // cada cuenta arranca sin materias marcadas; el progreso vive en la cuenta
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
export const cargarFinales = () => limpiarFinales(leer('finales'));
export const guardarFinales = (f) => guardar('finales', f);
export const cargarElectivas = () => limpiarElectivas(leer('electivas'));
export const guardarElectivas = (e) => guardar('electivas', e);
export const cargarLicenciatura = () => limpiarLicenciatura(leer('licenciatura'));
export const guardarLicenciatura = (id) => guardar('licenciatura', limpiarLicenciatura(id));
export const cargarOpcionesPlan = () => limpiarOpcionesPlan(leer('opcionesPlan'));
export const guardarOpcionesPlan = (o) => guardar('opcionesPlan', limpiarOpcionesPlan(o));
export const cargarNombre = () => limpiarNombre(leer('nombre'));
export const guardarNombre = (n) => guardar('nombre', limpiarNombre(n));
export const cargarTemaColor = () => limpiarTemaColor(leer('temaColor'));
export const guardarTemaColor = (c) => guardar('temaColor', limpiarTemaColor(c));
export const cargarTemaModo = () => limpiarTemaModo(leer('temaModo'));
export const guardarTemaModo = (m) => guardar('temaModo', limpiarTemaModo(m));

// ---------- Exportar / importar ----------
export function armarExport() {
  return { app: 'correlativas', version: 1, exportado: new Date().toISOString(), estado: cargarEstado(), plan: cargarPlan() ?? {}, recursar: cargarRecursar(), fechas: cargarFechas(), finales: cargarFinales(), electivas: cargarElectivas(), licenciatura: cargarLicenciatura(), opcionesPlan: cargarOpcionesPlan(), nombre: cargarNombre(), temaColor: cargarTemaColor(), temaModo: cargarTemaModo() };
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
  return { ok: true, datos: { estado, plan: limpiarPlan(j.plan), recursar: limpiarRecursar(j.recursar), fechas: limpiarFechas(j.fechas), finales: limpiarFinales(j.finales), electivas: limpiarElectivas(j.electivas), licenciatura: limpiarLicenciatura(j.licenciatura), opcionesPlan: limpiarOpcionesPlan(j.opcionesPlan), nombre: limpiarNombre(j.nombre), temaColor: limpiarTemaColor(j.temaColor), temaModo: limpiarTemaModo(j.temaModo) } };
}
export function aplicarImport({ estado, plan, recursar = [], fechas, finales = {}, electivas, licenciatura = null, opcionesPlan = {}, nombre = '', temaColor = 'verde', temaModo = null }) {
  guardarEstado(estado); guardarPlan(plan); guardarRecursar(recursar); guardarFechas(fechas); guardarFinales(finales); guardarElectivas(electivas);
  guardarLicenciatura(licenciatura); guardarOpcionesPlan(opcionesPlan);
  guardarNombre(nombre); guardarTemaColor(temaColor); guardarTemaModo(temaModo);
}
