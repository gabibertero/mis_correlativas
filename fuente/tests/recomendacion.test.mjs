import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/lib/motor.js';

const con = (estado, ...ns) => Object.fromEntries(ns.map((n) => [n, { estado }]));
const resumir = (r) => r.map(({ n, posicion, traba, trabaDirectas, rendible }) => ({ n, posicion, traba, trabaDirectas, rendible }));

test('recomendacionFinales: Física I, ASI y Economía regulares (cuentas a mano desde plan.js)', () => {
  // Estado coherente: todo 1º nivel aprobado menos Física I (3); regulares Física I, ASI (16) y Economía (18).
  // Las tres se pueden rendir hoy: 3 no tiene correlativas; 16 pide 6 y 8 regulares; 18 pide 1 y 2 aprobadas.
  //
  // Física I (3): la piden APROBADA solo COM (21, aprob [3, 7]) -> trabaDirectas = 1. Física II (10) la pide
  //   regular: ya no está trabada. COM sin cursar frena a Redes (26, reg 21) y a Seguridad (35, aprob 21);
  //   Redes frena a Seguridad (ya contada) y a Proyecto Final (36, no cuenta). -> {21, 26, 35} = 3.
  // ASI (16): la pide aprobada Administración de SI (30, aprob [16]) -> 1 directa. El Seminario (99) es opcional;
  //   BD/DDS/DSI la piden solo regular. 30 frena a Gestión Gerencial (34, reg 30) y Seguridad (35, reg 30). -> 3.
  // Economía (18): la pide aprobada Gestión Gerencial (34, aprob [18]) -> 1. ADS (30) y Sist. de Gestión (33)
  //   la piden solo regular. 34 solo frena a Proyecto Final. -> {34} = 1.
  //
  // Empate 3 vs 16 (traba 3, 1 directa, ambas rendibles): gana el nivel más bajo -> Física I primero.
  // Orden: Física I (3) · ASI (3) · Economía (1). No es el orden «Economía, ASI, Física» del ejemplo: lo da la regla.
  const est = { ...con('aprobada', 1, 2, 4, 5, 6, 7, 8), ...con('regular', 3, 16, 18) };
  const r = M.recomendacionFinales(est);
  assert.deepEqual(resumir(r), [
    { n: 3, posicion: 1, traba: 3, trabaDirectas: 1, rendible: true },
    { n: 16, posicion: 2, traba: 3, trabaDirectas: 1, rendible: true },
    { n: 18, posicion: 3, traba: 1, trabaDirectas: 1, rendible: true },
  ]);
  assert.deepEqual(r[0].trabadas, [21, 26, 35]);
  assert.deepEqual(r[1].trabadas, [30, 34, 35]);
  assert.deepEqual(r[2].trabadas, [34]);
  assert.ok(r.every((x) => x.falta === null));
});

test('recomendacionFinales: estado real (AGA recursando, SO/ASI/Economía regulares)', () => {
  const est = {
    ...con('aprobada', 1, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 17, 19, 20),
    ...con('cursando', 9, 10, 21, 24), 2: { estado: 'recursando' }, ...con('regular', 15, 16, 18),
  };
  // AGA (2) la piden aprobada Economía (18) y Análisis Numérico (22) -> 2 directas.
  //   Economía ya está regular: de ella solo sigue trabada Gestión Gerencial (34, aprob 18); ADS (30) y
  //   Sist. de Gestión (33) la piden regular, así que por Economía no se traban.
  //   Análisis Numérico sin cursar frena a Inv. Operativa (27), Automatización (29) e IA (31); IO a Sist. de Gestión (33).
  //   -> {18, 22, 27, 29, 31, 33, 34} = 7. AGA recursando cuenta como regular: se puede rendir.
  // ASI -> {30, 34, 35} = 3. Economía -> {34} = 1, pero no se puede rendir: falta aprobar AGA. SO (15) -> 0.
  const r = M.recomendacionFinales(est);
  assert.deepEqual(resumir(r), [
    { n: 2, posicion: 1, traba: 7, trabaDirectas: 2, rendible: true },
    { n: 16, posicion: 2, traba: 3, trabaDirectas: 1, rendible: true },
    { n: 18, posicion: 3, traba: 1, trabaDirectas: 1, rendible: false },
    { n: 15, posicion: 4, traba: 0, trabaDirectas: 0, rendible: true },
  ]);
  assert.deepEqual(r[0].trabadas, [18, 22, 27, 29, 31, 33, 34]);
  assert.deepEqual(r[2].falta, { regularizar: [], aprobar: [2], extra: [] });
  // Las cursando (AM II, Física II, COM, Legislación) todavía no deben final.
  assert.ok(!r.some((x) => [9, 10, 21, 24].includes(x.n)));
});

