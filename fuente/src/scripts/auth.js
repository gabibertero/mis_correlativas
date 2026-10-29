// Login con Supabase: botón en el header + <dialog> (ambos viven en Layout). Sincroniza vía lib/sync.js.
import { limpiarLocal } from '../lib/progreso.js';
import { supabase } from '../lib/supabase.js';
import { pull, habilitarPush } from '../lib/sync.js';

const BANDERA = 'corr:pulled'; // sessionStorage: una sola bajada por sesión del navegador, evita bucles de recarga
const $ = (s) => document.querySelector(s);
const btn = $('[data-accion="sesion"]');
const dlg = $('[data-sesion-dialogo]');
if (btn && dlg) iniciar();

const MENSAJES = [
  [/already registered|already been registered/i, 'Ese mail ya está registrado. Probá entrar.'],
  [/invalid login|invalid credentials/i, 'Mail o contraseña incorrectos.'],
  [/at least 6|weak password|should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/invalid.*email|unable to validate email|email.*invalid/i, 'El mail no es válido.'],
  [/^Confirmá el mail/, 'Confirmá el mail para entrar.'],
  [/rate limit|too many/i, 'Demasiados intentos. Esperá un rato.'],
  [/fetch|network/i, 'Sin conexión. Revisá internet.'],
];
const traducir = (e) => MENSAJES.find(([re]) => re.test(e?.message ?? ''))?.[1] ?? 'No se pudo completar. Probá de nuevo.';

function iniciar() {
  const form = dlg.querySelector('form');
  const aviso = dlg.querySelector('[role="status"]');
  const vistaForm = dlg.querySelector('[data-vista="form"]');
  const vistaCuenta = dlg.querySelector('[data-vista="cuenta"]');
  const titulo = dlg.querySelector('[data-titulo]');
  const alternar = dlg.querySelector('[data-alternar]');
  const enviar = dlg.querySelector('[data-enviar]');
  const mail = form.elements.email;
  const clave = form.elements.password;
  let registro = false;
  let sesion = null;

  const pintarModo = () => {
    titulo.textContent = registro ? 'Crear cuenta' : 'Entrar';
    enviar.textContent = registro ? 'Crear cuenta' : 'Entrar';
    alternar.textContent = registro ? 'Ya tengo cuenta' : 'Crear una cuenta';
    clave.autocomplete = registro ? 'new-password' : 'current-password';
  };
  const pintarSesion = () => {
    const email = sesion?.user?.email;
    btn.querySelector('[data-texto]').textContent = email ?? 'Entrar';
    btn.setAttribute('aria-label', email ? `Cuenta: ${email}` : 'Entrar o crear cuenta');
    vistaForm.hidden = !!sesion;
    vistaCuenta.hidden = !sesion;
    dlg.querySelector('[data-mail]').textContent = email ?? '';
    if (!sesion) { titulo.textContent = registro ? 'Crear cuenta' : 'Entrar'; } else titulo.textContent = 'Tu cuenta';
  };
  const sincronizar = async () => {
    if (!sesion) return;
    if (sessionStorage.getItem(BANDERA)) return habilitarPush(); // ya se bajó en esta sesión (otra página)
    try {
      const cambio = await pull();
      sessionStorage.setItem(BANDERA, '1'); // solo tras una bajada exitosa; si falló, se reintenta
      if (cambio) location.reload(); // la bandera ya está: la próxima carga no vuelve a bajar
    } catch { /* sin red o error: no se sube nada hasta lograr bajar */ }
  };

  btn.hidden = false;
  pintarModo();
  btn.addEventListener('click', () => { aviso.textContent = ''; dlg.showModal(); (sesion ? dlg.querySelector('[data-salir]') : mail).focus(); });
  dlg.querySelector('[data-cerrar]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // click en el fondo
  alternar.addEventListener('click', () => { registro = !registro; aviso.textContent = ''; pintarModo(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    enviar.disabled = true;
    aviso.textContent = '';
    const cred = { email: mail.value.trim(), password: clave.value };
    try {
      const { data, error } = registro ? await supabase.auth.signUp(cred) : await supabase.auth.signInWithPassword(cred);
      if (error) throw error;
      if (!data.session) throw new Error('Confirmá el mail para entrar.'); // solo si Confirm email sigue prendido
      sessionStorage.removeItem(BANDERA);
      clave.value = '';
      dlg.close();
    } catch (err) {
      aviso.textContent = traducir(err);
    } finally { enviar.disabled = false; }
  });

  dlg.querySelector('[data-salir]').addEventListener('click', async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(BANDERA);
    limpiarLocal();
    location.reload();
  });

  // INITIAL_SESSION (al cargar) y SIGNED_IN (login) pasan por acá; TOKEN_REFRESHED no vuelve a bajar por la bandera.
  supabase.auth.onAuthStateChange((_, s) => { sesion = s; pintarSesion(); setTimeout(sincronizar); }); // setTimeout: no esperar a supabase dentro del callback (deadlock)
}
