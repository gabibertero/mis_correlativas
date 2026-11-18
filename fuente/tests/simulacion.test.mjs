import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAS_PLAN, ELECTIVAS, ESTADOS, ESTADO_INICIAL } from '../src/data/plan.js';
import { CATALOGO_ELECTIVAS } from '../src/data/trayectos.js';
import * as M from '../src/lib/motor.js';
import * as S from '../src/lib/simulacion.js';

const candidatas = MATERIAS_PLAN.map((m) => m.n);

test('acciones: solo se ofrece lo que cambia algo respecto del estado real', () => {
  assert.deepEqual(S.accionesPara('aprobada'), []);
  assert.deepEqual(S.accionesPara('pendiente'), ['regular', 'aprobada']);
  assert.deepEqual(S.accionesPara('cursando'), ['regular', 'aprobada', 'libre']);
  assert.deepEqual(S.accionesPara('regular'), ['aprobada', 'libre']);
  assert.deepEqual(S.accionesPara('recursando'), ['aprobada', 'libre']);
  assert.deepEqual(S.accionesPara('promocion'), ['aprobada']);
  assert.deepEqual(S.accionesPara('libre'), ['regular', 'aprobada']);
  assert.deepEqual(S.accionesPara('abandono'), ['regular', 'aprobada']);
  for (const e of ESTADOS) for (const a of S.accionesPara(e)) assert.notEqual(a, e, `${e} ofrece su propio estado`);
});

test('acciones ocultas no alterarían correlativas: ofrecerlas sería ruido', () => {
  // Para cada estado, una acción no ofrecida produce las mismas habilitaciones que "Como está".
  const base = { ...ESTADO_INICIAL };
  for (const n of [9, 15, 2, 18]) {
    for (const accion of ['regular', 'libre']) {
      const e = M.estadoDe(base, n);
      if (S.accionesPara(e).includes(accion) || e === 'aprobada') continue;
      const d = S.diferencias(base, M.aplicar(base, { [n]: accion }), candidatas.filter((x) => x !== n));
      assert.deepEqual([d.cursar, d.finales, d.perdidas], [[], [], []], `${n} ${e} -> ${accion}`);
    }
  }
});

test('filtros: lo que debo, habilitadas hoy y todas sin aprobadas', () => {
  for (const e of ['cursando', 'recursando', 'regular', 'promocion', 'libre']) assert.ok(S.enFiltro('debo', e));
  for (const e of ['pendiente', 'abandono', 'aprobada']) assert.ok(!S.enFiltro('debo', e));
  assert.ok(S.enFiltro('cursar', 'pendiente', true));
  assert.ok(!S.enFiltro('cursar', 'pendiente', false));
  assert.ok(S.enFiltro('todas', 'pendiente'));
  assert.ok(!S.enFiltro('todas', 'aprobada'));
  assert.equal(S.filtroInicial(['aprobada', 'cursando']), 'debo');
  assert.equal(S.filtroInicial(['aprobada', 'pendiente']), 'todas');
  assert.equal(S.filtroInicial([]), 'todas');
});

test('escenarios rápidos: regularizar lo que curso y aprobar todo lo que debo', () => {
  const reales = { 1: 'aprobada', 2: 'recursando', 9: 'cursando', 15: 'regular', 18: 'pendiente', 22: 'libre', 'e:x': 'cursando' };
  assert.deepEqual(S.escenarioRapido('regularizar-cursando', reales), { 9: 'regular', 'e:x': 'regular' });
  assert.deepEqual(S.escenarioRapido('aprobar-debo', reales), { 2: 'aprobada', 9: 'aprobada', 15: 'aprobada', 22: 'aprobada', 'e:x': 'aprobada' });
  assert.deepEqual(S.escenarioRapido('otro', reales), {});
});

test('diferencias: regularizar AM II (con AM I y AGA aprobadas) habilita Análisis Numérico y su final', () => {
  const real = { 1: { estado: 'aprobada' }, 2: { estado: 'aprobada' }, 9: { estado: 'cursando' }, 18: { estado: 'regular' } };
  const sin = S.diferencias(real, real, candidatas);
  assert.deepEqual([sin.cursar, sin.finales, sin.perdidas], [[], [], []]);
  const d = S.diferencias(real, M.aplicar(real, { 9: 'regular' }), candidatas);
  assert.deepEqual(d.cursar, [22]);
  assert.deepEqual(d.finales, [9]);
  assert.deepEqual(d.perdidas, []);
  // Aprobar AM II además destraba lo que la pide aprobada, sin perder nada.
  const ap = S.diferencias(real, M.aplicar(real, { 9: 'aprobada' }), candidatas);
  assert.ok(ap.cursar.includes(22));
  assert.deepEqual(ap.perdidas, []);
});

test('diferencias: quedar libre pierde el final y aprobar no cuenta como pérdida', () => {
  const real = { 1: { estado: 'regular' } };
  const libre = S.diferencias(real, M.aplicar(real, { 1: 'libre' }), candidatas);
  assert.ok(libre.perdidas.some((p) => p.n === 1 && p.tipo === 'final'));
  const aprob = S.diferencias(real, M.aplicar(real, { 1: 'aprobada' }), candidatas);
  assert.ok(!aprob.perdidas.some((p) => p.n === 1));
});

test('cifras: créditos solo con electivas aprobadas y cursadas incluye aprobadas', () => {
  const e = ELECTIVAS[0];
  const id = M.idElectiva(e);
  const est = { 1: { estado: 'aprobada' }, 2: { estado: 'regular' }, 3: { estado: 'cursando' }, [id]: { estado: 'regular' } };
  const electivas = CATALOGO_ELECTIVAS.filter((x) => !x.licenciatura);
  assert.deepEqual(S.cifras(est, electivas, null), { aprobadas: 1, cursadas: 2, creditos: 0, analista: 0 });
  const c = S.cifras(M.aplicar(est, { [id]: 'aprobada' }), electivas, null);
  assert.equal(c.creditos, e.creditos);
  assert.equal(c.analista, e.nivel === 3 ? e.creditos : 0);
});

test('delta en texto: signo explícito y menos tipográfico', () => {
  assert.equal(S.textoDelta(2), '+2');
  assert.equal(S.textoDelta(-3), '−3');
  assert.equal(S.textoDelta(0), 'Igual');
});
