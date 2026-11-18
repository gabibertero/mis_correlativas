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

test('anioAMandar: hasta octubre el año en curso; noviembre y diciembre, el siguiente', () => {
  assert.equal(M.anioAMandar(new Date(2027, 8, 15)), 2027);
  assert.equal(M.anioAMandar(new Date(2027, 10, 24)), 2028);
  assert.equal(M.anioAMandar(new Date(2027, 9, 31)), 2027);
  assert.equal(M.anioAMandar(new Date(2027, 10, 1)), 2028);
  assert.equal(M.anioAMandar(new Date(2027, 0, 1)), 2027);
  assert.equal(M.anioAMandar(new Date(2027, 11, 31)), 2028);
});

test('textoPlanWhatsApp: secciones con materias, condiciones reales, electivas y licenciatura', () => {
  const a = (e) => ({ estado: e });
  const est = Object.fromEntries([1, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 17, 19, 20].map((n) => [n, a('aprobada')]));
  Object.assign(est, { 2: a('recursando'), 9: a('cursando'), 10: a('regular'), 15: a('regular'), 16: a('regular'), 21: a('cursando'), 23: a('abandono') });
  const plan = {
    '2026-2C': [2, 9, 21],
    '2027-VER': [9], '2027-1C': [23, 26, 10, 22, 28, 'e:desarrollo-y-operaciones-devops'],
    '2027-2C': [29, 32, 'e:criptografia-y-seguridad-criptografica'],
  };
  assert.equal(M.textoPlanWhatsApp(est, plan, 2027, { veranos: ['2027'] }, { nombre: 'Gavi', recursar: [10] }), [
    '📚 *Plan 2027 · Gavi*',
    '',
    '☀️ *Intensivo de febrero*',
    '1. Análisis Matemático II',
    '',
    '📅 *Anuales*',
    '1. Física II _(recursado, si me lo aprueban)_',
    '2. Diseño de Sistemas de Información',
    '3. Redes de Datos _(si regularizo Comunicación de Datos)_',
    '',
    '1️⃣ *1er cuatrimestre*',
    '1. Análisis Numérico _(si regularizo Análisis Matemático II y apruebo Álgebra y Geometría Analítica)_',
    '2. Simulación _(si apruebo Análisis Matemático II)_',
    '3. Desarrollo y Operaciones (DevOps) — electiva · 3 créditos',
    '',
    '2️⃣ *2do cuatrimestre*',
    '1. Tecnologías para la Automatización _(si regularizo Análisis Numérico y apruebo Análisis Matemático II)_',
    '2. Ciencia de Datos _(si regularizo Simulación)_',
    '3. Criptografía y Seguridad Criptográfica — Lic. Seguridad Informática · 3 créditos _(correlativas a confirmar)_',
    '',
    '_Sujeto a correlativas, oferta e inscripción._',
  ].join('\n'));
  // Sin nombre, sin febrero y sin 2C: solo las secciones con materias.
  assert.equal(M.textoPlanWhatsApp({}, { '2028-1C': [5, 1] }, 2028), '📚 *Plan 2028*\n\n📅 *Anuales*\n1. Análisis Matemático I\n\n1️⃣ *1er cuatrimestre*\n1. Lógica y Estructuras Discretas\n\n_Sujeto a correlativas, oferta e inscripción._');
  // Varias condiciones: un verbo por tipo, comas y «y» final.
  assert.match(M.textoPlanWhatsApp({}, { '2028-1C': [25] }, 2028), /_\(si regularizo Base de Datos, Desarrollo de Software y Diseño de Sistemas de Información, y apruebo Sintaxis y Semántica de los Lenguajes y Paradigmas de Programación\)_/);
  // Una anual de 1C no se repite en el 2C; nada planificado -> ''.
  assert.doesNotMatch(M.textoPlanWhatsApp({}, { '2028-1C': [1], '2028-2C': [1] }, 2028), /2do cuatrimestre/);
  assert.equal(M.textoPlanWhatsApp({}, { '2027-1C': [9] }, 2028), '');
});
