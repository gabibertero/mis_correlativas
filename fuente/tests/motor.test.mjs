import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAS, ELECTIVAS, ESTADOS, ESTADO_INICIAL } from '../src/data/plan.js';
import * as M from '../src/lib/motor.js';

// Fixture: mesas de diciembre 2026 de Gabi (en la app viven en la cuenta como `finales`, ya no en plan.js).
const EXAMENES = [
  { fecha: '2026-11-30', materia: 18, tipo: 'equivalencia', etiqueta: 'Equivalencia · 1ª oportunidad' },
  { fecha: '2026-12-02', materia: 2,  tipo: 'final',        etiqueta: 'Final · opción 1', opcional: true },
  { fecha: '2026-12-14', materia: 18, tipo: 'equivalencia', etiqueta: 'Equivalencia · 2ª oportunidad' },
  { fecha: '2026-12-15', materia: 9,  tipo: 'final',        etiqueta: 'Final' },
  { fecha: '2026-12-16', materia: 2,  tipo: 'final',        etiqueta: 'Final · opción 2', opcional: true },
];

const T = (...ns) => Object.fromEntries(ns.map((n) => [n, { estado: 'aprobada' }]));
const todas = () => T(...MATERIAS.map((m) => m.n));
// PRNG determinista (mulberry32)
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const aleatorio = (r) => Object.fromEntries(MATERIAS.map((m) => [m.n, { estado: ESTADOS[Math.floor(r() * ESTADOS.length)] }]));

test('datos: correlativas referencian materias existentes y no hay ciclos', () => {
  for (const m of MATERIAS) {
    for (const r of [...m.reg, ...m.aprob]) assert.ok(M.porN[r], `${m.n} -> ${r}`);
    assert.ok(!M.destraba(m.n).has(m.n), `ciclo en ${m.n}`);
  }
});

test('cursar: sin estado solo se habilitan las de primer nivel sin correlativas', () => {
  const h = M.habilitadas({});
  assert.deepEqual(h, MATERIAS.filter((m) => !m.reg.length && !m.aprob.length).map((m) => m.n));
});

test('cursar: regular alcanza para reg pero no para aprob', () => {
  // AM II (9) pide reg 1 y 2
  assert.equal(M.puedeCursar({ 1: { estado: 'regular' }, 2: { estado: 'regular' } }, 9), true);
  // Economía (18) pide aprob 1 y 2
  assert.equal(M.puedeCursar({ 1: { estado: 'regular' }, 2: { estado: 'regular' } }, 18), false);
  assert.equal(M.puedeCursar(T(1, 2), 18), true);
  // cursando / pendiente / libre / abandono no cuentan
  for (const e of ['cursando', 'pendiente', 'libre', 'abandono']) assert.equal(M.puedeCursar({ 1: { estado: e }, 2: { estado: 'aprobada' } }, 9), false);
});

test('cursar: qué falta se reporta separado en reg y aprob', () => {
  const f = M.queFaltaParaCursar({ 13: { estado: 'regular' }, 5: { estado: 'aprobada' } }, 19); // BD: reg 13,16 · aprob 5,6
  assert.deepEqual(f, { reg: [16], aprob: [6] });
});

test('habilitada exige estar pendiente', () => {
  assert.equal(M.estaHabilitada({}, 1), true);
  assert.equal(M.estaHabilitada({ 1: { estado: 'cursando' } }, 1), false);
  assert.equal(M.estaHabilitada(T(1), 1), false);
});

test('final: regular + todas las correlativas aprobadas', () => {
  const base = { 9: { estado: 'regular' }, 1: { estado: 'aprobada' }, 2: { estado: 'regular' } };
  assert.equal(M.puedeRendirFinal(base, 9), false); // 2 solo regular
  assert.deepEqual(M.queFaltaParaFinal(base, 9).aprobar, [2]);
  assert.equal(M.puedeRendirFinal({ ...base, 2: { estado: 'aprobada' } }, 9), true);
  assert.equal(M.puedeRendirFinal({ ...base, 2: { estado: 'aprobada' }, 9: { estado: 'cursando' } }, 9), false); // no es regular
  assert.equal(M.queFaltaParaFinal({ 1: { estado: 'aprobada' }, 2: { estado: 'aprobada' } }, 9).regular, true);
});

test('Seminario (99): el final exige 1 a 23 aprobadas', () => {
  const casi = T(...MATERIAS.filter((m) => m.n <= 23 && m.n !== 22).map((m) => m.n));
  casi[99] = { estado: 'regular' };
  assert.equal(M.puedeRendirFinal(casi, 99), false);
  assert.deepEqual(M.queFaltaParaFinal(casi, 99).aprobar, [22]);
  casi[22] = { estado: 'aprobada' };
  assert.equal(M.puedeRendirFinal(casi, 99), true); // 24..36 no importan
  assert.equal(M.queFaltaParaFinal(casi, 99).aprobar.length, 0);
});

test('Seminario (99): cursar usa sus reg/aprob normales', () => {
  assert.equal(M.puedeCursar({ 16: { estado: 'regular' }, ...T(6, 8, 13, 14) }, 99), true);
  assert.equal(M.puedeCursar({ 16: { estado: 'regular' }, ...T(6, 8, 13) }, 99), false);
});

