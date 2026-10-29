import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mismosDatos } from '../src/lib/comparar.js';

test('mismosDatos: iguales -> true, distintos -> false', () => {
  const a = { estado: { 1: { estado: 'aprobada', nota: 6 } }, plan: {}, recursar: [], fechas: {}, electivas: {} };
  assert.equal(mismosDatos(a, structuredClone(a)), true);
  const b = structuredClone(a); b.estado[1].nota = 7;
  assert.equal(mismosDatos(a, b), false);
});

test('mismosDatos ignora el orden de claves pero no el de las listas', () => {
  assert.equal(mismosDatos({ e: { a: 'x', b: 'y' } }, { e: { b: 'y', a: 'x' } }), true);
  assert.equal(mismosDatos({ r: [1, 2] }, { r: [2, 1] }), false);
});
