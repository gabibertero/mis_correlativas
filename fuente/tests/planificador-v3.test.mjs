// Planificador v3: febreros por año y proyección del Home con un solo verano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/lib/motor.js';
import { CUATRIS } from '../src/lib/progreso.js';

const ids = ['2026-2C', '2027-VER', '2027-1C', '2027-2C', '2028-VER', '2028-1C', '2028-2C'];

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

test('CUATRIS trae febreros 2027–2033 (años válidos para `veranos`)', () => {
  assert.deepEqual(CUATRIS.filter(M.esVerano).map((id) => id.slice(0, 4)), ['2027', '2028', '2029', '2030', '2031', '2032', '2033']);
});