test('recomendacionFinales: promoción entra, Seminario no, y Proyecto Final no infla la cuenta', () => {
  // Inglés I (4) en promoción (debe el final reducido): la pide aprobada DSI (23) -> 1 directa. DSI sin cursar frena a
  // Calidad (25), ADS (30) y Sist. de Gestión (33); ADS a Gestión Gerencial (34) y Seguridad (35). -> 6.
  // Inglés II (12) regular: la pide aprobada SOLO Proyecto Final (36) -> se cuenta porque es directa. -> 1.
  // Seminario (99) regular: opcional, fuera de la lista.
  const est = { ...con('promocion', 4), ...con('regular', 99, 12) };
  const r = M.recomendacionFinales(est);
  assert.deepEqual(r.map((x) => [x.n, x.traba, x.trabaDirectas]), [[4, 6, 1], [12, 1, 1]]);
  assert.deepEqual(r[0].trabadas, [23, 25, 30, 33, 34, 35]);
  assert.deepEqual(r[1].trabadas, [36]);
  // AED (6) regular: Proyecto Final depende de ella por cadenas largas, pero no la pide aprobada en forma directa.
  const aed = M.recomendacionFinales(con('regular', 6))[0];
  assert.ok(!aed.trabadas.includes(36));
  assert.deepEqual(aed.directas, [19, 20, 23]); // BD, DDS y DSI piden AED aprobada
  assert.ok(!aed.trabadas.includes(13)); // Sintaxis solo la pide regular
});

test('recomendacionFinales: desempata por rendible hoy, nivel y Nº', () => {
  // AM I (1) y AGA (2) regulares traban exactamente lo mismo (9, con 2 directas): mismo nivel -> Nº menor.
  const r = M.recomendacionFinales(con('regular', 1, 2));
  assert.deepEqual(r.map((x) => [x.n, x.traba, x.trabaDirectas]), [[1, 9, 2], [2, 9, 2]]);
  // Economía (18, 3er nivel) e Inglés II (12, 2º nivel) traban 1 cada una con 1 directa. Inglés II no se puede rendir
  // (falta regularizar Inglés I): Economía, rendible hoy, va primero aunque sea de un nivel más alto.
  const s = M.recomendacionFinales({ ...con('aprobada', 1, 2), ...con('regular', 12, 18) });
  assert.deepEqual(s.map((x) => [x.n, x.rendible]), [[18, true], [12, false]]);
  assert.deepEqual(s[1].falta, { regularizar: [4], aprobar: [], extra: [] });
  // DSI regular sin AED, Inglés I ni SPN aprobadas: no rendible y la falta lo dice.
  assert.deepEqual(M.recomendacionFinales(con('regular', 23))[0].falta.aprobar, [4, 6, 8]);
  assert.deepEqual(M.recomendacionFinales({}), []);
  assert.deepEqual(M.recomendacionFinales(con('aprobada', 1, 2)), []);
});

test('ordenarPorNivel: por nivel y después por Nº', () => {
  assert.deepEqual(M.ordenarPorNivel([24, 16, 2, 15, 18]), [2, 15, 16, 18, 24]);
  assert.deepEqual(M.ordenarPorNivel([]), []);
});
