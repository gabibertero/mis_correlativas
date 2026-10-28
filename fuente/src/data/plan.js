// Plan 2023 · Ingeniería en Sistemas de Información · UTN FRC
// Fuente: régimen de correlativas oficial (sistemas.pdf, CET AETI / Consejeros de Sistemas).
// Verificado contra la planilla "Mis Correlativas" el 2026-10-27: coincide al 100%.
//
// Correlativas: `reg` = materias que deben estar REGULARES para CURSAR esta;
//               `aprob` = materias con FINAL APROBADO para CURSAR esta.
// Para RENDIR EL FINAL de una materia: tenerla regular + TODAS sus correlativas (reg y aprob)
//   con final aprobado. (El "destraba" y los habilitados se calculan en la lógica, no acá.)
// Modalidad: 'A' anual · '1C-2C' se dicta 1º y 2º cuatrimestre · '2C-1C' ídem, orden sugerido.

export const MATERIAS = [
  { n: 1,  nombre: 'Análisis Matemático I',                      nivel: 1, modalidad: 'A',     reg: [],          aprob: [],          hs: 5 },
  { n: 2,  nombre: 'Álgebra y Geometría Analítica',              nivel: 1, modalidad: 'A',     reg: [],          aprob: [],          hs: 5 },
  { n: 3,  nombre: 'Física I',                                   nivel: 1, modalidad: 'A',     reg: [],          aprob: [],          hs: 5 },
  { n: 4,  nombre: 'Inglés I',                                   nivel: 1, modalidad: 'A',     reg: [],          aprob: [],          hs: 2 },
  { n: 5,  nombre: 'Lógica y Estructuras Discretas',             nivel: 1, modalidad: '1C-2C', reg: [],          aprob: [],          hs: 3 },
  { n: 6,  nombre: 'Algoritmo y Estructura de Datos',            nivel: 1, modalidad: 'A',     reg: [],          aprob: [],          hs: 5 },
  { n: 7,  nombre: 'Arquitectura de Computadoras',               nivel: 1, modalidad: '2C-1C', reg: [],          aprob: [],          hs: 4 },
  { n: 8,  nombre: 'Sistemas y Proceso de Negocios',             nivel: 1, modalidad: '1C-2C', reg: [],          aprob: [],          hs: 3 },

  { n: 9,  nombre: 'Análisis Matemático II',                     nivel: 2, modalidad: 'A',     reg: [1, 2],      aprob: [],          hs: 5 },
  { n: 10, nombre: 'Física II',                                  nivel: 2, modalidad: 'A',     reg: [1, 3],      aprob: [],          hs: 5 },
  { n: 11, nombre: 'Ingeniería y Sociedad',                      nivel: 2, modalidad: '2C-1C', reg: [],          aprob: [],          hs: 2 },
  { n: 12, nombre: 'Inglés II',                                  nivel: 2, modalidad: 'A',     reg: [4],         aprob: [],          hs: 2 },
  { n: 13, nombre: 'Sintaxis y Semántica de los Lenguajes',      nivel: 2, modalidad: '1C-2C', reg: [5, 6],      aprob: [],          hs: 4 },
  { n: 14, nombre: 'Paradigmas de Programación',                 nivel: 2, modalidad: '1C-2C', reg: [5, 6],      aprob: [],          hs: 4 },
  { n: 15, nombre: 'Sistemas Operativos',                        nivel: 2, modalidad: 'A',     reg: [7],         aprob: [],          hs: 4 },
  { n: 16, nombre: 'Análisis de Sistemas de Información',        nivel: 2, modalidad: 'A',     reg: [6, 8],      aprob: [],          hs: 6, integradora: true },
  { n: 17, nombre: 'Probabilidad y Estadística',                 nivel: 2, modalidad: '1C-2C', reg: [1, 2],      aprob: [],          hs: 3 },

  { n: 18, nombre: 'Economía',                                   nivel: 3, modalidad: '2C-1C', reg: [],          aprob: [1, 2],      hs: 3 },
  { n: 19, nombre: 'Base de Datos',                              nivel: 3, modalidad: '1C-2C', reg: [13, 16],    aprob: [5, 6],      hs: 4 },
  { n: 20, nombre: 'Desarrollo de Software',                     nivel: 3, modalidad: '1C-2C', reg: [14, 16],    aprob: [5, 6],      hs: 4 },
  { n: 21, nombre: 'Comunicación de Datos',                      nivel: 3, modalidad: 'A',     reg: [],          aprob: [3, 7],      hs: 4 },
  { n: 22, nombre: 'Análisis Numérico',                          nivel: 3, modalidad: '2C-1C', reg: [9],         aprob: [1, 2],      hs: 3 },
  { n: 23, nombre: 'Diseño de Sistemas de Información',          nivel: 3, modalidad: 'A',     reg: [14, 16],    aprob: [4, 6, 8],   hs: 6, integradora: true },
  { n: 99, nombre: 'Seminario Integrador',                       nivel: 3, modalidad: '2C',    reg: [16],        aprob: [6, 8, 13, 14], hs: 4, integradora: true,
    titulo: 'analista',
    opcional: true,         // Gabi NO lo hace: fuera de los totales del plan (36 materias)
    creditosElectivos: 6,   // si queda aprobado suma 6 créditos electivos SOLO para Ingeniería (no cuenta para Analista)
    finalExigeTodasHasta: 23, // para rendirlo: 1–23 aprobadas (título Analista Dev. Universitario)
    nota: 'Condición para rendir y acceder al título de Analista: aprobar las materias 1 a 23.' },

  { n: 24, nombre: 'Legislación',                                nivel: 4, modalidad: '2C-1C', reg: [11],        aprob: [],          hs: 2 },
  { n: 25, nombre: 'Ingeniería y Calidad de Software',           nivel: 4, modalidad: '2C-1C', reg: [19, 20, 23], aprob: [13, 14],   hs: 3 },
  { n: 26, nombre: 'Redes de Datos',                             nivel: 4, modalidad: 'A',     reg: [15, 21],    aprob: [],          hs: 4 },
  { n: 27, nombre: 'Investigación Operativa',                    nivel: 4, modalidad: 'A',     reg: [17, 22],    aprob: [],          hs: 4 },
  { n: 28, nombre: 'Simulación',                                 nivel: 4, modalidad: '1C-2C', reg: [17],        aprob: [9],         hs: 3 },
  { n: 29, nombre: 'Tecnologías para la Automatización',         nivel: 4, modalidad: '2C-1C', reg: [10, 22],    aprob: [9],         hs: 3 },
  { n: 30, nombre: 'Administración de Sistemas de Información',  nivel: 4, modalidad: 'A',     reg: [18, 23],    aprob: [16],        hs: 6, integradora: true },

  { n: 31, nombre: 'Inteligencia Artificial',                    nivel: 5, modalidad: '2C-1C', reg: [28],        aprob: [17, 22],    hs: 3 },
  { n: 32, nombre: 'Ciencia de Datos',                           nivel: 5, modalidad: '2C-1C', reg: [28],        aprob: [17, 19],    hs: 3 },
  { n: 33, nombre: 'Sistemas de Gestión',                        nivel: 5, modalidad: '1C-2C', reg: [18, 27],    aprob: [23],        hs: 4 },
  { n: 34, nombre: 'Gestión Gerencial',                          nivel: 5, modalidad: '1C-2C', reg: [24, 30],    aprob: [18],        hs: 3 },
  { n: 35, nombre: 'Seguridad en los Sistemas de Información',   nivel: 5, modalidad: '1C-2C', reg: [26, 30],    aprob: [20, 21],    hs: 3 },
  { n: 36, nombre: 'Proyecto Final',                             nivel: 5, modalidad: 'A',     reg: [25, 26, 30], aprob: [12, 20, 23], hs: 6, integradora: true,
    finalExigeTodo: true, // para rendirlo: todo el plan aprobado + PPS (Práctica Profesional Supervisada)
    nota: 'Condición para rendir: aprobar todas las asignaturas previas del plan + PPS (Práctica Profesional Supervisada).' },
];

