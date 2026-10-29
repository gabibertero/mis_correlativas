// Planificador: cuatrimestres con validación de correlativas y horas + finales por turno (impacto, cuenta regresiva).
import { MATERIAS, ELECTIVAS } from '../data/plan.js';
import * as M from '../lib/motor.js';
import { ETIQUETA } from '../lib/vista.js';
import { cargarEstado, cargarElectivas, cargarPlan, guardarPlan, cargarRecursar, guardarRecursar, cargarFechas, guardarFechas, cargarFinales, CUATRIS, CUATRIS_VISIBLES } from '../lib/progreso.js';
import { $, $$, el, chip, etiquetaN, vacio, textoDias } from './comun.js';

const est = cargarEstado();
const fechas = cargarFechas();
const electEst = cargarElectivas(); // estado real de cada electiva { slug: 'aprobada'|'cursando' }
const clave = (v) => (/^\d+$/.test(v) ? Number(v) : v); // dataset -> Nº de materia o id 'e:<slug>'
// Sin plan guardado: el cuatrimestre en curso arranca con lo que está cursando.
const plan = cargarPlan() ?? { [CUATRIS[0]]: MATERIAS.filter((m) => M.estadoDe(est, m.n) === 'cursando').map((m) => m.n) };
for (const id of CUATRIS) plan[id] ??= [];
// "Recursar": marca por ítem del plan (no cambia las correlativas para cursarla). Se guarda aparte, en corr:v1:recursar.
const recursar = new Set(cargarRecursar());
const guardarMarcas = () => { for (const n of [...recursar]) if (!Object.values(plan).some((ns) => ns.includes(n))) recursar.delete(n); guardarRecursar([...recursar]); };
const HS_LIMITE = 30; // provisorio, igual que data-hs-limite del markup
const arts = $$('[data-cuatri]');
const ids = arts.map((a) => a.dataset.cuatri);
const nombreDe = (id) => $('h3', $(`[data-cuatri="${id}"]`)).textContent;
let visibles = CUATRIS_VISIBLES;
const decir = (t) => { const a = $('[data-estado-plan]'); if (a) a.textContent = t; };

// ---------- Cuatrimestres ----------
function filaMateriaPlan(n, i) {
  const nombre = nombreDe(ids[i]);
  const elec = M.esElectiva(n);
  const e = elec ? M.electivaPorId[n] : null;
  const rec = recursar.has(n);
  return el('li', { draggable: 'true', dataset: { materia: n, hs: M.hsDe(n), recursar: rec ? 'si' : 'no', ...(elec && { electiva: 'si' }) } },
    el('span', { class: 'n num' }, elec ? 'E' : etiquetaN(n)),
    el('span', { class: 's-nom' }, M.nombreCorto(n), elec ? el('small', {}, el('span', { class: 'chip-electiva' }, `Electiva · ${e.creditos} cr`), ` = ${e.creditos} hs`) : el('small', {}, `${M.porN[n].hs} hs`),
      el('small', { class: 'modalidad', dataset: { modalidad: M.modalidadInfo(elec ? e : M.porN[n]).label } }, M.modalidadInfo(elec ? e : M.porN[n]).label),
      M.esContracuatri(n, ids[i]) ? el('small', { class: 'contra-cuatri', dataset: { contracuatri: 'si' } }, 'Contracuatrimestre: menos cátedras') : null,
      rec ? el('small', { class: 'marca-recursar', dataset: { marca: 'recursar' } }, 'Recursar') : null),
    chip(elec ? (electEst[n.slice(2)] ?? 'pendiente') : M.estadoDe(est, n)),
    el('button', { type: 'button', class: 'toggle-recursar', 'aria-pressed': String(rec), 'aria-label': `Recursar ${M.nombreCorto(n)}`, dataset: { accion: 'recursar', materia: n } }, 'Recursar'),
    el('span', { class: 'mover' },
      el('button', { type: 'button', class: 'quitar', 'aria-label': `Quitar ${M.nombreCorto(n)} de ${nombre}`, dataset: { accion: 'quitar-materia', materia: n } }, 'Quitar')));
}