test('Proyecto Final (36): el final exige todo el plan (SIN el Seminario, que es opcional) y avisa la PPS', () => {
  const est = todas(); est[36] = { estado: 'regular' }; est[99] = { estado: 'pendiente' };
  assert.equal(M.puedeRendirFinal(est, 36), true); // el Seminario no cuenta
  est[30] = { estado: 'regular' };
  assert.equal(M.puedeRendirFinal(est, 36), false);
  assert.deepEqual(M.queFaltaParaFinal(est, 36).aprobar, [30]);
  assert.match(M.queFaltaParaFinal(est, 36).extra[0], /PPS/);
  est[20] = { estado: 'cursando' };
  assert.equal(M.puedeRendirFinal(est, 36), false);
});

test('destraba: cierre transitivo conocido', () => {
  const d = M.destraba(6); // AED
  for (const n of [13, 14, 19, 20, 23, 25, 30, 99, 36]) assert.ok(d.has(n), `6 destraba ${n}`);
  assert.ok(!d.has(1) && !d.has(6));
  assert.deepEqual([...M.destraba(36)], []); // hoja
  assert.ok(M.destraba(1).has(31)); // AM I -> ... -> IA
  // no incluye electivas: sólo números del plan
  for (const x of M.destraba(1)) assert.ok(M.porN[x]);
});

test('destraba: propiedades sobre todo el plan (clausura y consistencia con reg/aprob)', () => {
  for (const m of MATERIAS) {
    const d = M.destraba(m.n);
    for (const x of d) for (const y of M.destraba(x)) assert.ok(d.has(y), `${m.n}: clausura ${x}->${y}`);
    for (const x of MATERIAS) if (x.reg.includes(m.n) || x.aprob.includes(m.n)) assert.ok(d.has(x.n)); // directas incluidas
    for (const x of d) assert.ok(M.destraba(x).size < d.size || d.size === 0); // estrictamente menor (DAG)
  }
});

test('destraba: devuelve copia (no se puede ensuciar la caché)', () => {
  const a = M.destraba(1); a.clear();
  assert.ok(M.destraba(1).size > 0);
});

test('seDesbloquea: se habilita si aprueba lo que cursa', () => {
  // Simulación (28): reg 17 · aprob 9. Con 9 cursando y 17 aprobada -> naranja para cursar
  const est = { 17: { estado: 'aprobada' }, 9: { estado: 'cursando' } };
  assert.deepEqual(M.seDesbloquea(est, 28), { cursar: true, final: false });
  assert.deepEqual(M.seDesbloquea({ 17: { estado: 'aprobada' }, 9: { estado: 'pendiente' } }, 28), { cursar: false, final: false });
  // ya habilitada hoy -> no es "se desbloquea"
  assert.deepEqual(M.seDesbloquea({ 17: { estado: 'aprobada' }, 9: { estado: 'aprobada' } }, 28), { cursar: false, final: false });
  // final: AM II regular, AGA cursando -> aprobando AGA puede rendir
  assert.deepEqual(M.seDesbloquea({ 9: { estado: 'regular' }, 1: { estado: 'aprobada' }, 2: { estado: 'cursando' } }, 9), { cursar: false, final: true });
  // lo que cursa la propia materia no cuenta
  assert.deepEqual(M.seDesbloquea({ 9: { estado: 'cursando' }, ...T(1, 2) }, 9), { cursar: false, final: false });
});

test('estado real de Gabi (ESTADO_INICIAL)', () => {
  const est = ESTADO_INICIAL;
  const r = M.resumen(est);
  assert.equal(r.aprobadas, 14);
  assert.equal(r.total, 36);
  assert.equal(r.pct, 39); // 14/36
  assert.deepEqual(M.habilitadas(est), [23]); // el Seminario (opcional) no se ofrece
  assert.deepEqual(M.puedeCursar(est, 99), true); // pero sigue existiendo en la malla
  assert.deepEqual(M.rendibles(est), [2, 15, 16]); // AGA recursando (regular), SO y ASI regulares con sus correlativas
  assert.deepEqual(M.seDesbloquea(est, 28), { cursar: true, final: false }); // Simulación si aprueba AM II
  assert.equal(M.seDesbloquea(est, 22).cursar, false); // Análisis Numérico: aprob 1,2 y AGA está recursando (regular, no aprobada): "aprobar lo que cursás" no la libera
  assert.equal(M.puedeCursar(est, 25), false); // Calidad: falta Diseño
  assert.deepEqual(M.queFaltaParaCursar(est, 25).reg, [23]);
  assert.ok(Math.abs(r.promedio - [6, 6, 8, 8, 9, 6, 9, 10, 7, 8, 9, 7, 7, 8].reduce((a, b) => a + b) / 14) < 1e-9);
  const top = M.masDestraban(est, 3);
  assert.equal(top.length, 3);
  assert.ok(top[0].impacto >= top[1].impacto && top[1].impacto >= top[2].impacto);
});

test('veredicto: textos según el caso', () => {
  assert.match(M.veredicto(T(1), 1).texto, /aprobaste/);
  assert.equal(M.veredicto({}, 1).tono, 'ok');
  assert.match(M.veredicto({}, 9).texto, /Todavía no podés cursarla: te falta regularizar/);
  assert.equal(M.veredicto({}, 9).tono, 'falta');
  assert.equal(M.veredicto({ 1: { estado: 'regular' }, 2: { estado: 'regular' }, 9: { estado: 'regular' } }, 9).tono, 'falta');
  assert.equal(M.veredicto(ESTADO_INICIAL, 28).tono, 'espera');
  assert.match(M.veredicto(ESTADO_INICIAL, 15).texto, /Podés rendir/);
  assert.equal(M.veredicto(ESTADO_INICIAL, 9).texto, 'La estás cursando.');
});

