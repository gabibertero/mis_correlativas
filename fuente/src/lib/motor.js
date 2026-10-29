// Motor de correlativas: lógica PURA (sin DOM, sin localStorage). Se testea con `node --test`.
// El estado `est` tiene la forma { [n]: { estado, nota? } }; lo que falta es 'pendiente'.
// Reglas (ESTADO-SITIO.md):
//  - Estados: pendiente · cursando · regular · promocion · aprobada · libre · abandono (libre/abandono no satisfacen nada).
//  - CURSAR: todas las `reg` en regular/promocion/aprobada y todas las `aprob` en aprobada (promoción NO: debe su final).
//  - FINAL:  la materia regular o promoción + TODAS sus correlativas (reg ∪ aprob) aprobadas.
//  - TERMINADA / avance: solo `aprobada`.
//    Seminario (99): 1–23 aprobadas. Proyecto Final (36): todo el plan aprobado + PPS (la PPS no se registra: se avisa).
//  - OPCIONAL: el Seminario (99) existe en la malla pero queda fuera de totales, listas "qué puedo hacer" y del Proyecto Final.
//  - DESTRABA: cierre transitivo sobre reg+aprob entre materias del plan (sin electivas).
import { MATERIAS, MATERIAS_PLAN, NIVELES, ELECTIVAS } from '../data/plan.js';

export const porN = Object.fromEntries(MATERIAS.map((m) => [m.n, m]));
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Ítems del planificador: materia = Nº (number); electiva = 'e:<slug del nombre>' (string, estable aunque cambie el orden).
export const idElectiva = (e) => `e:${slug(e.nombre)}`;
export const electivaPorId = Object.fromEntries(ELECTIVAS.map((e) => [idElectiva(e), e]));
export const esElectiva = (x) => typeof x === 'string' && Object.hasOwn(electivaPorId, x);
const itemDe = (x) => porN[x] ?? electivaPorId[x];
export const nombreCorto = (n) => itemDe(n)?.nombre ?? String(n);

export const estadoDe = (est, n) => est?.[n]?.estado ?? 'pendiente';
const regOk = (e) => e === 'regular' || e === 'recursando' || e === 'promocion' || e === 'aprobada';
const aprobada = (est, n) => estadoDe(est, n) === 'aprobada';

// ---------- Cursar ----------
/** Qué correlativas faltan de `item` ({reg, aprob}: una materia o una electiva). */
export function faltan(est, item) {
  return {
    reg: item.reg.filter((n) => !regOk(estadoDe(est, n))),
    aprob: item.aprob.filter((n) => !aprobada(est, n)),
  };
}
export const queFaltaParaCursar = (est, n) => faltan(est, porN[n]);
export const puedeCursar = (est, n) => { const f = queFaltaParaCursar(est, n); return !f.reg.length && !f.aprob.length; };
/** Sin cursar (o a retomar): pendiente, libre o abandono. */
export const sinCursar = (e) => e === 'pendiente' || e === 'libre' || e === 'abandono';
/** Solo `aprobada` y `promocion` llevan nota. */
export const admiteNota = (e) => e === 'aprobada' || e === 'promocion';
/** Habilitada = todavía sin empezar (o a retomar) y con las correlativas cumplidas. */
export const estaHabilitada = (est, n) => sinCursar(estadoDe(est, n)) && puedeCursar(est, n);

// ---------- Final ----------
/** { regular: falta regularizarla, aprobar: [n…] sin final aprobado, extra: [texto…] requisitos no registrados } */
export function queFaltaParaFinal(est, n) {
  const m = porN[n];
  const req = m.finalExigeTodo ? MATERIAS_PLAN.filter((x) => x.n !== n).map((x) => x.n)
    : m.finalExigeTodasHasta ? MATERIAS.filter((x) => x.n <= m.finalExigeTodasHasta).map((x) => x.n)
    : [...new Set([...m.reg, ...m.aprob])];
  const e = estadoDe(est, n);
  return {
    regular: !regOk(e),
    aprobar: req.filter((x) => !aprobada(est, x)),
    extra: m.finalExigeTodo ? ['PPS (Práctica Profesional Supervisada)'] : [], // shortcut: la PPS no se registra, solo se avisa
  };
}
export const puedeRendirFinal = (est, n) => ['regular', 'recursando', 'promocion'].includes(estadoDe(est, n)) && queFaltaParaFinal(est, n).aprobar.length === 0;

