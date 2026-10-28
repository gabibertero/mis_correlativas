import { test, expect } from '@playwright/test';

const K = 'corr:v1:';
const leerPlan = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k + 'plan') ?? 'null'), K);
const guardarLS = (page, k, v) => page.evaluate(([p, k, v]) => localStorage.setItem(p + k, JSON.stringify(v)), [K, k, v]);

test.describe('planificador: proponer y mover', () => {
  test('proponer arma un plan sin avisos, persiste y sobrevive al reload', async ({ page }) => {
    await page.goto('planificador/');
    await page.locator('[data-accion="proponer-plan"]').click();
    await expect(page.locator('[data-estado-plan]')).toContainText('Propuesta armada');
    const plan = await leerPlan(page);
    expect(plan['2027-1C'].length).toBeGreaterThan(0);
    expect(Object.values(plan).flat()).not.toContain(99);
    await expect(page.locator('[data-cuatri="2027-1C"] [data-avisos] li')).toHaveCount(0);
    // aparecen los cuatrimestres extra necesarios
    await expect(page.locator('[data-cuatri="2029-1C"]')).toBeVisible();
    for (const id of ['2027-1C', '2027-2C', '2028-1C', '2029-1C']) await expect(page.locator(`[data-cuatri="${id}"] [data-avisos] li`)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-cuatri="2029-1C"]')).toBeVisible();
    expect(await leerPlan(page)).toEqual(plan);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]);
  });

  test('proponer pide confirmación si ya había plan armado', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2026-2C': [], '2027-1C': [23] });
    await page.reload();
    let vistos = 0;
    page.on('dialog', (d) => { vistos++; d.dismiss(); });
    await page.locator('[data-accion="proponer-plan"]').click();
    expect(vistos).toBe(1);
    await expect(page.locator('[data-estado-plan]')).toContainText('cancelada');
    expect((await leerPlan(page))['2027-1C']).toEqual([23]);
  });

  test('agregar una materia sin correlativas avisa en rojo', async ({ page }) => {
    await page.goto('planificador/');
    const c1 = page.locator('[data-cuatri="2027-1C"]');
    await c1.locator('select').selectOption('25'); // Calidad: falta Diseño
    await c1.locator('[data-accion="agregar-materia"]').click();
    await expect(c1.locator('[data-avisos] li')).not.toHaveCount(0);
    await expect(c1.locator('li[data-materia="25"] [data-accion="mover-siguiente"]')).toHaveCount(0);
  });

  test('arrastrar y soltar entre cuatrimestres (mouse)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'el drag es con mouse; en celular se quita y se vuelve a agregar');
    await page.goto('planificador/');
    const c1 = page.locator('[data-cuatri="2027-1C"]');
    await c1.locator('select').selectOption('23');
    await c1.locator('[data-accion="agregar-materia"]').click();
    await c1.locator('li[data-materia="23"]').dragTo(page.locator('[data-cuatri="2027-2C"]'));
    await expect(page.locator('[data-cuatri="2027-2C"] li[data-materia="23"]')).toBeVisible();
    await expect(c1.locator('li[data-materia="23"]')).toHaveCount(0);
    // Diseño es anual: en un 2C avisa la modalidad
    await expect(page.locator('[data-cuatri="2027-2C"] [data-avisos]')).toContainText('anual');
    expect((await leerPlan(page))['2027-2C']).toContain(23);
  });

  test('anual puesta en 1C ocupa horas del 2C siguiente', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2026-2C': [], '2027-1C': [23], '2027-2C': [] });
    await page.reload();
    await expect(page.locator('[data-cuatri="2027-2C"] [data-hs-total]')).toHaveText('6');
    await expect(page.locator('[data-cuatri="2027-2C"] li[data-continua]')).toHaveCount(1);
  });

  test('sumar un cuatrimestre muestra el siguiente', async ({ page }) => {
    await page.goto('planificador/');
    await expect(page.locator('[data-cuatri="2028-1C"]')).toBeHidden();
    await page.locator('[data-accion="sumar-cuatri"]').click();
    await expect(page.locator('[data-cuatri="2028-1C"]')).toBeVisible();
  });

  test('sin JS: los cuatrimestres base se ven y las herramientas quedan ocultas', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4399/Correlativas/planificador/');
    await expect(page.locator('[data-cuatri="2026-2C"]')).toBeVisible();
    await expect(page.locator('[data-cuatri="2028-1C"]')).toBeHidden();
    await expect(page.locator('[data-herramientas]')).toBeHidden();
    await ctx.close();
  });
});

test.describe('seminario opcional', () => {
  test('malla: aparece marcado como opcional y nivel 3 es /6', async ({ page }) => {
    await page.goto('malla/');
    await expect(page.locator('button.mat[data-materia="99"]')).toHaveAttribute('data-opcional', 'si');
    await expect(page.locator('button.mat[data-materia="99"]')).toContainText('Opcional');
    await expect(page.locator('section[data-nivel="3"] [data-nivel-avance]')).toContainText('/6');
  });
  test('aprobar el Seminario suma 6 créditos solo a Ingeniería', async ({ page }) => {
    await page.goto('');
    await guardarLS(page, 'estado', { 99: { estado: 'aprobada' } });
    await page.reload();
    await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('6');
    await expect(page.locator('[data-creditos="analista"] [data-valor]')).toHaveText('0');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('0');
    await page.goto('electivas/');
    await expect(page.locator('[data-seminario-creditos]')).toBeVisible();
  });
  test('urgencia: 0 finales = ok', async ({ page }) => {
    await page.goto('');
    await guardarLS(page, 'estado', { 1: { estado: 'aprobada' } });
    await page.reload();
    await expect(page.locator('[data-kpi="finales"]')).toHaveAttribute('data-nivel-urgencia', 'ok');
  });
});

