// Capa de presentación (sin lógica de dominio): count-up de porcentajes, barras de progreso y colores de la mini-malla del Home.
// Se apoya en los hooks que deja inicio.js (data-objetivo) y se apaga con prefers-reduced-motion.
import { cargarEstado } from '../lib/progreso.js';
import * as M from '../lib/motor.js';

const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const suave = (t) => 1 - (1 - t) ** 3;

/** Cuenta de lo mostrado hasta `a` en 1,3 s; sin movimiento, directo. */
function contar(nodo, a) {
  if (nodo._a === a) return;
  nodo._a = a;
  const de = quieto || nodo._v === undefined ? 0 : nodo._v;
  if (quieto) { nodo.textContent = a; nodo._v = a; return; }
  const t0 = performance.now();
  cancelAnimationFrame(nodo._raf);
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / 1300);
    nodo._v = Math.round(de + (a - de) * suave(k));
    nodo.textContent = nodo._v;
    if (k < 1) nodo._raf = requestAnimationFrame(paso);
  };
  nodo._raf = requestAnimationFrame(paso);
}

function sincronizar() {
  for (const n of $$('[data-valor][data-objetivo]')) contar(n, Number(n.dataset.objetivo));
  const anillo = document.querySelector('[data-anillo-valor]');
  const avance = document.querySelector('[data-kpi="avance"] [data-valor]');
  if (anillo && avance) contar(anillo, Number(avance.dataset.objetivo));

  // Barras apiladas de proyección: hoy / si apruebo lo que curso / + finales
  const pr = document.querySelector('[data-proyeccion]');
  if (pr) {
    const v = (id) => Number(document.querySelector(`[data-kpi="${id}"] [data-valor]`)?.dataset.objetivo ?? 0);
    pr.style.setProperty('--hoy', `${v('avance')}%`);
    pr.style.setProperty('--cur', `${v('proy-cursando')}%`);
    pr.style.setProperty('--fin', `${v('proy-finales')}%`);
  }
  // Porcentaje por nivel (a partir de data-aprobadas / data-total que mantiene inicio.js)
  for (const li of $$('[data-nivel-bar]')) {
    const p = li.querySelector('[data-pct]');
    if (p) p.textContent = `${Math.round((li.dataset.aprobadas / li.dataset.total) * 100)}%`;
  }
  // Mini-malla del hero: color por estado real
  const est = cargarEstado();
  for (const nodo of $$('[data-nodo]')) {
    const n = Number(nodo.dataset.nodo);
    nodo.dataset.estado = M.estadoDe(est, n);
    nodo.dataset.habilitada = M.estaHabilitada(est, n) ? 'si' : 'no';
  }
}

const obs = new MutationObserver(sincronizar);
obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-objetivo', 'data-aprobadas'] });
sincronizar();
