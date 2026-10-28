// Etiquetas y helpers para el render estático (build) y para los scripts de UI.
// La lógica de correlativas vive en motor.js (testeada); acá solo se adapta con el estado semilla por defecto.
import { ESTADO_INICIAL } from '../data/plan.js';
import * as M from './motor.js';

export const ETIQUETA = { pendiente: 'Pendiente', cursando: 'Cursando', recursando: 'Recursando · regular', regular: 'Regular', promocion: 'Promoción', aprobada: 'Aprobada', libre: 'Libre', abandono: 'Abandono' };
export const NOMBRE_NIVEL = { 1: 'Primer nivel', 2: 'Segundo nivel', 3: 'Tercer nivel', 4: 'Cuarto nivel', 5: 'Quinto nivel' };
export const MODALIDAD = { A: 'Anual', '1C-2C': '1C · 2C', '2C-1C': '2C · 1C', '2C': '2C', '1C': '1C' };

export const { porN, slug, nombreCorto, destraba } = M;
export const estadoDe = (n, est = ESTADO_INICIAL) => M.estadoDe(est, n);
export const falta = (m, est = ESTADO_INICIAL) => M.faltan(est, m);
export const puedeCursar = (m, est = ESTADO_INICIAL) => { const f = M.faltan(est, m); return !f.reg.length && !f.aprob.length; };
export const puedeRendir = (m, est = ESTADO_INICIAL) => M.puedeRendirFinal(est, m.n);
