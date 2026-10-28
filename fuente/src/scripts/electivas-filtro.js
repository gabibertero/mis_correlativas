// Electivas: buscador y filtros (presentación; no toca estado ni créditos). Lee data-habilitada / data-nivel de cada fila.
import { $, $$ } from './comun.js';

const barra = $('[data-filtros]');
const filas = $$('li[data-electiva]');
const vacio = $('[data-sin-resultados]');
const buscar = $('[data-buscar]', barra);
const botones = $$('[data-filtro]', barra);
let filtro = 'todas';
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function aplicar() {
  const q = sinTildes(buscar.value.trim());
  let visibles = 0;
  for (const li of filas) {
    const ok = filtro === 'todas' || (filtro === 'hab' ? li.dataset.habilitada === 'si' : li.dataset.nivel === filtro);
    const coincide = ok && sinTildes($('h3', li).textContent).includes(q);
    li.hidden = !coincide;
    if (coincide) visibles++;
  }
  vacio.hidden = visibles > 0;
}

botones.forEach((b) => b.addEventListener('click', () => {
  filtro = b.dataset.filtro;
  botones.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  aplicar();
}));
buscar.addEventListener('input', aplicar);
// El estado de una fila puede cambiar su "habilitada": se reaplica después del handler de electivas.js
$('.filas').addEventListener('change', aplicar);
barra.hidden = false;
aplicar();
