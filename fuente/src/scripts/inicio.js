// Dashboard: KPIs, avance por nivel, créditos, "qué puedo hacer ahora", orden recomendado de finales, exportar/importar.
import { CREDITOS_INGENIERIA, CREDITOS_ANALISTA } from '../data/plan.js';
import { CATALOGO_ELECTIVAS, LICENCIATURAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import { PREFIJO, cargarEstado, cargarFinales, cargarElectivas, cargarLicenciatura, cargarOpcionesPlan, armarExport, validarImport, aplicarImport } from '../lib/progreso.js';
import { $, $$, el, etiquetaN, filaMateria, fmtFecha } from './comun.js';

// Nombres breves para listas compactas (el completo va para lectores de pantalla).
const BREVE = {
  1: 'AM I', 2: 'AGA', 3: 'Física I', 4: 'Inglés I', 5: 'Lógica', 6: 'AED', 7: 'Arquitectura', 8: 'Sist. y Procesos',
  9: 'AM II', 10: 'Física II', 11: 'Ing. y Sociedad', 12: 'Inglés II', 13: 'Sintaxis', 14: 'Paradigmas', 15: 'SO', 16: 'ASI', 17: 'Probabilidad',
  18: 'Economía', 19: 'Base de Datos', 20: 'Des. de Software', 21: 'COM', 22: 'Análisis Numérico', 23: 'Diseño de Sistemas',
  24: 'Legislación', 25: 'Calidad de Software', 26: 'Redes', 27: 'Inv. Operativa', 28: 'Simulación', 29: 'Automatización', 30: 'Adm. de SI',
  31: 'IA', 32: 'Ciencia de Datos', 33: 'Sist. de Gestión', 34: 'Gestión Gerencial', 35: 'Seguridad', 36: 'Proyecto Final', 99: 'Seminario',
};
const breve = (n) => BREVE[n] ?? M.nombreCorto(n);
const nombreBreve = (n) => (breve(n) === M.nombreCorto(n) ? breve(n)
  : [el('span', { 'aria-hidden': 'true' }, breve(n)), el('span', { class: 'sr-only' }, M.nombreCorto(n))]);
/** «AGA», «AGA y SO», «AGA, SO y ASI», «AGA, SO, ASI y 4 más». */
const enumerar = (ns, max = 3) => {
  const v = ns.slice(0, max).map(breve); const resto = ns.length - v.length;
  if (resto > 0) return `${v.join(', ')} y ${resto} más`;
  return v.length > 1 ? `${v.slice(0, -1).join(', ')} y ${v.at(-1)}` : v.join('');
};
const plural = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;

const reemplazarLista = (cont, items, textoVacio) => {
  $$('ul, p.vacio', cont).forEach((n) => n.remove());
  cont.append(items.length ? el('ul', {}, ...items) : el('p', { class: 'vacio' }, textoVacio));
};

function pintar() {
  const est = cargarEstado();
  const r = M.resumen(est);
  const rend = M.ordenarPorNivel(M.rendibles(est));

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
  // Cuáles son, agrupados por nivel (1º a 5º) y por Nº dentro de cada nivel.
  const nombres = $('[data-finales-nombres]');
  const porNivel = new Map();
  for (const n of rend) { const nv = M.itemDe(n).nivel; porNivel.set(nv, [...(porNivel.get(nv) ?? []), n]); }
  nombres.replaceChildren(...[...porNivel].map(([nv, ns]) => el('li', { dataset: { nivel: nv } },
    el('span', { class: 'kf-nv' }, `${nv}º nivel`, el('span', { class: 'sr-only' }, ':')),
    ...ns.map((n) => el('span', { class: 'kf-m', dataset: { materia: n }, title: M.nombreCorto(n) }, ...[nombreBreve(n)].flat())))));
  nombres.hidden = !rend.length;
  kpi('proy-cursando', r.proyCursando.pct);
  kpi('proy-finales', r.proyFinales.pct);
  for (const [id, n] of [['avance', r.aprobadas], ['proy-cursando', r.proyCursando.n], ['proy-finales', r.proyFinales.n]]) {
    const paso = $(`[data-kpi="${id}"]`);
    paso.dataset.n = n;
    paso.dataset.total = r.total;
    $('[data-paso-cantidad]', paso).textContent = `${n} de ${r.total} materias`;
  }
  $('[data-kpi-texto="aprobadas"]').textContent = r.aprobadas;
  $('[data-anillo-resumen]').textContent = `${r.aprobadas} de ${r.total} materias`;
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
  const licenciatura = cargarLicenciatura();
  const cr = M.creditos(cargarElectivas(), CATALOGO_ELECTIVAS, est, licenciatura);
  const trayecto = $('[data-trayecto-resumen]');
  if (trayecto) trayecto.textContent = LICENCIATURAS.find((l) => l.id === licenciatura)?.nombre ?? 'Sin licenciatura elegida';
  for (const [id, v] of [['ing', cr.ing], ['analista', cr.analista]]) {
    const c = $(`[data-creditos="${id}"]`);
    $('[data-valor]', c).textContent = v;
    $('progress', c).value = Math.min(v, id === 'ing' ? CREDITOS_INGENIERIA : CREDITOS_ANALISTA);
  }

  // Qué puedo hacer ahora
  reemplazarLista($('[data-lista="cursar"]'), M.habilitadas(est).map((n) => filaMateria(n)), 'Nada habilitado por ahora.');
  reemplazarLista($('[data-lista="finales"]'), rend.map((n) => filaMateria(n)), 'Ningún final habilitado por ahora.');
  reemplazarLista($('[data-lista="destraba"]'), M.masDestraban(est).map(({ n, impacto }) => filaMateria(n, `${impacto} dependencias potenciales · revisá si exigen regularidad o aprobación en la malla`)), 'Todo aprobado.');

  // Plan 2027 con el porqué
  for (const c of M.planProximoAnio(est, undefined, cargarOpcionesPlan())) {
    const sec = $(`[data-cuatri-plan="${c.id}"]`); if (!sec) continue;
    $('[data-hs]', sec).textContent = `${c.hs} hs`;
    reemplazarLista(sec, c.items.map((it) => el('li', { dataset: { materia: it.n, electiva: it.electiva ? 'si' : 'no' } },
      el('span', { class: 'n num' }, it.electiva ? 'E' : etiquetaN(it.n)),
      el('span', {}, it.electiva ? 'Electiva' : M.nombreCorto(it.n), el('small', { dataset: { razon: '' } }, it.razon)))), 'Sin materias propuestas.');
  }

  // Orden recomendado de finales: primero los que más materias traban a futuro.
  const fechas = cargarFinales();
  const orden = M.recomendacionFinales(est);
  const lo = $('[data-orden-finales]');
  lo.replaceChildren(...orden.map((f) => {
    const fecha = fechas[f.n] && M.diasHasta(fechas[f.n]) >= 0 ? fechas[f.n] : null;
    const antes = f.falta && [
      f.falta.regularizar.length && `regularizar ${enumerar(f.falta.regularizar)}`,
      f.falta.aprobar.length && `aprobar ${enumerar(f.falta.aprobar)}`,
      ...f.falta.extra.filter((x) => x.startsWith('PPS')),
    ].filter(Boolean).join(' y ');
    return el('li', { dataset: { materia: f.n, posicion: f.posicion, traba: f.traba, trabaDirectas: f.trabaDirectas, rendible: f.rendible ? 'si' : 'no' } },
      el('span', { class: 'of-pos num', 'aria-hidden': 'true' }, String(f.posicion), el('small', {}, 'º')),
      el('strong', { class: 'of-nombre' }, M.nombreCorto(f.n)),
      el('p', { class: 'of-traba' }, f.traba ? `Traba ${plural(f.traba, 'materia', 'materias')}` : 'No traba otras materias',
        f.trabaDirectas ? el('small', {}, ` · ${plural(f.trabaDirectas, 'pide', 'piden')} su final`) : null),
      el('p', { class: 'of-estado' },
        f.rendible ? el('span', { class: 'insignia-hab' }, 'Podés rendirla') : el('span', { class: 'of-antes' }, antes ? `Antes: ${antes}` : 'Todavía no se puede rendir'),
        fecha ? el('time', { class: 'of-fecha', datetime: fecha }, `Mesa: ${fmtFecha(M.parseFecha(fecha))}`) : null));
  }));
  lo.hidden = !orden.length;
  $('[data-orden-vacio]').hidden = !!orden.length;
}
pintar();
// Al volver atrás el navegador puede restaurar el DOM anterior sin ejecutar de nuevo el script.
addEventListener('pageshow', (ev) => { if (ev.persisted) pintar(); });
const clavesResumen = new Set(['estado', 'electivas', 'finales', 'fechas', 'licenciatura', 'opcionesPlan'].map((c) => PREFIJO + c));
addEventListener('storage', (ev) => { if (ev.key === null || clavesResumen.has(ev.key)) pintar(); });

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