test('propiedades con 300 estados aleatorios', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const est = aleatorio(rng(seed));
    const hab = new Set(M.habilitadas(est));
    assert.ok(!hab.has(99));
    for (const m of MATERIAS) {
      const e = M.estadoDe(est, m.n);
      const cursar = m.reg.every((r) => ['regular', 'recursando', 'promocion', 'aprobada'].includes(M.estadoDe(est, r))) && m.aprob.every((r) => M.estadoDe(est, r) === 'aprobada');
      assert.equal(M.puedeCursar(est, m.n), cursar, `seed ${seed} cursar ${m.n}`);
      assert.equal(hab.has(m.n), ['pendiente', 'libre', 'abandono'].includes(e) && cursar && !m.opcional);
      if (M.puedeRendirFinal(est, m.n)) {
        assert.ok(['regular', 'recursando', 'promocion'].includes(e));
        for (const r of [...m.reg, ...m.aprob]) assert.equal(M.estadoDe(est, r), 'aprobada', `seed ${seed} final ${m.n}`); // final ⊆ reg ∪ aprob aprobadas
        assert.ok(M.puedeCursar(est, m.n), 'quien rinde el final también cumple las de cursar');
      }
      const sd = M.seDesbloquea(est, m.n);
      assert.ok(!(sd.cursar && M.estaHabilitada(est, m.n)));
      assert.ok(!(sd.final && M.puedeRendirFinal(est, m.n)));
    }
  }
});

test('monotonía: mejorar el estado de una materia nunca quita habilitaciones', () => {
  const orden = { pendiente: 0, cursando: 0, libre: 0, abandono: 0, regular: 1, promocion: 1, aprobada: 2 };
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 7);
    const est = aleatorio(r);
    const m = MATERIAS[Math.floor(r() * MATERIAS.length)].n;
    const e0 = M.estadoDe(est, m);
    if (e0 === 'aprobada') continue;
    const mejor = M.aplicar(est, { [m]: orden[e0] === 0 ? 'regular' : 'aprobada' });
    for (const x of MATERIAS) {
      if (x.n === m) continue;
      if (M.puedeCursar(est, x.n)) assert.ok(M.puedeCursar(mejor, x.n), `seed ${seed}`);
      if (M.puedeRendirFinal(est, x.n)) assert.ok(M.puedeRendirFinal(mejor, x.n), `seed ${seed}`);
    }
  }
});

test('plan completo aprobado: nada que cursar, nada que rendir', () => {
  const est = todas();
  assert.deepEqual(M.habilitadas(est), []);
  assert.deepEqual(M.rendibles(est), []);
  assert.equal(M.resumen(est).pct, 100);
});

test('aplicar no muta el original', () => {
  const est = { 1: { estado: 'regular', nota: 5 } };
  const c = M.aplicar(est, { 1: 'aprobada', 2: 'regular' });
  assert.equal(est[1].estado, 'regular');
  assert.equal(c[1].estado, 'aprobada');
  assert.equal(c[1].nota, 5);
  assert.equal(c[2].estado, 'regular');
});

test('créditos: Ingeniería suma todas, Analista solo 3er nivel', () => {
  const id = (nombre) => M.slug(nombre);
  const e = { [id('Backend de Aplicaciones')]: 'aprobada', [id('Green Software')]: 'aprobada', [id('Arquitectura de Software')]: 'cursando' };
  assert.deepEqual(M.creditos(e, ELECTIVAS), { ing: 7, analista: 4 });
  assert.deepEqual(M.creditos({}, ELECTIVAS), { ing: 0, analista: 0 });
  assert.equal(new Set(ELECTIVAS.map((x) => M.slug(x.nombre))).size, ELECTIVAS.length); // ids únicos
});

test('electivas: faltan() sirve igual que para materias', () => {
  const bd = ELECTIVAS.find((x) => x.nombre === 'Desarrollo de Aplicaciones con Objetos'); // reg 13 · aprob 6
  assert.deepEqual(M.faltan({}, bd), { reg: [13], aprob: [6] });
  assert.deepEqual(M.faltan({ 13: { estado: 'regular' }, 6: { estado: 'aprobada' } }, bd), { reg: [], aprob: [] });
});

test('fechas: diasHasta y proximaMesa', () => {
  const hoy = new Date(2026, 10, 27, 15, 30); // 27/11 a la tarde
  assert.equal(M.diasHasta('2026-11-27', hoy), 0);
  assert.equal(M.diasHasta('2026-11-30', hoy), 3);
  assert.equal(M.diasHasta('2026-11-26', hoy), -1);
  assert.equal(M.diasHasta('2027-03-14', hoy), 107);
  const p = M.proximaMesa(EXAMENES, {}, {}, hoy);
  assert.equal(p.fecha, '2026-11-30');
  assert.equal(p.dias, 3);
  // con Economía aprobada se saltea y sigue AGA 2/12
  assert.equal(M.proximaMesa(EXAMENES, {}, T(18), hoy).fecha, '2026-12-02');
  // fecha de turno editable más cercana gana
  const q = M.proximaMesa(EXAMENES, { 'feb-mar-2027': '2026-11-28' }, {}, hoy);
  assert.equal(q.fecha, '2026-11-28');
  assert.equal(q.materia, null);
  // fechas inválidas / ids desconocidos se ignoran; sin nada vigente -> null
  assert.equal(M.proximaMesa([], { 'otro': '2027-01-01' }, {}, hoy), null);
  assert.equal(M.proximaMesa(EXAMENES, {}, {}, new Date(2027, 0, 1)), null);
});

