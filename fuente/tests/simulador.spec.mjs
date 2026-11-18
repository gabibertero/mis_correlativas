import { test, expect } from '@playwright/test';
import { ELECTIVAS } from '../src/data/plan.js';
import { slug } from '../src/lib/motor.js';

test.use({ reducedMotion: 'reduce' });

// Sesión ficticia solo local: toda petición a Supabase se intercepta y nunca se usa una cuenta real.
async function preparar(page, { estado = {}, electivas = {}, ...otros } = {}) {
  await page.context().route(/https:\/\/[^/]+\.supabase\.co\/.*/, (route) => route.fulfill({ json: {} }));
  await page.addInitScript(({ estado, electivas, otros }) => {
    if (sessionStorage.getItem('simulador:iniciado')) return;
    sessionStorage.setItem('simulador:iniciado', '1');
    sessionStorage.setItem('corr:pulled', '1');
    const user = { id: '00000000-0000-4000-8000-000000000003', aud: 'authenticated', role: 'authenticated', email: 'simulador@example.test' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, aud: user.aud, role: user.role, exp }))}.firma-de-prueba`;
    localStorage.setItem('sb-sqxfimanxgrzvjzbnumj-auth-token', JSON.stringify({ access_token: token, refresh_token: 'solo-prueba', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
    for (const [clave, valor] of Object.entries({ estado, electivas, ...otros })) localStorage.setItem(`corr:v1:${clave}`, JSON.stringify(valor));
  }, { estado, electivas, otros });
}
const progreso = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('corr:v1:'))));
async function sinDesborde(page) {
  const [contenido, ventana] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(contenido).toBeLessThanOrEqual(ventana);
}
const fila = (page, n) => page.locator(`[data-sim-materia="${n}"]`);

const DEBE = { 1: { estado: 'aprobada' }, 2: { estado: 'aprobada' }, 9: { estado: 'cursando' }, 18: { estado: 'regular' } };

test('regularizar AM II habilita Análisis Numérico y su final; volver a mi estado real resetea', async ({ page }) => {
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
  const antes = await progreso(page);
  // Arranca en «Lo que debo»: AM II y Economía; las aprobadas no aparecen.
  await expect(page.locator('[data-sim-filtro][value="debo"]')).toBeChecked();
  await expect(page.locator('[data-sim-cuenta="debo"]')).toHaveText('2');
  await expect(fila(page, 9)).toBeVisible();
  await expect(fila(page, 18)).toBeVisible();
  await expect(fila(page, 1)).toBeHidden();
  await expect(fila(page, 22)).toBeHidden();
  await expect(page.locator('.res-listas')).toBeHidden();

  await fila(page, 9).getByRole('radio', { name: 'Regularizo' }).check();
  await expect(fila(page, 9).locator('input[value="regular"]')).toBeChecked();
  await expect(fila(page, 9)).toHaveAttribute('data-sim-cambiada', 'si');
  await expect(fila(page, 9).locator('[data-sim-chip="proy"]')).toHaveText('Regular');
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="22"]')).toContainText('Análisis Numérico');
  await expect(page.locator('[data-sim-lista="finales"] li[data-materia="9"]')).toBeVisible();
  await expect(page.locator('[data-sim-real="cursadas"]')).toHaveText('3');
  await expect(page.locator('[data-sim-proy="cursadas"]')).toHaveText('4');
  await expect(page.locator('[data-sim-delta="cursadas"]')).toHaveText('+1');
  await expect(page.locator('[data-sim-resumen]')).toContainText('1 materia nueva para cursar y 1 final nuevo');
  expect(await progreso(page)).toEqual(antes);

  await page.getByRole('button', { name: 'Volver a mi estado real' }).click();
  await expect(fila(page, 9).locator('input[value="real"]')).toBeChecked();
  await expect(fila(page, 9)).toHaveAttribute('data-sim-cambiada', 'no');
  await expect(page.locator('[data-sim-resumen]')).toContainText('Elegí qué pasaría');
  await expect(page.locator('.res-listas')).toBeHidden();
  await expect(page.locator('[data-accion="reset-simulacion"]')).toBeHidden();
  await expect(page.locator('[data-sim-proy="cursadas"]')).toHaveText('3');
  expect(await progreso(page)).toEqual(antes);
  await sinDesborde(page);
});

test('cada fila ofrece solo las acciones que cambian algo y se maneja con teclado', async ({ page }) => {
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  // Regular: ya está regularizada, «Regularizo» no aporta.
  await expect(fila(page, 18).locator('[data-sim-op="regular"]')).toBeHidden();
  await expect(fila(page, 18).locator('[data-sim-op="libre"]')).toBeVisible();
  // Cursando: las cuatro.
  for (const op of ['real', 'regular', 'aprobada', 'libre']) await expect(fila(page, 9).locator(`[data-sim-op="${op}"]`)).toBeVisible();
  // Flechas dentro del grupo de radios.
  await fila(page, 9).locator('input[value="real"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(fila(page, 9).locator('input[value="regular"]')).toBeChecked();
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="22"]')).toBeVisible();
  // Los botones del control miden al menos 44px de alto (incluido el borde del grupo).
  const alto = await fila(page, 9).locator('[data-sim-opciones]').evaluate((e) => e.getBoundingClientRect().height);
  expect(alto).toBeGreaterThanOrEqual(44);
});

test('filtros: puedo cursar, todas y búsqueda; la fila cambiada sigue visible', async ({ page }) => {
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  await fila(page, 9).locator('[data-sim-op="aprobada"]').click();
  await page.locator('[data-sim-filtro][value="cursar"]').check({ force: true });
  await expect(fila(page, 3)).toBeVisible(); // primer nivel sin correlativas
  await expect(fila(page, 22)).toBeHidden(); // necesita AM II regular
  await expect(fila(page, 9)).toBeVisible(); // cambiada: no se pierde de vista
  await page.locator('[data-sim-filtro][value="todas"]').check({ force: true });
  await expect(fila(page, 22)).toBeVisible();
  await expect(fila(page, 1)).toBeHidden(); // aprobada
  await page.locator('[data-sim-buscar]').fill('numerico');
  await expect(page.locator('[data-sim-materia]:visible')).toHaveCount(1);
  await page.locator('[data-sim-buscar]').fill('');
  await page.locator('[data-sim-filtro][value="debo"]').check({ force: true });
  await page.locator('[data-sim-buscar]').fill('zzz');
  await expect(page.locator('[data-sim-sin-resultados]')).toBeVisible();
  await page.locator('[data-sim-ver-todas]').click();
  await expect(page.locator('[data-sim-filtro][value="todas"]')).toBeChecked();
});

test('sin materias pendientes de final arranca en «Todas»', async ({ page }) => {
  await preparar(page, { estado: { 1: { estado: 'aprobada' } } });
  await page.goto('simulador/');
  await expect(page.locator('[data-sim-filtro][value="todas"]')).toBeChecked();
  await expect(page.locator('[data-sim-rapido="aprobar-debo"]')).toBeHidden();
  await expect(page.locator('[data-sim-rapido="regularizar-cursando"]')).toBeHidden();
});

test('escenarios rápidos: regularizar lo que curso y aprobar todo lo que debo', async ({ page }) => {
  await preparar(page, { estado: { ...DEBE, 10: { estado: 'cursando' } } });
  await page.goto('simulador/');
  await page.getByRole('button', { name: 'Regularizar lo que curso' }).click();
  for (const n of [9, 10]) await expect(fila(page, n).locator('input[value="regular"]')).toBeChecked();
  await expect(fila(page, 18).locator('input[value="real"]')).toBeChecked();
  await page.getByRole('button', { name: 'Aprobar todo lo que debo' }).click();
  for (const n of [9, 10, 18]) await expect(fila(page, n).locator('input[value="aprobada"]')).toBeChecked();
  await expect(page.locator('[data-sim-proy="aprobadas"]')).toHaveText('5');
  await expect(page.locator('[data-sim-delta="aprobadas"]')).toHaveText('+3');
});

test('quedar libre muestra lo que se perdería', async ({ page }) => {
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  await fila(page, 18).locator('[data-sim-op="libre"]').click();
  await expect(page.locator('[data-sim-perdidas]')).toBeVisible();
  await expect(page.locator('[data-sim-lista="perdidas"] li[data-materia="18"]')).toContainText('Final');
  await expect(page.locator('[data-sim-delta="cursadas"]')).toHaveText('−1');
});

test('electiva regular: aprobarla suma créditos sin tocar el progreso guardado', async ({ page }) => {
  const e = ELECTIVAS[0]; const id = slug(e.nombre);
  await preparar(page, { electivas: { [id]: 'regular' } });
  await page.goto('simulador/');
  await expect(page.locator('[data-sim-filtro][value="debo"]')).toBeChecked();
  await fila(page, `e:${id}`).locator('[data-sim-op="aprobada"]').click();
  await expect(page.locator('[data-sim-real="creditos"]')).toHaveText('0');
  await expect(page.locator('[data-sim-proy="creditos"]')).toHaveText(String(e.creditos));
  await expect(page.locator('[data-sim-delta="creditos"]')).toHaveText(`+${e.creditos}`);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), 'corr:v1:electivas')).toEqual({ [id]: 'regular' });
});

test('volver atrás: el resultado coincide con los radios restaurados', async ({ page }) => {
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  await fila(page, 9).locator('[data-sim-op="regular"]').click();
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="22"]')).toBeVisible();
  await page.goto('malla/');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
  const marcado = await fila(page, 9).locator('input[value="regular"]').isChecked();
  if (marcado) await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="22"]')).toBeVisible();
  else await expect(page.locator('[data-sim-resumen]')).toContainText('Elegí qué pasaría');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('corr:v1:estado')))).toEqual(DEBE);
});

test('celular: barra fija sobre la nav con resumen y «Ver resultado»', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'solo en celular');
  await preparar(page, { estado: DEBE });
  await page.goto('simulador/');
  const barra = page.locator('[data-sim-barra]');
  await expect(barra).toBeHidden();
  await fila(page, 9).locator('[data-sim-op="regular"]').click();
  await expect(barra).toBeVisible();
  await expect(barra).toContainText('+1 cursar · +1 final');
  const [b, nav] = await Promise.all([barra.boundingBox(), page.locator('.sitio nav').boundingBox()]);
  expect(b.y + b.height).toBeLessThanOrEqual(nav.y + 1);
  await barra.getByRole('link', { name: 'Ver resultado' }).click();
  await expect(page.locator('[data-sim-resultado]')).toBeFocused();
  await expect(page.locator('[data-sim-resultado]')).toBeInViewport();
  await expect(barra).toBeHidden();
  await page.locator('[data-sim-deshacer]').click();
  await expect(fila(page, 9).locator('input[value="real"]')).toBeChecked();
  await sinDesborde(page);
});
