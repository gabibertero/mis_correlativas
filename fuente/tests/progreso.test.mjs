import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/lib/progreso.js';

const falso = () => { const d = {}; return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); } }; };
beforeEach(() => P.usarAlmacen(falso()));

test('sin nada guardado -> semilla vacía; la app funciona', () => {
  const est = P.cargarEstado();
  assert.deepEqual(est, {}); // semilla vacía: cada cuenta arranca sin materias marcadas
  assert.equal(P.cargarPlan(), null);
  assert.deepEqual(P.cargarFechas(), {});
  assert.deepEqual(P.cargarElectivas(), {});
});

test('guardar y volver a leer, con prefijo corr:v1:', () => {
  const a = falso(); P.usarAlmacen(a);
  P.guardarEstado({ 1: { estado: 'regular' } });
  assert.ok('corr:v1:estado' in a.d);
  assert.deepEqual(P.cargarEstado(), { 1: { estado: 'regular' } });
});

test('estado guardado vacío ({}) NO vuelve a la semilla (el usuario lo borró)', () => {
  P.guardarEstado({});
  assert.deepEqual(P.cargarEstado(), {});
});

test('localStorage roto o bloqueado: no tira, sigue en memoria', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  P.usarAlmacen(roto);
  assert.deepEqual(P.cargarEstado(), {}); // semilla vacía
  assert.equal(P.guardarEstado({ 2: { estado: 'regular' } }), false);
  assert.deepEqual(P.cargarEstado(), { 2: { estado: 'regular' } }); // memoria durante la visita
  P.usarAlmacen(null);
  assert.deepEqual(P.cargarEstado(), {});
});

test('JSON corrupto o de otro tipo -> semilla', () => {
  const a = falso(); P.usarAlmacen(a);
  a.d['corr:v1:estado'] = '{no es json';
  assert.deepEqual(P.cargarEstado(), {});
  a.d['corr:v1:estado'] = '[1,2,3]';
  assert.deepEqual(P.cargarEstado(), {});
});

test('limpiarEstado descarta basura y valida notas', () => {
  const e = P.limpiarEstado({
    1: { estado: 'aprobada', nota: 8 }, 2: { estado: 'aprobada', nota: 11 }, 3: { estado: 'aprobada', nota: '9' },
    4: { estado: 'volando' }, 5: 'aprobada', 999: { estado: 'aprobada' }, __proto__x: { estado: 'aprobada' },
    6: { estado: 'regular', nota: 9 }, 7: null,
  });
  assert.deepEqual(e, { 1: { estado: 'aprobada', nota: 8 }, 2: { estado: 'aprobada' }, 3: { estado: 'aprobada' }, 6: { estado: 'regular' } });
  assert.deepEqual(P.limpiarEstado(null), {});
  assert.deepEqual(P.limpiarEstado('x'), {});
});

test('limpiarPlan / fechas / electivas', () => {
  assert.deepEqual(P.limpiarPlan({ '2026-2C': [9, 9, 999, 'x', 10], '2027-1C': 'no', raro: [1] }), { '2026-2C': [9, 10] });
  assert.deepEqual(P.limpiarPlan({ '2026-2C': [9], '2027-1C': [9, 10] }), { '2026-2C': [9], '2027-1C': [10] }); // sin repetir entre cuatris
  assert.deepEqual(P.limpiarFechas({ 'feb-mar-2027': '2027-02-30', 'jul-2027': '2027-07-12', otro: '2027-01-01' }), { 'jul-2027': '2027-07-12' });
  assert.deepEqual(P.limpiarElectivas({ 'green-software': 'aprobada', 'testing-de-software': 'pendiente', inventada: 'aprobada' }), { 'green-software': 'aprobada' });
});

test('exportar -> importar es ida y vuelta', () => {
  P.guardarEstado({ 1: { estado: 'aprobada', nota: 7 }, 9: { estado: 'cursando' } });
  P.guardarPlan({ '2027-1C': [25] });
  P.guardarFechas({ 'jul-2027': '2027-07-12' });
  P.guardarElectivas({ 'green-software': 'aprobada' });
  const txt = JSON.stringify(P.armarExport());
  P.usarAlmacen(falso()); // otro dispositivo
  const v = P.validarImport(txt);
  assert.ok(v.ok);
  P.aplicarImport(v.datos);
  assert.deepEqual(P.cargarEstado(), { 1: { estado: 'aprobada', nota: 7 }, 9: { estado: 'cursando' } });
  assert.deepEqual(P.cargarPlan(), { '2027-1C': [25] });
  assert.deepEqual(P.cargarFechas(), { 'jul-2027': '2027-07-12' });
  assert.deepEqual(P.cargarElectivas(), { 'green-software': 'aprobada' });
});

test('importar rechaza archivos inválidos con mensaje', () => {
  const malos = ['', 'no json', '[]', '{}', '{"app":"otra","version":1,"estado":{}}', '{"app":"correlativas","version":2,"estado":{}}',
    '{"app":"correlativas","version":1}', '{"app":"correlativas","version":1,"estado":{"1":{"estado":"xx"}}}', 'x'.repeat(300_000), null, 5];
  for (const t of malos) { const v = P.validarImport(t); assert.equal(v.ok, false, String(t).slice(0, 30)); assert.ok(v.error); }
});