test('planificador: previas proyectadas, avisos y horas', () => {
  // cuatrimestres previos quedan aprobados: Calidad (25) con Diseño (23) antes
  const proy = M.proyectarPrevias(ESTADO_INICIAL, [23]);
  assert.equal(M.estadoDe(proy, 23), 'aprobada');
  assert.equal(M.estadoDe(ESTADO_INICIAL, 23), 'pendiente'); // no muta
  assert.deepEqual(M.avisosMateria(proy, 25), []);
  const av = M.avisosMateria(ESTADO_INICIAL, 25);
  assert.equal(av.length, 1);
  assert.match(av[0], /falta regularizar Diseño de Sistemas/);
  assert.deepEqual(M.avisosMateria(ESTADO_INICIAL, 9), []);
  assert.match(M.avisosMateria(ESTADO_INICIAL, 1)[0], /ya la aprobaste/);
  assert.equal(M.horasDe([9, 10, 2, 21, 24]), 21);
  assert.equal(M.horasDe([]), 0);
});

// ---------- Seminario opcional, proyecciones, urgencia, créditos ----------
test('total 36: el Seminario (99) existe pero no entra en ningún conteo', () => {
  assert.ok(M.porN[99].opcional);
  for (const est of [{}, ESTADO_INICIAL, todas()]) {
    const r = M.resumen(est);
    assert.equal(r.total, 36);
    assert.equal(r.niveles.reduce((a, n) => a + n.total, 0), 36);
    assert.equal(r.niveles.find((n) => n.nv === 3).total, 6);
    assert.ok(r.aprobadas <= 36 && r.pct <= 100);
  }
  assert.equal(M.resumen(todas()).pct, 100);
  assert.equal(M.resumen(todas()).aprobadas, 36);
});

test('proyecciones: hoy, "si apruebo lo que curso" y "+ finales" (Gabi: 14 / 19 / 21 de 36)', () => {
  const r = M.resumen(ESTADO_INICIAL);
  assert.deepEqual([r.aprobadas, r.pct], [14, 39]);
  assert.deepEqual(r.proyCursando, { n: 18, pct: 50 }); // + AM II, Fís II, COM, Legislación (AGA recursando ya está regular: no suma)
  assert.deepEqual(r.proyFinales, { n: 21, pct: 58 });  // + AGA, SO y ASI (regular/recursando con final habilitado)
  assert.equal(r.finales, 3);
});

test('proyecciones: propiedades con 300 estados aleatorios', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const est = aleatorio(rng(seed)); const r = M.resumen(est);
    const cursa = MATERIALES().filter((m) => M.estadoDe(est, m.n) === 'cursando').length;
    assert.ok(r.pct <= r.proyCursando.pct && r.proyCursando.pct <= r.proyFinales.pct && r.proyFinales.pct <= 100, `seed ${seed}`);
    assert.equal(r.proyCursando.n, r.aprobadas + cursa);
    assert.equal(r.proyFinales.n, r.proyCursando.n + M.rendibles(est).length);
    assert.equal(r.finales, M.rendibles(est).length);
    assert.equal(r.urgencia, M.nivelUrgencia(r.finales));
  }
});
function MATERIALES() { return MATERIAS.filter((m) => !m.opcional); }

test('urgencia de finales: 0 ok, 1-2 medio, 3+ alto', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(M.nivelUrgencia), ['ok', 'medio', 'medio', 'alto', 'alto', 'alto']);
  assert.equal(M.resumen({}).urgencia, 'ok');
  assert.equal(M.resumen(ESTADO_INICIAL).urgencia, 'alto'); // 3 finales
});

test('créditos: el Seminario aprobado suma 6 solo a Ingeniería', () => {
  const elect = { 'backend-de-aplicaciones': 'aprobada', 'green-software': 'aprobada', 'testing-de-software': 'cursando' };
  assert.deepEqual(M.creditos(elect, ELECTIVAS), { ing: 7, analista: 4 });
  assert.deepEqual(M.creditos(elect, ELECTIVAS, {}), { ing: 7, analista: 4 });
  assert.deepEqual(M.creditos(elect, ELECTIVAS, { 99: { estado: 'regular' } }), { ing: 7, analista: 4 }); // no aprobado: nada
  assert.deepEqual(M.creditos(elect, ELECTIVAS, { 99: { estado: 'aprobada' } }), { ing: 13, analista: 4 });
  assert.deepEqual(M.creditos({}, ELECTIVAS, { 99: { estado: 'aprobada' } }), { ing: 6, analista: 0 });
});

// ---------- Planificador: validar y proponer ----------
const IDS = ['2026-2C', '2027-1C', '2027-2C', '2028-1C', '2028-2C', '2029-1C', '2029-2C', '2030-1C', '2030-2C'];
const fijoGabi = MATERIAS.filter((m) => M.estadoDe(ESTADO_INICIAL, m.n) === 'cursando').map((m) => m.n);

test('proponer: plan válido para Gabi (correlativas, modalidad, horas, sin repetir, completo)', () => {
  const { plan, sinUbicar } = M.proponerPlan(ESTADO_INICIAL, IDS, { fijo: fijoGabi });
  assert.deepEqual(sinUbicar, []);
  assert.deepEqual(plan[IDS[0]], fijoGabi);
  const todasPuestas = Object.values(plan).flat();
  assert.equal(new Set(todasPuestas).size, todasPuestas.length);
  assert.ok(!todasPuestas.includes(99)); // opcional
  // lo que falta del plan quedó ubicado
  const faltan = MATERIAS.filter((m) => !m.opcional && !['aprobada', 'regular', 'recursando', 'promocion'].includes(M.estadoDe(ESTADO_INICIAL, m.n))).map((m) => m.n).sort((a, b) => a - b);
  assert.deepEqual([...todasPuestas].sort((a, b) => a - b), faltan);
  IDS.forEach((_, i) => assert.deepEqual(M.avisosCuatri(ESTADO_INICIAL, plan, IDS, i), [], `cuatri ${IDS[i]}`));
});

