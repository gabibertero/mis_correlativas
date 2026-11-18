// Planificador: cursado y finales explícitos, con intensivos optativos de febrero.
import { MATERIAS, CREDITOS_INGENIERIA } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import { cargarEstado, cargarElectivas, cargarPlan, guardarPlan, cargarRecursar, guardarRecursar, cargarFechas, guardarFechas, cargarFinales, cargarLicenciatura, cargarOpcionesPlan, guardarOpcionesPlan, cargarNombre, CUATRIS, CUATRIS_VISIBLES } from '../lib/progreso.js';
import { $, $$, el, chip, etiquetaN, vacio, textoDias } from './comun.js';

const electEst = cargarElectivas();
const est = M.conElectivas(cargarEstado(), electEst);
const licenciatura = cargarLicenciatura();
const catalogo = CATALOGO_ELECTIVAS.filter((e) => !e.licenciatura || e.licenciatura === licenciatura);
const licElegida = LICENCIATURAS.find((l) => l.id === licenciatura) ?? null;
const nombreLic = (id) => (LICENCIATURAS.find((l) => l.id === id)?.nombre ?? 'Licenciatura').replace(/^Licenciatura en /, 'Lic. ');
/** obligatoria · electiva (habitual) · licenciatura: define color, cajita y créditos. */
const tipoDe = (n) => (!M.esElectiva(n) ? 'obligatoria' : M.electivaPorId[n].licenciatura ? 'licenciatura' : 'electiva');
/** Créditos que sumarían las electivas de `ns` si se aprueban: sin las ya aprobadas ni las de otra licenciatura. */
const creditosPlanificados = (ns) => [...new Set(ns)].filter((n) => M.esElectiva(n)).map((n) => M.electivaPorId[n])
  .filter((e) => (!e.licenciatura || e.licenciatura === licenciatura) && electEst[M.slug(e.nombre)] !== 'aprobada')
  .reduce((a, e) => a + e.creditos, 0);
const opciones = cargarOpcionesPlan();
opciones.veranoExtrasPorAnio ??= {};
const ANIOS_VERANO = CUATRIS.filter(M.esVerano).map((id) => id.slice(0, 4));
const extrasDeAnio = (anio) => [...new Set([...(opciones.veranoExtrasPorAnio[anio] ?? []), ...(String(anio) === '2027' ? opciones.veranoExtras : [])])];
const fechas = cargarFechas();
const clave = (v) => (/^\d+$/.test(v) ? Number(v) : v);
const actuales = [...MATERIAS.map((m) => m.n), ...catalogo.map(M.idElectiva)].filter((n) => M.estadoDe(est, n) === 'cursando');
const plan = cargarPlan() ?? { [CUATRIS[0]]: actuales };
for (const id of CUATRIS) plan[id] ??= [];
// Migración: un febrero con materias guardadas queda sumado aunque venga del interruptor viejo.
const conMaterias = CUATRIS.filter((id) => M.esVerano(id) && plan[id].length).map((id) => id.slice(0, 4)).filter((a) => !opciones.veranos.includes(a));
if (conMaterias.length) { opciones.veranos = [...opciones.veranos, ...conMaterias].sort(); guardarOpcionesPlan(opciones); }
const recursar = new Set(cargarRecursar());
const guardarMarcas = () => {
  for (const n of [...recursar]) if (!Object.values(plan).some((ns) => ns.includes(n))) recursar.delete(n);
  guardarRecursar([...recursar]);
};
const HS_LIMITE = 30;
const arts = $$('[data-cuatri]');
const ids = arts.map((a) => a.dataset.cuatri);
const nombreDe = (id) => M.nombrePeriodo(id);
const itemDe = (n) => M.porN[n] ?? M.electivaPorId[n];
const periodosActivos = () => ids.filter((id) => !M.esVerano(id) || M.veranoActivo(opciones, id) || plan[id].length);
let visibles = CUATRIS_VISIBLES;
const decir = (t) => { const a = $('[data-estado-plan]'); if (a) a.textContent = t; };
const guardarOpciones = () => guardarOpcionesPlan(opciones);