// Electivas vigentes. Referencian el Nº de MATERIAS en sus correlativas.
// Créditos: 20 para Ingeniería (cualesquiera) · 4 de tercer nivel para Analista.
export const ELECTIVAS = [
  { nombre: 'Backend de Aplicaciones',                              nivel: 3, modalidad: '2C',    reg: [13, 14],     aprob: [6],       creditos: 4 },

  { nombre: 'Green Software',                                       nivel: 4, modalidad: '1C-2C', reg: [19, 20],     aprob: [13, 14],  creditos: 3 },
  { nombre: 'Gestión Industrial de la Producción',                 nivel: 4, modalidad: '1C',    reg: [19],         aprob: [8, 16],   creditos: 3 },
  { nombre: 'Gestión de la Mejora de los Procesos',                nivel: 4, modalidad: '1C',    reg: [19],         aprob: [8, 16],   creditos: 3 },
  { nombre: 'Desarrollo y Operaciones (DevOps)',                   nivel: 4, modalidad: '1C',    reg: [19, 20],     aprob: [13, 14],  creditos: 3 },
  { nombre: 'Desarrollo de Aplicaciones con Objetos',              nivel: 4, modalidad: '2C',    reg: [13],         aprob: [6],       creditos: 3 },
  { nombre: 'Comunicación Multimedial en el Desarrollo de SI',     nivel: 4, modalidad: '2C',    reg: [19],         aprob: [8, 16],   creditos: 3 },
  { nombre: 'Arquitectura de Software',                            nivel: 4, modalidad: '1C',    reg: [19, 20],     aprob: [13, 14],  creditos: 3 },

  { nombre: 'Desarrollo de Tecnología Blockchain',                 nivel: 5, modalidad: '1C',    reg: [19, 26],     aprob: [14, 20],  creditos: 3 },
  { nombre: 'Creatividad e Innovación en Ingeniería',              nivel: 5, modalidad: '1C-2C', reg: [30],         aprob: [20],      creditos: 3 },
  { nombre: 'Auditorías de SI/TI',                                 nivel: 5, modalidad: '1C',    reg: [30],         aprob: [20],      creditos: 3 },
  { nombre: 'Gerenciamiento Estratégico',                          nivel: 5, modalidad: '1C',    reg: [30],         aprob: [20],      creditos: 3 },
  { nombre: 'Consultoría en Negocios Digitales',                   nivel: 5, modalidad: '1C',    reg: [30],         aprob: [20],      creditos: 3 },
  { nombre: 'Emprendimientos Tecnológicos',                        nivel: 5, modalidad: '1C',    reg: [30],         aprob: [16, 19],  creditos: 3 },
  { nombre: 'Decisiones en Escenarios Complejos',                  nivel: 5, modalidad: '1C',    reg: [27],         aprob: [19],      creditos: 3 },
  { nombre: 'Testing de Software',                                 nivel: 5, modalidad: '2C',    reg: [25],         aprob: [19, 20],  creditos: 3 },
  { nombre: 'Seguridad en el Desarrollo de Software',              nivel: 5, modalidad: '2C',    reg: [19, 26],     aprob: [8, 20],   creditos: 3 },
  { nombre: 'Integración de Aplicaciones en Entorno Web',          nivel: 5, modalidad: '2C',    reg: [19, 26],     aprob: [19, 20],  creditos: 3 },
  { nombre: 'Ingeniería de Software de Fuentes Abiertas/Libres',   nivel: 5, modalidad: '2C',    reg: [19, 20, 26], aprob: [13, 14],  creditos: 3 },
];