// Horizonte más largo: con muchos libre/abandono (equivalen a pendiente) la cadena de correlativas no entra en 9 cuatrimestres.
const IDS_LARGO = [...IDS, '2031-1C', '2031-2C', '2032-1C', '2032-2C', '2033-1C', '2033-2C'];
test('proponer: propiedades con 150 estados aleatorios', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 13);
    const est = aleatorio(r);
    const fijo = MATERIAS.filter((m) => M.estadoDe(est, m.n) === 'cursando').map((m) => m.n);
    const hsLimite = 12 + Math.floor(r() * 25);
    const { plan, sinUbicar } = M.proponerPlan(est, IDS_LARGO, { hsLimite, fijo });
    const puestas = Object.values(plan).flat();
    assert.equal(new Set(puestas).size, puestas.length, `seed ${seed} repetidas`);
    IDS_LARGO.forEach((_, i) => {
      assert.ok(M.horasCuatri(est, plan, IDS_LARGO, i) <= Math.max(hsLimite, i === 0 ? Infinity : 0), `seed ${seed} horas ${i}`);
      if (i > 0) assert.deepEqual(M.avisosCuatri(est, plan, IDS_LARGO, i, hsLimite), [], `seed ${seed} cuatri ${i}`);
    });
    // lo que no se ubicó es porque una sola materia no entra en el límite o no alcanzaron los cuatrimestres
    for (const n of sinUbicar) assert.ok(!puestas.includes(n));
    if (hsLimite >= 26) assert.deepEqual(sinUbicar, [], `seed ${seed} sin ubicar`);
  }
});

test('validar: avisos de correlativas, modalidad, repetidas y horas al mover', () => {
  const ids = IDS.slice(0, 4);
  assert.deepEqual(M.avisosCuatri(ESTADO_INICIAL, { '2026-2C': [], '2027-1C': [], '2027-2C': [], '2028-1C': [] }, ids, 1), []);
  const mal = { '2026-2C': [], '2027-1C': [25], '2027-2C': [], '2028-1C': [] };
  assert.match(M.avisosCuatri(ESTADO_INICIAL, mal, ids, 1)[0], /falta regularizar Diseño/);
  // Diseño (23, anual) en 2027-1C: Calidad en 2027-2C todavía NO (el anual termina recién en 2027-2C)
  const anual = { '2026-2C': [], '2027-1C': [23], '2027-2C': [25], '2028-1C': [] };
  assert.equal(M.horasCuatri(ESTADO_INICIAL, anual, ids, 2), 3 + 6); // 23 sigue ocupando horas
  assert.match(M.avisosCuatri(ESTADO_INICIAL, anual, ids, 2).join(' '), /falta regularizar Diseño/);
  assert.deepEqual(M.avisosCuatri(ESTADO_INICIAL, { ...anual, '2027-2C': [], '2028-1C': [25] }, ids, 3), []);
  // modalidad: Diseño (anual) en un 2C; Testing (solo 2C) en un 1C
  assert.match(M.avisosCuatri(ESTADO_INICIAL, { '2027-2C': [23] }, ids, 2).join(' '), /anual, arrancando en el 1º/);
  // repetida + sobrecarga
  const rep = { '2027-1C': [23, 36], '2027-2C': [23] };
  assert.match(M.avisosCuatri(ESTADO_INICIAL, rep, ids, 2).join(' '), /repetida/);
  assert.match(M.avisosCuatri(ESTADO_INICIAL, { '2027-1C': [23, 36, 26, 27, 30, 25, 28] }, ids, 1, 30).join(' '), /Te pasás por 2 hs/);
});

test('proponer: desde cero elige primero lo que más destraba y respeta el límite', () => {
  const { plan } = M.proponerPlan({}, IDS.slice(0, 3), { hsLimite: 10 });
  const ns = plan['2027-1C'];
  assert.ok(M.horasDe(ns) <= 10 && ns.length);
  const impactos = ns.map((n) => M.destraba(n).size);
  assert.deepEqual(impactos, [...impactos].sort((a, b) => b - a));
});

