// Sincroniza el progreso local con la tabla `progreso` de Supabase (una fila por usuaria).
// shortcut: last-write-wins, sin merge; si dos dispositivos editan a la vez gana el último en guardar.
import { supabase, SUPABASE_URL, SUPABASE_ANON } from './supabase.js';
import { armarExport, validarImport, aplicarImport, onCambio, leer, guardar, limpiarLocal } from './progreso.js';
import { mismosDatos } from './comparar.js';

const sanear = (obj) => validarImport(JSON.stringify(obj));
let timer = null;
let aplicando = false; // evita que aplicar lo bajado de la nube dispare un push
let bajado = false; // nunca subir antes de haber bajado bien: una bajada fallida no debe pisar la nube con lo local

/** El auth.js lo llama cuando la bajada de esta sesión ya se hizo en una página anterior. */
export const habilitarPush = () => { bajado = true; };
let sucio = false; // hay un cambio local sin subir
let sesion = null; // copia de la sesión para el flush, que no puede esperar a getSession()
supabase.auth.onAuthStateChange((ev, s) => { sesion = s; if (ev === 'SIGNED_OUT') { bajado = false; sucio = false; } });

async function usuario() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

async function enviar(u) {
  sucio = false; // el snapshot se arma ya mismo; si falla vuelve a quedar sucio
  const { error } = await supabase.from('progreso').upsert({ user_id: u.id, datos: armarExport(), actualizado: new Date().toISOString() });
  if (error) { sucio = true; throw error; }
}

/** Push con debounce de ~1 s. Si falla, el próximo cambio vuelve a subir el snapshot completo. */
export function push() {
  if (aplicando || !bajado) return;
  sucio = true;
  clearTimeout(timer);
  timer = setTimeout(async () => { try { const u = await usuario(); if (u) await enviar(u); } catch { /* reintenta en el próximo cambio */ } }, 1000);
}
onCambio(push);

/** Al ocultar/cerrar la página sube lo pendiente con fetch keepalive (el SDK con await no llega a completar). */
function flush() {
  if (!sucio || aplicando || !bajado || !sesion) return;
  clearTimeout(timer);
  sucio = false;
  fetch(`${SUPABASE_URL}/rest/v1/progreso`, {
    method: 'POST', keepalive: true,
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${sesion.access_token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ user_id: sesion.user.id, datos: armarExport(), actualizado: new Date().toISOString() }]),
  }).catch(() => { sucio = true; });
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);

/** Baja la fila de la nube. true = cambió el progreso local (hay que re-renderizar). Lanza si falla (sin marcar `bajado`). */
export async function pull() {
  const u = await usuario();
  if (!u) return false;
  // Otra cuenta usó este navegador: lo local no es de esta usuaria, se descarta.
  const otra = leer('uid') != null && leer('uid') !== u.id;
  if (otra) limpiarLocal();
  const { data: row, error } = await supabase.from('progreso').select('datos').eq('user_id', u.id).maybeSingle();
  if (error) throw error;
  let cambio = otra;
  if (!row) {
    await enviar(u); // cuenta nueva: sube lo que haya local
  } else {
    const remoto = sanear(row.datos);
    if (!remoto.ok) throw new Error('datos de la nube inválidos');
    const local = sanear(armarExport());
    if (!(local.ok && mismosDatos(local.datos, remoto.datos))) {
      aplicando = true;
      try { aplicarImport(remoto.datos); } finally { aplicando = false; }
      cambio = true;
    }
  }
  aplicando = true;
  try { guardar('uid', u.id); } finally { aplicando = false; }
  bajado = true;
  return cambio;
}