const SIN_DEUDA = { reg: [], aprob: [] };
/** «Para cursar · Regular: … · Final aprobado: …», con lo que debés resaltado (mark.deuda). */
function textoRequisitos(n, deudas = SIN_DEUDA) {
  const m = itemDe(n);
  if (m.correlativasConfirmadas === false) return el('small', { class: 'requisitos-plan' }, 'Acceso al trayecto: Diseño regular o aprobada. Correlativas propias y dictado por confirmar.');
  const nombre = (r, tipo) => (deudas[tipo].includes(r)
    ? [el('mark', { class: 'deuda', dataset: { deuda: tipo, materia: r } }, M.nombreCorto(r)), el('span', { class: 'sr-only' }, tipo === 'reg' ? ' (la debés: regularizala)' : ' (debés el final)')]
    : [M.nombreCorto(r)]);
  const lista = (rs, tipo) => rs.flatMap((r, k) => (k ? [', ', ...nombre(r, tipo)] : nombre(r, tipo)));
  const partes = [];
  if (m.reg.length) partes.push(['Regular: ', ...lista(m.reg, 'reg')]);
  if (m.aprob.length) partes.push(['Final aprobado: ', ...lista(m.aprob, 'aprob')]);
  return el('small', { class: 'requisitos-plan' }, ...(partes.length ? ['Para cursar · ', ...partes.flatMap((p, k) => (k ? [' · ', ...p] : p))] : ['Para cursar: sin correlativas.']));
}

function filaMateriaPlan(n, i, proyDeuda) {
  const elec = M.esElectiva(n); const m = itemDe(n); const tipo = tipoDe(n);
  const rec = recursar.has(n);
  // Solo para cursados futuros (no lo que ya cursás o tenés regular sin recursar).
  const deudas = proyDeuda && (M.sinCursar(M.estadoDe(est, n)) || rec) ? M.deudasDe(est, proyDeuda, n) : SIN_DEUDA;
  const debe = deudas.reg.length + deudas.aprob.length > 0;
  const activos = periodosActivos(); const pos = activos.indexOf(ids[i]);
  const resultado = opciones.resultados[n] ?? opciones.resultado;
  const resultadoSelect = el('select', { dataset: { resultadoPlan: '', materia: n }, 'aria-label': `Resultado previsto de ${M.nombreCorto(n)}` },
    el('option', { value: 'regular' }, 'Solo regularizar'), el('option', { value: 'aprobada' }, 'Aprobar final / directa'));
  resultadoSelect.value = resultado;
  return el('li', { draggable: 'true', dataset: { materia: n, hs: M.hsDe(n), recursar: rec ? 'si' : 'no', tipo, ...(elec && { electiva: 'si' }), ...(debe && { deuda: 'si' }) } },
    el('span', { class: 'n num', ...(elec && { 'aria-hidden': 'true' }) }, tipo === 'electiva' ? 'E' : tipo === 'licenciatura' ? 'L' : etiquetaN(n)),
    el('span', { class: 's-nom' }, M.nombreCorto(n),
      elec ? el('small', { class: 'insignias-plan' },
        el('span', { class: 'insignia-tipo' }, tipo === 'licenciatura' ? nombreLic(m.licenciatura) : 'Electiva'),
        el('span', { class: 'insignia-cr', dataset: { sinCreditos: m.creditos > 0 ? 'no' : 'si' } }, m.creditos > 0 ? `+${m.creditos} créditos` : 'No suma créditos')) : el('small', {}, `${m.hs} hs semanales de referencia`),
      el('small', { class: 'modalidad', dataset: { modalidad: M.esVerano(ids[i]) ? 'Intensivo en febrero' : M.modalidadInfo(m).label } }, M.esVerano(ids[i]) ? 'Intensivo en febrero · oferta a confirmar' : M.modalidadInfo(m).label || 'Dictado a confirmar'),
      !M.esVerano(ids[i]) && M.esContracuatri(n, ids[i]) ? el('small', { class: 'contra-cuatri', dataset: { contracuatri: 'si' } }, 'Contracuatrimestre: menos cátedras') : null,
      debe ? el('small', { class: 'etiqueta-deuda' }, 'Depende de algo que debés') : null,
      textoRequisitos(n, deudas),
      m.licenciatura && m.licenciatura !== licenciatura ? el('small', { class: 'contra-cuatri' }, 'Materia de otra licenciatura: no suma créditos a la selección actual.') : null,
      rec ? el('small', { class: 'marca-recursar', dataset: { marca: 'recursar' } }, 'Recursar') : null),
    chip(M.estadoDe(est, n)),
    el('button', { type: 'button', class: 'toggle-recursar', 'aria-pressed': String(rec), 'aria-label': `Recursar ${M.nombreCorto(n)}`, dataset: { accion: 'recursar', materia: n } }, 'Recursar'),
    el('span', { class: 'mover' },
      el('button', { type: 'button', class: 'paso-mover', disabled: pos <= 0, 'aria-label': `Mover ${M.nombreCorto(n)} al período anterior`, dataset: { accion: 'mover-anterior', materia: n } }, 'Anterior'),
      el('button', { type: 'button', class: 'paso-mover', disabled: pos >= activos.length - 1, 'aria-label': `Mover ${M.nombreCorto(n)} al período siguiente`, dataset: { accion: 'mover-siguiente', materia: n } }, 'Siguiente'),
      el('button', { type: 'button', class: 'quitar', 'aria-label': `Quitar ${M.nombreCorto(n)} de ${nombreDe(ids[i])}`, dataset: { accion: 'quitar-materia', materia: n } }, 'Quitar')),
    el('label', { class: 'resultado-plan' }, 'Resultado previsto al terminar el cursado', resultadoSelect));
}

