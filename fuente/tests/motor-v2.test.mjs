import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAS_PLAN, ELECTIVAS, MATERIAS } from '../src/data/plan.js';
import { CATALOGO_ELECTIVAS } from '../src/data/trayectos.js';
import * as M from '../src/lib/motor.js';

const reg = (...ns) => Object.fromEntries(ns.map((n) => [n, { estado: 'regular' }]));
const aprob = (...ns) => Object.fromEntries(ns.map((n) => [n, { estado: 'aprobada' }]));
const ids = ['2026-2C', '2027-VER', '2027-1C', '2027-2C', '2028-VER', '2028-1C', '2028-2C'];

test('régimen 1878: cursadas y aprobadas conservan significado también para rendir', () => {
  const estado = reg(1, 2, 9);
  assert.equal(M.puedeCursar(estado, 9), true);
  assert.equal(M.puedeRendirFinal(estado, 9), true);
  assert.deepEqual(M.queFaltaParaFinal({ ...estado, 2: { estado: 'libre' } }, 9), { regular: false, reg: [2], aprobar: [], extra: [] });
  assert.equal(M.puedeRendirFinal(reg(1, 2, 18), 18), false); // Economía sí pide aprobadas 1 y 2.
  assert.equal(M.puedeRendirFinal({ ...aprob(1, 2), ...reg(18) }, 18), true);
});

test('todas las finales ordinarias respetan exactamente sus dos columnas', () => {
  for (const m of MATERIAS_PLAN.filter((m) => !m.finalExigeTodo)) {
    const estado = { ...reg(...m.reg), ...aprob(...m.aprob), ...reg(m.n) };
    assert.equal(M.puedeRendirFinal(estado, m.n), true, m.nombre);
    for (const n of m.reg) assert.equal(M.puedeRendirFinal({ ...estado, [n]: { estado: 'pendiente' } }, m.n), false, `${m.nombre}: cursada ${n}`);
    for (const n of m.aprob) assert.equal(M.puedeRendirFinal({ ...estado, [n]: { estado: 'regular' } }, m.n), false, `${m.nombre}: aprobada ${n}`);
  }
});

test('las relaciones explican regularizar y aprobar, sin confundir alcance con habilitación', () => {
  assert.ok(M.relacionesDe(1).regular.includes(9));
  assert.ok(M.relacionesDe(1).aprobada.includes(18));
  assert.ok(M.relacionesDe(1).indirectas.includes(31));
  assert.equal(M.impactoReal({}, 1, 'regular').cursar.includes(9), false); // También falta AGA.
  assert.equal(M.impactoReal(reg(2), 1, 'regular').cursar.includes(9), true);
  assert.match(M.razonEntrada(1), /regularizarla es requisito para cursar/);
  assert.match(M.razonEntrada(1), /aprobarla es requisito para cursar/);
  for (const { n, impacto } of M.masDestraban({}, 36)) assert.equal(impacto, [...M.destraba(n)].filter((x) => !M.porN[x].opcional).length);
});

test('electivas usan los mismos estados y columnas, incluidos libre y abandono', () => {
  const e = ELECTIVAS[0], id = M.idElectiva(e), slug = M.slug(e.nombre);
  const base = { ...reg(...e.reg), ...aprob(...e.aprob) };
  for (const estado of ['regular', 'recursando', 'promocion']) {
    const unido = M.conElectivas(base, { [slug]: estado });
    assert.equal(M.puedeRendirFinal(unido, id), true, estado);
    assert.deepEqual(M.creditos({ [slug]: estado }, ELECTIVAS), { ing: 0, analista: 0 });
  }
  for (const estado of ['libre', 'abandono']) assert.equal(M.estaHabilitada(M.conElectivas(base, { [slug]: estado }), id), true);
  assert.equal(M.puedeCursar(base, id), true);
  assert.equal(M.puedeRendirFinal(M.conElectivas(base, { [slug]: 'cursando' }), id), false);
  assert.equal(Object.hasOwn(base, id), false);
});