function pintarCuatris() {
  const ultimo = ids.findLastIndex((id) => plan[id].length);
  visibles = Math.min(ids.length, Math.max(visibles, CUATRIS_VISIBLES, ultimo + 1));
  const usadas = new Set(Object.values(plan).flat());
  arts.forEach((art, i) => {
    const id = ids[i]; const ns = plan[id];
    art.hidden = i >= visibles;
    const nombre = $('h3', art).textContent;
    const cont = M.continuan(est, plan, ids, i);

    $('[data-slot-lista]', art).replaceChildren(...(ns.length || cont.length ? [
      ...cont.map((n) => el('li', { class: 'continua', dataset: { materia: n, continua: 'si' } }, el('span', { class: 'n num' }, etiquetaN(n)),
        el('span', { class: 's-nom' }, M.nombreCorto(n), el('small', {}, `Anual: sigue de ${nombreDe(ids[i - 1])} · ${M.hsDe(n)} hs`)))),
      ...M.ordenarPlan(ns).map((n) => filaMateriaPlan(n, i))] : [vacio('Sin materias. Agregá las que quieras cursar.')]));

    const limite = Number(art.dataset.hsLimite); const hs = M.horasCuatri(est, plan, ids, i);
    $('[data-hs-total]', art).textContent = hs;
    $('progress', art).value = hs;
    art.dataset.sobrecarga = hs > limite ? 'si' : 'no';

    const ul = $('[data-avisos]', art);
    ul.setAttribute('role', 'status');
    ul.replaceChildren(...M.avisosCuatri(est, plan, ids, i, limite, recursar).map((t) => el('li', {}, t)));

    $('[data-campo="materia"]', art).replaceChildren(el('option', { value: '' }, 'Elegí una materia…'),
      el('optgroup', { label: 'Materias del plan' }, ...MATERIAS.filter((m) => !usadas.has(m.n) && !['aprobada', 'regular', 'recursando'].includes(M.estadoDe(est, m.n))).map((m) => el('option', { value: m.n }, `${etiquetaN(m.n)} · ${m.nombre}${m.opcional ? ' (opcional)' : ''}`))),
      el('optgroup', { label: 'Electivas' }, ...ELECTIVAS.filter((e) => !usadas.has(M.idElectiva(e)) && electEst[M.slug(e.nombre)] !== 'aprobada').map((e) => el('option', { value: M.idElectiva(e) }, `Electiva · ${e.nombre} (${e.creditos} cr)`))));
  });
  const sumar = $('[data-accion="sumar-cuatri"]'); if (sumar) sumar.disabled = visibles >= ids.length;
}

function cambiarPlan(id, ns) {
  plan[id] = ns; guardarPlan(plan); guardarMarcas(); pintarCuatris();
  $(`[data-cuatri="${id}"] [data-campo="materia"]`).focus();
}
/** Mueve una materia de un cuatrimestre a otro, guarda, revalida y avisa. Devuelve true si movió. */
function mover(n, desde, hacia) {
  if (desde === hacia || !plan[desde]?.includes(n) || !plan[hacia]) return false;
  plan[desde] = plan[desde].filter((x) => x !== n); plan[hacia] = [...plan[hacia], n];
  visibles = Math.max(visibles, ids.indexOf(hacia) + 1);
  guardarPlan(plan); pintarCuatris();
  const av = M.avisosCuatri(est, plan, ids, ids.indexOf(hacia), HS_LIMITE, recursar).length;
  decir(`Moviste ${M.nombreCorto(n)} a ${nombreDe(hacia)}.` + (av ? ` Ese cuatrimestre tiene ${av} ${av === 1 ? 'aviso' : 'avisos'}.` : ' Sin avisos.'));
  return true;
}