const BASICAS_VERANO = new Set(M.ofertaVerano({}));
function pintarVeranos() {
  const libres = ANIOS_VERANO.filter((a) => !opciones.veranos.includes(a));
  const sel = $('[data-verano-sumar-anio]');
  sel.replaceChildren(...(libres.length ? libres.map((a) => el('option', { value: a }, `Febrero ${a}`)) : [el('option', { value: '' }, 'Ya sumaste todos')]));
  sel.disabled = !libres.length; $('[data-accion="sumar-verano"]').disabled = !libres.length;
  $('[data-veranos-activos]').replaceChildren(...opciones.veranos.map((a) => el('li', {}, `Febrero ${a}`,
    el('button', { type: 'button', dataset: { quitarVerano: a }, 'aria-label': `Quitar intensivo de febrero ${a}` }, 'Quitar'))));
  for (const art of arts.filter((a) => a.dataset.verano === 'si')) {
    const anio = art.dataset.cuatri.slice(0, 4);
    const activo = M.veranoActivo(opciones, art.dataset.cuatri);
    $('[data-accion="quitar-verano"]', art).hidden = !activo;
    $('[data-accion="quitar-verano"]', art).setAttribute('aria-label', `Quitar intensivo de febrero ${anio}`);
    $('[data-oferta-verano]', art).hidden = !activo;
    $('[data-verano-extra]', art).replaceChildren(el('option', { value: '' }, 'Elegí una materia…'), ...MATERIAS.filter((m) => !m.opcional && !BASICAS_VERANO.has(m.n) && !extrasDeAnio(anio).includes(m.n)).map((m) => el('option', { value: m.n }, m.nombre)));
    $('[data-verano-extras]', art).replaceChildren(...extrasDeAnio(anio).map((n) => el('li', {}, M.nombreCorto(n),
      el('button', { type: 'button', dataset: { accion: 'quitar-oferta', materia: n }, 'aria-label': `Quitar oferta de febrero ${anio} de ${M.nombreCorto(n)}` }, 'Quitar'))));
  }
}