// ---------- Destraba ----------
const dependientes = {};
for (const m of MATERIAS) for (const r of [...m.reg, ...m.aprob]) (dependientes[r] ??= []).push(m.n);
const cacheDestraba = new Map();
/** Set de materias del plan que dependen de `n`, directa o indirectamente. */
export function destraba(n) {
  if (!cacheDestraba.has(n)) {
    const out = new Set(); const cola = [n];
    while (cola.length) for (const d of dependientes[cola.pop()] ?? []) if (!out.has(d)) { out.add(d); cola.push(d); }
    cacheDestraba.set(n, [...out].sort((a, b) => a - b));
  }
  return new Set(cacheDestraba.get(n));
}

// ---------- "Se desbloquea" (naranja): hoy no, pero sí si aprobás lo que estás cursando ----------
/** Copia de `est` con cambios { n: 'regular'|'aprobada'|… } (la nota se conserva). */
export function aplicar(est, cambios) {
  const out = { ...est };
  for (const [n, estado] of Object.entries(cambios)) out[n] = { ...out[n], estado };
  return out;
}
export function aprobandoLoQueCursa(est, excepto) {
  const c = {};
  for (const m of MATERIAS) if (m.n !== excepto && estadoDe(est, m.n) === 'cursando') c[m.n] = 'aprobada';
  return aplicar(est, c);
}
export function seDesbloquea(est, n) {
  const p = aprobandoLoQueCursa(est, n);
  return {
    cursar: estaHabilitada(p, n) && !estaHabilitada(est, n),
    final: puedeRendirFinal(p, n) && !puedeRendirFinal(est, n),
  };
}

// ---------- Vistas globales ----------
export const habilitadas = (est) => MATERIAS_PLAN.filter((m) => estaHabilitada(est, m.n)).map((m) => m.n);
export const rendibles = (est) => MATERIAS_PLAN.filter((m) => puedeRendirFinal(est, m.n)).map((m) => m.n);
/** Finales rendibles, los que más destraban primero. */
export const finalesPorImpacto = (est) => rendibles(est).map((n) => ({ n, impacto: destraba(n).size })).sort((a, b) => b.impacto - a.impacto || a.n - b.n);
/** Materias no aprobadas que más destraban. */
export const masDestraban = (est, k = 4) => MATERIAS_PLAN.filter((m) => !aprobada(est, m.n)).map((m) => ({ n: m.n, impacto: destraba(m.n).size })).sort((a, b) => b.impacto - a.impacto || a.n - b.n).slice(0, k);

export function analizarMateria(est, n) {
  return {
    n, estado: estadoDe(est, n),
    puedeCursar: puedeCursar(est, n), puedeRendirFinal: puedeRendirFinal(est, n), estaHabilitada: estaHabilitada(est, n),
    seDesbloquea: seDesbloquea(est, n),
    queFaltaParaCursar: queFaltaParaCursar(est, n), queFaltaParaFinal: queFaltaParaFinal(est, n),
    destraba: destraba(n),
  };
}
export const analizar = (est) => Object.fromEntries(MATERIAS.map((m) => [m.n, analizarMateria(est, m.n)]));