test.describe('planificador: electivas', () => {
  const BACKEND = 'e:backend-de-aplicaciones'; // 2C · reg 13,14 · aprob 6 · 4 cr
  test('agregar una electiva bloqueada avisa en rojo, suma sus créditos como horas y persiste', async ({ page, isMobile }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'estado', {});
    await page.reload();
    const c = page.locator('[data-cuatri="2026-2C"]');
    const antes = Number(await c.locator('[data-hs-total]').textContent());
    await c.locator('select').selectOption(BACKEND);
    await c.locator('[data-accion="agregar-materia"]').click();
    const fila = c.locator(`li[data-materia="${BACKEND}"]`);
    await expect(fila).toContainText('Electiva · 4 cr');
    await expect(c.locator('[data-hs-total]')).toHaveText(String(antes + 4));
    await expect(c.locator('[data-avisos]')).toContainText('Backend de Aplicaciones: falta');
    expect((await leerPlan(page))['2026-2C']).toContain(BACKEND);
    await page.reload();
    await expect(page.locator(`[data-cuatri="2026-2C"] li[data-materia="${BACKEND}"]`)).toBeVisible();
    // ya usada: no vuelve a ofrecerse
    await expect(page.locator(`[data-cuatri="2027-2C"] option[value="${BACKEND}"]`)).toHaveCount(0);
    if (isMobile) return; // el arrastre es con mouse
    await page.setViewportSize({ width: 1280, height: 2600 }); // origen y destino a la vista: dragTo no scrollea a mitad de arrastre
    // en un 1C avisa la modalidad
    await page.locator(`[data-cuatri="2026-2C"] li[data-materia="${BACKEND}"]`).dragTo(page.locator('[data-cuatri="2027-1C"]'));
    await expect(page.locator('[data-cuatri="2027-1C"] [data-avisos]')).toContainText('solo en el 2º cuatrimestre');
  });

  test('electiva habilitada en su cuatri no avisa; el arrastre la lleva a otro cuatri', async ({ page, isMobile }) => {
    test.skip(isMobile, 'el arrastre es con mouse');
    await page.goto('planificador/');
    await guardarLS(page, 'estado', { 6: { estado: 'aprobada' }, 13: { estado: 'aprobada' }, 14: { estado: 'aprobada' } });
    await guardarLS(page, 'plan', { '2026-2C': [BACKEND], '2027-1C': [], '2027-2C': [] });
    await page.reload();
    await expect(page.locator('[data-cuatri="2026-2C"] [data-avisos] li')).toHaveCount(0);
    await page.locator(`[data-cuatri="2026-2C"] li[data-materia="${BACKEND}"]`).dragTo(page.locator('[data-cuatri="2027-1C"]'));
    await expect(page.locator('[data-estado-plan]')).toContainText('Moviste Backend de Aplicaciones');
    await expect(page.locator('[data-cuatri="2027-1C"] [data-avisos]')).toContainText('solo en el 2º');
    await page.locator(`[data-cuatri="2027-1C"] li[data-materia="${BACKEND}"] [data-accion="quitar-materia"]`).click();
    await expect(page.locator(`li[data-materia="${BACKEND}"]`)).toHaveCount(0);
  });

  test('sin scroll horizontal a 390px con electivas en el plan', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2026-2C': ['e:ingenieria-de-software-de-fuentes-abiertas-libres', BACKEND], '2027-1C': [], '2027-2C': [] });
    await page.reload();
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]);
  });
});

test.describe('planificador: modalidad, orden y recursar', () => {
  test('orden anuales -> cuatrimestrales -> electivas, modalidad y contracuatri visibles', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2027-1C': [28, 'e:desarrollo-y-operaciones-devops', 22, 7, 23] });
    await page.reload();
    const filas = page.locator('[data-cuatri="2027-1C"] li[data-materia]');
    expect(await filas.evaluateAll((l) => l.map((x) => x.dataset.materia))).toEqual(['23', '7', '22', '28', 'e:desarrollo-y-operaciones-devops']);
    await expect(filas.first().locator('.modalidad')).toHaveText('Anual');
    const contra = page.locator('[data-cuatri="2027-1C"] li[data-materia="7"] [data-contracuatri="si"]');
    await expect(contra).toContainText(/contracuatrimestre/i);
    await expect(page.locator('[data-cuatri="2027-1C"] [data-avisos]')).not.toContainText('se dicta');
  });
  test('recursar oculta "ya la aprobaste" y desmarcar lo vuelve', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'estado', { 1: { estado: 'aprobada' } });
    await guardarLS(page, 'plan', { '2027-1C': [1] });
    await page.reload();
    const av = page.locator('[data-cuatri="2027-1C"] [data-avisos]');
    await expect(av).toContainText('ya la aprobaste');
    await page.locator('[data-cuatri="2027-1C"] [data-accion="recursar"][data-materia="1"]').click();
    await expect(av).not.toContainText('ya la aprobaste');
    await page.locator('[data-cuatri="2027-1C"] [data-accion="recursar"][data-materia="1"]').click();
    await expect(av).toContainText('ya la aprobaste');
  });
});
