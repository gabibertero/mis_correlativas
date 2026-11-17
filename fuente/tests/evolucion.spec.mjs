import { test, expect } from '@playwright/test';
import { MATERIAS_PLAN, ELECTIVAS } from '../src/data/plan.js';
import { slug } from '../src/lib/motor.js';

test.use({ reducedMotion: 'reduce' });
const K = 'corr:v1:';
const completo = Object.fromEntries(MATERIAS_PLAN.map((m) => [m.n, { estado: 'aprobada' }]));

// Datos ficticios y peticiones interceptadas: nunca se usa una cuenta real.
async function preparar(page, { estado = {}, electivas = {}, ...otros } = {}) {
  await page.context().route(/https:\/\/[^/]+\.supabase\.co\/.*/, (route) => route.fulfill({ json: {} }));
  await page.addInitScript(({ estado, electivas, otros }) => {
    if (sessionStorage.getItem('evolucion:iniciado')) return;
    sessionStorage.setItem('evolucion:iniciado', '1');
    sessionStorage.setItem('corr:pulled', '1');
    const user = { id: '00000000-0000-4000-8000-000000000002', aud: 'authenticated', role: 'authenticated', email: 'evolucion@example.test' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, aud: user.aud, role: user.role, exp }))}.firma-de-prueba`;
    localStorage.setItem('sb-sqxfimanxgrzvjzbnumj-auth-token', JSON.stringify({ access_token: token, refresh_token: 'solo-prueba', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
    for (const [clave, valor] of Object.entries({ estado, electivas, ...otros })) localStorage.setItem(`corr:v1:${clave}`, JSON.stringify(valor));
  }, { estado, electivas, otros });
}

async function sinDesborde(page) {
  const [contenido, ventana] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(contenido).toBeLessThanOrEqual(ventana);
}

const leer = (page, clave) => page.evaluate(([k, c]) => JSON.parse(localStorage.getItem(k + c) ?? 'null'), [K, clave]);

test('Análisis II admite AMI y Álgebra regulares; Economía exige sus aprobaciones', async ({ page }) => {
  await preparar(page, { estado: { 1: { estado: 'regular' }, 2: { estado: 'regular' } } });
  await page.goto('malla/');
  await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
  await expect(page.locator('button.mat[data-materia="9"]')).toHaveAttribute('data-habilitada', 'si');
  await expect(page.locator('button.mat[data-materia="18"]')).toHaveAttribute('data-habilitada', 'no');
  await page.locator('button.mat[data-materia="9"]').click();
  await expect(page.locator('[data-campo="veredicto"]')).toContainText('Podés cursarla');
  await expect(page.locator('[data-lista="requisitos"]')).toContainText('Regular');
  await sinDesborde(page);
});

test('rendir Redes mantiene regulares SO y Comunicación sin exigir ambos finales', async ({ page }) => {
  await preparar(page, { estado: { 15: { estado: 'regular' }, 21: { estado: 'regular' }, 26: { estado: 'regular' } } });
  await page.goto('malla/');
  await page.locator('button.mat[data-materia="26"]').click();
  await expect(page.locator('[data-campo="veredicto"]')).toContainText('Podés rendir el final');
  await expect(page.locator('[data-lista="falta-final"]')).not.toContainText('Aprobar: Sistemas Operativos');
  await expect(page.locator('[data-lista="falta-final"]')).not.toContainText('Aprobar: Comunicación de Datos');
  await page.goto('');
  await expect(page.locator('[data-lista="finales"] li[data-materia="26"]')).toBeVisible();
});

test('simular regularizar y aprobar produce habilitaciones distintas sin guardar estados', async ({ page }) => {
  await preparar(page);
  await page.goto('simulador/');
  for (const n of [1, 2]) await page.locator(`[data-sim-materia="${n}"] [data-sim-estado]`).selectOption('regular');
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="9"]')).toBeVisible();
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="18"]')).toHaveCount(0);
  expect(await leer(page, 'estado')).toEqual({});
  for (const n of [1, 2]) await page.locator(`[data-sim-materia="${n}"] [data-sim-estado]`).selectOption('aprobada');
  await expect(page.locator('[data-sim-lista="cursar"] li[data-materia="18"]')).toBeVisible();
  expect(await leer(page, 'estado')).toEqual({});
  await page.locator('[data-accion="reset-simulacion"]').click();
  await expect(page.locator('[data-sim-resumen]')).toContainText('Elegí un estado de prueba');
  await sinDesborde(page);
});

test('electivas conservan regular, libre y abandono; solo aprobadas suman créditos', async ({ page }) => {
  const id = slug(ELECTIVAS[0].nombre);
  await preparar(page, { estado: completo, electivas: { [id]: 'regular' } });
  await page.goto('electivas/');
  const fila = page.locator(`li[data-electiva="${id}"]`);
  const selector = fila.locator('select');
  await expect(selector).toHaveValue('regular');
  await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('0');
  for (const estado of ['libre', 'abandono']) {
    await selector.selectOption(estado);
    await expect(fila).toHaveAttribute('data-estado', estado);
    await expect(fila).toHaveAttribute('data-habilitada', 'si');
    await page.reload();
    await expect(selector).toHaveValue(estado);
    expect((await leer(page, 'electivas'))[id]).toBe(estado);
    await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('0');
  }
  await selector.selectOption('aprobada');
  await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('4');
  await selector.selectOption('regular');
  await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('0');
  await sinDesborde(page);
});

test('febrero es optativo y su cursado regulariza sin inventar aprobación ni continuación anual', async ({ page }) => {
  const estado = { 2: { estado: 'regular' } };
  await preparar(page, { estado, plan: {} });
  await page.goto('planificador/');
  const verano = page.locator('[data-cuatri="2027-VER"]');
  await expect(page.locator('[data-veranos-activos] li')).toHaveCount(0);
  await expect(verano).toBeHidden();
  await page.locator('[data-verano-sumar-anio]').selectOption('2027');
  await page.locator('[data-accion="sumar-verano"]').click();
  await expect(verano).toBeVisible();
  await expect(page.locator('[data-cuatri="2028-VER"]')).toBeHidden();
  await verano.locator('[data-campo="materia"]').selectOption('1');
  await verano.locator('[data-accion="agregar-materia"]').click();
  await expect(verano.locator('[data-resultado-plan][data-materia="1"]')).toHaveValue('regular');
  const primero = page.locator('[data-cuatri="2027-1C"]');
  await primero.locator('[data-campo="materia"]').selectOption('9');
  await primero.locator('[data-accion="agregar-materia"]').click();
  await expect(primero.locator('[data-avisos]')).not.toContainText('falta regularizar Análisis Matemático I');
  await primero.locator('[data-campo="materia"]').selectOption('18');
  await primero.locator('[data-accion="agregar-materia"]').click();
  await expect(primero.locator('[data-avisos]')).toContainText('Análisis Matemático I');
  await expect(page.locator('[data-cuatri="2027-1C"] li[data-materia="1"][data-continua]')).toHaveCount(0);
  expect(await leer(page, 'estado')).toEqual(estado);
  await page.reload();
  await expect(page.locator('[data-veranos-activos]')).toContainText('Febrero 2027');
  expect((await leer(page, 'opcionesPlan')).veranos).toEqual(['2027']);
  await expect(verano.locator('[data-resultado-plan][data-materia="1"]')).toHaveValue('regular');
  await sinDesborde(page);
});

test('una sola licenciatura elegida, créditos por aprobadas e historial conservado al cambiar', async ({ page }) => {
  await preparar(page, { estado: { 23: { estado: 'regular' } } });
  await page.goto('licenciaturas/');
  const selector = page.locator('[data-licenciatura-selector]');
  await selector.selectOption('seguridad');
  const nuevasSeguridad = page.locator('[data-licenciatura-materia="seguridad"]:visible');
  await expect(nuevasSeguridad).toHaveCount(6);
  await expect(page.locator('[data-licenciatura-acceso]')).toContainText('Diseño');
  const criptografia = page.locator('[data-electiva="criptografia-y-seguridad-criptografica"] [data-licenciatura-estado-selector]');
  await criptografia.selectOption('regular');
  await expect(page.locator('[data-licenciatura-creditos]')).toHaveText('0');
  await criptografia.selectOption('aprobada');
  await expect(page.locator('[data-licenciatura-creditos]')).toHaveText('3');
  await selector.selectOption('ia');
  await expect(nuevasSeguridad).toHaveCount(0);
  await expect(page.locator('[data-licenciatura-materia="ia"]:visible')).toHaveCount(4);
  await expect(page.locator('[data-licenciatura-creditos]')).toHaveText('0');
  expect(await leer(page, 'licenciatura')).toBe('ia');
  await selector.selectOption('datos');
  await expect(page.locator('[data-licenciatura-materia]:visible')).toHaveCount(0);
  await expect(page.locator('[data-licenciatura-sin-plan]')).toContainText('public');
  await selector.selectOption('seguridad');
  await expect(criptografia).toHaveValue('aprobada');
  await expect(page.locator('[data-licenciatura-creditos]')).toHaveText('3');
  await page.reload();
  await expect(selector).toHaveValue('seguridad');
  await expect(criptografia).toHaveValue('aprobada');
  await sinDesborde(page);
});

test('materias externas de la licenciatura suman créditos sin aumentar las 36 obligatorias', async ({ page }) => {
  const id = 'criptografia-y-seguridad-criptografica';
  await preparar(page, { estado: { 23: { estado: 'regular' } }, licenciatura: 'seguridad', electivas: { [id]: 'aprobada' } });
  await page.goto('');
  await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('0');
  await expect(page.locator('[data-anillo-resumen]')).toHaveText('0 de 36 materias');
  await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('3');
  await expect(page.locator('[data-creditos="analista"] [data-valor]')).toHaveText('0');
  await page.goto('electivas/');
  await page.locator('[data-filtro="trayecto"]').click();
  await expect(page.locator('li[data-electiva]:visible')).toHaveCount(6);
  await expect(page.locator(`li[data-electiva="${id}"] select`)).toHaveValue('aprobada');
  await page.goto('simulador/');
  await page.locator('[data-sim-ver-aprobadas]').check();
  await page.locator(`[data-sim-materia="e:${id}"] [data-sim-estado]`).selectOption('regular');
  await expect(page.locator('[data-sim-real="creditos"]')).toHaveText('3');
  await expect(page.locator('[data-sim-proy="creditos"]')).toHaveText('0');
  expect((await leer(page, 'electivas'))[id]).toBe('aprobada');
  await sinDesborde(page);
});

test('oferta excepcional de Sistemas se confirma por año y no se repite automáticamente', async ({ page }) => {
  await preparar(page, { plan: {} });
  await page.goto('planificador/');
  for (const anio of ['2027', '2028']) {
    await page.locator('[data-verano-sumar-anio]').selectOption(anio);
    await page.locator('[data-accion="sumar-verano"]').click();
  }
  const v27 = page.locator('[data-cuatri="2027-VER"]'); const v28 = page.locator('[data-cuatri="2028-VER"]');
  await v27.locator('[data-oferta-verano] summary').click();
  await v27.locator('[data-verano-extra]').selectOption('23');
  await v27.locator('[data-accion="confirmar-verano-extra"]').click();
  await expect(page.locator('[data-cuatri="2027-VER"] [data-campo="materia"] option[value="23"]')).toHaveCount(1);
  await expect(page.locator('[data-cuatri="2028-VER"] [data-campo="materia"] option[value="23"]')).toHaveCount(0);
  await v28.locator('[data-oferta-verano] summary').click();
  await v28.locator('[data-verano-extra]').selectOption('21');
  await v28.locator('[data-accion="confirmar-verano-extra"]').click();
  await expect(page.locator('[data-cuatri="2028-VER"] [data-campo="materia"] option[value="21"]')).toHaveCount(1);
  await expect(page.locator('[data-cuatri="2027-VER"] [data-campo="materia"] option[value="21"]')).toHaveCount(0);
  expect((await leer(page, 'opcionesPlan')).veranoExtrasPorAnio).toEqual({ 2027: [23], 2028: [21] });
});
