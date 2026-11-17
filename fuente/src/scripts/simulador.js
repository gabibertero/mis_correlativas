// Escenarios de cursado y finales sobre copias. Este módulo nunca guarda progreso.
import { MATERIAS_PLAN } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import { ETIQUETA } from '../lib/vista.js';
import { cargarEstado, cargarElectivas, cargarLicenciatura, PREFIJO } from '../lib/progreso.js';
import { $, $$, filaMateria, vacio } from './comun.js';

let licenciatura, electivas, real, candidatas;
const filas = $$('[data-sim-materia]');
const reset = $('[data-accion="reset-simulacion"]');
const resumen = $('[data-sim-resumen]');
const listas = $('.res-listas');
const buscar = $('[data-sim-buscar]');
const verAprobadas = $('[data-sim-ver-aprobadas]');
const clave = (v) => /^\d+$/.test(v) ? Number(v) : v;
const itemDe = (n) => M.esElectiva(n) ? M.electivaPorId[n] : M.porN[n];
const activa = (f) => !f.dataset.simLicenciaturaId || f.dataset.simLicenciaturaId === licenciatura;
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const regularizada = (e) => ['regular', 'recursando', 'promocion', 'aprobada'].includes(e);

function actualizarReal() {
  licenciatura = cargarLicenciatura();
  electivas = CATALOGO_ELECTIVAS.filter((e) => !e.licenciatura || e.licenciatura === licenciatura);
  real = M.conElectivas(cargarEstado(), cargarElectivas());
  candidatas = [...MATERIAS_PLAN.map((m) => m.n), ...electivas.filter((e) => e.correlativasConfirmadas !== false).map(M.idElectiva)];
  for (const f of filas) {
    const e = M.estadoDe(real, clave(f.dataset.simMateria));
    f.dataset.estadoReal = e;
    const c = $('.chip', f); c.dataset.estado = e; c.textContent = ETIQUETA[e];
    $('option[value="real"]', f).textContent = `Como está · ${ETIQUETA[e]}`;
  }
  $('[data-hechas-n]').textContent = filas.filter((f) => activa(f) && f.dataset.estadoReal === 'aprobada').length;
  const trayecto = LICENCIATURAS.find((l) => l.id === licenciatura);
  $('[data-sim-licenciatura]').textContent = trayecto
    ? `${trayecto.nombre}: se incluyen sus materias nuevas publicadas. Sus correlativas y oferta deben confirmarse antes de inscribirte.${licenciatura === 'datos' ? ' Todavía no se publicaron sus nuevas materias.' : ''}`
    : 'Las electivas suman créditos aparte de las 36 obligatorias. Podés elegir una licenciatura en Electivas para incluir también sus materias nuevas.';
}

function filtrar() {
  const q = normalizar(buscar.value.trim());
  for (const f of filas) {
    const cambiada = $('[data-sim-estado]', f).value !== 'real';
    f.dataset.simCambiada = cambiada ? 'si' : 'no';
    f.hidden = !activa(f) || (!verAprobadas.checked && f.dataset.estadoReal === 'aprobada' && !cambiada) || !normalizar($('.fila-nombre', f).textContent).includes(q);
  }
  for (const g of $$('[data-sim-grupo]')) g.hidden = !$('[data-sim-materia]:not([hidden])', g);
  $('[data-sim-sin-resultados]').hidden = filas.some((f) => !f.hidden);
}

function cambios() {
  const c = {};
  for (const f of filas.filter(activa)) {
    const v = $('[data-sim-estado]', f).value;
    if (v !== 'real' && v !== M.estadoDe(real, clave(f.dataset.simMateria))) c[f.dataset.simMateria] = v;
  }
  return c;
}

