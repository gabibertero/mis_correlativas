// Simulador "y si…": estados hipotéticos sobre una COPIA del estado. No escribe nada en localStorage.
import * as M from '../lib/motor.js';
import { ETIQUETA } from '../lib/vista.js';
import { cargarEstado } from '../lib/progreso.js';
import { $, $$, el, filaMateria, vacio } from './comun.js';

const real = cargarEstado();
const filas = $$('fieldset[data-sim-materia]');
const reset = $('[data-accion="reset-simulacion"]');
const resumen = $('[data-sim-resumen]');
const listas = $('.res-listas');
const TEXTO_VACIO = 'Todavía no marcaste nada. Elegí una materia de la lista.';

// Estado real -> qué filas mostrar (las aprobadas van a "Ya aprobadas")
for (const f of filas) {
  const n = Number(f.dataset.simMateria);
  const e = M.estadoDe(real, n);
  f.dataset.estadoReal = e; f.hidden = e === 'aprobada';
  const c = $('.chip', f); c.dataset.estado = e; c.textContent = ETIQUETA[e];
  $('input[value="regular"]', f).closest('label').hidden = e === 'regular' || e === 'recursando' || e === 'promocion';
}
$$('.hechas li').forEach((li) => { li.hidden = M.estadoDe(real, Number(li.dataset.materia)) !== 'aprobada'; });
$('[data-hechas-n]').textContent = $$('.hechas li:not([hidden])').length;
const ocultarGrupos = () => $$('.grupo').forEach((g) => { g.hidden = !$('fieldset:not([hidden])', g); });
ocultarGrupos();

function cambios() {
  const c = {};
  for (const f of filas) {
    const v = $('input:checked', f)?.value;
    if (v && v !== 'real') c[f.dataset.simMateria] = v;
  }
  return c;
}

function pintar() {
  const c = cambios();
  const k = Object.keys(c).length;
  reset.hidden = k === 0;
  listas.hidden = k === 0;
  if (!k) { resumen.textContent = TEXTO_VACIO; return; }
  const sim = M.aplicar(real, c);
  const antesC = new Set(M.habilitadas(real)); const antesF = new Set(M.rendibles(real));
  const cursar = M.habilitadas(sim).filter((n) => !antesC.has(n));
  const finales = M.rendibles(sim).filter((n) => !antesF.has(n));
  const mostrar = (ul, ns, vac) => ul.replaceChildren(...(ns.length ? ns.map((n) => filaMateria(n)) : [vacio(vac)]));
  mostrar($('[data-sim-lista="cursar"]'), cursar, 'Nada nuevo para cursar.');
  mostrar($('[data-sim-lista="finales"]'), finales, 'Ningún final nuevo.');
  const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  resumen.textContent = `Con ${s(k, 'materia de prueba', 'materias de prueba')} se habilitarían ${s(cursar.length, 'materia para cursar', 'materias para cursar')} y ${s(finales.length, 'final', 'finales')}. Tu estado real no cambia.`;
}

for (const f of filas) f.addEventListener('change', pintar);
reset.addEventListener('click', () => {
  for (const f of filas) $('input[value="real"]', f).checked = true;
  pintar();
});
// Los radios pueden quedar marcados si el navegador restaura el formulario al volver atrás (bfcache o autofill tardío):
// el resumen se recalcula siempre desde los radios.
pintar();
addEventListener('pageshow', pintar);