test('nuevas licenciaturas: créditos de la elegida sin afirmar correlativas no publicadas', () => {
  const seguridad = CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'seguridad');
  const ia = CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'ia');
  const elect = { [M.slug(seguridad.nombre)]: 'aprobada', [M.slug(ia.nombre)]: 'aprobada' };
  assert.deepEqual(M.creditos(elect, CATALOGO_ELECTIVAS, {}, 'seguridad'), { ing: 3, analista: 0 });
  assert.deepEqual(M.creditos(elect, CATALOGO_ELECTIVAS, {}, 'ia'), { ing: 3, analista: 0 });
  assert.deepEqual(M.creditos(elect, CATALOGO_ELECTIVAS), { ing: 0, analista: 0 });
  assert.deepEqual(M.creditos(elect, [...CATALOGO_ELECTIVAS, seguridad], {}, 'seguridad'), { ing: 3, analista: 0 });
  assert.equal(M.puedeCursar(reg(23), M.idElectiva(seguridad)), false);
  assert.equal(M.puedeRendirFinal({ ...reg(23), [M.idElectiva(seguridad)]: { estado: 'regular' } }, M.idElectiva(seguridad)), false);
  assert.match(M.avisosMateria(reg(23), M.idElectiva(seguridad))[0], /confirmar/);
  assert.equal(M.resumen(M.conElectivas({}, elect)).aprobadas, 0);
});

test('plan conservador: cursos previos se regularizan y los finales actuales no se aprueban solos', () => {
  const plan = { '2026-2C': [1, 2] };
  const estado = M.estadoEnCuatri(reg(3), plan, ids, 2);
  // Anuales comenzadas indebidamente en 2C no deben habilitar cursos futuros.
  assert.equal(M.estadoDe(estado, 1), 'pendiente');
  assert.equal(M.estadoDe(estado, 3), 'regular');
  const correcto = { '2027-1C': [1, 2] };
  const al2028 = M.estadoEnCuatri(reg(3), correcto, ids, 4);
  assert.equal(M.estadoDe(al2028, 1), 'regular');
  assert.equal(M.puedeCursar(al2028, 9), true);
  assert.equal(M.puedeCursar(al2028, 18), false);
});

test('aprobación explícita respeta las correlativas del final y puede resolver cadenas', () => {
  const base = reg(1, 2);
  assert.equal(M.estadoDe(M.estadoEnCuatri(base, {}, ids, 2), 1), 'regular');
  const elegido = M.estadoEnCuatri(base, {}, ids, 2, { finalesPrevistos: [1, 2] });
  assert.equal(M.puedeCursar(elegido, 18), true);
  const bloqueado = M.estadoEnCuatri(reg(18), {}, ids, 2, { finalesPrevistos: [18] });
  assert.equal(M.estadoDe(bloqueado, 18), 'regular');
  const proyectado = M.estadoEnCuatri({ 1: { estado: 'cursando' }, 2: { estado: 'cursando' } }, { '2026-2C': [1, 2] }, ids, 2, { resultado: 'aprobada' });
  assert.equal(M.puedeCursar(proyectado, 18), true);
});

test('anuales duran hasta fin de 2C aunque haya períodos de verano en el calendario', () => {
  const plan = { '2027-1C': [1] };
  assert.equal(M.estadoDe(M.estadoEnCuatri({}, plan, ids, 3), 1), 'pendiente');
  assert.deepEqual(M.continuan({}, plan, ids, 3), [1]);
  assert.equal(M.horasCuatri({}, plan, ids, 3), 5);
  assert.equal(M.estadoDe(M.estadoEnCuatri({}, plan, ids, 4), 1), 'regular');
  assert.deepEqual(M.continuan({}, plan, ids, 4), []);
  assert.equal(M.horasCuatri({}, plan, ids, 4), 0);
});

