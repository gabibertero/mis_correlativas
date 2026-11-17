// Motor de correlativas: lógica PURA (sin DOM, sin localStorage). Se testea con `node --test`.
// El estado `est` tiene la forma { [n]: { estado, nota? } }; lo que falta es 'pendiente'.
// Reglas (ESTADO-SITIO.md):
//  - Estados: pendiente · cursando · regular · promocion · aprobada · libre · abandono (libre/abandono no satisfacen nada).
//  - CURSAR: todas las `reg` en regular/promocion/aprobada y todas las `aprob` en aprobada (promoción NO: debe su final).
//  - FINAL: la materia regular + las correlativas CURSADAS y APROBADAS según sus columnas
//    del régimen 1878, Anexo I (PARA CURSAR Y RENDIR). No se exige aprobar una correlativa solo cursada.
//  - TERMINADA / avance: solo `aprobada`.
//    Seminario (99): 1–23 aprobadas. Proyecto Final (36): todo el plan aprobado + PPS (la PPS no se registra: se avisa).
//  - OPCIONAL: el Seminario (99) existe en la malla pero queda fuera de totales, listas "qué puedo hacer" y del Proyecto Final.
//  - DESTRABA: cierre transitivo sobre reg+aprob entre materias del plan (sin electivas).
import { MATERIAS, MATERIAS_PLAN, NIVELES } from '../data/plan.js';
import { CATALOGO_ELECTIVAS } from '../data/trayectos.js';

export const porN = Object.fromEntries(MATERIAS.map((m) => [m.n, m]));
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Ítems del planificador: materia = Nº (number); electiva = 'e:<slug del nombre>' (string, estable aunque cambie el orden).
export const idElectiva = (e) => `e:${slug(e.nombre)}`;
export const electivaPorId = Object.fromEntries(CATALOGO_ELECTIVAS.map((e) => [idElectiva(e), e]));
export const esElectiva = (x) => typeof x === 'string' && Object.hasOwn(electivaPorId, x);
export const itemDe = (x) => porN[x] ?? electivaPorId[x];
export const nombreCorto = (n) => itemDe(n)?.nombre ?? String(n);

export const estadoDe = (est, n) => est?.[n]?.estado ?? 'pendiente';
const regOk = (e) => e === 'regular' || e === 'recursando' || e === 'promocion' || e === 'aprobada';
const aprobada = (est, n) => estadoDe(est, n) === 'aprobada';
/** Une el estado de obligatorias y electivas sin mutar ni cambiar su almacenamiento. */
export function conElectivas(est, elect = {}) {
  const out = { ...est };
  for (const [id, estado] of Object.entries(elect)) {
    const n = id.startsWith('e:') ? id : `e:${id}`;
    if (esElectiva(n)) out[n] = { estado: typeof estado === 'string' ? estado : estado?.estado ?? 'pendiente' };
  }
  return out;
}

// ---------- Cursar ----------
/** Qué correlativas faltan de `item` ({reg, aprob}: una materia o una electiva). */
export function faltan(est, item) {
  return {
    reg: (item?.reg ?? []).filter((n) => !regOk(estadoDe(est, n))),
    aprob: (item?.aprob ?? []).filter((n) => !aprobada(est, n)),
  };
}
export const queFaltaParaCursar = (est, n) => faltan(est, itemDe(n));
export const puedeCursar = (est, n) => {
  const m = itemDe(n);
  if (!m || m.correlativasConfirmadas === false) return false;
  const f = queFaltaParaCursar(est, n); return !f.reg.length && !f.aprob.length;
};
/** Sin cursar (o a retomar): pendiente, libre o abandono. */
export const sinCursar = (e) => e === 'pendiente' || e === 'libre' || e === 'abandono';
/** Solo `aprobada` y `promocion` llevan nota. */
export const admiteNota = (e) => e === 'aprobada' || e === 'promocion';
/** Habilitada = todavía sin empezar (o a retomar) y con las correlativas cumplidas. */
export const estaHabilitada = (est, n) => sinCursar(estadoDe(est, n)) && puedeCursar(est, n);