// Materias que cuentan para los totales (sin las opcionales, p. ej. el Seminario Integrador).
export const MATERIAS_PLAN = MATERIAS.filter((m) => !m.opcional);

export const NIVELES = [1, 2, 3, 4, 5];

export const CREDITOS_INGENIERIA = 20; // mínimo total
export const CREDITOS_ANALISTA = 4;    // mínimo de 3er nivel

// Estados posibles de una materia (los que edita Gabi).
export const ESTADOS = ['pendiente', 'cursando', 'recursando', 'regular', 'promocion', 'aprobada', 'libre', 'abandono'];
// pendiente = sin empezar · cursando = "Cursando" · recursando = regular (podés rendir) pero la volvés a cursar · regular = cursada aprobada, falta final
// promocion = promocionó, debe un final reducido (todavía NO terminada) · aprobada = final rendido
// libre = perdió la regularidad · abandono = la dejó. Ojo: la marca "Recursar" del planificador (corr:v1:recursar) es otra cosa que el estado `recursando`.

// Estado inicial de Gabi (seteo conservador, entrevista 2026-10-27).
// Solo se usa como semilla la PRIMERA vez; después manda localStorage.
// Las "directas a confirmar" (AGA, Física II, COM, Legislación) van como cursando
// hasta que se confirmen; los exámenes de diciembre están en EXAMENES.
export const ESTADO_INICIAL = {
  // n: { estado, nota? }
  1:  { estado: 'aprobada', nota: 6 },
  2:  { estado: 'recursando' },            // AGA — regular y recursando; finales 2/12 o 16/12 de respaldo (ex directa probable); finales 2/12 o 16/12 de respaldo
  3:  { estado: 'aprobada', nota: 6 },
  4:  { estado: 'aprobada', nota: 8 },
  5:  { estado: 'aprobada', nota: 8 },
  6:  { estado: 'aprobada', nota: 9 },
  7:  { estado: 'aprobada', nota: 6 },
  8:  { estado: 'aprobada', nota: 9 },
  9:  { estado: 'cursando' },              // AM II — final 15/12
  10: { estado: 'cursando' },              // Física II — directa pendiente
  11: { estado: 'aprobada', nota: 10 },
  12: { estado: 'aprobada', nota: 7 },
  13: { estado: 'aprobada', nota: 8 },
  14: { estado: 'aprobada', nota: 9 },
  15: { estado: 'regular' },               // SO
  16: { estado: 'regular' },               // ASI
  17: { estado: 'aprobada', nota: 7 },
  18: { estado: 'pendiente' },             // Economía — equivalencia 30/11 y 14/12 (no la cursa)
  19: { estado: 'aprobada', nota: 7 },
  20: { estado: 'aprobada', nota: 8 },
  21: { estado: 'cursando' },              // COM — directa pendiente
  24: { estado: 'cursando' },              // Legislación — directa pendiente (nota sin subir)
};

// Mesas de examen / exámenes planificados (turno diciembre 2026).
// `tipo`: 'final' | 'equivalencia'. `opcion`: alternativa (rendís una de las fechas).
// Las fechas de febrero/marzo y julio 2027 todavía no están: se cargan desde la web.
export const EXAMENES = [
  { fecha: '2026-11-30', materia: 18, tipo: 'equivalencia', etiqueta: 'Equivalencia · 1ª oportunidad' },
  { fecha: '2026-12-02', materia: 2,  tipo: 'final',        etiqueta: 'Final · opción 1 (si no sale directa)', opcional: true },
  { fecha: '2026-12-14', materia: 18, tipo: 'equivalencia', etiqueta: 'Equivalencia · 2ª oportunidad (si va mal el 30/11)' },
  { fecha: '2026-12-15', materia: 9,  tipo: 'final',        etiqueta: 'Final' },
  { fecha: '2026-12-16', materia: 2,  tipo: 'final',        etiqueta: 'Final · opción 2 (si no sale directa)', opcional: true },
];

// Materias que Gabi espera "sacar directa" (promoción sin final) — pendientes de confirmar.
export const DIRECTAS_A_CONFIRMAR = [2, 10, 21, 24];