const lista = (ns) => ns.map(nombreCorto).join(', ');
/** { texto, tono: 'ok'|'espera'|'falta' } en lenguaje llano. */
export function veredicto(est, n) {
  const e = estadoDe(est, n);
  const sd = seDesbloquea(est, n);
  if (e === 'aprobada') return { texto: 'Ya la aprobaste.', tono: 'ok' };
  if (e === 'regular' || e === 'recursando') {
    const f = queFaltaParaFinal(est, n);
    if (!f.aprobar.length) return { texto: (e === 'recursando' ? 'Está regular: podés rendir el final.' : 'Podés rendir el final.') + (f.extra.length ? ` Recordá: ${f.extra.join(', ')}.` : ''), tono: 'ok' };
    return { texto: `${e === 'recursando' ? 'Regular (la estás recursando)' : 'Regular'}, pero para rendir el final te falta aprobar: ${lista(f.aprobar)}.` + (sd.final ? ' Se te habilita si aprobás lo que cursás.' : ''), tono: sd.final ? 'espera' : 'falta' };
  }
  if (e === 'promocion') {
    const f = queFaltaParaFinal(est, n);
    if (!f.aprobar.length) return { texto: 'Promocionaste: rendí tu final reducido para terminarla.', tono: 'ok' };
    return { texto: `Promocionaste, pero para rendir el final te falta aprobar: ${lista(f.aprobar)}.` + (sd.final ? ' Se te habilita si aprobás lo que cursás.' : ''), tono: sd.final ? 'espera' : 'falta' };
  }
  if (e === 'cursando') return { texto: 'La estás cursando.', tono: 'espera' };
  const previo = e === 'libre' ? 'Quedaste libre. ' : e === 'abandono' ? 'La dejaste. ' : '';
  const f = queFaltaParaCursar(est, n);
  if (!f.reg.length && !f.aprob.length) return { texto: previo + (previo ? 'Podés cursarla de nuevo.' : 'Podés cursarla.'), tono: 'ok' };
  const partes = [];
  if (f.reg.length) partes.push(`regularizar ${lista(f.reg)}`);
  if (f.aprob.length) partes.push(`aprobar ${lista(f.aprob)}`);
  return { texto: previo + `Todavía no podés cursarla: te falta ${partes.join(' y ')}.` + (sd.cursar ? ' Se te habilita si aprobás lo que cursás.' : ''), tono: sd.cursar ? 'espera' : 'falta' };
}

// ---------- Resumen / créditos ----------
/** Urgencia de los finales por rendir: 0 -> 'ok' (al día) · 1-2 -> 'medio' · 3+ -> 'alto'. */
export const nivelUrgencia = (finales) => (finales <= 0 ? 'ok' : finales <= 2 ? 'medio' : 'alto');

export function resumen(est) {
  const total = MATERIAS_PLAN.length;
  const ok = MATERIAS_PLAN.filter((m) => aprobada(est, m.n));
  const notas = ok.map((m) => est[m.n]?.nota).filter((x) => Number.isFinite(x));
  const pct = (n) => Math.round((n / total) * 100);
  const cursa = MATERIAS_PLAN.filter((m) => estadoDe(est, m.n) === 'cursando').length;
  const finales = rendibles(est).length;
  return {
    total, aprobadas: ok.length, pct: pct(ok.length),
    // proyecciones: "si apruebo lo que curso" y "... + los finales que hoy puedo rendir"
    proyCursando: { n: ok.length + cursa, pct: pct(ok.length + cursa) },
    proyFinales: { n: ok.length + cursa + finales, pct: pct(ok.length + cursa + finales) },
    finales, urgencia: nivelUrgencia(finales),
    promedio: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null, notas: notas.length,
    niveles: NIVELES.map((nv) => {
      const ms = MATERIAS_PLAN.filter((m) => m.nivel === nv);
      return {
        nv, total: ms.length, ok: ms.filter((m) => aprobada(est, m.n)).length,
        curso: ms.filter((m) => ['regular', 'recursando', 'promocion', 'cursando'].includes(estadoDe(est, m.n))).length,
      };
    }),
  };
}

/**
 * Avance por nivel en capas (cada materia cuenta en una sola): aprobadas · +cursando (si apruebo lo que curso) · +finales
 * (rendibles hoy). -> [{ nv, total, aprobadas, masCursando, masFinales }]
 */
export function resumenPorNivel(est) {
  const rend = new Set(rendibles(est));
  return NIVELES.map((nv) => {
    const ms = MATERIAS_PLAN.filter((m) => m.nivel === nv);
    return {
      nv, total: ms.length,
      aprobadas: ms.filter((m) => aprobada(est, m.n)).length,
      masCursando: ms.filter((m) => estadoDe(est, m.n) === 'cursando').length,
      masFinales: ms.filter((m) => rend.has(m.n)).length,
    };
  });
}

/**
 * `elect`: { [idElectiva]: 'aprobada'|'cursando' }. Ingeniería: cualquier crédito; Analista: solo 3er nivel.
 * `est` (opcional): si el Seminario (99) está aprobado suma sus `creditosElectivos` SOLO a Ingeniería.
 */