// ---------- Planificador con electivas ----------
test('planificador: electiva habilitada suma sus créditos como horas y no avisa', () => {
  const e = ELECTIVAS.find((x) => x.nombre === 'Backend de Aplicaciones'); // 2C · reg 13,14 · aprob 6
  const id = M.idElectiva(e);
  const ids = ['2026-2C', '2027-1C', '2027-2C'];
  assert.ok(M.esElectiva(id) && !M.esElectiva(13) && !M.esElectiva('e:nada') && !M.esElectiva('constructor'));
  const est = T(6, 13, 14);
  const plan = { '2026-2C': [id], '2027-1C': [], '2027-2C': [] };
  assert.equal(M.horasCuatri(est, plan, ids, 0), e.creditos);
  assert.equal(M.horasDe([9, id]), M.horasDe([9]) + e.creditos);
  assert.deepEqual(M.avisosCuatri(est, plan, ids, 0), []);
});
test('planificador: electiva sin correlativas avisa; modalidad fuera de cuatri avisa; previas la habilitan', () => {
  const e = ELECTIVAS.find((x) => x.nombre === 'Backend de Aplicaciones');
  const id = M.idElectiva(e);
  const ids = ['2026-2C', '2027-1C', '2027-2C'];
  const plan = { '2026-2C': [], '2027-1C': [id], '2027-2C': [] };
  const av = M.avisosCuatri({}, plan, ids, 1);
  assert.ok(av.some((t) => /Backend de Aplicaciones: falta regularizar/.test(t)));
  assert.ok(av.some((t) => /Backend de Aplicaciones: falta el final aprobado de/.test(t)));
  assert.ok(av.some((t) => /solo en el 2º cuatrimestre/.test(t)));
  // lo del cuatri previo del plan cuenta como aprobado (6, 13, 14 en 2026-2C -> Backend en 2027-2C)
  const ok = { '2026-2C': [6, 13, 14], '2027-1C': [], '2027-2C': [id] };
  assert.deepEqual(M.avisosCuatri({}, ok, ids, 2).filter((t) => t.startsWith('Backend')), []);
});
test('planificador: cualquier electiva en cualquier cuatri no rompe y suma créditos (semillas)', () => {
  const ids = ['2026-2C', '2027-1C', '2027-2C', '2028-1C'];
  for (let s = 1; s <= 200; s++) {
    const r = rng(s); const e = ELECTIVAS[Math.floor(r() * ELECTIVAS.length)]; const i = Math.floor(r() * ids.length);
    const est = aleatorio(r); const plan = Object.fromEntries(ids.map((x) => [x, []])); plan[ids[i]] = [M.idElectiva(e)];
    assert.equal(M.horasCuatri(est, plan, ids, i), e.creditos);
    const f = M.faltan(M.estadoEnCuatri(est, plan, ids, i), e);
    const hay = M.avisosCuatri(est, plan, ids, i).some((t) => t.startsWith(`${e.nombre}: falta`));
    assert.equal(hay, M.estadoDe(est, M.idElectiva(e)) === 'pendiente' && (f.reg.length + f.aprob.length > 0));
  }
});

// ---------- Nuevo modelo de estados (7) ----------
test('estados: el set real (8, con "recursando")', () => {
  assert.deepEqual(ESTADOS, ['pendiente', 'cursando', 'recursando', 'regular', 'promocion', 'aprobada', 'libre', 'abandono']);
  assert.ok(Object.values(ESTADO_INICIAL).every((v) => ESTADOS.includes(v.estado)));
  assert.equal(ESTADO_INICIAL[2].estado, 'recursando'); // AGA
});

test('semántica: "necesita regular" lo satisfacen regular, promoción y aprobada; el resto no', () => {
  // AM II (9) pide reg 1 y 2
  for (const e of ESTADOS) {
    const ok = ['regular', 'recursando', 'promocion', 'aprobada'].includes(e);
    assert.equal(M.puedeCursar({ 1: { estado: e }, 2: { estado: e } }, 9), ok, e);
  }
});

test('semántica: "necesita aprobada" solo la satisface aprobada (promoción NO)', () => {
  // Economía (18) pide aprob 1 y 2
  for (const e of ESTADOS) assert.equal(M.puedeCursar({ 1: { estado: e }, 2: { estado: e } }, 18), e === 'aprobada', e);
});

test('semántica: promoción es final rendible, regular y recursando también; libre/abandono/cursando no', () => {
  for (const e of ESTADOS) {
    const est = { ...T(1, 2), 18: { estado: e } };
    assert.equal(M.puedeRendirFinal(est, 18), e === 'regular' || e === 'recursando' || e === 'promocion', e);
  }
  // con una correlativa solo promocionada el final NO se puede rendir
  assert.equal(M.puedeRendirFinal({ 1: { estado: 'promocion' }, 2: { estado: 'aprobada' }, 18: { estado: 'regular' } }, 18), false);
  assert.deepEqual(M.rendibles({ ...T(1, 2), 18: { estado: 'promocion' } }), [18]);
});

test('semántica: promoción no suma al avance hasta rendir el final; sí cuenta como final por rendir', () => {
  const est = { ...T(1, 2), 18: { estado: 'promocion', nota: 9 } };
  const r = M.resumen(est);
  assert.equal(r.aprobadas, 2);
  assert.equal(r.finales, 1);
  assert.equal(r.proyFinales.n, 3);
  assert.equal(r.notas, 0); // la nota de la promoción no entra al promedio hasta aprobar el final
  assert.equal(M.resumen({ ...est, 18: { estado: 'aprobada', nota: 9 } }).aprobadas, 3);
});

test('semántica: libre y abandono no satisfacen nada, no cuentan en avance ni proyecciones, se pueden retomar', () => {
  for (const e of ['libre', 'abandono']) {
    const est = { 1: { estado: 'aprobada' }, 2: { estado: 'aprobada' }, 9: { estado: e } };
    const r = M.resumen(est);
    assert.equal(r.aprobadas, 2);
    assert.equal(r.proyCursando.n, 2);
    assert.equal(r.proyFinales.n, 2);
    assert.equal(M.puedeRendirFinal(est, 9), false);
    assert.equal(M.puedeCursar({ 9: { estado: e }, 1: { estado: 'aprobada' } }, 28), false); // 28 necesita 9 aprobada
    assert.equal(M.estaHabilitada(est, 9), true); // retomable
    assert.match(M.veredicto(est, 9).texto, e === 'libre' ? /libre/ : /dejaste/);
  }
});

test('semántica: proyecciones = (aprobada + cursando) y + rendibles de regular/promoción', () => {
  const est = { ...T(1, 2), 3: { estado: 'cursando' }, 18: { estado: 'promocion' }, 9: { estado: 'regular' }, 4: { estado: 'libre' } };
  // 9 (AM II) regular con reg 1,2 aprobadas -> rendible; 18 promoción con 1,2 aprobadas -> rendible
  const r = M.resumen(est);
  assert.deepEqual([r.aprobadas, r.proyCursando.n, r.proyFinales.n], [2, 3, 5]);
});

