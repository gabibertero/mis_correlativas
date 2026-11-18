// Trayectos de licenciatura: se registran únicamente las asignaturas nuevas
// publicadas, sin duplicar las materias comunes de Ingeniería en Sistemas.
import { ELECTIVAS, ESTADOS } from './plan.js';

export const FUENTE_LICENCIATURAS = 'https://www.frc.utn.edu.ar/novedades/2026/licenciaturas-en-seguridad-informatica-y-en-inteligencia-artificial-los-nuevos-trayectos-de-la-carrera-ingenieria-en-sistemas-de-informacion/';
export const ESTADOS_ELECTIVAS = [...ESTADOS];

const nueva = (licenciatura, nombre, desde, nombreOriginal = nombre) => ({
  nombre, nombreOriginal, licenciatura, desde,
  // Agrupación del planificador de ISI; no es un año del plan de la licenciatura.
  nivel: 4, modalidad: null,
  // Diseño regular/aprobado permite solicitar el acceso al trayecto. No se
  // publicaron aquí las correlativas particulares ni la modalidad de cada curso.
  reg: [23], aprob: [], requisitoAcceso: 23, correlativasConfirmadas: false,
  creditos: 3, criterioCreditos: 'Configuración solicitada: 3 créditos al aprobar una asignatura nueva del trayecto elegido.',
});

// Por el momento los Trabajos Finales Integradores NO suman créditos electivos (decisión de Gabi, 2026-11-17).
const sinCreditos = (e) => ({ ...e, creditos: 0, criterioCreditos: 'Por el momento no suma créditos electivos.' });

const seguridad = [
  nueva('seguridad', 'Criptografía y Seguridad Criptográfica', 2026),
  nueva('seguridad', 'Ingeniería Social y Ética', 2026),
  nueva('seguridad', 'Seguridad en Infraestructura', 2026),
  nueva('seguridad', 'Gestión y Gobierno de la Seguridad Informática', 2027),
  nueva('seguridad', 'Análisis Forense y Pericial', 2027),
  sinCreditos(nueva('seguridad', 'Trabajo Final Integrador (Seguridad Informática)', 2027, 'Trabajo Final Integrador')),
];
const ia = [
  nueva('ia', 'Aprendizaje Automático', 2026),
  nueva('ia', 'Visión Artificial y Lenguaje Natural', 2026),
  nueva('ia', 'Aprendizaje Profundo', 2027),
  sinCreditos(nueva('ia', 'Trabajo Final Integrador (Inteligencia Artificial)', 2027, 'Trabajo Final Integrador')),
];

export const LICENCIATURAS = [
  { id: 'seguridad', nombre: 'Licenciatura en Seguridad Informática', planPublicado: true, materias: seguridad, fuente: FUENTE_LICENCIATURAS },
  { id: 'ia', nombre: 'Licenciatura en Inteligencia Artificial', planPublicado: true, materias: ia, fuente: FUENTE_LICENCIATURAS },
  { id: 'datos', nombre: 'Licenciatura en Ciencia de Datos', planPublicado: false, materias: [], nota: 'Asignaturas pendientes de publicación.' },
];

export const CATALOGO_ELECTIVAS = [...ELECTIVAS, ...seguridad, ...ia];