function pintarOpciones() {
  pintarVeranos();
  const finales = [...MATERIAS.map((m) => m.n), ...catalogo.map(M.idElectiva)].filter((n) => ['regular', 'recursando', 'promocion'].includes(M.estadoDe(est, n)));
  $('[data-finales-previstos]').replaceChildren(...(finales.length ? finales.map((n) => {
    const input = el('input', { type: 'checkbox', value: n, dataset: { finalPrevisto: '' } });
    input.checked = opciones.finalesPrevistos.includes(n);
    return el('label', {}, input, el('span', {}, M.nombreCorto(n), el('small', {}, M.puedeRendirFinal(est, n) ? 'Hoy tenés el final habilitado' : 'Se proyectará solo si se cumplen sus requisitos')));
  }) : [el('p', { class: 'suave' }, 'No tenés materias regulares con finales para proyectar.') ]));
}

function pintarCuatris() {
  const activos = periodosActivos();
  const ultimo = activos.findLastIndex((id) => plan[id].length);
  // Siempre a la vista: los CUATRIS_VISIBLES primeros cuatrimestres comunes y todo febrero sumado.
  const base = activos.indexOf(ids.filter((id) => !M.esVerano(id))[CUATRIS_VISIBLES - 1]) + 1;
  const ultimoVerano = activos.findLastIndex((id) => M.esVerano(id));
  visibles = Math.min(activos.length, Math.max(visibles, base, ultimo + 1, ultimoVerano + 1));
  const usadas = new Set(Object.values(plan).flat());
  arts.forEach((art, i) => {
    const id = ids[i]; const ns = plan[id]; const verano = M.esVerano(id);
    const oferta = new Set(M.ofertaVerano(opciones, id));
    const rango = activos.indexOf(id);
    art.hidden = rango < 0 || rango >= visibles;
    const cont = M.continuan(est, plan, ids, i, opciones);
    $('[data-slot-lista]', art).replaceChildren(...(ns.length || cont.length ? [
      ...cont.map((n) => el('li', { class: 'continua', dataset: { materia: n, continua: 'si' } }, el('span', { class: 'n num' }, M.esElectiva(n) ? 'E' : etiquetaN(n)),
        el('span', { class: 's-nom' }, M.nombreCorto(n), el('small', {}, `Anual: continúa el cursado · ${M.hsDe(n)} hs de referencia`)))),
      ...(() => { const proy = M.proyeccionDeudas(est, plan, ids, i, opciones); return M.ordenarPlan(ns).map((n) => filaMateriaPlan(n, i, proy)); })()] : [vacio(verano ? 'Sin intensivos. Usá febrero solo si decidís cursar y hay oferta.' : 'Sin materias. Agregá las que quieras cursar.')]));
    const hs = M.horasCuatri(est, plan, ids, i, opciones);
    const limite = Number(art.dataset.hsLimite);
    $('[data-hs-total]', art).textContent = verano ? ns.length : hs;
    $('[data-carga-label]', art).textContent = verano ? (ns.length === 1 ? 'materia intensiva en febrero' : 'materias intensivas en febrero') : `de ${limite} unidades de carga orientativa`;
    $('[data-carga-aclaracion]', art).textContent = verano ? 'La carga y la oferta de febrero se confirman cada año. No equivale a las horas semanales del cursado normal.' : 'Obligatorias: horas semanales de referencia. Electivas: créditos como orientación de carga, no horas reales.';
    $('progress', art).hidden = verano;
    $('progress', art).value = hs;
    art.dataset.sobrecarga = hs > limite ? 'si' : 'no';
    const crPeriodo = creditosPlanificados(ns);
    const crP = $('[data-creditos-periodo]', art);
    crP.hidden = !crPeriodo;
    crP.textContent = crPeriodo ? `+${crPeriodo} créditos electivos en este período, si aprobás sus electivas.` : '';
    const avisos = M.avisosCuatri(est, plan, ids, i, limite, recursar, opciones);
    if (ns.some((n) => itemDe(n).licenciatura && itemDe(n).licenciatura !== licenciatura)) avisos.push('Este período conserva materias de una licenciatura que no está elegida; no suman créditos al trayecto actual.');
    const ul = $('[data-avisos]', art); ul.setAttribute('role', 'status');
    ul.replaceChildren(...avisos.map((t) => el('li', {}, t)));
    const ofrecida = (n) => !verano || oferta.has(n);
    const materias = MATERIAS.filter((m) => !usadas.has(m.n) && ofrecida(m.n) && (M.sinCursar(M.estadoDe(est, m.n)) || M.estadoDe(est, m.n) === 'cursando'));
    const electivas = catalogo.filter((e) => !usadas.has(M.idElectiva(e)) && ofrecida(M.idElectiva(e)) && (M.sinCursar(M.estadoDe(est, M.idElectiva(e))) || M.estadoDe(est, M.idElectiva(e)) === 'cursando') && (!e.desde || Number(id.slice(0, 4)) >= e.desde));
    const habituales = electivas.filter((e) => !e.licenciatura);
    const deLic = electivas.filter((e) => e.licenciatura);
    const opcionElectiva = (e) => el('option', { value: M.idElectiva(e) }, `${e.nombre} (${e.creditos > 0 ? `+${e.creditos} cr` : 'sin créditos'})`);
    const grupoLic = verano ? null
      : !licElegida ? el('optgroup', { label: 'Licenciatura' }, el('option', { value: '', disabled: true }, 'Elegí tu licenciatura en la página Licenciaturas'))
      : el('optgroup', { label: `${licElegida.nombre} · suman créditos` }, ...(deLic.length ? deLic.map(opcionElectiva) : [el('option', { value: '', disabled: true }, licElegida.materias.length ? 'Ya están todas en tu plan o no se dictan este año' : 'Sin materias publicadas todavía')]));
    const recursables = [...MATERIAS.map((m) => m.n), ...catalogo.map(M.idElectiva)].filter((n) => !usadas.has(n) && ofrecida(n) && ['regular', 'recursando', 'promocion'].includes(M.estadoDe(est, n)));
    $('[data-campo="materia"]', art).replaceChildren(el('option', { value: '' }, 'Elegí una materia…'),
      el('optgroup', { label: verano ? `Intensivos posibles de febrero ${id.slice(0, 4)} (a confirmar)` : 'Materias del plan' }, ...materias.map((m) => el('option', { value: m.n }, `${etiquetaN(m.n)} · ${m.nombre}${m.opcional ? ' (opcional)' : ''}`))),
      habituales.length ? el('optgroup', { label: 'Electivas · suman créditos' }, ...habituales.map(opcionElectiva)) : null,
      grupoLic,
      el('optgroup', { label: 'Volver a cursar (opcional)' }, ...recursables.map((n) => el('option', { value: n, dataset: { recursar: 'si' } }, M.nombreCorto(n)))));
  });
  $('[data-accion="sumar-cuatri"]').disabled = visibles >= activos.length;
  pintarCreditos();
  pintarWhatsApp();
}