test('semántica: "si apruebo lo que curso" no promueve a promoción ni toca libre/abandono', () => {
  const est = { 1: { estado: 'cursando' }, 2: { estado: 'cursando' }, 3: { estado: 'promocion' }, 4: { estado: 'libre' } };
  const p = M.aprobandoLoQueCursa(est);
  assert.deepEqual([1, 2, 3, 4].map((n) => M.estadoDe(p, n)), ['aprobada', 'aprobada', 'promocion', 'libre']);
});

test('semántica: promoción de una correlativa de aprobada no destraba el final pero sí el cursado', () => {
  // AM II promocionada: Análisis Numérico (22) pide reg 9 y aprob 1,2 -> se puede cursar; pero finales de lo que dependa de 9 aprobada, no
  const est = { ...T(1, 2), 9: { estado: 'promocion' } };
  assert.equal(M.puedeCursar(est, 22), true);
  assert.equal(M.puedeCursar(est, 28), false); // Simulación pide aprob 9
  assert.deepEqual(M.seDesbloquea({ ...T(1, 2, 17), 9: { estado: 'cursando' } }, 28), { cursar: true, final: false });
});

test('semántica: la nota solo la admiten aprobada y promoción; el Seminario solo suma créditos con aprobada', () => {
  for (const e of ESTADOS) assert.equal(M.admiteNota(e), e === 'aprobada' || e === 'promocion', e);
  assert.deepEqual(M.creditos({}, ELECTIVAS, { 99: { estado: 'promocion' } }), { ing: 0, analista: 0 });
});

test('planificador: promoción se asume rendida y no se vuelve a proponer', () => {
  const est = { ...T(1, 2), 18: { estado: 'promocion' } };
  assert.equal(M.estadoDe(M.asumirRendidos(est), 18), 'aprobada');
  const { plan } = M.proponerPlan(est, IDS);
  assert.ok(!Object.values(plan).flat().includes(18));
});

test('recursando: como regular (habilita cursar, final rendible) pero no suma al avance ni a "si apruebo lo que curso"', () => {
  const est = { ...T(1), 2: { estado: 'recursando' } };
  assert.equal(M.puedeCursar({ 1: { estado: 'aprobada' }, 2: { estado: 'recursando' } }, 9), true); // AM II pide reg 1 y 2
  assert.equal(M.puedeCursar({ 1: { estado: 'aprobada' }, 2: { estado: 'recursando' } }, 18), false); // Economía pide aprob 2
  assert.deepEqual(M.rendibles(est), [2]);
  const r = M.resumen(est);
  assert.deepEqual([r.aprobadas, r.proyCursando.n, r.proyFinales.n, r.finales], [1, 1, 2, 1]);
  assert.ok(!M.habilitadas(est).includes(2)); // no se vuelve a ofrecer como "para cursar"
  assert.match(M.veredicto(est, 2).texto, /regular/);
});

// ---------- Modalidad, orden, recursar ----------
test('modalidadInfo: cada código', () => {
  const f = (modalidad) => M.modalidadInfo({ modalidad });
  assert.deepEqual(f('A'), { anual: true, principal: null, contra: null, soloCuatri: null, label: 'Anual' });
  assert.deepEqual(f('1C-2C'), { anual: false, principal: 1, contra: 2, soloCuatri: null, label: '1º cuatri' });
  assert.deepEqual(f('2C-1C'), { anual: false, principal: 2, contra: 1, soloCuatri: null, label: '2º cuatri' });
  assert.deepEqual(f('1C'), { anual: false, principal: 1, contra: null, soloCuatri: 1, label: 'Solo 1º cuatri' });
  assert.deepEqual(f('2C'), { anual: false, principal: 2, contra: null, soloCuatri: 2, label: 'Solo 2º cuatri' });
});

test('ordenarPlan: anuales, cuatrimestrales, electivas; por Nº', () => {
  const e = M.idElectiva(ELECTIVAS[0]);
  assert.deepEqual(M.ordenarPlan([28, e, 22, 18, 26, 23]), [23, 26, 18, 22, 28, e]);
  // con muchas permutaciones el resultado es el mismo
  for (let s = 1; s < 50; s++) {
    const xs = [28, e, 22, 18, 26, 23].sort((a, b) => Math.sin(s * String(a).length + a) - Math.sin(s + String(b).length * 3 + b));
    assert.deepEqual(M.ordenarPlan(xs), [23, 26, 18, 22, 28, e]);
  }
});

test('recursar suprime "ya la tenés" pero no correlativas ni horas', () => {
  const ids = ['2026-2C', '2027-1C'];
  const est = { 1: { estado: 'aprobada' }, 18: { estado: 'regular' } };
  const plan = { '2026-2C': [], '2027-1C': [1, 18, 25] };
  const sin = M.avisosCuatri(est, plan, ids, 1, 30);
  assert.ok(sin.some((t) => /ya la aprobaste/.test(t)) && sin.some((t) => /ya la tenés regular/.test(t)));
  const con = M.avisosCuatri(est, plan, ids, 1, 30, new Set([1, 18, 25]));
  assert.ok(!con.some((t) => /ya la/.test(t)));
  assert.ok(con.some((t) => /falta regularizar/.test(t))); // Calidad (25) sigue sin correlativas
  const pesado = M.avisosCuatri(est, { ...plan, '2027-1C': [1, 2, 3, 5, 6, 7, 8, 9, 10] }, ids, 1, 10, new Set([1]));
  assert.ok(pesado.some((t) => /límite/.test(t)) && !pesado.some((t) => /Análisis Matemático I: ya/.test(t)));
});

