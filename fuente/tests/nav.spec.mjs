import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

// Sesión ficticia solo local (mismo mecanismo que conteos.spec): Supabase interceptado, sin red real.
async function conSesion(page) {
  await page.context().route(/https:\/\/[^/]+\.supabase\.co\/.*/, (route) => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    sessionStorage.setItem('corr:pulled', '1');
    const user = { id: '00000000-0000-4000-8000-000000000002', aud: 'authenticated', role: 'authenticated', email: 'nav.con.un.mail.largo@example.test' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, aud: user.aud, role: user.role, exp }))}.firma-de-prueba`;
    localStorage.setItem('sb-sqxfimanxgrzvjzbnumj-auth-token', JSON.stringify({ access_token: token, refresh_token: 'solo-prueba', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
  });
}

// Problemas de layout del header/nav en el ancho actual: desbordes, solapes, textos en 2 líneas u objetivos chicos.
const problemasNav = () => {
  const r = (e) => e.getBoundingClientRect();
  const q = (s) => document.querySelector(s);
  const err = [];
  const movil = innerWidth <= 900;
  if (document.documentElement.scrollWidth > innerWidth) err.push('scroll horizontal');
  for (const s of ['.sitio-in', '.sitio nav ul', '.marca']) { const e = q(s); if (e.scrollWidth > e.clientWidth + 1) err.push(`${s} desborda`); }
  const ul = r(q('.sitio nav ul'));
  document.querySelectorAll('.sitio nav a').forEach((a, i) => {
    const b = r(a);
    if (b.width < 44 || b.height < 44) err.push(`link ${i} mide ${Math.round(b.width)}x${Math.round(b.height)}`);
    if (b.left < ul.left - 0.5 || b.right > ul.right + 0.5) err.push(`link ${i} fuera de la lista`);
    for (const s of [...a.querySelectorAll('span')].filter((s) => getComputedStyle(s).display !== 'none' && r(s).width > 1)) {
      const t = r(s);
      if (t.height > parseFloat(getComputedStyle(s).lineHeight) * 1.5) err.push(`«${s.textContent}» en 2+ líneas`);
      if (t.left < b.left - 0.5 || t.right > b.right + 0.5) err.push(`«${s.textContent}» se sale del ítem`);
    }
    if (!movil) for (const s of ['.marca', '.tema', '.sesion']) { const c = r(q(s)); if (b.left < c.right - 0.5 && c.left < b.right - 0.5) err.push(`link ${i} pisa ${s}`); }
  });
  const cajas = ['.marca', '.tema', '.sesion'].map((s) => r(q(s)));
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) if (cajas[i].left < cajas[j].right - 0.5 && cajas[j].left < cajas[i].right - 0.5) err.push(`header: ${i} pisa ${j}`);
  if (!movil && r(q('.sitio')).height > 72) err.push('el header saltó de línea');
  return err;
};

test.describe('navbar', () => {
  test.skip(({ isMobile }) => isMobile, 'recorre los anchos por su cuenta: alcanza con un proyecto');

  test('entra sin desbordes ni cortes de 320 a 1440px', async ({ page }) => {
    await conSesion(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('licenciaturas/');
    await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
    for (const width of [320, 360, 390, 414, 768, 900, 901, 1024, 1079, 1180, 1280, 1281, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(problemasNav), `${width}px`).toEqual([]);
    }
  });

  test('los links conservan el nombre completo aunque en celular se vea abreviado', async ({ page }) => {
    await conSesion(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('licenciaturas/');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByText('Licenc.')).toBeVisible();
    for (const nombre of ['Inicio', 'Malla', 'Simulador', 'Planificador', 'Electivas', 'Licenciaturas']) {
      await expect(nav.getByRole('link', { name: nombre, exact: true })).toHaveCount(1);
    }
    await expect(nav.getByRole('link', { name: 'Licenciaturas', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(nav.getByText('Licenc.')).toBeHidden();
    await expect(nav.getByText('Licenciaturas', { exact: true })).toBeVisible();
  });
});