// ---------- Mensaje para WhatsApp ----------
const anioMensaje = M.anioAMandar(new Date());
const textoWhatsApp = () => M.textoPlanWhatsApp(est, plan, anioMensaje, opciones, { nombre: cargarNombre(), recursar: [...recursar] });
function pintarWhatsApp() {
  const t = textoWhatsApp(); const b = $('[data-accion="copiar-whatsapp"]');
  b.textContent = `Copiar plan ${anioMensaje} para WhatsApp`;
  b.disabled = !t;
  const ayuda = $('[data-whatsapp-ayuda]');
  ayuda.hidden = !!t;
  ayuda.textContent = t ? '' : `Todavía no planificaste materias para ${anioMensaje}. Sumalas a febrero, 1º o 2º cuatrimestre ${anioMensaje} para armar el mensaje.`;
  $('[data-whatsapp-vista]').hidden = !t;
  $('[data-whatsapp-texto]').textContent = t;
}
async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso o sin API: probamos el método viejo */ }
  const ta = el('textarea', { readonly: true, class: 'sr-only', 'aria-hidden': 'true' });
  ta.value = texto; document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

function pintarCreditos() {
  const caja = $('[data-creditos-plan]'); caja.hidden = false;
  const hoy = M.creditos(electEst, CATALOGO_ELECTIVAS, est, licenciatura).ing;
  const plan_ = creditosPlanificados(Object.values(plan).flat());
  const total = hoy + plan_; const meta = CREDITOS_INGENIERIA;
  const pct = (x) => `${Math.min(100, (x / meta) * 100).toFixed(1)}%`;
  $('[data-cr-hoy]', caja).textContent = hoy;
  $('[data-cr-plan]', caja).textContent = plan_;
  $('[data-cr-total]', caja).textContent = total;
  $('[data-cr-barra-hoy]', caja).style.width = pct(hoy);
  $('[data-cr-barra-plan]', caja).style.width = pct(Math.min(plan_, Math.max(0, meta - hoy)));
  $('[data-cr-texto]', caja).textContent = !plan_
    ? (hoy >= meta ? `Ya cumplís los ${meta} créditos de Ingeniería.` : 'Sumá electivas o materias de tu licenciatura al plan para proyectar cuántos créditos te faltan.')
    : total >= meta ? `Si aprobás las planificadas, llegás a ${total} de ${meta}: cumplís los créditos de Ingeniería.`
      : `Si aprobás las planificadas, llegás a ${total} de ${meta}. Te faltarían ${meta - total}.`;
  $('[data-cr-lic]', caja).hidden = !!licElegida;
}

