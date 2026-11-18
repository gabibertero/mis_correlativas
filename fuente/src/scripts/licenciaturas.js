// Un trayecto por cuenta; el historial de los demás permanece guardado.
import { LICENCIATURAS, CATALOGO_ELECTIVAS } from '../data/trayectos.js';
import * as M from '../lib/motor.js';
import { cargarEstado, cargarElectivas, guardarElectivas, cargarLicenciatura, guardarLicenciatura, PREFIJO } from '../lib/progreso.js';
import { $, $$, chip } from './comun.js';

const selector = $('[data-licenciatura-selector]');
const regularizada = (estado) => ['regular', 'recursando', 'promocion', 'aprobada'].includes(estado);

function pintar() {
  const elegida = cargarLicenciatura();
  const lic = LICENCIATURAS.find((l) => l.id === elegida);
  const est = cargarEstado();
  const elect = cargarElectivas();
  const materias = CATALOGO_ELECTIVAS.filter((e) => e.licenciatura === elegida);
  selector.value = elegida ?? '';
  for (const tarjeta of $$('[data-licenciatura-opcion]')) {
    const activa = tarjeta.dataset.licenciaturaOpcion === elegida;
    tarjeta.dataset.elegida = activa ? 'si' : 'no';
    $('[data-licenciatura-elegida]', tarjeta).hidden = !activa;
  }
  $('[data-licenciatura-titulo]').textContent = lic ? `Materias nuevas · ${lic.nombre}` : 'Materias nuevas de mi licenciatura';
  const acceso = $('[data-licenciatura-acceso]');
  if (!lic) acceso.textContent = 'Elegí una licenciatura para ver tu situación registrada.';
  else if (elegida === 'datos') acceso.textContent = 'Ciencia de Datos: materias y requisitos específicos pendientes de publicación. No se presupone el mismo régimen de las otras licenciaturas.';
  else {
    const diseno = M.estadoDe(est, 23);
    acceso.textContent = regularizada(diseno) ? 'Tenés Diseño regularizada o aprobada: cumplís el requisito académico de acceso publicado. También necesitás no haber egresado de Ingeniería y completar la inscripción oficial.' : 'Todavía te falta regularizar Diseño de Sistemas de Información para cumplir el requisito académico de acceso publicado. No exige su final aprobado.';
    if (M.resumen(est).aprobadas === 36) acceso.textContent += ' Registraste todas las materias obligatorias aprobadas: verificá tu situación de egreso antes de inscribirte.';
  }
  const hay = Boolean(lic && materias.length);
  $('[data-licenciatura-resumen]').hidden = !hay;
  $('[data-licenciatura-nota]').hidden = !hay;
  const sinPlan = $('[data-licenciatura-sin-plan]');
  sinPlan.hidden = hay;
  sinPlan.textContent = !lic ? 'Elegí una licenciatura para ver sus materias nuevas.' : 'Ciencia de Datos todavía no tiene materias publicadas para este seguimiento. Tu elección queda guardada; no se agregan asignaturas ni créditos inventados.';
  const aprobadas = materias.filter((e) => elect[M.slug(e.nombre)] === 'aprobada').length;
  const regulares = materias.filter((e) => regularizada(elect[M.slug(e.nombre)]) && elect[M.slug(e.nombre)] !== 'aprobada').length;
  $('[data-licenciatura-aprobadas]').textContent = aprobadas;
  $('[data-licenciatura-total]').textContent = ` de ${materias.length} materias nuevas aprobadas`;
  $('[data-licenciatura-creditos]').textContent = materias.filter((e) => elect[M.slug(e.nombre)] === 'aprobada').reduce((a, e) => a + e.creditos, 0);
  $('[data-licenciatura-regularizadas]').textContent = `${regulares} ${regulares === 1 ? 'materia regularizada pendiente de aprobación' : 'materias regularizadas pendientes de aprobación'}.`;
  for (const fila of $$('[data-licenciatura-materia]')) {
    fila.hidden = fila.dataset.licenciaturaMateria !== elegida;
    const estado = elect[fila.dataset.electiva] ?? 'pendiente';
    fila.dataset.estado = estado;
    $('[data-licenciatura-estado]', fila).replaceChildren(chip(estado));
    $('[data-licenciatura-estado-selector]', fila).value = estado;
  }
}

selector.addEventListener('change', () => {
  guardarLicenciatura(selector.value || null);
  pintar();
  $('[data-licenciatura-guardada]').textContent = selector.value ? 'Elección guardada. Solo las materias nuevas aprobadas de este trayecto aportan créditos. El historial de los demás se conserva.' : 'Sin licenciatura elegida. Se conserva el historial; las materias de otros trayectos no aportan créditos.';
});
for (const sel of $$('[data-licenciatura-estado-selector]')) sel.addEventListener('change', () => {
  const elect = cargarElectivas();
  const id = sel.closest('[data-electiva]').dataset.electiva;
  if (sel.value === 'pendiente') delete elect[id]; else elect[id] = sel.value;
  guardarElectivas(elect);
  pintar();
});
addEventListener('pageshow', (ev) => { if (ev.persisted) pintar(); });
addEventListener('storage', (ev) => { if (ev.key === null || ['estado', 'electivas', 'licenciatura'].some((k) => ev.key === PREFIJO + k)) pintar(); });
pintar();
