// Malla interactiva: resalta correlativas, abre el panel y deja cambiar estado y nota.
import * as M from '../lib/motor.js';
import { ETIQUETA, MODALIDAD, NOMBRE_NIVEL } from '../lib/vista.js';
import { cargarEstado, guardarEstado, cargarFinales, guardarFinales } from '../lib/progreso.js';
import { $, $$, el, chip, etiquetaN, vacio } from './comun.js';

let est = cargarEstado();
let sel = null; // n seleccionada
const cajas = $$('button.mat');
cajas.forEach((c) => { c.disabled = false; }); // vienen disabled en el HTML: sin JS no son controles
const panel = $('#panel-materia');
const campo = (c) => $(`[data-campo="${c}"]`, panel);
const lista = (c) => $(`[data-lista="${c}"]`, panel);

function pintarCaja(caja) {
  const n = Number(caja.dataset.materia);
  const e = M.estadoDe(est, n);
  const hab = M.estaHabilitada(est, n);
  caja.dataset.estado = e;
  caja.dataset.habilitada = hab ? 'si' : 'no';
  const c = $('.chip', caja); c.dataset.estado = e; c.textContent = ETIQUETA[e];
  const nota = est[n]?.nota;
  $('[data-nota]', caja).hidden = nota == null;
  $('[data-nota-valor]', caja).textContent = nota ?? '';
  $('.mat-hab', caja).hidden = !hab;
}

function pintarRelaciones() {
  const m = sel && M.porN[sel];
  const dest = sel ? M.destraba(sel) : null;
  for (const caja of cajas) {
    const n = Number(caja.dataset.materia);
    caja.dataset.rel = !sel ? '' : n === sel ? 'sel' : m.reg.includes(n) ? 'reg' : m.aprob.includes(n) ? 'aprob' : dest.has(n) ? 'destraba' : 'atenuada';
    caja.setAttribute('aria-expanded', String(n === sel));
  }
}

// Fila con el estado actual de la materia como chip (mismo componente y colores que las tarjetas; el texto lo hace entendible sin color).
const fila = (n, ...nodos) => { const li = el('li', {}, ...nodos, chip(M.estadoDe(est, n))); li.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px'; return li; };
const item = (n, ok, prefijo) => fila(n, `${ok ? '✓' : '✗'} ${prefijo}${M.nombreCorto(n)}`, el('span', { class: 'sr-only' }, ok ? ' (cumplido)' : ' (falta)'));
const llenar = (ul, nodos, textoVacio) => ul.replaceChildren(...(nodos.length ? nodos : [vacio(textoVacio)]));

function pintarPanel() {
  if (!sel) { panel.hidden = true; return; }
  const n = sel; const m = M.porN[n];
  const e = M.estadoDe(est, n);
  panel.dataset.materiaActiva = n;
  campo('nivel').textContent = NOMBRE_NIVEL[m.nivel];
  campo('titulo').textContent = `${etiquetaN(n)} · ${m.nombre}`;
  campo('meta').textContent = `${m.hs} hs semanales · ${MODALIDAD[m.modalidad]}${m.integradora ? ' · Integradora' : ''}`;
  campo('estado').value = e;
  const nota = campo('nota');
  nota.value = est[n]?.nota ?? ''; nota.disabled = !M.admiteNota(e);
  campo('final').value = cargarFinales()[n] ?? '';
  const v = M.veredicto(est, n);
  const ver = campo('veredicto'); ver.textContent = v.texto; ver.dataset.tono = v.tono;

  const f = M.queFaltaParaCursar(est, n);
  llenar(lista('requisitos'), [
    ...m.reg.map((r) => item(r, !f.reg.includes(r), 'Regular: ')),
    ...m.aprob.map((r) => item(r, !f.aprob.includes(r), 'Aprobada: ')),
  ], 'No tiene correlativas: se puede cursar desde el principio.');

  const ff = M.queFaltaParaFinal(est, n);
  llenar(lista('falta-final'), e === 'aprobada' ? [] : [
    ...(ff.regular ? [item(n, false, 'Tenerla regular: ')] : []),
    ...ff.aprobar.map((r) => item(r, false, 'Aprobar: ')),
    ...ff.extra.map((t) => el('li', {}, `Además: ${t} (no se registra en la app).`)),
  ], e === 'aprobada' ? 'Ya la aprobaste.' : 'Nada: ya cumplís todo.');

  const d = [...M.destraba(n)].sort((a, b) => a - b);
  llenar(lista('destraba'), d.map((x) => fila(x, `${etiquetaN(x)} · ${M.nombreCorto(x)}`)), 'No destraba otras materias.');
  panel.hidden = false;
}

function repintar() {
  cajas.forEach(pintarCaja);
  pintarRelaciones();
  pintarPanel();
  for (const nv of $$('[data-nivel-avance]')) {
    const nivel = nv.closest('[data-nivel]').dataset.nivel;
    $('.num', nv).textContent = M.resumen(est).niveles.find((x) => x.nv === Number(nivel)).ok;
  }
}

function abrir(n) {
  sel = n; repintar(); campo('titulo').focus({ preventScroll: true });
  // En bottom-sheet (<1024) la caja elegida no puede quedar tapada por el panel.
  if (!matchMedia('(min-width: 1024px)').matches) cajas.find((c) => Number(c.dataset.materia) === n)?.scrollIntoView({ block: 'nearest' });
}
function cerrar() {
  const caja = cajas.find((c) => Number(c.dataset.materia) === sel);
  sel = null; repintar(); caja?.focus();
}

function guardarCambio(n, estado, nota) {
  est = { ...est, [n]: { estado } };
  if (M.admiteNota(estado) && nota != null) est[n].nota = nota;
  guardarEstado(est);
  repintar();
}

campo('titulo').tabIndex = -1;
for (const caja of cajas) caja.addEventListener('click', () => abrir(Number(caja.dataset.materia)));
$('[data-accion="cerrar-panel"]', panel).addEventListener('click', cerrar);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && sel) cerrar(); });
campo('estado').addEventListener('change', (ev) => guardarCambio(sel, ev.target.value, est[sel]?.nota));
campo('final').addEventListener('change', (ev) => {
  const f = cargarFinales();
  if (ev.target.value) f[sel] = ev.target.value; else delete f[sel];
  guardarFinales(f);
});
campo('nota').addEventListener('change', (ev) => {
  const t = ev.target.value.trim();
  const v = t === '' ? null : Number(t);
  if (v !== null && !(Number.isFinite(v) && v >= 1 && v <= 10)) { ev.target.value = est[sel]?.nota ?? ''; return; } // fuera de rango: se ignora
  guardarCambio(sel, M.estadoDe(est, sel), v);
});
repintar();