function cambiarPlan(id, ns) {
  plan[id] = ns; guardarPlan(plan); guardarMarcas(); pintarCuatris();
  $(`[data-cuatri="${id}"] [data-campo="materia"]`).focus();
}
function mover(n, desde, hacia) {
  if (desde === hacia || !plan[desde]?.includes(n) || !plan[hacia]) return false;
  plan[desde] = plan[desde].filter((x) => x !== n); plan[hacia] = [...plan[hacia], n];
  visibles = Math.max(visibles, periodosActivos().indexOf(hacia) + 1);
  guardarPlan(plan); pintarCuatris();
  const av = M.avisosCuatri(est, plan, ids, ids.indexOf(hacia), HS_LIMITE, recursar, opciones).length;
  decir(`Moviste ${M.nombreCorto(n)} a ${nombreDe(hacia)}.${av ? ` Revisá los ${av} avisos del período.` : ' Sin avisos de correlativas.'}`);
  return true;
}

arts.forEach((art) => {
  const id = art.dataset.cuatri;
  $('[data-agregar]', art).hidden = false;
  $('[data-accion="agregar-materia"]', art).addEventListener('click', () => {
    const select = $('[data-campo="materia"]', art); const n = clave(select.value);
    if (!n) return;
    if (select.selectedOptions[0]?.dataset.recursar === 'si') recursar.add(n);
    cambiarPlan(id, [...plan[id], n]);
  });
  art.addEventListener('change', (ev) => {
    const select = ev.target.closest('[data-resultado-plan]'); if (!select) return;
    opciones.resultados[select.dataset.materia] = select.value;
    guardarOpciones(); pintarCuatris();
    decir('Resultado previsto actualizado. Los estados reales no cambiaron.');
  });
  art.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]'); if (!b) return;
    const n = clave(b.dataset.materia ?? '');
    if (b.dataset.accion === 'recursar') {
      if (recursar.has(n)) recursar.delete(n); else recursar.add(n);
      guardarMarcas(); pintarCuatris();
      $(`[data-cuatri="${id}"] [data-accion="recursar"][data-materia="${n}"]`)?.focus();
    } else if (b.dataset.accion === 'quitar-materia') cambiarPlan(id, plan[id].filter((x) => x !== n));
    else if (b.dataset.accion === 'quitar-verano') quitarVerano(id.slice(0, 4));
    else if (b.dataset.accion === 'confirmar-verano-extra') {
      const anio = id.slice(0, 4); const sel = $('[data-verano-extra]', art); const m = Number(sel.value);
      if (!m || extrasDeAnio(anio).includes(m)) return;
      opciones.veranoExtrasPorAnio[anio] = [...extrasDeAnio(anio), m];
      guardarOpciones(); pintarOpciones(); pintarCuatris();
      decir(`Confirmaste ${M.nombreCorto(m)} para febrero ${anio}. Solo vale para ese año.`);
      $('[data-verano-extra]', art).focus();
    } else if (b.dataset.accion === 'quitar-oferta') {
      const anio = id.slice(0, 4);
      opciones.veranoExtrasPorAnio[anio] = extrasDeAnio(anio).filter((x) => x !== n);
      if (anio === '2027') opciones.veranoExtras = opciones.veranoExtras.filter((x) => x !== n);
      guardarOpciones(); pintarOpciones(); pintarCuatris();
      decir(`Quitaste la oferta de ${M.nombreCorto(n)} para febrero ${anio}.`);
      $('[data-verano-extra]', art).focus();
    }
    else if (b.dataset.accion === 'mover-anterior' || b.dataset.accion === 'mover-siguiente') {
      const activos = periodosActivos(); const pos = activos.indexOf(id);
      const hacia = activos[pos + (b.dataset.accion === 'mover-anterior' ? -1 : 1)];
      if (hacia && mover(n, id, hacia)) $(`[data-cuatri="${hacia}"] [data-accion="quitar-materia"][data-materia="${n}"]`)?.focus();
    }
  });
  art.addEventListener('dragstart', (ev) => {
    const li = ev.target.closest?.('li[draggable]'); if (!li) return;
    ev.dataTransfer.setData('text/plain', `${li.dataset.materia}:${id}`); ev.dataTransfer.effectAllowed = 'move'; li.dataset.arrastrando = '';
  });
  art.addEventListener('dragend', () => { $$('[data-arrastrando]').forEach((x) => delete x.dataset.arrastrando); $$('[data-drop-activo]').forEach((x) => delete x.dataset.dropActivo); });
  art.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; art.dataset.dropActivo = ''; });
  art.addEventListener('dragleave', (ev) => { if (!art.contains(ev.relatedTarget)) delete art.dataset.dropActivo; });
  art.addEventListener('drop', (ev) => {
    ev.preventDefault(); delete art.dataset.dropActivo;
    const t = ev.dataTransfer.getData('text/plain') || ''; const k = t.lastIndexOf(':'); const desde = t.slice(k + 1);
    if (ids.includes(desde)) mover(clave(t.slice(0, k)), desde, id);
  });
});

