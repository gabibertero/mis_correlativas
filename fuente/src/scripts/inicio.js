// Dashboard: KPIs, avance por nivel, créditos, "qué puedo hacer ahora", cuenta regresiva, exportar/importar.
import { ELECTIVAS, CREDITOS_INGENIERIA, CREDITOS_ANALISTA } from '../data/plan.js';
import * as M from '../lib/motor.js';
import { cargarEstado, cargarFechas, cargarFinales, cargarElectivas, armarExport, validarImport, aplicarImport } from '../lib/progreso.js';
import { $, $$, el, etiquetaN, filaMateria, vacio, fmtFecha } from './comun.js';

const reemplazarLista = (cont, items, textoVacio) => {
  $$('ul, p.vacio', cont).forEach((n) => n.remove());
  cont.append(items.length ? el('ul', {}, ...items) : el('p', { class: 'vacio' }, textoVacio));
};

function pintar() {
  const est = cargarEstado();
  const r = M.resumen(est);
  const rend = M.rendibles(est);

  // KPIs + hero
  const kpi = (id, valor, label) => {
    const k = $(`[data-kpi="${id}"]`); if (!k) return;
    const v = $('[data-valor]', k);
    v.textContent = valor;
    if (typeof valor === 'number') v.dataset.objetivo = valor; // número crudo para animar
    if (label) $('.kpi-l', k).textContent = label;
  };
  kpi('aprobadas', r.aprobadas);
  kpi('avance', r.pct);
  kpi('promedio', r.promedio == null ? '—' : r.promedio.toFixed(2).replace('.', ','), `Promedio · ${r.notas} ${r.notas === 1 ? 'nota' : 'notas'}`);
  kpi('finales', r.finales);
  $('[data-kpi="finales"]').dataset.nivelUrgencia = r.urgencia; // ok | medio | alto (0 / 1-2 / 3+)
  kpi('proy-cursando', r.proyCursando.pct);
  kpi('proy-finales', r.proyFinales.pct);
  for (const [id, p] of [['proy-cursando', r.proyCursando], ['proy-finales', r.proyFinales]]) $(`[data-kpi="${id}"]`).dataset.n = p.n;
  $('[data-kpi-texto="aprobadas"]').textContent = r.aprobadas;
  const anillo = $('[data-anillo]');
  anillo.setAttribute('aria-label', `Avance de la carrera: ${r.pct} por ciento`);
  $('[data-anillo-valor]').textContent = r.pct;
  const arco = $('.valor', anillo);
  const C = Number(arco.getAttribute('stroke-dasharray'));
  arco.setAttribute('stroke-dashoffset', (C * (1 - r.pct / 100)).toFixed(1));

  // Niveles
  for (const n of M.resumenPorNivel(est)) {
    const li = $(`[data-nivel-bar="${n.nv}"]`); if (!li) continue;
    li.dataset.aprobadas = n.aprobadas; li.dataset.masCursando = n.masCursando; li.dataset.masFinales = n.masFinales;
    $('[data-ok]', li).textContent = n.aprobadas;
    $('[data-pct]', li).textContent = `${Math.round((n.aprobadas / n.total) * 100)}%`;
    for (const [c, v] of [['.b-ok', n.aprobadas], ['.b-cursando', n.masCursando], ['.b-finales', n.masFinales]]) $(c, li).style.width = `${(v / n.total) * 100}%`;
  }

  // Créditos
  const cr = M.creditos(cargarElectivas(), ELECTIVAS, est);
  for (const [id, v] of [['ing', cr.ing], ['analista', cr.analista]]) {
    const c = $(`[data-creditos="${id}"]`);
    $('[data-valor]', c).textContent = v;
    $('progress', c).value = Math.min(v, id === 'ing' ? CREDITOS_INGENIERIA : CREDITOS_ANALISTA);
  }

  // Qué puedo hacer ahora
  reemplazarLista($('[data-lista="cursar"]'), M.habilitadas(est).map((n) => filaMateria(n)), 'Nada habilitado por ahora.');
  reemplazarLista($('[data-lista="finales"]'), rend.map((n) => filaMateria(n)), 'Ningún final habilitado por ahora.');
  reemplazarLista($('[data-lista="destraba"]'), M.masDestraban(est).map(({ n, impacto }) => filaMateria(n, `destraba ${impacto}`)), 'Todo aprobado.');

  // Plan 2027 con el porqué
  for (const c of M.planProximoAnio(est)) {
    const sec = $(`[data-cuatri-plan="${c.id}"]`); if (!sec) continue;
    $('[data-hs]', sec).textContent = `${c.hs} hs`;
    reemplazarLista(sec, c.items.map((it) => el('li', { dataset: { materia: it.n, electiva: it.electiva ? 'si' : 'no' } },
      el('span', { class: 'n num' }, it.electiva ? 'E' : etiquetaN(it.n)),
      el('span', {}, it.electiva ? 'Electiva' : M.nombreCorto(it.n), el('small', { dataset: { razon: '' } }, it.razon)))), 'Sin materias propuestas.');
  }

  const examenes = M.examenesDeFinales(cargarFinales());
  // Próximos finales confirmados (ascendente desde hoy)
  const lf = $('[data-proximos-finales]');
  lf.replaceChildren(...M.proximosFinales(examenes, est).map((e) => el('li', { dataset: { materia: e.materia, fecha: e.fecha, tipo: e.tipo, ...(e.opcional && { opcional: 'si' }) } },
    el('time', { datetime: e.fecha }, fmtFecha(M.parseFecha(e.fecha))), el('strong', {}, M.nombreCorto(e.materia)), el('small', {}, e.etiqueta))));

  // Cuenta regresiva
  const sec = $('#cuenta-regresiva');
  $$('[data-countdown], p.vacio', sec).forEach((n) => n.remove());
  const p = M.proximaMesa(examenes, cargarFechas(), est);
  if (!p) { lf.before(el('p', { class: 'vacio' }, 'No hay mesas cargadas. Poné la fecha del final en cada materia, en la Malla.')); return; }
  lf.before(el('div', { dataset: { countdown: '', fecha: p.fecha, materia: p.materia ?? '' } },
    el('p', { class: 'cuenta-n' }, el('span', { class: 'num', dataset: { dias: '' } }, String(p.dias)), el('span', {}, p.dias === 1 ? 'día' : p.dias === 0 ? 'hoy' : 'días')),
    el('p', { class: 'cuenta-m' }, el('strong', {}, p.materia ? M.nombreCorto(p.materia) : p.etiqueta)),
    el('p', { class: 'suave' }, el('time', { datetime: p.fecha }, fmtFecha(M.parseFecha(p.fecha))), p.materia ? ` · ${p.etiqueta}` : '')));
}
pintar();

// Exportar / importar
const bExp = $('[data-accion="exportar"]'); const bImp = $('[data-accion="importar"]'); const archivo = $('[data-importar-archivo]');
const aviso = $('[data-estado-import]');
const decir = (t) => { aviso.textContent = t; aviso.toggleAttribute('data-error', t.startsWith('No se importó')); };
bExp.hidden = false; bImp.hidden = false;

bExp.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(armarExport(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `correlativas-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  decir('Listo: se descargó tu respaldo.');
});
bImp.addEventListener('click', () => archivo.click());
archivo.addEventListener('change', async () => {
  const f = archivo.files?.[0]; archivo.value = '';
  if (!f) return;
  let v;
  try { v = validarImport(await f.text()); } catch { v = { ok: false, error: 'No se pudo leer el archivo.' }; }
  if (!v.ok) { decir(`No se importó: ${v.error}`); return; }
  if (!confirm('Esto reemplaza el estado que tenés guardado en este navegador. ¿Seguimos?')) { decir('Importación cancelada.'); return; }
  aplicarImport(v.datos);
  pintar();
  decir(`Listo: se importó el respaldo (${Object.keys(v.datos.estado).length} materias con estado).`);
});
