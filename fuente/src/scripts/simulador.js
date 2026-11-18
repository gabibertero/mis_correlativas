// Escenarios de cursado y finales sobre copias. Este módulo nunca guarda progreso.
// La lógica (acciones por fila, filtros, comparación) vive en lib/simulacion.js y lib/motor.js.
import { MATERIAS_PLAN } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import * as S from '../lib/simulacion.js';
import { ETIQUETA } from '../lib/vista.js';
import { cargarEstado, cargarElectivas, cargarLicenciatura, PREFIJO } from '../lib/progreso.js';
import { $, $$, filaMateria, vacio } from './comun.js';

let licenciatura, electivas, real, candidatas;
let panelVisible = false;
const filas = $$('[data-sim-materia]');
const panel = $('[data-sim-resultado]');
const reset = $('[data-accion="reset-simulacion"]');
const deshacer = $('[data-sim-deshacer]');
const resumen = $('[data-sim-resumen]');
const listas = $('.res-listas');
const buscar = $('[data-sim-buscar]');
const filtros = $$('[data-sim-filtro]');
const barra = $('[data-sim-barra]');
const clave = (v) => /^\d+$/.test(v) ? Number(v) : v;
const itemDe = (n) => M.esElectiva(n) ? M.electivaPorId[n] : M.porN[n];
const activa = (f) => !f.dataset.simLicenciaturaId || f.dataset.simLicenciaturaId === licenciatura;
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const radio = (f, v) => $(`input[value="${v}"]`, f);
const accionDe = (f) => $('[data-sim-opciones] input:checked', f)?.value ?? 'real';
const filtroActual = () => filtros.find((r) => r.checked)?.value ?? 'todas';
const habilitadaHoy = (f) => M.estaHabilitada(real, clave(f.dataset.simMateria));

function actualizarReal() {
  licenciatura = cargarLicenciatura();
  electivas = CATALOGO_ELECTIVAS.filter((e) => !e.licenciatura || e.licenciatura === licenciatura);
  real = M.conElectivas(cargarEstado(), cargarElectivas());
  candidatas = [...MATERIAS_PLAN.map((m) => m.n), ...electivas.filter((e) => e.correlativasConfirmadas !== false).map(M.idElectiva)];
  for (const f of filas) {
    const e = M.estadoDe(real, clave(f.dataset.simMateria));
    f.dataset.estadoReal = e;
    const c = $('[data-sim-chip="real"]', f); c.dataset.estado = e; c.textContent = ETIQUETA[e];
    // Solo las acciones que cambian algo; si la elegida dejó de tener sentido, vuelve a "Como está".
    const utiles = new Set(['real', ...S.accionesPara(e)]);
    for (const op of $$('[data-sim-op]', f)) {
      const sirve = utiles.has(op.dataset.simOp);
      op.hidden = !sirve; $('input', op).disabled = !sirve;
      if (!sirve && $('input', op).checked) radio(f, 'real').checked = true;
    }
  }
  const act = filas.filter(activa);
  for (const v of S.FILTROS) $(`[data-sim-cuenta="${v}"]`).textContent = act.filter((f) => S.enFiltro(v, f.dataset.estadoReal, habilitadaHoy(f))).length;
  $('[data-sim-rapido="regularizar-cursando"]').hidden = !act.some((f) => f.dataset.estadoReal === 'cursando');
  $('[data-sim-rapido="aprobar-debo"]').hidden = !act.some((f) => S.debe(f.dataset.estadoReal));
  const trayecto = LICENCIATURAS.find((l) => l.id === licenciatura);
  $('[data-sim-licenciatura]').textContent = trayecto
    ? `${trayecto.nombre}: se incluyen sus materias nuevas publicadas. Sus correlativas y oferta deben confirmarse antes de inscribirte.${licenciatura === 'datos' ? ' Todavía no se publicaron sus nuevas materias.' : ''}`
    : 'Las electivas suman créditos aparte de las 36 obligatorias. Elegí una licenciatura en Electivas para incluir también sus materias nuevas.';
}

function elegirFiltroInicial() {
  const v = S.filtroInicial(filas.filter(activa).map((f) => f.dataset.estadoReal));
  for (const r of filtros) r.checked = r.value === v;
}

function filtrar() {
  const q = normalizar(buscar.value.trim());
  const filtro = filtroActual();
  for (const f of filas) {
    const cambiada = accionDe(f) !== 'real';
    f.hidden = !activa(f) || !(cambiada || S.enFiltro(filtro, f.dataset.estadoReal, habilitadaHoy(f))) || !normalizar($('.fila-nombre', f).textContent).includes(q);
  }
  for (const g of $$('[data-sim-grupo]')) g.hidden = !$('[data-sim-materia]:not([hidden])', g);
  const nada = !filas.some((f) => !f.hidden);
  $('[data-sim-sin-resultados]').hidden = !nada;
  $('[data-sim-sin-texto]').textContent = q
    ? 'No hay materias que coincidan con la búsqueda en este filtro.'
    : filtro === 'debo' ? 'No debés ninguna materia: no cursás ni tenés regulares.'
    : filtro === 'cursar' ? 'Hoy no tenés materias nuevas habilitadas para cursar.'
    : 'No quedan materias sin aprobar.';
  $('[data-sim-ver-todas]').hidden = !nada || filtro === 'todas';
}

function cambios() {
  const c = {};
  for (const f of filas.filter(activa)) {
    const v = accionDe(f);
    if (v !== 'real' && v !== f.dataset.estadoReal) c[f.dataset.simMateria] = v;
  }
  return c;
}

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
  if (!partes.length) partes.push(`en el escenario queda ${ETIQUETA[M.estadoDe(sim, n)].toLowerCase()}`);
  return `${tipo === 'cursar' ? 'Cursado' : 'Final'} · ${partes.join(' · ')}.`;
}

