// Electivas: habilitada/bloqueada según el estado real, qué falta, estado propio y contador de créditos.
import { ELECTIVAS, CREDITOS_INGENIERIA, CREDITOS_ANALISTA } from '../data/plan.js';
import * as M from '../lib/motor.js';
import { cargarEstado, cargarElectivas, guardarElectivas } from '../lib/progreso.js';
import { $, $$, el, chip } from './comun.js';

const est = cargarEstado();
const elect = cargarElectivas();
const porId = Object.fromEntries(ELECTIVAS.map((e) => [M.slug(e.nombre), e]));

function pintar() {
  let puedo = 0;
  for (const li of $$('li[data-electiva]')) {
    const id = li.dataset.electiva; const e = porId[id];
    const estado = elect[id] ?? 'pendiente';
    const f = M.faltan(est, e);
    const ok = !f.reg.length && !f.aprob.length;
    li.dataset.estado = estado; li.dataset.habilitada = ok ? 'si' : 'no';
    if (ok && estado === 'pendiente') puedo++;

    const chipEl = estado !== 'pendiente' ? chip(estado) : ok ? el('span', { class: 'chip chip-hab' }, 'Habilitada') : chip('pendiente', 'Bloqueada');
    $('.el-est', li).replaceChildren(chipEl);

    $('[data-faltan]', li)?.remove();
    const label = $('label.sel', li);
    if (!ok && estado === 'pendiente') {
      label.before(el('ul', { class: 'faltan', dataset: { faltan: '' } },
        ...f.reg.map((n) => el('li', {}, 'Regular: ', el('b', {}, M.nombreCorto(n)))),
        ...f.aprob.map((n) => el('li', {}, 'Aprobada: ', el('b', {}, M.nombreCorto(n))))));
    }
    label.hidden = false;
    const sel = $('select', label);
    sel.value = estado;
    sel.disabled = !ok && estado === 'pendiente'; // bloqueada: no se puede marcar hasta cumplir las correlativas
  }
  const c = M.creditos(elect, ELECTIVAS, est);
  for (const [id, v, max] of [['ing', c.ing, CREDITOS_INGENIERIA], ['analista', c.analista, CREDITOS_ANALISTA]]) {
    const caja = $(`[data-creditos="${id}"]`);
    $('[data-valor]', caja).textContent = v;
    $('progress', caja).value = Math.min(v, max);
  }
  const sem = $('[data-seminario-creditos]');
  if (sem) { const s = M.estadoDe(est, 99) === 'aprobada'; sem.hidden = !s; }
  $('[data-resumen-electivas]').replaceChildren('Hoy podés cursar ', el('b', {}, String(puedo)), ` de ${ELECTIVAS.length}.`);
}

for (const sel of $$('li[data-electiva] select')) {
  sel.addEventListener('change', () => {
    const id = sel.closest('li').dataset.electiva;
    if (sel.value === 'pendiente') delete elect[id]; else elect[id] = sel.value;
    guardarElectivas(elect);
    pintar();
  });
}
pintar();