arts.forEach((art, i) => {
  const id = ids[i];
  $('[data-agregar]', art).hidden = false;
  $('[data-accion="agregar-materia"]', art).addEventListener('click', () => {
    const n = clave($('[data-campo="materia"]', art).value);
    if (n) cambiarPlan(id, [...plan[id], n]);
  });
  art.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]'); if (!b) return;
    const n = clave(b.dataset.materia);
    if (b.dataset.accion === 'recursar') {
      if (recursar.has(n)) recursar.delete(n); else recursar.add(n);
      guardarMarcas(); pintarCuatris();
      $(`[data-cuatri="${id}"] [data-accion="recursar"][data-materia="${n}"]`)?.focus();
      decir(recursar.has(n) ? `${M.nombreCorto(n)} marcada para recursar.` : `${M.nombreCorto(n)} ya no está marcada para recursar.`);
    } else if (b.dataset.accion === 'quitar-materia') cambiarPlan(id, plan[id].filter((x) => x !== n));
    else if (b.dataset.accion === 'mover-anterior' || b.dataset.accion === 'mover-siguiente') {
      const hacia = ids[i + (b.dataset.accion === 'mover-anterior' ? -1 : 1)];
      if (mover(n, id, hacia)) $(`[data-cuatri="${hacia}"] [data-accion="${b.dataset.accion}"][data-materia="${n}"], [data-cuatri="${hacia}"] [data-accion="quitar-materia"][data-materia="${n}"]`)?.focus();
    }
  });
  // Arrastrar y soltar (con mouse). Alternativa sin mouse / táctil: botones ◂ ▸.
  art.addEventListener('dragstart', (ev) => {
    const li = ev.target.closest?.('li[draggable]'); if (!li) return;
    ev.dataTransfer.setData('text/plain', `${li.dataset.materia}:${id}`); ev.dataTransfer.effectAllowed = 'move';
    li.dataset.arrastrando = '';
  });
  art.addEventListener('dragend', () => { $$('[data-arrastrando]').forEach((x) => delete x.dataset.arrastrando); $$('[data-drop-activo]').forEach((x) => delete x.dataset.dropActivo); });
  art.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; art.dataset.dropActivo = ''; });
  art.addEventListener('dragleave', (ev) => { if (!art.contains(ev.relatedTarget)) delete art.dataset.dropActivo; });
  art.addEventListener('drop', (ev) => {
    ev.preventDefault(); delete art.dataset.dropActivo;
    const t = ev.dataTransfer.getData('text/plain') || ''; const k = t.lastIndexOf(':'); // el id de electiva ya lleva ':'
    const desde = t.slice(k + 1);
    if (ids.includes(desde)) mover(clave(t.slice(0, k)), desde, id);
  });
});

// Herramientas (solo con JS)
$('[data-herramientas]').hidden = false;
$('[data-accion="sumar-cuatri"]').addEventListener('click', () => { visibles++; pintarCuatris(); $$('[data-cuatri]')[visibles - 1].scrollIntoView({ block: 'nearest' }); });
$('[data-accion="proponer-plan"]').addEventListener('click', () => {
  if (ids.slice(1).some((id) => plan[id].length) && !confirm('Esto reemplaza lo que armaste del segundo cuatrimestre en adelante. ¿Seguimos?')) { decir('Propuesta cancelada.'); return; }
  const r = M.proponerPlan(est, ids, { hsLimite: HS_LIMITE, fijo: plan[ids[0]] });
  for (const id of ids) plan[id] = r.plan[id] ?? [];
  guardarPlan(plan); guardarMarcas();
  visibles = CUATRIS_VISIBLES; pintarCuatris();
  const usados = ids.filter((id, i) => i > 0 && plan[id].length).length;
  decir(r.sinUbicar.length
    ? `Propuesta armada, pero no entran en los cuatrimestres disponibles: ${r.sinUbicar.map(M.nombreCorto).join(', ')}.`
    : `Propuesta armada: ${usados} ${usados === 1 ? 'cuatrimestre' : 'cuatrimestres'} más hasta completar el plan. Es un punto de partida: ajustalo a tu gusto.`);
});
pintarCuatris();

