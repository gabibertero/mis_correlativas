// Estados reales de electivas. Los requisitos informan, sin impedir cargar historial.
import { ELECTIVAS, CREDITOS_INGENIERIA, CREDITOS_ANALISTA } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import { cargarEstado, cargarElectivas, guardarElectivas, cargarLicenciatura, PREFIJO } from '../lib/progreso.js';
import { $, $$, el, chip } from './comun.js';

const porId = Object.fromEntries(CATALOGO_ELECTIVAS.map((e) => [M.slug(e.nombre), e]));

function pintar() {
  const est = cargarEstado();
  const elect = cargarElectivas();
  const licenciatura = cargarLicenciatura();
  const combinado = M.conElectivas(est, elect);
  let puedo = 0;
  let activas = 0;
  for (const li of $$('li[data-electiva]')) {
    const id = li.dataset.electiva;
    const e = porId[id];
    const activa = !e.licenciatura || e.licenciatura === licenciatura;
    li.dataset.activa = activa ? 'si' : 'no';
    const estado = elect[id] ?? 'pendiente';
    const f = M.faltan(est, e);
    const confirmadas = e.correlativasConfirmadas !== false;
    const ok = confirmadas && !f.reg.length && !f.aprob.length;
    const habilitada = activa && ok && M.sinCursar(estado);
    li.dataset.estado = estado;
    li.dataset.habilitada = habilitada ? 'si' : 'no';
    if (activa) activas++;
    if (habilitada) puedo++;
    $('.el-est', li).replaceChildren(!M.sinCursar(estado) ? chip(estado) : habilitada ? el('span', { class: 'chip chip-hab' }, 'Habilitada') : chip(estado, confirmadas ? (estado === 'pendiente' ? 'Sin habilitar' : undefined) : (estado === 'pendiente' ? 'Por confirmar' : undefined)));
    $('[data-faltan]', li)?.remove();
    const label = $('label.sel', li);
    const detalles = [];
    if (!confirmadas) {
      detalles.push(el('li', {}, 'Correlativas y modalidad propias: pendientes de confirmar.'));
      if (f.reg.length) detalles.push(el('li', {}, 'Acceso al trayecto: regularizar Diseño de Sistemas de Información.'));
      else detalles.push(el('li', {}, 'Diseño regular: cumplís el requisito académico de acceso al trayecto.'));
      detalles.push(el('li', {}, `Implementación anunciada desde ${e.desde}; no confirma oferta ni cupo para un período.`));
    } else if (M.sinCursar(estado)) {
      detalles.push(...f.reg.map((n) => el('li', {}, 'Para cursar: regularizar ', el('b', {}, M.nombreCorto(n)), ' (no exige su final).')),
        ...f.aprob.map((n) => el('li', {}, 'Para cursar: aprobar ', el('b', {}, M.nombreCorto(n)), '.')));
    } else if (['regular', 'recursando', 'promocion'].includes(estado)) {
      const ff = M.queFaltaParaFinal(combinado, `e:${id}`);
      if (M.puedeRendirFinal(combinado, `e:${id}`)) detalles.push(el('li', {}, 'Final habilitado según las correlativas registradas.'));
      else detalles.push(...(ff.reg ?? []).map((n) => el('li', {}, 'Para el final: regularizar ', el('b', {}, M.nombreCorto(n)), '.')),
        ...ff.aprobar.map((n) => el('li', {}, 'Para el final: aprobar ', el('b', {}, M.nombreCorto(n)), '.')));
    }
    if (detalles.length) label.before(el('ul', { class: 'faltan', dataset: { faltan: '' } }, ...detalles));
    label.hidden = false;
    const sel = $('select', label);
    sel.value = estado;
    sel.disabled = false;
  }
  const c = M.creditos(elect, CATALOGO_ELECTIVAS, est, licenciatura);
  for (const [id, v, max] of [['ing', c.ing, CREDITOS_INGENIERIA], ['analista', c.analista, CREDITOS_ANALISTA]]) {
    const caja = $(`[data-creditos="${id}"]`);
    $('[data-valor]', caja).textContent = v;
    $('progress', caja).value = Math.min(v, max);
  }
  const sem = $('[data-seminario-creditos]');
  if (sem) sem.hidden = M.estadoDe(est, 99) !== 'aprobada';
  const trayecto = LICENCIATURAS.find((l) => l.id === licenciatura);
  $('[data-trayecto-electivas]').textContent = trayecto ? `${trayecto.nombre}: solo sus materias nuevas aprobadas suman 3 créditos cada una.` : 'Podés sumar las materias nuevas de una licenciatura.';
  $('[data-resumen-electivas]').replaceChildren('Hoy podés cursar ', el('b', {}, String(puedo)), ` de ${activas}. ${ELECTIVAS.length} electivas del catálogo${activas > ELECTIVAS.length ? ` y ${activas - ELECTIVAS.length} materias nuevas de tu licenciatura` : ''}.`);
  document.dispatchEvent(new Event('electivas-pintadas'));
}

for (const sel of $$('li[data-electiva] select')) {
  sel.addEventListener('change', () => {
    const elect = cargarElectivas();
    const id = sel.closest('li').dataset.electiva;
    if (sel.value === 'pendiente') delete elect[id]; else elect[id] = sel.value;
    guardarElectivas(elect);
    pintar();
  });
}
addEventListener('pageshow', (ev) => { if (ev.persisted) pintar(); });
addEventListener('storage', (ev) => { if (ev.key === null || ['estado', 'electivas', 'licenciatura'].some((k) => ev.key === PREFIJO + k)) pintar(); });
pintar();