export function creditos(elect, electivas, est = {}) {
  let ing = 0; let analista = 0;
  for (const e of electivas) if (elect?.[slug(e.nombre)] === 'aprobada') { ing += e.creditos; if (e.nivel === 3) analista += e.creditos; }
  for (const m of MATERIAS) if (m.creditosElectivos && aprobada(est, m.n)) ing += m.creditosElectivos;
  return { ing, analista };
}

// ---------- Fechas ----------
export function parseFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function diasHasta(iso, hoy = new Date()) {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((parseFecha(iso) - h) / 86400000);
}
/** Fechas de final de la cuenta ({ Nº: 'YYYY-MM-DD' }) -> lista de exámenes para proximosFinales/proximaMesa. */
export const examenesDeFinales = (finales) => Object.entries(finales ?? {}).map(([n, fecha]) => ({ fecha, materia: Number(n), tipo: 'final', etiqueta: 'Final' }));
/** Mesas confirmadas (hoy o futuras) de materias no aprobadas, de la más próxima a la más lejana. */
export function proximosFinales(examenes, est, hoy = new Date()) {
  return examenes.filter((e) => !aprobada(est, e.materia))
    .map((e) => ({ ...e, dias: diasHasta(e.fecha, hoy) })).filter((e) => e.dias >= 0)
    .sort((a, b) => a.dias - b.dias || a.materia - b.materia);
}
const TURNOS_NOMBRE = { 'feb-mar-2027': 'Mesa de febrero / marzo 2027', 'jul-2027': 'Mesa de julio 2027' };
/**
 * Próxima mesa (hoy o futura). `fechas` = { idTurno: 'YYYY-MM-DD' }. Se descartan exámenes de materias ya aprobadas.
 * -> { fecha, dias, materia|null, etiqueta } | null
 */
export function proximaMesa(examenes, fechas, est, hoy = new Date()) {
  const cand = examenes.filter((e) => !aprobada(est, e.materia)).map((e) => ({ fecha: e.fecha, materia: e.materia, etiqueta: e.etiqueta }));
  for (const [id, f] of Object.entries(fechas ?? {})) if (f && TURNOS_NOMBRE[id]) cand.push({ fecha: f, materia: null, etiqueta: TURNOS_NOMBRE[id] });
  return cand.map((c) => ({ ...c, dias: diasHasta(c.fecha, hoy) })).filter((c) => c.dias >= 0).sort((a, b) => a.dias - b.dias)[0] ?? null;
}

