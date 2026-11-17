import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/lib/progreso.js';
import { ESTADOS } from '../src/data/plan.js';
import { CATALOGO_ELECTIVAS } from '../src/data/trayectos.js';
import { slug } from '../src/lib/motor.js';

const almacen = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) };
};
beforeEach(() => P.usarAlmacen(almacen()));
const opcionesVacias = { incluirVerano: false, veranos: [], veranoExtras: [], veranoExtrasPorAnio: {}, resultado: 'regular', resultados: {}, finalesPrevistos: [] };

test('electivas conservan todos los estados académicos sin transformar regular en aprobada', () => {
  const id = slug(CATALOGO_ELECTIVAS[0].nombre);
  for (const estado of ESTADOS) {
    P.guardarElectivas({ [id]: estado });
    assert.deepEqual(P.cargarElectivas(), estado === 'pendiente' ? {} : { [id]: estado });
  }
  assert.deepEqual(P.limpiarElectivas({ [id]: 'desconocido', inventada: 'regular' }), {});
});

test('elección es única, validada y no elimina avances de otros trayectos', () => {
  const seg = slug(CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'seguridad').nombre);
  const ia = slug(CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'ia').nombre);
  P.guardarElectivas({ [seg]: 'aprobada', [ia]: 'regular' });
  P.guardarLicenciatura('seguridad');
  assert.equal(P.cargarLicenciatura(), 'seguridad');
  P.guardarLicenciatura('datos');
  assert.equal(P.cargarLicenciatura(), 'datos');
  assert.deepEqual(P.cargarElectivas(), { [seg]: 'aprobada', [ia]: 'regular' });
  for (const id of [null, [], {}, 'otra', '__proto__', 1]) {
    P.guardarLicenciatura(id);
    assert.equal(P.cargarLicenciatura(), null);
  }
});

test('períodos de verano no eliminan planes antiguos y son anteriores al 1C de cada año', () => {
  const e = `e:${slug(CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'seguridad').nombre)}`;
  const plan = { '2027-VER': [2], '2027-1C': [9, e], '2030-2C': [36], '2033-2C': [35] };
  P.guardarPlan(plan);
  assert.deepEqual(P.cargarPlan(), plan);
  assert.equal(P.CUATRIS.at(-1), '2033-2C');
  for (let y = 2027; y <= 2033; y++) {
    assert.equal(P.CUATRIS.indexOf(`${y}-VER`) + 1, P.CUATRIS.indexOf(`${y}-1C`));
    assert.equal(P.CUATRIS.indexOf(`${y}-1C`) + 1, P.CUATRIS.indexOf(`${y}-2C`));
  }
});

test('opciones de planificación validan hipótesis, finales e intensivos adicionales', () => {
  assert.deepEqual(P.cargarOpcionesPlan(), opcionesVacias);
  const opt = P.limpiarOpcionesPlan({
    incluirVerano: true, veranoExtras: [6, 6, 999, '6'], resultado: 'aprobada',
    resultados: { 2: 'aprobada', 'e:green-software': 'regular', 999: 'aprobada', 3: 'libre' },
    finalesPrevistos: [2, 'e:green-software', 2, 999],
  });
  assert.deepEqual(opt, { incluirVerano: true, veranos: ['2027'], veranoExtras: [6], veranoExtrasPorAnio: {}, resultado: 'aprobada', resultados: { 2: 'aprobada', 'e:green-software': 'regular' }, finalesPrevistos: [2, 'e:green-software'] });
  assert.deepEqual(P.limpiarOpcionesPlan({ incluirVerano: 'si', resultado: 'libre', resultados: [] }), opcionesVacias);
});

test('febreros activos por año: válidos, sin repetidos, ordenados y con migración del interruptor viejo', () => {
  assert.deepEqual(P.limpiarOpcionesPlan({ veranos: ['2029', 2027, '2027', '2026', '2034', 'x', null] }).veranos, ['2027', '2029']);
  assert.equal(P.limpiarOpcionesPlan({ veranos: ['2028'] }).incluirVerano, true);
  // Sin `veranos`: el interruptor viejo activa solo febrero 2027.
  assert.deepEqual(P.limpiarOpcionesPlan({ incluirVerano: true }).veranos, ['2027']);
  assert.deepEqual(P.limpiarOpcionesPlan({ incluirVerano: false }).veranos, []);
  // Con `veranos` explícito, manda la lista aunque el derivado viejo diga otra cosa.
  assert.deepEqual(P.limpiarOpcionesPlan({ incluirVerano: true, veranos: [] }), { ...opcionesVacias });
  const ida = P.limpiarOpcionesPlan({ veranos: ['2030'] });
  assert.deepEqual(P.limpiarOpcionesPlan(ida), ida); // idempotente
});

test('la oferta de intensivos excepcional se conserva por año y descarta años e IDs inválidos', () => {
  const opciones = P.limpiarOpcionesPlan({ veranoExtrasPorAnio: { 2027: [6, 6, '6', 999], 2028: [13], 2029: 'no', 2033: [14], 2034: [15], desconocido: [19] } });
  assert.deepEqual(opciones.veranoExtrasPorAnio, { 2027: [6], 2028: [13], 2029: [], 2033: [14] });
  P.guardarOpcionesPlan(opciones);
  const copia = P.validarImport(JSON.stringify(P.armarExport()));
  assert.deepEqual(copia.datos.opcionesPlan.veranoExtrasPorAnio, opciones.veranoExtrasPorAnio);
});

test('respaldo versión1 conserva licenciatura, estados ampliados y plan de verano entre dispositivos', () => {
  const seg = slug(CATALOGO_ELECTIVAS.find((e) => e.licenciatura === 'seguridad').nombre);
  const opciones = { ...opcionesVacias, incluirVerano: true, veranos: ['2027', '2029'], veranoExtras: [6], veranoExtrasPorAnio: { 2028: [13] }, resultados: { 2: 'aprobada' }, finalesPrevistos: [15] };
  P.guardarLicenciatura('seguridad');
  P.guardarElectivas({ [seg]: 'regular', 'green-software': 'abandono' });
  P.guardarPlan({ '2027-VER': [2] });
  P.guardarOpcionesPlan(opciones);
  const exp = P.armarExport();
  assert.equal(exp.version, 1);
  const validado = P.validarImport(JSON.stringify(exp));
  assert.ok(validado.ok);
  P.usarAlmacen(almacen());
  P.aplicarImport(validado.datos);
  assert.equal(P.cargarLicenciatura(), 'seguridad');
  assert.deepEqual(P.cargarElectivas(), exp.electivas);
  assert.deepEqual(P.cargarPlan(), exp.plan);
  assert.deepEqual(P.cargarOpcionesPlan(), opciones);
});

test('respaldo anterior sin trayecto ni opciones carga con defaults conservadores', () => {
  const v = P.validarImport(JSON.stringify({ app: 'correlativas', version: 1, estado: {}, electivas: { 'green-software': 'cursando' }, plan: { '2027-1C': [9] } }));
  assert.ok(v.ok);
  assert.equal(v.datos.licenciatura, null);
  assert.deepEqual(v.datos.opcionesPlan, opcionesVacias);
  assert.deepEqual(v.datos.plan, { '2027-1C': [9] });
  assert.deepEqual(v.datos.electivas, { 'green-software': 'cursando' });
});