// ---------- Finales por turno ----------
const mesCorto = (d) => new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(d).replace('.', '');
const porImpacto = (a, b) => (a.dataset.pasado === 'si') - (b.dataset.pasado === 'si') || b.dataset.impacto - a.dataset.impacto || a.dataset.fecha.localeCompare(b.dataset.fecha);

function filaExamen({ fecha, materia, tipo, etiqueta, opcional }) {
  const d = M.parseFecha(fecha);
  return el('li', { class: 'examen', dataset: { examen: '', fecha, materia, tipo, opcional: opcional ? 'si' : 'no', impacto: M.destraba(materia).size } },
    el('time', { class: 'fecha', datetime: fecha }, el('span', { class: 'num' }, String(d.getDate())), mesCorto(d)),
    el('span', { class: 'ex-info' }, el('strong', {}, M.nombreCorto(materia)), el('small', {}, etiqueta)),
    el('span', { class: 'ex-meta' }, M.destraba(materia).size > 0 ? el('span', { class: 'impacto', title: 'Materias que destraba' }, `Destraba ${M.destraba(materia).size}`) : null, el('span', { class: 'dias', dataset: { dias: '' } })));
}

function actualizarExamenes(ul) {
  for (const li of $$('[data-examen]', ul)) {
    const d = M.diasHasta(li.dataset.fecha);
    $('[data-dias]', li).textContent = textoDias(d);
    li.dataset.pasado = d < 0 ? 'si' : 'no';
    $('.ex-estado', li)?.remove();
    if (li.dataset.tipo === 'final') $('.ex-info', li).append(el('small', { class: 'ex-estado' }, M.veredicto(est, Number(li.dataset.materia)).texto));
  }
  ul.append(...$$('[data-examen]', ul).sort(porImpacto));
}

for (const turno of $$('[data-turno]')) {
  const editable = $('[data-fecha-editable]', turno);
  if (turno.dataset.turno === 'finales') { // fechas por materia de la cuenta (se cargan en la Malla)
    const filas = M.examenesDeFinales(cargarFinales()).sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((e) => filaExamen({ ...e, etiqueta: 'Final' }));
    $('.vacio', turno).hidden = filas.length > 0;
    if (filas.length) { const ul = el('ul', { class: 'examenes' }, ...filas); $('.pendiente', turno).append(ul); actualizarExamenes(ul); }
    continue;
  }
  if (!editable) { const ul = $('.examenes', turno); if (ul) actualizarExamenes(ul); continue; }
  const id = turno.dataset.turno; const cont = $('.pendiente', turno);
  const input = $('input', editable);
  editable.hidden = false; input.value = fechas[id] ?? '';
  const pintarTurno = () => {
    $$('.examenes, [data-turno-cuenta]', cont).forEach((n) => n.remove());
    const f = fechas[id];
    $('.vacio', cont).hidden = !!f;
    if (!f) return;
    const dias = M.diasHasta(f);
    const filas = M.finalesPorImpacto(est).map(({ n }) => filaExamen({ fecha: f, materia: n, tipo: 'final', etiqueta: 'Final · ya cumplís las correlativas' }));
    cont.prepend(el('p', { class: 'suave', dataset: { turnoCuenta: '' } }, `Mesa: ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(M.parseFecha(f))} · ${dias < 0 ? 'ya pasó' : dias === 0 ? 'es hoy' : `faltan ${dias} ${dias === 1 ? 'día' : 'días'}`}`));
    const ul = el('ul', { class: 'examenes' }, ...(filas.length ? filas : [vacio('Hoy no tenés finales habilitados para este turno.')]));
    editable.before(ul);
    actualizarExamenes(ul);
  };
  input.addEventListener('change', () => {
    if (input.value) fechas[id] = input.value; else delete fechas[id];
    guardarFechas(fechas);
    pintarTurno();
  });
  pintarTurno();
}