// ---------- Planificador ----------
// Modelo: `plan` = { [idCuatri]: [n…] } con ids 'AAAA-1C'|'AAAA-2C' en orden (`ids`). Una materia ANUAL pendiente
// puesta en un 1C ocupa también las horas del 2C siguiente y recién cuenta como aprobada desde el cuatrimestre después.
// Supuesto (se avisa en la UI): lo que hoy cursás o tenés regular se rinde, y lo de cuatrimestres previos queda aprobado.
const tipoCuatri = (id) => id.slice(-2);
const dur = (est, n) => (itemDe(n).modalidad === 'A' && sinCursar(estadoDe(est, n)) ? 2 : 1);
/** Modalidad legible. principal/contra: 1|2|null; soloCuatri: 1|2|null (se dicta en un único cuatrimestre). */
export function modalidadInfo(item) {
  const m = item?.modalidad;
  const c = { 'A': [null, null, null, 'Anual'], '1C-2C': [1, 2, null, '1º cuatri'], '2C-1C': [2, 1, null, '2º cuatri'], '1C': [1, null, 1, 'Solo 1º cuatri'], '2C': [2, null, 2, 'Solo 2º cuatri'] }[m];
  if (!c) return { anual: false, principal: null, contra: null, soloCuatri: null, label: '' };
  return { anual: m === 'A', principal: c[0], contra: c[1], soloCuatri: c[2], label: c[3] };
}
/** ¿El ítem `n` puesto en el cuatrimestre `id` ('AAAA-1C'|'AAAA-2C') cae en su contracuatrimestre? (aviso informativo, no error) */
export const esContracuatri = (n, id) => modalidadInfo(itemDe(n)).contra === Number(id.slice(5, 6));
/** Orden dentro de un cuatrimestre: anuales, cuatrimestrales, electivas; cada grupo por Nº (electivas por id). */
export function ordenarPlan(ns) {
  const g = (n) => (esElectiva(n) ? 2 : itemDe(n)?.modalidad === 'A' ? 0 : 1);
  return [...ns].sort((a, b) => g(a) - g(b) || (g(a) === 2 ? String(a).localeCompare(String(b)) : a - b));
}
const PERMITE = { A: ['1C'], '1C': ['1C'], '2C': ['2C'], '1C-2C': ['1C', '2C'], '2C-1C': ['1C', '2C'] };
/** Copia de `est` con lo que hoy cursás o tenés regular dado por aprobado. */
export function asumirRendidos(est) {
  const c = {};
  for (const m of MATERIAS) if (['regular', 'recursando', 'promocion', 'cursando'].includes(estadoDe(est, m.n))) c[m.n] = 'aprobada';
  return aplicar(est, c);
}
/** Estado proyectado: lo de cuatrimestres anteriores queda aprobado. */
export function proyectarPrevias(est, previas) {
  const c = {};
  for (const n of previas) if (!aprobada(est, n)) c[n] = 'aprobada';
  return aplicar(est, c);
}
/** Estado con el que se valida el cuatrimestre `i` (el primero usa el estado real). */
export function estadoEnCuatri(est, plan, ids, i) {
  if (i === 0) return est;
  const previas = [];
  ids.slice(0, i).forEach((id, j) => { for (const n of plan[id] ?? []) if (i >= j + dur(est, n)) previas.push(n); });
  return proyectarPrevias(asumirRendidos(est), previas);
}
/** Anuales pendientes que empezaron en el cuatrimestre anterior y siguen ocupando horas en el `i`. */
export const continuan = (est, plan, ids, i) => (i > 0 ? (plan[ids[i - 1]] ?? []).filter((n) => dur(est, n) === 2) : []);
/** Carga semanal en el planificador: `hs` de la materia; la electiva no tiene hs, se usan sus `creditos` como proxy. */
export const hsDe = (n) => porN[n]?.hs ?? electivaPorId[n]?.creditos ?? 0;
export const horasDe = (ns) => ns.reduce((a, n) => a + hsDe(n), 0);
export const horasCuatri = (est, plan, ids, i) => horasDe(plan[ids[i]] ?? []) + horasDe(continuan(est, plan, ids, i));

/** Avisos de una materia puesta en un cuatrimestre, validada contra `est` (ya proyectado). [] si está todo bien. */
export function avisosMateria(est, n, real = est, recursa = false) {
  const e = estadoDe(est, n);
  if (e === 'aprobada') {
    if (recursa) return []; // recursar es intencional
    const r = estadoDe(real, n);
    return [`${nombreCorto(n)}: ${r === 'aprobada' ? 'ya la aprobaste' : r === 'cursando' ? 'ya la estás cursando' : r === 'pendiente' ? 'ya está en un cuatrimestre anterior' : 'ya la tenés regular'}.`];
  }
  if (!sinCursar(e)) return []; // ya la está cursando / regularizó: no se revalidan correlativas
  const f = faltan(est, itemDe(n));
  const out = [];
  if (f.reg.length) out.push(`${nombreCorto(n)}: falta regularizar ${lista(f.reg)}.`);
  if (f.aprob.length) out.push(`${nombreCorto(n)}: falta el final aprobado de ${lista(f.aprob)}.`);
  return out;
}
/** Todos los avisos del cuatrimestre `i`: correlativas, modalidad, repetidas y horas. */
export function avisosCuatri(est, plan, ids, i, hsLimite = 30, recursar = new Set()) {
  const id = ids[i]; const ns = plan[id] ?? [];
  const proy = estadoEnCuatri(est, plan, ids, i);
  // Recursar suprime solo "ya la tenés/aprobaste"; siguen correlativas, modalidad y horas.
  const out = ns.flatMap((n) => avisosMateria(proy, n, est, recursar.has(n)));
  for (const n of ns) {
    const modalidad = itemDe(n).modalidad;
    if (sinCursar(estadoDe(est, n)) && !PERMITE[modalidad].includes(tipoCuatri(id)))
      out.push(`${nombreCorto(n)}: se dicta ${modalidad === 'A' ? 'como anual, arrancando en el 1º cuatrimestre' : `solo en el ${tipoCuatri(id) === '1C' ? '2º' : '1º'} cuatrimestre`}.`);
    if (ids.some((o) => o !== id && (plan[o] ?? []).includes(n))) out.push(`${nombreCorto(n)}: está repetida en otro cuatrimestre.`);
  }
  const hs = horasCuatri(est, plan, ids, i);
  if (hs > hsLimite) out.push(`Te pasás por ${hs - hsLimite} hs del límite de ${hsLimite} hs semanales (límite provisorio).`);
  return out;
}
/** Notas informativas (no errores): materias puestas en su contracuatrimestre. */
export const notasCuatri = (plan, ids, i) => (plan[ids[i]] ?? []).filter((n) => esContracuatri(n, ids[i])).map((n) => `${nombreCorto(n)}: contracuatrimestre · menos cátedras.`);
/**
 * Propone un plan hasta recibirse. Respeta `fijo` (lo del primer cuatrimestre, p. ej. lo que cursás) y arma los demás:
 * en cada uno elige materias habilitadas (con los cuatrimestres previos aprobados), las que más destraban primero,
 * según modalidad y `hsLimite`. Determinista. Deja afuera electivas, PPS y las opcionales.
 * -> { plan, sinUbicar: [n…] } (sinUbicar = no entraron en los cuatrimestres disponibles)
 */