test('modalidad: 2C-1C en cualquier cuatri no da error (solo nota); 2C en 1C sí; A en 2C sí', () => {
  const ids = ['2027-1C', '2027-2C'];
  const modal = (est, n, k) => M.avisosCuatri(est, { '2027-1C': k === 0 ? [n] : [], '2027-2C': k === 1 ? [n] : [] }, ids, k, 99).filter((t) => /se dicta/.test(t));
  for (let k = 0; k < 2; k++) assert.deepEqual(modal({}, 7, k), []);
  assert.equal(M.notasCuatri({ '2027-1C': [7], '2027-2C': [] }, ids, 0).length, 1); // 7 es 2C-1C: el 1C es su contra
  assert.equal(M.notasCuatri({ '2027-1C': [], '2027-2C': [7] }, ids, 1).length, 0);
  const solo2 = MATERIAS.find((m) => m.modalidad === '2C'), solo1 = MATERIAS.find((m) => m.modalidad === '1C');
  if (solo2) { assert.equal(modal({}, solo2.n, 0).length, 1); assert.equal(modal({}, solo2.n, 1).length, 0); }
  if (solo1) { assert.equal(modal({}, solo1.n, 1).length, 1); assert.equal(modal({}, solo1.n, 0).length, 0); }
  assert.equal(modal({}, 1, 1).length, 1); // anual en 2C
});

test('proponerPlan deja cada cuatri ordenado', () => {
  const ids = ['2026-2C', '2027-1C', '2027-2C', '2028-1C', '2028-2C', '2029-1C'];
  const { plan } = M.proponerPlan({}, ids, {});
  for (const id of ids) assert.deepEqual(plan[id], M.ordenarPlan(plan[id]));
});

test('resumenPorNivel: capas sin doble conteo (300 estados aleatorios)', () => {
  const estados = ['pendiente', 'cursando', 'regular', 'recursando', 'promocion', 'aprobada', 'libre', 'abandono'];
  for (let s = 1; s <= 300; s++) {
    let x = s * 2654435761 % 2 ** 32; const rnd = () => (x = (x * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const est = Object.fromEntries(MATERIAS.map((m) => [m.n, { estado: estados[Math.floor(rnd() * estados.length)] }]));
    const niv = M.resumenPorNivel(est);
    const r = M.resumen(est);
    for (const n of niv) assert.ok(n.aprobadas + n.masCursando + n.masFinales <= n.total);
    const sum = (k) => niv.reduce((a, n) => a + n[k], 0);
    assert.equal(sum('aprobadas'), r.aprobadas);
    assert.equal(sum('aprobadas') + sum('masCursando'), r.proyCursando.n);
    assert.equal(sum('aprobadas') + sum('masCursando') + sum('masFinales'), r.proyFinales.n);
  }
});

test('proximosFinales: ordenados, futuros y sin materias aprobadas', () => {
  const hoy = new Date(2026, 9, 28);
  const l = M.proximosFinales(EXAMENES, ESTADO_INICIAL, hoy);
  assert.deepEqual(l.map((e) => e.fecha), ['2026-11-30', '2026-12-02', '2026-12-14', '2026-12-15', '2026-12-16']);
  assert.ok(l.every((e, i) => e.dias >= 0 && (!i || l[i - 1].dias <= e.dias)));
  assert.equal(M.proximosFinales(EXAMENES, { ...ESTADO_INICIAL, 2: { estado: 'aprobada' } }, hoy).some((e) => e.materia === 2), false);
  assert.deepEqual(M.proximosFinales(EXAMENES, ESTADO_INICIAL, new Date(2026, 11, 15)).map((e) => e.fecha), ['2026-12-15', '2026-12-16']);
});

test('planProximoAnio: 1C y 2C 2027 con razón y orden de proponerPlan', () => {
  const p = M.planProximoAnio(ESTADO_INICIAL);
  assert.deepEqual(p.map((c) => c.id), ['2027-1C', '2027-2C']);
  const esperado = M.proponerPlan(ESTADO_INICIAL, ['2026-2C', '2027-1C', '2027-2C']).plan;
  for (const c of p) {
    assert.deepEqual(c.items.map((i) => i.n), esperado[c.id] ?? []);
    assert.ok(c.items.every((i) => typeof i.razon === 'string' && i.razon.length > 3));
  }
  assert.ok(p[0].items.length > 0);
  assert.match(M.razonEntrada(1), /anual/i);
  assert.equal(M.planProximoAnio({}).length, 2);
});

test('examenesDeFinales: arma exámenes desde finales de la cuenta', () => {
  assert.deepEqual(M.examenesDeFinales({}), []);
  assert.deepEqual(M.examenesDeFinales(undefined), []);
  const ex = M.examenesDeFinales({ 9: '2026-12-15', 2: '2026-12-02' });
  assert.deepEqual(ex.map((e) => [e.materia, e.fecha, e.tipo]).sort(), [[2, '2026-12-02', 'final'], [9, '2026-12-15', 'final']]);
  const hoy = new Date(2026, 10, 27);
  assert.equal(M.proximaMesa(ex, {}, {}, hoy).materia, 2);
  assert.equal(M.proximaMesa(ex, {}, T(2), hoy).materia, 9); // aprobada: se saltea
  assert.equal(M.proximaMesa(M.examenesDeFinales({}), {}, {}, hoy), null); // cuenta nueva: sin mesas
});