test('intensivo termina febrero, no ocupa ambos cuatrimestres ni fuerza aprobación', () => {
  const plan = { '2027-VER': [1, 2] }, opciones = { incluirVerano: true };
  const inicio = M.estadoEnCuatri({}, plan, ids, 2, opciones);
  assert.equal(M.estadoDe(inicio, 1), 'regular');
  assert.equal(M.estadoDe(inicio, 2), 'regular');
  assert.equal(M.puedeCursar(inicio, 9), true);
  assert.equal(M.puedeCursar(inicio, 18), false);
  assert.deepEqual(M.continuan({}, plan, ids, 2, opciones), []);
  assert.deepEqual(M.continuan({}, plan, ids, 3, opciones), []);
  assert.equal(M.estadoDe(M.estadoEnCuatri({}, plan, ids, 2), 1), 'pendiente');
});

test('oferta de verano no incluye sistemas por defecto, solo excepciones declaradas', () => {
  assert.deepEqual(M.ofertaVerano(), [1, 2, 3, 9, 10]);
  assert.equal(M.ofertaVerano({ veranoExtras: [6] }).includes(6), true);
  assert.equal(M.ofertaVerano({ veranoExtras: [6] }, '2028-VER').includes(6), false);
  assert.equal(M.ofertaVerano({ veranoExtrasPorAnio: { 2027: [6] } }, '2027-VER').includes(6), true);
  assert.equal(M.ofertaVerano({ veranoExtrasPorAnio: { 2027: [6] } }, '2028-VER').includes(6), false);
  const plan = { '2027-VER': [6] };
  assert.equal(M.estadoDe(M.estadoEnCuatri({}, plan, ids, 2, { incluirVerano: true }), 6), 'pendiente');
  assert.equal(M.estadoDe(M.estadoEnCuatri({}, plan, ids, 2, { incluirVerano: true, veranoExtras: [6] }), 6), 'regular');
  assert.match(M.avisosCuatri({}, plan, ids, 1, 30, new Set(), { incluirVerano: true }).join(' '), /no pertenece a la oferta/);
});

test('propuesta automática: verano opcional, un intensivo y sin promesa de aprobar la carrera', () => {
  for (const incluirVerano of [false, true]) {
    const { plan, sinUbicar } = M.proponerPlan({}, ids, { incluirVerano });
    const todas = Object.values(plan).flat();
    assert.equal(new Set(todas).size, todas.length);
    assert.ok(sinUbicar.length > 0); // Se dejan pendientes los finales no planificados.
    for (const id of ids.filter(M.esVerano)) assert.ok(plan[id].length <= (incluirVerano ? 1 : 0));
    assert.ok(todas.every((n) => MATERIAS.some((m) => m.n === n && !m.opcional)));
  }
});

test('un plan manual sin correlativas no se usa para habilitar indebidamente el futuro', () => {
  const plan = { '2027-1C': [23] }; // Diseño sin sus antecedentes.
  const futuro = M.estadoEnCuatri({}, plan, ids, 4, { resultado: 'aprobada' });
  assert.equal(M.estadoDe(futuro, 23), 'pendiente');
  assert.equal(M.puedeCursar(futuro, 30), false);
});


test('veredicto no dice que aprobar es necesario cuando alcanza con regularizar', () => {
  const est = { 1: { estado: 'cursando' }, 2: { estado: 'regular' } };
  assert.match(M.veredicto(est, 9).texto, /Se habilita si regularizás lo que cursás/);
  assert.doesNotMatch(M.veredicto(est, 9).texto, /si aprobás/);
  assert.match(M.veredicto({ 1: { estado: 'cursando' }, 2: { estado: 'aprobada' } }, 18).texto, /si aprobás los finales/);
  assert.match(M.veredicto({ ...est, 9: { estado: 'regular' } }, 9).texto, /Se habilita si regularizás lo que cursás/);
});
