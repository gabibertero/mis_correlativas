import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELECTIVAS, ESTADOS, MATERIAS_PLAN } from '../src/data/plan.js';
import { LICENCIATURAS, CATALOGO_ELECTIVAS, ESTADOS_ELECTIVAS } from '../src/data/trayectos.js';
import { slug } from '../src/lib/motor.js';

test('tres licenciaturas: solo los dos trayectos anunciados tienen asignaturas nuevas', () => {
  assert.deepEqual(LICENCIATURAS.map((l) => l.id), ['seguridad', 'ia', 'datos']);
  assert.deepEqual(LICENCIATURAS.map((l) => l.materias.length), [6, 4, 0]);
  assert.equal(LICENCIATURAS.find((l) => l.id === 'datos').planPublicado, false);
  assert.deepEqual(ESTADOS_ELECTIVAS, ESTADOS);
});

test('catálogo ampliado conserva las electivas y evita colisiones entre trabajos finales', () => {
  assert.deepEqual(CATALOGO_ELECTIVAS.slice(0, ELECTIVAS.length), ELECTIVAS);
  assert.equal(CATALOGO_ELECTIVAS.length, 29);
  assert.equal(new Set(CATALOGO_ELECTIVAS.map((e) => slug(e.nombre))).size, 29);
  assert.equal(MATERIAS_PLAN.length, 36);
  const tfi = CATALOGO_ELECTIVAS.filter((e) => e.nombreOriginal === 'Trabajo Final Integrador');
  assert.equal(tfi.length, 2);
  assert.notEqual(slug(tfi[0].nombre), slug(tfi[1].nombre));
});

test('asignaturas de trayectos distinguen acceso y datos académicos pendientes', () => {
  for (const e of CATALOGO_ELECTIVAS.filter((e) => e.licenciatura)) {
    assert.equal(e.creditos, e.nombreOriginal === 'Trabajo Final Integrador' ? 0 : 3); // los TFI por ahora no suman
    assert.equal(e.requisitoAcceso, 23);
    assert.equal(e.correlativasConfirmadas, false);
    assert.equal(e.modalidad, null);
    assert.ok([2026, 2027].includes(e.desde));
  }
});

test('por el momento los Trabajos Finales Integradores y el Seminario no suman créditos', async () => {
  const M = await import('../src/lib/motor.js');
  const tfi = CATALOGO_ELECTIVAS.filter((e) => e.nombreOriginal === 'Trabajo Final Integrador');
  const elect = Object.fromEntries(tfi.map((e) => [slug(e.nombre), 'aprobada']));
  assert.deepEqual(M.creditos(elect, CATALOGO_ELECTIVAS, { 99: { estado: 'aprobada' } }, 'seguridad'), { ing: 0, analista: 0 });
  assert.equal(M.textoCreditos(tfi[0]), 'no suma créditos');
  assert.equal(M.textoCreditos({ creditos: 3 }), '3 créditos');
});