$('[data-herramientas]').hidden = false;
function quitarVerano(anio) {
  const id = `${anio}-VER`; const ns = plan[id] ?? [];
  if (ns.length && !confirm(`Febrero ${anio} tiene ${ns.length === 1 ? '1 materia' : `${ns.length} materias`} (${ns.map(M.nombreCorto).join(', ')}). Si quitás el intensivo, salen del plan. ¿Seguimos?`)) { decir('No se quitó el intensivo.'); return; }
  plan[id] = []; opciones.veranos = opciones.veranos.filter((a) => a !== anio);
  guardarPlan(plan); guardarMarcas(); guardarOpciones(); pintarOpciones(); pintarCuatris();
  decir(`Quitaste el intensivo de febrero ${anio}.${ns.length ? ' Sus materias salieron del plan.' : ''}`);
  $('[data-verano-sumar-anio]').focus();
}
$('[data-accion="sumar-verano"]').addEventListener('click', () => {
  const anio = $('[data-verano-sumar-anio]').value; if (!anio || opciones.veranos.includes(anio)) return;
  opciones.veranos = [...opciones.veranos, anio].sort();
  guardarOpciones();
  const rango = periodosActivos().indexOf(`${anio}-VER`);
  if (rango < visibles) visibles++;
  pintarOpciones(); pintarCuatris();
  decir(`Sumaste el intensivo de febrero ${anio}. La oferta de febrero se confirma cada año con la Facultad.`);
  const art = $(`[data-cuatri="${anio}-VER"]`);
  art?.scrollIntoView({ block: 'nearest' }); $('[data-campo="materia"]', art)?.focus();
});
$('[data-veranos-activos]').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-quitar-verano]'); if (b) quitarVerano(b.dataset.quitarVerano);
});
$('[data-finales-previstos]').addEventListener('change', (ev) => {
  if (!ev.target.matches('[data-final-previsto]')) return;
  opciones.finalesPrevistos = $$('[data-final-previsto]:checked').map((input) => clave(input.value));
  guardarOpciones(); pintarCuatris();
  decir('Se actualizó la proyección de finales; el motor verificará sus requisitos antes de darlos por aprobados.');
});
$('[data-accion="copiar-whatsapp"]').addEventListener('click', async (ev) => {
  const b = ev.currentTarget; const t = textoWhatsApp(); if (!t) return;
  const ok = await copiarTexto(t);
  b.focus();
  if (ok) decir(`Copiado: pegalo en WhatsApp. Es tu plan ${anioMensaje}.`);
  else { $('[data-whatsapp-vista]').open = true; decir('No se pudo copiar solo: abrí «Ver el mensaje», seleccioná el texto y copialo.'); }
});
$('[data-accion="sumar-cuatri"]').addEventListener('click', () => {
  visibles++; pintarCuatris();
  $(`[data-cuatri="${periodosActivos()[visibles - 1]}"]`)?.scrollIntoView({ block: 'nearest' });
});
$('[data-accion="proponer-plan"]').addEventListener('click', () => {
  if (ids.slice(1).some((id) => plan[id].length) && !confirm('Esto reemplaza los períodos futuros de tu plan. Conserva el cursado del primer período. ¿Seguimos?')) { decir('Propuesta cancelada.'); return; }
  const r = M.proponerPlan(est, periodosActivos(), { ...opciones, hsLimite: HS_LIMITE, fijo: plan[ids[0]] });
  for (const id of ids) plan[id] = r.plan[id] ?? [];
  guardarPlan(plan); guardarMarcas(); visibles = CUATRIS_VISIBLES; pintarCuatris();
  decir(r.sinUbicar.length
    ? `Propuesta parcial: quedan sin ubicar ${r.sinUbicar.map(M.nombreCorto).join(', ')}. Revisá los finales previstos, la oferta y la carga disponible.`
    : 'Propuesta de cursado armada. Revisá los resultados previstos y sumá las electivas que elijas. Completar este plan no acredita por sí solo los créditos electivos ni la PPS.');
});
pintarOpciones(); pintarCuatris();

// ---------- Finales por turno ----------
const mesCorto = (d) => new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(d).replace('.', '');
const porImpacto = (a, b) => (a.dataset.pasado === 'si') - (b.dataset.pasado === 'si') || b.dataset.impacto - a.dataset.impacto || a.dataset.fecha.localeCompare(b.dataset.fecha);

function filaExamen({ fecha, materia, tipo, etiqueta, opcional }) {
  const d = M.parseFecha(fecha);
  return el('li', { class: 'examen', dataset: { examen: '', fecha, materia, tipo, opcional: opcional ? 'si' : 'no', impacto: M.destraba(materia).size } },
    el('time', { class: 'fecha', datetime: fecha }, el('span', { class: 'num' }, String(d.getDate())), mesCorto(d)),
    el('span', { class: 'ex-info' }, el('strong', {}, M.nombreCorto(materia)), el('small', {}, etiqueta)),
    el('span', { class: 'ex-meta' }, M.destraba(materia).size > 0 ? el('span', { class: 'impacto', title: 'Dependencias directas e indirectas; no significa que se habiliten todas al aprobar este final' }, `${M.destraba(materia).size} dependencias potenciales`) : null, el('span', { class: 'dias', dataset: { dias: '' } })));
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