// ---------- Final ----------
/** Propia regularidad, correlativas cursadas/aprobadas y requisitos externos, por separado. */
export function queFaltaParaFinal(est, n) {
  const m = itemDe(n);
  if (!m) return { regular: true, reg: [], aprobar: [], extra: ['Materia no identificada.'] };
  const especial = m.finalExigeTodo || m.finalExigeTodasHasta;
  const req = m.finalExigeTodo ? MATERIAS_PLAN.filter((x) => x.n !== n).map((x) => x.n)
    : m.finalExigeTodasHasta ? MATERIAS.filter((x) => x.n <= m.finalExigeTodasHasta).map((x) => x.n)
    : m.aprob;
  return {
    regular: !regOk(estadoDe(est, n)),
    reg: especial ? [] : m.reg.filter((x) => !regOk(estadoDe(est, x))),
    aprobar: req.filter((x) => !aprobada(est, x)),
    extra: [
      ...(m.finalExigeTodo ? ['PPS (Práctica Profesional Supervisada)'] : []),
      ...(m.correlativasConfirmadas === false ? ['Correlativas de la licenciatura pendientes de confirmación; el requisito de acceso no sustituye el régimen de cada asignatura.'] : []),
    ],
  };
}
export const puedeRendirFinal = (est, n) => {
  if (!itemDe(n) || itemDe(n).correlativasConfirmadas === false || !['regular', 'recursando', 'promocion'].includes(estadoDe(est, n))) return false;
  const f = queFaltaParaFinal(est, n);
  return !f.reg.length && !f.aprobar.length;
};

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

/** Dependencias directas según la acción exigida, e indirectas solo como alcance potencial. */
export function relacionesDe(n) {
  const regular = MATERIAS_PLAN.filter((m) => m.reg.includes(n)).map((m) => m.n);
  const aprobada = MATERIAS_PLAN.filter((m) => m.aprob.includes(n)).map((m) => m.n);
  const directas = new Set([...regular, ...aprobada]);
  return { regular, aprobada, indirectas: [...destraba(n)].filter((d) => !directas.has(d) && !porN[d]?.opcional) };
}
/** Habilitaciones nuevas reales al cambiar una materia; no confundir con dependencias transitivas. */
export function impactoReal(est, n, estado = 'aprobada') {
  const sim = aplicar(est, { [n]: estado });
  return {
    cursar: habilitadas(sim).filter((x) => !habilitadas(est).includes(x)),
    finales: rendibles(sim).filter((x) => !rendibles(est).includes(x)),
  };
}

