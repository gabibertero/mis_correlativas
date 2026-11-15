import { test, expect } from '@playwright/test';
import { MATERIAS_PLAN, ELECTIVAS } from '../src/data/plan.js';
import { slug } from '../src/lib/motor.js';

test.use({ reducedMotion: 'reduce' });

const completo = Object.fromEntries(MATERIAS_PLAN.map((m) => [m.n, { estado: 'aprobada' }]));
const parcial = {
  1: { estado: 'aprobada', nota: 8 },
  2: { estado: 'aprobada', nota: 6 },
  3: { estado: 'cursando' },
  9: { estado: 'regular' },
  18: { estado: 'promocion' },
  19: { estado: 'regular' }, // Tiene el final bloqueado: no debe sumarse a los rendibles.
  99: { estado: 'aprobada' }, // Opcional: suma créditos, no materias obligatorias.
};

// Sesión ficticia solo local. Toda petición a Supabase se intercepta: estas pruebas
// no crean cuentas, consultan progreso real ni escriben datos en el servicio.
async function preparar(page, estado = {}, electivas = {}) {
  await page.context().route(/https:\/\/[^/]+\.supabase\.co\/.*/, (route) => route.fulfill({ json: {} }));
  await page.addInitScript(({ estado, electivas }) => {
    if (sessionStorage.getItem('conteos:iniciado')) return;
    sessionStorage.setItem('conteos:iniciado', '1');
    sessionStorage.setItem('corr:pulled', '1');
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'conteos@example.test' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, aud: user.aud, role: user.role, exp }))}.firma-de-prueba`;
    localStorage.setItem('sb-sqxfimanxgrzvjzbnumj-auth-token', JSON.stringify({ access_token: token, refresh_token: 'solo-prueba', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
    localStorage.setItem('corr:v1:estado', JSON.stringify(estado));
    localStorage.setItem('corr:v1:electivas', JSON.stringify(electivas));
  }, { estado, electivas });
}

async function comprobarResumen(page, { aprobadas, cursando, finales, pct, niveles }) {
  await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
  await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText(String(aprobadas));
  await expect(page.locator('[data-kpi-texto="aprobadas"]')).toHaveText(String(aprobadas));
  await expect(page.locator('.anillo-t span')).toHaveText(`${aprobadas} de 36 materias`);
  await expect(page.locator('[data-anillo-valor]')).toHaveText(String(pct));
  for (const [id, n] of [['avance', aprobadas], ['proy-cursando', cursando], ['proy-finales', finales]]) {
    const paso = page.locator(`[data-kpi="${id}"]`);
    await expect(paso).toHaveAttribute('data-n', String(n));
    await expect(paso).toContainText(`${n} de 36 materias`);
    await expect(paso.locator('[data-valor]')).toHaveText(String(Math.round(n / 36 * 100)));
  }
  for (const [nv, n] of niveles.entries()) {
    await expect(page.locator(`[data-nivel-bar="${nv + 1}"] [data-ok]`)).toHaveText(String(n));
  }
  const dimensiones = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(dimensiones[0]).toBeLessThanOrEqual(dimensiones[1]);
}

test('cuenta vacía muestra cero en todos los conteos', async ({ page }) => {
  await preparar(page);
  await page.goto('');
  await comprobarResumen(page, { aprobadas: 0, cursando: 0, finales: 0, pct: 0, niveles: [0, 0, 0, 0, 0] });
});

test('progreso propio coincide en anillo, pasos y niveles sin contar el Seminario', async ({ page }) => {
  await preparar(page, parcial);
  await page.goto('');
  await comprobarResumen(page, { aprobadas: 2, cursando: 3, finales: 5, pct: 6, niveles: [2, 0, 0, 0, 0] });
  await expect(page.locator('[data-kpi="finales"] [data-valor]')).toHaveText('2');
  await expect(page.locator('[data-lista="finales"] li[data-materia]')).toHaveCount(2);
  await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('6');
});

test('plan completo muestra 36 y 100% en todos los resúmenes', async ({ page }) => {
  await preparar(page, { ...completo, 99: { estado: 'aprobada' } });
  await page.goto('');
  await comprobarResumen(page, { aprobadas: 36, cursando: 36, finales: 36, pct: 100, niveles: [8, 9, 6, 7, 6] });
  await expect(page.locator('[data-kpi="finales"] [data-valor]')).toHaveText('0');
});

test('importar actualiza todos los conteos en la misma página y persiste al recargar', async ({ page }) => {
  await preparar(page);
  await page.goto('');
  page.on('dialog', (dialog) => dialog.accept());
  for (const [estado, esperado] of [
    [parcial, { aprobadas: 2, cursando: 3, finales: 5, pct: 6, niveles: [2, 0, 0, 0, 0] }],
    [{}, { aprobadas: 0, cursando: 0, finales: 0, pct: 0, niveles: [0, 0, 0, 0, 0] }],
  ]) {
    await page.locator('[data-importar-archivo]').setInputFiles({ name: 'progreso.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'correlativas', version: 1, estado })) });
    await expect(page.locator('[data-estado-import]')).toContainText('Listo');
    await comprobarResumen(page, esperado);
    await page.reload();
    await comprobarResumen(page, esperado);
  }
});

test('aprobar una materia en la malla actualiza las cantidades del Inicio', async ({ page }) => {
  await preparar(page, parcial);
  await page.goto('malla/');
  await page.locator('button.mat[data-materia="3"]').click();
  await page.locator('[data-campo="estado"]').selectOption('aprobada');
  await page.goto('');
  await comprobarResumen(page, { aprobadas: 3, cursando: 3, finales: 5, pct: 8, niveles: [3, 0, 0, 0, 0] });
});

test('volver de la malla refresca los conteos al restaurar el Inicio', async ({ page }) => {
  await preparar(page, parcial);
  await page.goto('');
  await page.getByRole('link', { name: 'Ver la malla', exact: true }).click();
  await page.locator('button.mat[data-materia="3"]').click();
  await page.locator('[data-campo="estado"]').selectOption('aprobada');
  await page.goBack();
  await comprobarResumen(page, { aprobadas: 3, cursando: 3, finales: 5, pct: 8, niveles: [3, 0, 0, 0, 0] });
});

test('cambios y borrado de progreso en otra pestaña refrescan el Inicio', async ({ page }) => {
  await preparar(page);
  await page.goto('');
  page.on('dialog', (dialog) => dialog.accept());
  // Importar primero también llena la caché en memoria de persistencia.
  await page.locator('[data-importar-archivo]').setInputFiles({ name: 'progreso.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'correlativas', version: 1, estado: parcial })) });
  await comprobarResumen(page, { aprobadas: 2, cursando: 3, finales: 5, pct: 6, niveles: [2, 0, 0, 0, 0] });
  const otra = await page.context().newPage();
  await otra.goto(new URL('favicon.svg', page.url()).href);
  await otra.evaluate((estado) => localStorage.setItem('corr:v1:estado', JSON.stringify(estado)), completo);
  await comprobarResumen(page, { aprobadas: 36, cursando: 36, finales: 36, pct: 100, niveles: [8, 9, 6, 7, 6] });
  await otra.evaluate(() => localStorage.removeItem('corr:v1:estado'));
  await comprobarResumen(page, { aprobadas: 0, cursando: 0, finales: 0, pct: 0, niveles: [0, 0, 0, 0, 0] });
  await otra.close();
});

test('filtro de electivas habilitadas coincide con el contador y se actualiza al cursar', async ({ page }) => {
  const aprobada = slug(ELECTIVAS[0].nombre);
  const cursando = slug(ELECTIVAS[1].nombre);
  const pendiente = slug(ELECTIVAS[2].nombre);
  await preparar(page, completo, { [aprobada]: 'aprobada', [cursando]: 'cursando' });
  await page.goto('electivas/');
  await expect(page.locator('[data-resumen-electivas] b')).toHaveText('17');
  await page.locator('[data-filtro="hab"]').click();
  await expect(page.locator('li[data-electiva]:visible')).toHaveCount(17);
  await expect(page.locator(`li[data-electiva="${aprobada}"]`)).toBeHidden();
  await expect(page.locator(`li[data-electiva="${cursando}"]`)).toBeHidden();
  await page.locator(`li[data-electiva="${pendiente}"] select`).selectOption('cursando');
  await expect(page.locator('[data-resumen-electivas] b')).toHaveText('16');
  await expect(page.locator(`li[data-electiva="${pendiente}"]`)).toBeHidden();
  await expect(page.locator('li[data-electiva]:visible')).toHaveCount(16);
});
