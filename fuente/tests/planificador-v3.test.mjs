// Planificador v3: febreros por año, deudas resaltadas y proyección del Home con un solo verano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/lib/motor.js';
import { CUATRIS } from '../src/lib/progreso.js';

const ids = ['2026-2C', '2027-VER', '2027-1C', '2027-2C', '2028-VER', '2028-1C', '2028-2C'];
// Ejemplo del pedido: AM II cursando, AGA recursando (debe el final), Simulación nunca cursada.
const real = { 9: { estado: 'cursando' }, 2: { estado: 'recursando' }, 1: { estado: 'aprobada' }, 17: { estado: 'aprobada' }, 28: { estado: 'pendiente' } };

test('veranoActivo: por año con `veranos`; sin la lista respeta el interruptor viejo', () => {
  assert.equal(M.veranoActivo({ veranos: ['2027'] }, '2027-VER'), true);
  assert.equal(M.veranoActivo({ veranos: ['2027'] }, '2028-VER'), false);
  assert.equal(M.veranoActivo({ veranos: [2029] }, '2029-VER'), true);
  assert.equal(M.veranoActivo({ veranos: [], incluirVerano: true }, '2027-VER'), false); // manda la lista
  assert.equal(M.veranoActivo({ incluirVerano: true }, '2031-VER'), true);
  assert.equal(M.veranoActivo({}, '2027-VER'), false);
  assert.equal(M.veranoActivo(undefined, '2027-VER'), false);
});

test('un febrero activo no habilita los demás: proyección, avisos y propuesta', () => {
  const opciones = { veranos: ['2027'] };
  const plan = { '2027-VER': [1], '2028-VER': [3] };
  const en2028 = M.estadoEnCuatri({}, plan, ids, 6, opciones);
  assert.equal(M.estadoDe(en2028, 1), 'regular');
  assert.equal(M.estadoDe(en2028, 3), 'pendiente'); // 2028 no está sumado
  assert.match(M.avisosCuatri({}, plan, ids, 4, 30, new Set(), opciones).join(' '), /febrero 2028 no está sumado/);
  assert.doesNotMatch(M.avisosCuatri({}, plan, ids, 1, 30, new Set(), opciones).join(' '), /no está sumado/);
  const { plan: p } = M.proponerPlan({}, ids, opciones);
  assert.ok(p['2027-VER'].length <= 1);
  assert.deepEqual(p['2028-VER'], []);
});

test('planProximoAnio incluye solo los febreros activos dentro del rango', () => {
  const est = { 1: { estado: 'regular' }, 2: { estado: 'regular' }, 3: { estado: 'regular' } };
  const sin = M.planProximoAnio(est, undefined, {});
  const con = M.planProximoAnio(est, undefined, { veranos: ['2027'] });
  const fuera = M.planProximoAnio(est, undefined, { veranos: ['2028'] }); // fuera del rango 2026-2C..2027-2C
  assert.deepEqual(con.map((c) => c.id), ['2027-1C', '2027-2C']); // el Home sigue mostrando 1C/2C
  assert.deepEqual(fuera, sin);
  // Con febrero 2027 un intensivo regulariza antes: la propuesta cambia respecto de no tenerlo.
  assert.notDeepEqual(con, sin);
  // El viejo interruptor sigue proyectando el febrero del año siguiente.
  assert.deepEqual(M.planProximoAnio(est, undefined, { incluirVerano: true }), con);
  // Ids que traen un VER inactivo lo descartan.
  const ids3 = ['2026-2C', '2027-VER', '2027-1C', '2027-2C'];
  assert.deepEqual(M.planProximoAnio(est, ids3, { veranos: [] }).map((c) => c.id), ['2027-VER', '2027-1C', '2027-2C']);
  assert.deepEqual(M.planProximoAnio(est, ids3, { veranos: [] })[0].items, []);
});