// ---------- "Se desbloquea" (naranja): hoy no, pero sí si aprobás lo que estás cursando ----------
/** Copia de `est` con cambios { n: 'regular'|'aprobada'|… } (la nota se conserva). */
export function aplicar(est, cambios) {
  const out = { ...est };
  for (const [n, estado] of Object.entries(cambios)) out[n] = { ...out[n], estado };
  return out;
}
export function regularizandoLoQueCursa(est, excepto) {
  const c = {};
  for (const [id, dato] of Object.entries(est ?? {})) {
    const n = esElectiva(id) ? id : Number(id);
    if (n !== excepto && itemDe(n) && dato?.estado === 'cursando') c[n] = 'regular';
  }
  return aplicar(est, c);
}
export function aprobandoLoQueCursa(est, excepto) {
  const c = {};
  for (const [id, dato] of Object.entries(est ?? {})) {
    const n = esElectiva(id) ? id : Number(id);
    if (n !== excepto && itemDe(n) && dato?.estado === 'cursando') c[n] = 'aprobada';
  }
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
const impactoEnPlan = (n) => [...destraba(n)].filter((d) => !porN[d]?.opcional).length;
export const finalesPorImpacto = (est) => rendibles(est).map((n) => ({ n, impacto: impactoEnPlan(n) })).sort((a, b) => b.impacto - a.impacto || a.n - b.n);
/** Materias no aprobadas que más destraban. */
export const masDestraban = (est, k = 4) => MATERIAS_PLAN.filter((m) => !aprobada(est, m.n)).map((m) => ({ n: m.n, impacto: impactoEnPlan(m.n) })).sort((a, b) => b.impacto - a.impacto || a.n - b.n).slice(0, k);
/** Nºs ordenados por nivel y luego por Nº (para listas del Inicio). */
export const ordenarPorNivel = (ns) => [...ns].sort((a, b) => (itemDe(a)?.nivel ?? 9) - (itemDe(b)?.nivel ?? 9) || a - b);

const PROYECTO_FINAL = MATERIAS_PLAN.find((m) => m.finalExigeTodo)?.n;
/**
 * Materias del plan (sin opcionales, sin aprobadas) que hoy no se pueden cursar o rendir por deber el final de `n`.
 * Arranca por las que piden `n` APROBADA (las que solo la piden regular ya no están trabadas: ya la tenés regular)
 * y sigue la cadena con la misma regla: de una trabada que ya está regular solo siguen trabadas las que la piden
 * aprobada (igual si ya la está cursando); de una sin cursar, todas sus dependientes. Proyecto Final (exige todo aprobado) se cuenta solo si
 * pide `n` aprobada en forma directa. -> { directas: [Nº], todas: [Nº] }
 */
function trabaPorFinal(est, n) {
  const cuenta = (x) => { const m = porN[x]; return m && !m.opcional && !aprobada(est, x); };
  const directas = MATERIAS_PLAN.filter((m) => m.aprob.includes(n) && cuenta(m.n)).map((m) => m.n);
  const todas = new Set(directas); const cola = [...directas];
  while (cola.length) {
    const d = cola.pop();
    // Si ya la cursa o la tiene regular, el final adeudado solo frena a las que la piden aprobada.
    const soloAprob = regOk(estadoDe(est, d)) || estadoDe(est, d) === 'cursando';
    for (const m of MATERIAS_PLAN) {
      if (todas.has(m.n) || m.n === PROYECTO_FINAL || !cuenta(m.n)) continue;
      if (m.aprob.includes(d) || (!soloAprob && m.reg.includes(d))) { todas.add(m.n); cola.push(m.n); }
    }
  }
  return { directas, todas: [...todas].sort((a, b) => a - b) };
}
/**
 * Orden recomendado para rendir los finales que debés (regular · recursando · promoción; sin el Seminario opcional):
 * primero los que más materias te traban a futuro. Desempates: más materias que piden ese final en forma directa,
 * rendible hoy, nivel más bajo, Nº.
 * -> [{ n, posicion, traba, trabaDirectas, trabadas, directas, rendible, falta: null | { regularizar, aprobar, extra } }]
 */
export function recomendacionFinales(est) {
  return MATERIAS_PLAN.filter((m) => ['regular', 'recursando', 'promocion'].includes(estadoDe(est, m.n)))
    .map((m) => {
      const t = trabaPorFinal(est, m.n);
      const rendible = puedeRendirFinal(est, m.n);
      const f = queFaltaParaFinal(est, m.n);
      return {
        n: m.n, nivel: m.nivel, traba: t.todas.length, trabaDirectas: t.directas.length, trabadas: t.todas, directas: t.directas,
        rendible, falta: rendible ? null : { regularizar: f.reg, aprobar: f.aprobar, extra: f.extra },
      };
    })
    .sort((a, b) => b.traba - a.traba || b.trabaDirectas - a.trabaDirectas || Number(b.rendible) - Number(a.rendible) || a.nivel - b.nivel || a.n - b.n)
    .map(({ nivel, ...r }, i) => ({ ...r, posicion: i + 1 }));
}

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
  const regularizando = regularizandoLoQueCursa(est, n);
  const alRegularizar = { cursar: estaHabilitada(regularizando, n), final: puedeRendirFinal(regularizando, n) };
  if (e === 'aprobada') return { texto: 'Ya la aprobaste.', tono: 'ok' };
  if (e === 'regular' || e === 'recursando' || e === 'promocion') {
    const f = queFaltaParaFinal(est, n);
    if (puedeRendirFinal(est, n)) return {
      texto: (e === 'promocion' ? 'Promocionaste: rendí tu final reducido para terminarla.' : e === 'recursando' ? 'Está regular: podés rendir el final.' : 'Podés rendir el final.') + (f.extra.length ? ` Recordá: ${f.extra.join(', ')}.` : ''), tono: 'ok',
    };
    const requisitos = [];
    if (f.reg.length) requisitos.push(`tener regulares ${lista(f.reg)}`);
    if (f.aprobar.length) requisitos.push(`aprobar ${lista(f.aprobar)}`);
    if (f.extra.length) requisitos.push(...f.extra);
    return { texto: `${e === 'promocion' ? 'Promocionaste' : 'Está regular'}, pero para rendir el final falta: ${requisitos.join(' y ')}.` + (sd.final ? (alRegularizar.final ? ' Se habilita si regularizás lo que cursás; no hace falta aprobar esos finales.' : ' Se habilita si aprobás los finales de las correlativas que lo exigen.') : ''), tono: sd.final ? 'espera' : 'falta' };
  }
  if (e === 'cursando') return { texto: 'La estás cursando.', tono: 'espera' };
  const previo = e === 'libre' ? 'Quedaste libre. ' : e === 'abandono' ? 'La dejaste. ' : '';
  const f = queFaltaParaCursar(est, n);
  if (itemDe(n)?.correlativasConfirmadas === false) return { texto: 'Para acceder a la licenciatura se exige Diseño de Sistemas regular o aprobada. Las correlativas de esta asignatura todavía deben confirmarse; no se informa como habilitada.', tono: 'espera' };
  if (!f.reg.length && !f.aprob.length) return { texto: previo + (previo ? 'Podés cursarla de nuevo.' : 'Podés cursarla.'), tono: 'ok' };
  const partes = [];
  if (f.reg.length) partes.push(`regularizar ${lista(f.reg)}`);
  if (f.aprob.length) partes.push(`aprobar ${lista(f.aprob)}`);
  return { texto: previo + `Todavía no podés cursarla: te falta ${partes.join(' y ')}.` + (sd.cursar ? (alRegularizar.cursar ? ' Se habilita si regularizás lo que cursás; no hace falta aprobar esos finales.' : ' Se habilita si aprobás los finales de las correlativas que lo exigen.') : ''), tono: sd.cursar ? 'espera' : 'falta' };
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
export function creditos(elect, electivas = CATALOGO_ELECTIVAS, est = {}, licenciatura = null) {
  let ing = 0; let analista = 0;
  const contadas = new Set();
  for (const e of electivas) {
    const id = slug(e.nombre);
    if (contadas.has(id) || (e.licenciatura && e.licenciatura !== licenciatura)) continue;
    contadas.add(id);
    if (elect?.[id] === 'aprobada') { ing += e.creditos; if (e.nivel === 3 && !e.licenciatura) analista += e.creditos; }
  }
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
// Los cursos se proyectan REGULARES por defecto. Aprobar requiere una decisión
// explícita y cumplir el régimen de finales; una dependencia potencial no habilita por sí sola.
const tipoCuatri = (id) => id?.split('-')[1];
export const esVerano = (id) => tipoCuatri(id) === 'VER';
export const nombrePeriodo = (id) => esVerano(id) ? `Intensivo de febrero ${id.slice(0, 4)}` : `${tipoCuatri(id) === '1C' ? '1º' : '2º'} cuatrimestre ${id.slice(0, 4)}`;
const ordenPeriodo = (id) => Number(id.slice(0, 4)) * 3 + ({ VER: 0, '1C': 1, '2C': 2 }[tipoCuatri(id)] ?? 0);
const BASICAS_VERANO = [1, 2, 3, 9, 10];
/** Oferta posible, no confirmación de apertura. Las excepcionales se incluyen solo al declararlas. */
export const ofertaVerano = (opciones = {}, id = '2027-VER') => {
  const anio = id.slice(0, 4);
  const extras = [...(opciones.veranoExtrasPorAnio?.[anio] ?? []), ...(anio === '2027' ? opciones.veranoExtras ?? [] : [])];
  return [...new Set([...BASICAS_VERANO, ...extras.filter((n) => itemDe(n))])];
};
/** Modalidad legible. Las asignaturas sin información no reciben una modalidad inventada. */
export function modalidadInfo(item) {
  const m = item?.modalidad;
  const c = { 'A': [null, null, null, 'Anual'], '1C-2C': [1, 2, null, '1º cuatri'], '2C-1C': [2, 1, null, '2º cuatri'], '1C': [1, null, 1, 'Solo 1º cuatri'], '2C': [2, null, 2, 'Solo 2º cuatri'] }[m];
  if (!c) return { anual: false, principal: null, contra: null, soloCuatri: null, label: 'Modalidad a confirmar' };
  return { anual: m === 'A', principal: c[0], contra: c[1], soloCuatri: c[2], label: c[3] };
}
export const esContracuatri = (n, id) => !esVerano(id) && modalidadInfo(itemDe(n)).contra === Number(id.slice(5, 6));
export function ordenarPlan(ns) {
  const g = (n) => (esElectiva(n) ? 2 : itemDe(n)?.modalidad === 'A' ? 0 : 1);
  return [...ns].sort((a, b) => g(a) - g(b) || (g(a) === 2 ? String(a).localeCompare(String(b)) : a - b));
}
const PERMITE = { A: ['1C'], '1C': ['1C'], '2C': ['2C'], '1C-2C': ['1C', '2C'], '2C-1C': ['1C', '2C'] };
const ofrecida = (n, id, opciones = {}) => {
  const m = itemDe(n);
  if (!m || (m.desde && Number(id.slice(0, 4)) < m.desde)) return false;
  return esVerano(id) ? !!opciones.incluirVerano && ofertaVerano(opciones, id).includes(n) : !!PERMITE[m.modalidad]?.includes(tipoCuatri(id));
};
// Las anuales de 1C terminan al finalizar 2C del mismo año. Un intensivo termina
// en febrero: agregar VER al calendario no transforma una anual en tres períodos.
const finCursado = (n, id) => ordenPeriodo(itemDe(n)?.modalidad === 'A' && tipoCuatri(id) === '1C' ? `${id.slice(0, 4)}-2C` : id);
const resultadoDe = (n, opciones) => opciones.resultados?.[n] ?? opciones.resultado ?? 'regular';

/** Escenario explícito de finales aprobados; no se utiliza como supuesto del plan por defecto. */
export function asumirRendidos(est) {
  const c = {};
  for (const [n, dato] of Object.entries(est ?? {})) if (['regular', 'recursando', 'promocion', 'cursando'].includes(dato?.estado)) c[n] = 'aprobada';
  return aplicar(est, c);
}
/** Proyectar un curso terminado no equivale a aprobar su final. */
export function proyectarPrevias(est, previas, resultado = 'regular') {
  return aplicar(est, Object.fromEntries(previas.filter((n) => !aprobada(est, n)).map((n) => [n, resultado])));
}
function aplicarFinalesPrevistos(est, candidatos) {
  let out = est; let cambio;
  do {
    cambio = false;
    for (const n of candidatos) if (puedeRendirFinal(out, n)) { out = aplicar(out, { [n]: 'aprobada' }); cambio = true; }
  } while (cambio);
  return out;
}
/** Estado al COMENZAR el período i, con cursos validados y resultados elegidos explícitamente. */
export function estadoEnCuatri(est, plan, ids, i, opciones = {}) {
  if (i <= 0 || !ids[i]) return est;
  let proy = { ...est };
  const activos = [];
  const yaIniciadas = new Set();
  const finales = new Set(opciones.finalesPrevistos ?? []);
  for (let j = 0; j < i; j++) {
    const id = ids[j];
    const ns = [...(plan[id] ?? [])];
    if (j === 0) {
      // Lo ya cursando acaba según su modalidad; no desaparece si no se arrastró al plan.
      for (const [n, dato] of Object.entries(est ?? {})) {
        const clave = esElectiva(n) ? n : Number(n);
        if (dato?.estado === 'cursando' && itemDe(clave) && !ns.includes(clave)) ns.push(clave);
      }
    }
    for (const n of ns) {
      if (!itemDe(n) || yaIniciadas.has(n)) continue;
      const estado = estadoDe(proy, n);
      const cursandoReal = j === 0 && estadoDe(est, n) === 'cursando';
      const conocida = estado === 'aprobada' || regOk(estado) || cursandoReal;
      if (!conocida && !(ofrecida(n, id, opciones) && puedeCursar(proy, n))) continue;
      // Una modalidad inválida no puede generar aprobaciones ficticias futuras.
      if (!cursandoReal && !ofrecida(n, id, opciones)) continue;
      activos.push({ n, fin: finCursado(n, id), resultado: resultadoDe(n, opciones) });
      yaIniciadas.add(n);
    }
    const siguiente = ordenPeriodo(ids[j + 1]);
    for (let k = activos.length - 1; k >= 0; k--) if (activos[k].fin < siguiente) {
      const { n, resultado } = activos[k];
      if (!aprobada(proy, n)) proy = aplicar(proy, { [n]: 'regular' });
      if (resultado === 'aprobada') finales.add(n);
      activos.splice(k, 1);
    }
    proy = aplicarFinalesPrevistos(proy, finales);
  }
  return proy;
}
/** Anuales empezadas en 1C que siguen cursándose en 2C de ese mismo año. */
export const continuan = (est, plan, ids, i, opciones = {}) => {
  const id = ids[i];
  if (!id || tipoCuatri(id) !== '2C') return [];
  return [...new Set(ids.slice(0, i).filter((prev) => prev === `${id.slice(0, 4)}-1C`).flatMap((prev) => plan[prev] ?? []).filter((n) => itemDe(n)?.modalidad === 'A'))];
};
/** Créditos son solo una aproximación de carga para electivas sin horas publicadas. */
export const hsDe = (n) => porN[n]?.hs ?? electivaPorId[n]?.hs ?? electivaPorId[n]?.creditos ?? 0;
export const horasDe = (ns) => ns.reduce((a, n) => a + hsDe(n), 0);
export const horasCuatri = (est, plan, ids, i, opciones = {}) => horasDe(plan[ids[i]] ?? []) + horasDe(continuan(est, plan, ids, i, opciones));

export function avisosMateria(est, n, real = est, recursa = false) {
  const m = itemDe(n);
  if (!m) return [`${nombreCorto(n)}: materia no identificada.`];
  const e = estadoDe(est, n);
  if (e === 'aprobada' && !recursa) {
    const r = estadoDe(real, n);
    return [`${nombreCorto(n)}: ${r === 'aprobada' ? 'ya la aprobaste' : r === 'cursando' ? 'ya la estás cursando' : sinCursar(r) ? 'ya está en un período anterior' : 'ya la tenés regular'}.`];
  }
  if (m.correlativasConfirmadas === false) return [`${m.nombre}: correlativas y modalidad específicas a confirmar; Diseño regular o aprobado es solo el requisito de acceso a la licenciatura.`];
  if (regOk(e) && !recursa) return [`${nombreCorto(n)}: ya la tenés regular; marcá Recursar si querés volver a cursarla.`];
  if (!sinCursar(e) && !recursa) return []; // cursando actual
  const f = faltan(est, m);
  const out = [];
  if (f.reg.length) out.push(`${nombreCorto(n)}: falta regularizar ${lista(f.reg)} para cursar (no hace falta aprobar sus finales).`);
  if (f.aprob.length) out.push(`${nombreCorto(n)}: falta el final aprobado de ${lista(f.aprob)} para cursar.`);
  return out;
}
/** Validación: las faltas de cursado y de finales se comunican por separado. */
export function avisosCuatri(est, plan, ids, i, hsLimite = 30, recursar = new Set(), opciones = {}) {
  const id = ids[i]; const ns = plan[id] ?? [];
  const proy = estadoEnCuatri(est, plan, ids, i, opciones);
  const out = ns.flatMap((n) => avisosMateria(proy, n, est, recursar.has(n)));
  for (const n of ns) {
    const m = itemDe(n); if (!m) continue;
    if (esVerano(id)) {
      if (!opciones.incluirVerano) out.push(`${nombreCorto(n)}: el período de verano es opcional; activalo para incluirlo en la proyección.`);
      if (!ofertaVerano(opciones, id).includes(n)) out.push(`${nombreCorto(n)}: no pertenece a la oferta de verano prevista; solo agregarla si su intensivo fue confirmado.`);
    } else if (sinCursar(estadoDe(est, n)) && m.modalidad && !PERMITE[m.modalidad]?.includes(tipoCuatri(id))) {
      out.push(`${nombreCorto(n)}: se dicta ${m.modalidad === 'A' ? 'como anual, arrancando en el 1º cuatrimestre' : `solo en el ${tipoCuatri(id) === '1C' ? '2º' : '1º'} cuatrimestre`}.`);
    }
    if (m.desde && Number(id.slice(0, 4)) < m.desde) out.push(`${m.nombre}: implementación informada desde ${m.desde}.`);
    if (ids.some((o) => o !== id && (plan[o] ?? []).includes(n))) out.push(`${nombreCorto(n)}: está repetida en otro período.`);
    if (resultadoDe(n, opciones) === 'aprobada') {
      // Comprobar el cierre real del curso: otros cursos del mismo período
      // también pueden satisfacer requisitos antes de rendir los finales previstos.
      const fin = finCursado(n, id);
      const ordenSiguiente = fin + 1;
      const anioSiguiente = Math.floor(ordenSiguiente / 3);
      const bloqueSiguiente = ['VER', '1C', '2C'][ordenSiguiente % 3];
      const hasta = [...ids.filter((x) => ordenPeriodo(x) <= fin), `${anioSiguiente}-${bloqueSiguiente}`];
      const cierre = estadoEnCuatri(est, plan, hasta, hasta.length - 1, opciones);
      const ff = queFaltaParaFinal(aplicar(cierre, { [n]: 'regular' }), n);
      if (ff.reg.length || ff.aprobar.length || m.correlativasConfirmadas === false)
        out.push(`${nombreCorto(n)}: el resultado «aprobada» requiere además cumplir las correlativas para rendir el final${ff.reg.length ? `; falta regularizar ${lista(ff.reg)}` : ''}${ff.aprobar.length ? `; falta aprobar ${lista(ff.aprobar)}` : ''}.`);
    }
  }
  if (esVerano(id)) out.push('Verano: apertura y carga del intensivo sujetas a confirmación; la carga habitual no representa las horas reales de febrero.');
  const hs = horasCuatri(est, plan, ids, i, opciones);
  if (hs > hsLimite) out.push(`Te pasás por ${hs - hsLimite} hs del límite de ${hsLimite} hs semanales (límite provisorio).`);
  return out;
}
export const notasCuatri = (plan, ids, i) => (plan[ids[i]] ?? []).filter((n) => esContracuatri(n, ids[i])).map((n) => `${nombreCorto(n)}: contracuatrimestre · menos cátedras.`);
/** Propuesta conservadora de cursado. Los pendientes bloqueados quedan explícitos en sinUbicar. */
export function proponerPlan(est, ids, { hsLimite = 30, fijo = [], ...opciones } = {}) {
  if (!ids.length) return { plan: {}, sinUbicar: MATERIAS_PLAN.filter((m) => sinCursar(estadoDe(est, m.n))).map((m) => m.n) };
  const plan = Object.fromEntries(ids.map((id) => [id, []]));
  plan[ids[0]] = [...new Set(fijo.filter((n) => itemDe(n)))];
  const puestas = new Set(plan[ids[0]]);
  const falta = () => MATERIAS_PLAN.filter((m) => sinCursar(estadoDe(est, m.n)) && !puestas.has(m.n));
  for (let i = 1; i < ids.length && falta().length; i++) {
    if (esVerano(ids[i]) && !opciones.incluirVerano) continue;
    const proy = estadoEnCuatri(est, plan, ids, i, opciones);
    let libre = hsLimite - horasDe(continuan(est, plan, ids, i, opciones));
    const cand = falta().filter((m) => estaHabilitada(proy, m.n) && ofrecida(m.n, ids[i], opciones)
      && !(m.finalExigeTodo && resultadoDe(m.n, opciones) === 'aprobada' && queFaltaParaFinal(proy, m.n).aprobar.length))
      .sort((a, b) => destraba(b.n).size - destraba(a.n).size || a.n - b.n);
    for (const m of cand) if (m.hs <= libre && (!esVerano(ids[i]) || plan[ids[i]].length < 1)) {
      plan[ids[i]].push(m.n); puestas.add(m.n); libre -= m.hs;
    }
    plan[ids[i]] = ordenarPlan(plan[ids[i]]);
  }
  return { plan, sinUbicar: falta().map((m) => m.n) };
}

/** Explica qué acción pide cada dependencia directa, sin prometer habilitación automática. */
export function razonEntrada(n) {
  const m = itemDe(n); if (!m) return 'Materia no identificada';
  const relaciones = relacionesDe(n);
  const partes = [];
  if (m.modalidad === 'A') partes.push('cursado anual');
  if (relaciones.regular.length) partes.push(`regularizarla es requisito para cursar ${relaciones.regular.slice(0, 2).map(nombreCorto).join(', ')}${relaciones.regular.length > 2 ? ' y otras' : ''}`);
  if (relaciones.aprobada.length) partes.push(`aprobarla es requisito para cursar ${relaciones.aprobada.slice(0, 2).map(nombreCorto).join(', ')}${relaciones.aprobada.length > 2 ? ' y otras' : ''}`);
  if (!partes.length) partes.push(m.reg.length || m.aprob.length ? 'requiere las correlativas indicadas para cursar' : 'sin correlativas para cursar');
  if (relaciones.regular.length || relaciones.aprobada.length) partes.push('también deben cumplirse los demás requisitos de cada materia');
  const r = partes.join(' · '); return r[0].toUpperCase() + r.slice(1);
}
/** El Home conserva 1C/2C, incorporando febrero a la proyección solo si fue elegido. */
export function planProximoAnio(est, ids = ['2026-2C', '2027-1C', '2027-2C'], opciones = {}) {
  const timeline = opciones.incluirVerano ? [...new Set([...ids, `${ids.at(-1).slice(0, 4)}-VER`])].sort((a, b) => ordenPeriodo(a) - ordenPeriodo(b)) : ids;
  const { plan } = proponerPlan(est, timeline, opciones);
  return ids.slice(1).map((id) => {
    const ns = plan[id] ?? [];
    return { id, hs: horasDe(ns), items: ns.map((n) => ({ n, electiva: esElectiva(n), razon: razonEntrada(n) })) };
  });
}