export function proponerPlan(est, ids, { hsLimite = 30, fijo = [] } = {}) {
  const plan = { [ids[0]]: [...fijo] };
  const puestas = new Set(fijo);
  const falta = () => MATERIAS_PLAN.filter((m) => !aprobada(est, m.n) && !puestas.has(m.n)
    && !['regular', 'recursando', 'promocion', 'cursando'].includes(estadoDe(est, m.n)));
  for (let i = 1; i < ids.length && falta().length; i++) {
    plan[ids[i]] = [];
    const proy = estadoEnCuatri(est, plan, ids, i);
    let libre = hsLimite - horasDe(continuan(est, plan, ids, i));
    const cand = falta().filter((m) => estaHabilitada(proy, m.n) && PERMITE[m.modalidad].includes(tipoCuatri(ids[i])))
      .sort((a, b) => destraba(b.n).size - destraba(a.n).size || a.n - b.n);
    for (const m of cand) if (m.hs <= libre) { plan[ids[i]].push(m.n); puestas.add(m.n); libre -= m.hs; }
    plan[ids[i]] = ordenarPlan(plan[ids[i]]);
  }
  return { plan, sinUbicar: falta().map((m) => m.n) };
}

/** Razón corta de por qué `n` entra en el plan (anual y/o a cuánto destraba, o que ya cumple las correlativas). */
export function razonEntrada(n) {
  const m = itemDe(n);
  const directas = (dependientes[n] ?? []).filter((d) => !porN[d].opcional);
  const partes = [];
  if (m.modalidad === 'A') partes.push('es anual, conviene arrancarla');
  if (directas.length) partes.push(`destraba ${directas.slice(0, 2).map(nombreCorto).join(', ')}${directas.length > 2 ? ` (+${directas.length - 2} más)` : ''}`);
  if (!partes.length) partes.push(m.reg.length || m.aprob.length ? 'ya tenés las correlativas' : 'no tiene correlativas');
  const r = partes.join(' · ');
  return r[0].toUpperCase() + r.slice(1);
}
/** Plan propuesto para el año que viene: [{ id, items: [{ n, electiva, razon }], hs }] (usa proponerPlan; 2026-2C queda como puente). */
export function planProximoAnio(est, ids = ['2026-2C', '2027-1C', '2027-2C']) {
  const { plan } = proponerPlan(est, ids);
  return ids.slice(1).map((id) => {
    const ns = plan[id] ?? [];
    return { id, hs: horasDe(ns), items: ns.map((n) => ({ n, electiva: esElectiva(n), razon: razonEntrada(n) })) };
  });
}