test('deudasDe: solo lo que empezaste y te falta cerrar, nunca lo que no cursaste', () => {
  // Análisis Numérico: reg [9], aprob [1, 2]
  assert.deepEqual(M.deudasDe(real, real, 22), { reg: [9], aprob: [2] });
  // Ciencia de Datos: reg [28] (Simulación, nunca cursada) y aprob [17, 19] (19 pendiente): no es deuda
  assert.deepEqual(M.deudasDe(real, real, 32), { reg: [], aprob: [] });
  // Libre o abandono también son deuda (la empezaste); pendiente no.
  assert.deepEqual(M.deudasDe({ 9: { estado: 'libre' }, 2: { estado: 'abandono' } }, {}, 22), { reg: [9], aprob: [2] });
  assert.deepEqual(M.deudasDe({}, {}, 22), { reg: [], aprob: [] });
  // Promoción y regular deben el final.
  assert.deepEqual(M.deudasDe({ 1: { estado: 'promocion' }, 2: { estado: 'regular' } }, {}, 22).aprob, [1, 2]);
  // Si el proyectado ya la resuelve, no se marca.
  assert.deepEqual(M.deudasDe(real, { ...real, 9: { estado: 'regular' }, 2: { estado: 'aprobada' } }, 22), { reg: [], aprob: [] });
  // Licenciaturas con correlativas sin confirmar no informan deudas.
  const lic = M.idElectiva({ nombre: 'Criptografía y Seguridad Criptográfica' });
  assert.deepEqual(M.deudasDe({ 23: { estado: 'cursando' } }, {}, lic), { reg: [], aprob: [] });
  // Electivas habituales sí: Backend pide 13 y 14 regulares y 6 aprobada.
  assert.deepEqual(M.deudasDe({ 13: { estado: 'libre' }, 6: { estado: 'regular' } }, {}, 'e:backend-de-aplicaciones'), { reg: [13], aprob: [6] });
});

test('proyeccionDeudas: la cursada actual sigue siendo deuda; un período futuro del plan la resuelve', () => {
  const i = ids.indexOf('2027-2C');
  // Plan por defecto: lo que cursás hoy en el período actual.
  const actual = { '2026-2C': [9, 2] };
  assert.deepEqual(M.deudasDe(real, M.proyeccionDeudas(real, actual, ids, i, {}), 22), { reg: [9], aprob: [2] });
  // estadoEnCuatri, en cambio, supone que la cursada actual regulariza.
  assert.equal(M.estadoDe(M.estadoEnCuatri(real, actual, ids, i, {}), 9), 'regular');
  // AM II en el intensivo de febrero 2027: ya no se resalta; AGA sigue debiendo el final.
  const conFebrero = { ...actual, '2027-VER': [9] };
  assert.deepEqual(M.deudasDe(real, M.proyeccionDeudas(real, conFebrero, ids, i, { veranos: ['2027'] }), 22), { reg: [], aprob: [2] });
  // Si el febrero no está sumado, no resuelve nada.
  assert.deepEqual(M.deudasDe(real, M.proyeccionDeudas(real, conFebrero, ids, i, { veranos: [] }), 22).reg, [9]);
  // Final de AGA previsto (finalesPrevistos) y aprobable: deja de ser deuda.
  const conFinal = M.proyeccionDeudas(real, conFebrero, ids, i, { veranos: ['2027'], finalesPrevistos: [2] });
  assert.deepEqual(M.deudasDe(real, conFinal, 22), { reg: [], aprob: [] });
  // Simulación sin cursar nunca aparece como deuda de Ciencia de Datos.
  assert.deepEqual(M.deudasDe(real, M.proyeccionDeudas(real, actual, ids, i, {}), 32), { reg: [], aprob: [] });
});

test('CUATRIS trae febreros 2027–2033 (años válidos para `veranos`)', () => {
  assert.deepEqual(CUATRIS.filter(M.esVerano).map((id) => id.slice(0, 4)), ['2027', '2028', '2029', '2030', '2031', '2032', '2033']);
});