test('importar acepta estado vacío y sanea partes opcionales rotas', () => {
  const v = P.validarImport('{"app":"correlativas","version":1,"estado":{},"plan":"roto","fechas":[1],"electivas":7}');
  assert.ok(v.ok);
  assert.deepEqual(v.datos, { estado: {}, plan: {}, recursar: [], fechas: {}, electivas: {}, nombre: '', temaColor: 'verde', temaModo: null });
});

test('limpiarPlan acepta electivas (e:<slug>) y descarta ids inventados', async () => {
  const P = await import('../src/lib/progreso.js');
  const out = P.limpiarPlan({ '2026-2C': [9, 'e:backend-de-aplicaciones', 'e:inventada', 'x', 9] });
  assert.deepEqual(out['2026-2C'], [9, 'e:backend-de-aplicaciones']);
});

test('recursar: se guarda aparte (corr:v1:recursar), se sanea y viaja en el respaldo', () => {
  const a = falso(); P.usarAlmacen(a);
  assert.deepEqual(P.cargarRecursar(), []);
  P.guardarRecursar([9, 'e:green-software', 9, 999, 'x', 'e:inventada']);
  assert.ok('corr:v1:recursar' in a.d);
  assert.deepEqual(P.cargarRecursar(), [9, 'e:green-software']);
  P.usarAlmacen(Object.assign(falso(), { getItem: () => { throw new Error('roto'); } }));
  assert.deepEqual(P.cargarRecursar(), []); // almacén roto: sin romper
  const b = falso(); P.usarAlmacen(b);
  P.guardarRecursar([9, 15]);
  const exp = P.armarExport();
  assert.deepEqual(exp.recursar, [9, 15]);
  const v = P.validarImport(JSON.stringify(exp));
  assert.ok(v.ok);
  P.usarAlmacen(falso());
  P.aplicarImport(v.datos);
  assert.deepEqual(P.cargarRecursar(), [9, 15]);
});

test('importar un respaldo viejo sin "recursar" funciona', () => {
  const v = P.validarImport('{"app":"correlativas","version":1,"estado":{"1":{"estado":"aprobada"}}}');
  assert.ok(v.ok); assert.deepEqual(v.datos.recursar, []);
});

test('estado: promoción lleva nota, pendiente/libre/abandono no; "recursando" es válido y un estado desconocido se descarta', () => {
  const out = P.limpiarEstado({ 1: { estado: 'promocion', nota: 8 }, 2: { estado: 'libre', nota: 5 }, 3: { estado: 'abandono' }, 4: { estado: 'recursando', nota: 7 }, 5: { estado: 'xx' } });
  assert.deepEqual(out, { 1: { estado: 'promocion', nota: 8 }, 2: { estado: 'libre' }, 3: { estado: 'abandono' }, 4: { estado: 'recursando' } });
});

test('limpiarLocal borra el progreso (prefijo) pero deja el tema y claves ajenas', () => {
  const d = { 'corr:v1:tema': '"dark"', otra: '1' };
  P.usarAlmacen({ getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, key: (i) => Object.keys(d)[i], get length() { return Object.keys(d).length; } });
  P.guardarFechas({ 'jul-2027': '2027-07-10' }); P.guardar('uid', 'x');
  P.limpiarLocal();
  assert.deepEqual(Object.keys(d).sort(), ['corr:v1:tema', 'otra']);
  assert.deepEqual(P.cargarFechas(), {});
});

test('perfil: sanitizadores de nombre, color (whitelist) y modo', () => {
  assert.equal(P.limpiarNombre('  Gabi  '), 'Gabi');
  assert.equal(P.limpiarNombre('x'.repeat(100)).length, 40);
  for (const m of [null, 5, {}, ['a']]) assert.equal(P.limpiarNombre(m), '');
  for (const c of P.TEMAS_COLOR) assert.equal(P.limpiarTemaColor(c), c);
  for (const c of ['rojo', '', null, 7, '__proto__', 'VERDE']) assert.equal(P.limpiarTemaColor(c), 'verde');
  assert.equal(P.limpiarTemaModo('claro'), 'claro');
  assert.equal(P.limpiarTemaModo('oscuro'), 'oscuro');
  for (const m of ['dark', '', null, 1, undefined]) assert.equal(P.limpiarTemaModo(m), null);
});

test('perfil: viaja en export/import y se sanea', () => {
  P.guardarNombre('Gabi'); P.guardarTemaColor('rosa'); P.guardarTemaModo('oscuro');
  const v = P.validarImport(JSON.stringify(P.armarExport()));
  assert.equal(v.datos.nombre, 'Gabi'); assert.equal(v.datos.temaColor, 'rosa'); assert.equal(v.datos.temaModo, 'oscuro');
  const sucio = P.validarImport('{"app":"correlativas","version":1,"estado":{},"nombre":42,"temaColor":"x","temaModo":"y"}');
  assert.deepEqual([sucio.datos.nombre, sucio.datos.temaColor, sucio.datos.temaModo], ['', 'verde', null]);
  P.usarAlmacen(falso()); P.aplicarImport(v.datos);
  assert.deepEqual([P.cargarNombre(), P.cargarTemaColor(), P.cargarTemaModo()], ['Gabi', 'rosa', 'oscuro']);
});