function pintarFila(f) {
  const v = accionDe(f);
  const cambiada = v !== 'real';
  f.dataset.simCambiada = cambiada ? 'si' : 'no';
  const proy = $('[data-sim-chip="proy"]', f);
  proy.hidden = !cambiada; $('.flecha', f).hidden = !cambiada; $('[data-sim-chip-sr]', f).hidden = !cambiada;
  if (cambiada) { proy.dataset.estado = v; proy.textContent = ETIQUETA[v]; }
}

function pintar() {
  for (const f of filas) pintarFila(f);
  const c = cambios(); const k = Object.keys(c).length;
  const sim = M.aplicar(real, c);
  panel.dataset.cambios = k ? 'si' : 'no';
  reset.hidden = k === 0; deshacer.hidden = k === 0; listas.hidden = k === 0;
  const antes = S.cifras(real, electivas, licenciatura); const despues = S.cifras(sim, electivas, licenciatura);
  for (const id of Object.keys(antes)) {
    const d = despues[id] - antes[id];
    $(`[data-sim-real="${id}"]`).textContent = antes[id];
    $(`[data-sim-proy="${id}"]`).textContent = despues[id];
    $(`[data-sim-delta="${id}"]`).textContent = k ? S.textoDelta(d) : '';
    $(`[data-sim-tile="${id}"]`).dataset.signo = String(Math.sign(d));
  }
  const { cursar, finales, perdidas } = S.diferencias(real, sim, candidatas);
  const mostrar = (tipo, ns, final, texto) => $(`[data-sim-lista="${tipo}"]`).replaceChildren(...(ns.length ? ns.map((n) => filaMateria(n, requisitos(n, final))) : [vacio(texto)]));
  mostrar('cursar', cursar, false, 'Ninguna materia nueva para cursar.');
  mostrar('finales', finales, true, 'Ningún final nuevo habilitado.');
  $('[data-sim-perdidas]').hidden = !perdidas.length;
  $('[data-sim-lista="perdidas"]').replaceChildren(...perdidas.map(({ n, tipo }) => filaMateria(n, motivosPerdida(sim, n, tipo))));
  $('[data-sim-n="cursar"]').textContent = cursar.length;
  $('[data-sim-n="finales"]').textContent = finales.length;
  $('[data-sim-n="perdidas"]').textContent = perdidas.length;
  resumen.textContent = k
    ? `Probás ${plural(k, 'cambio', 'cambios')}: ${plural(cursar.length, 'materia nueva', 'materias nuevas')} para cursar y ${plural(finales.length, 'final nuevo', 'finales nuevos')}.${perdidas.length ? ` Se perderían ${plural(perdidas.length, 'habilitación', 'habilitaciones')}.` : ''} Tu progreso real no cambia.`
    : 'Elegí qué pasaría con alguna materia para comparar. Tu progreso real no cambia.';
  barra.hidden = k === 0 || panelVisible;
  $('[data-sim-barra-texto]').replaceChildren(
    `+${cursar.length} cursar · +${finales.length} ${finales.length === 1 ? 'final' : 'finales'}`,
    Object.assign(document.createElement('small'), { textContent: `${plural(k, 'cambio', 'cambios')}${perdidas.length ? ` · se pierden ${perdidas.length}` : ' de prueba'}` }),
  );
  filtrar();
}

function volverAlReal() {
  for (const f of filas) radio(f, 'real').checked = true;
  pintar();
}

// El panel visible en pantalla oculta la barra del celular (sería redundante).
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { panelVisible = e.isIntersecting; barra.hidden = panelVisible || panel.dataset.cambios !== 'si'; }, { threshold: 0.15 }).observe(panel);
}

for (const f of filas) $('[data-sim-opciones]', f).addEventListener('change', pintar);
for (const r of filtros) r.addEventListener('change', filtrar);
buscar.addEventListener('input', filtrar);
reset.addEventListener('click', volverAlReal);
// El botón se oculta al deshacer: el foco pasa al panel para no perderse.
deshacer.addEventListener('click', () => { volverAlReal(); panel.focus(); });
$('[data-sim-deshacer-barra]').addEventListener('click', volverAlReal);
$('[data-sim-ver-todas]').addEventListener('click', () => { for (const r of filtros) r.checked = r.value === 'todas'; filtrar(); });
for (const b of $$('[data-sim-rapido]')) b.addEventListener('click', () => {
  const act = filas.filter(activa);
  const c = S.escenarioRapido(b.dataset.simRapido, Object.fromEntries(act.map((f) => [f.dataset.simMateria, f.dataset.estadoReal])));
  for (const f of act) if (c[f.dataset.simMateria]) { const r = radio(f, c[f.dataset.simMateria]); if (r && !r.disabled) r.checked = true; }
  pintar();
});
$('[data-sim-ver]').addEventListener('click', (ev) => {
  ev.preventDefault();
  panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  panel.focus({ preventScroll: true });
});

actualizarReal();
elegirFiltroInicial();
pintar();
addEventListener('pageshow', (ev) => { if (ev.persisted) actualizarReal(); pintar(); });
const clavesReales = new Set(['estado', 'electivas', 'licenciatura'].map((c) => PREFIJO + c));
addEventListener('storage', (ev) => {
  if (ev.key === null || clavesReales.has(ev.key)) { actualizarReal(); pintar(); }
});