const paraCursar = (est) => candidatas.filter((n) => M.estaHabilitada(est, n));
const paraFinal = (est) => candidatas.filter((n) => M.puedeRendirFinal(est, n));
const nombres = (ns) => ns.map(M.nombreCorto).join(', ');
function requisitos(n, final = false) {
  const m = itemDe(n);
  if (m.finalExigeTodo && final) return 'Necesita todas las asignaturas previas aprobadas y los requisitos adicionales de Proyecto Final.';
  if (m.finalExigeTodasHasta && final) return `Necesita las materias 1 a ${m.finalExigeTodasHasta} aprobadas.`;
  const partes = [];
  if (final) partes.push('La propia materia regular');
  if (m.reg.length) partes.push(`basta regularizar: ${nombres(m.reg)}`);
  if (m.aprob.length) partes.push(`requiere aprobar: ${nombres(m.aprob)}`);
  return partes.length ? `${partes.join(' · ')}.` : 'No requiere correlativas.';
}
function motivosPerdida(sim, n, tipo) {
  const f = tipo === 'cursar' ? M.queFaltaParaCursar(sim, n) : M.queFaltaParaFinal(sim, n);
  const partes = [];
  if (f.regular) partes.push('falta regularizar la propia materia');
  if (f.reg?.length) partes.push(`falta regularizar: ${nombres(f.reg)}`);
  const aprob = f.aprob ?? f.aprobar ?? [];
  if (aprob.length) partes.push(`falta aprobar: ${nombres(aprob)}`);
  if (!partes.length) partes.push(`el estado de prueba es ${ETIQUETA[M.estadoDe(sim, n)].toLowerCase()}`);
  return `${tipo === 'cursar' ? 'Cursado' : 'Final'} · ${partes.join(' · ')}.`;
}
function cifras(est) {
  const elect = Object.fromEntries(electivas.map((e) => [M.slug(e.nombre), M.estadoDe(est, M.idElectiva(e))]));
  const cr = M.creditos(elect, CATALOGO_ELECTIVAS, est, licenciatura);
  return { aprobadas: M.resumen(est).aprobadas, cursadas: MATERIAS_PLAN.filter((m) => regularizada(M.estadoDe(est, m.n))).length, creditos: cr.ing, analista: cr.analista };
}
function pintar() {
  const c = cambios(); const k = Object.keys(c).length;
  const sim = M.aplicar(real, c);
  reset.hidden = k === 0; listas.hidden = k === 0;
  for (const [lado, est] of [['real', real], ['proy', sim]]) {
    for (const [nombre, valor] of Object.entries(cifras(est))) $(`[data-sim-${lado}="${nombre}"]`).textContent = valor;
  }
  const antesC = paraCursar(real); const antesF = paraFinal(real);
  const despuesC = paraCursar(sim); const despuesF = paraFinal(sim);
  const cursar = despuesC.filter((n) => !antesC.includes(n));
  const finales = despuesF.filter((n) => !antesF.includes(n));
  const perdidas = [
    ...antesC.filter((n) => !despuesC.includes(n) && M.sinCursar(M.estadoDe(sim, n))).map((n) => ({ n, tipo: 'cursar' })),
    ...antesF.filter((n) => !despuesF.includes(n) && M.estadoDe(sim, n) !== 'aprobada').map((n) => ({ n, tipo: 'final' })),
  ];
  const mostrar = (tipo, ns, final, texto) => $(`[data-sim-lista="${tipo}"]`).replaceChildren(...(ns.length ? ns.map((n) => filaMateria(n, requisitos(n, final))) : [vacio(texto)]));
  mostrar('cursar', cursar, false, 'No aparece ninguna materia nueva para cursar.');
  mostrar('finales', finales, true, 'No aparece ningún final nuevo habilitado.');
  $('[data-sim-perdidas]').hidden = !perdidas.length;
  $('[data-sim-lista="perdidas"]').replaceChildren(...perdidas.map(({ n, tipo }) => filaMateria(n, motivosPerdida(sim, n, tipo))));
  resumen.textContent = k ? `Probás ${k} ${k === 1 ? 'cambio' : 'cambios'}: ${cursar.length} nuevas para cursar y ${finales.length} nuevos finales habilitados.${perdidas.length ? ` También se perderían ${perdidas.length} habilitaciones.` : ''} Tu progreso real no cambia.` : 'Elegí un estado de prueba para comparar. Regularizar no equivale a aprobar.';
  filtrar();
}

for (const f of filas) $('[data-sim-estado]', f).addEventListener('change', pintar);
reset.addEventListener('click', () => { for (const f of filas) $('[data-sim-estado]', f).value = 'real'; pintar(); });
buscar.addEventListener('input', filtrar);
verAprobadas.addEventListener('change', filtrar);
actualizarReal();
pintar();
addEventListener('pageshow', (ev) => { if (ev.persisted) actualizarReal(); pintar(); });
const clavesReales = new Set(['estado', 'electivas', 'licenciatura'].map((c) => PREFIJO + c));
addEventListener('storage', (ev) => {
  if (ev.key === null || clavesReales.has(ev.key)) { actualizarReal(); pintar(); }
});
