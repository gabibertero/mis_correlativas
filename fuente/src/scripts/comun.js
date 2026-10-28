// Helpers de DOM compartidos. Siempre textContent / nodos: nunca innerHTML con datos.
import { ETIQUETA } from '../lib/vista.js';
import { nombreCorto } from '../lib/motor.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** el('li', { class:'x', dataset:{a:1}, hidden:true }, 'texto', nodo) */
export function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k === 'class') nodo.className = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  nodo.append(...hijos.filter((h) => h != null && h !== false));
  return nodo;
}

export const etiquetaN = (n) => (n === 99 ? 'S' : String(n));
export const chip = (estado, texto = ETIQUETA[estado]) => el('span', { class: 'chip', dataset: { estado } }, texto);
/** <li data-materia><span class="n num">N</span>Nombre<small>extra</small></li> */
export function filaMateria(n, extra) {
  return el('li', { dataset: { materia: n } }, el('span', { class: 'n num' }, etiquetaN(n)),
    extra ? el('span', {}, nombreCorto(n), el('small', {}, extra)) : nombreCorto(n));
}
export const vacio = (texto) => el('li', { class: 'vacio' }, texto);
export const fmtFecha = (d) => { const s = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); return s[0].toUpperCase() + s.slice(1); };
export const textoDias = (d) => (d < 0 ? 'pasó' : d === 0 ? 'hoy' : `en ${d} d`);
