import { test, expect } from '@playwright/test';

const K = 'corr:v1:';
const leerLS = (page, k) => page.evaluate(([p, k]) => JSON.parse(localStorage.getItem(p + k) ?? 'null'), [K, k]);
const guardarLS = (page, k, v) => page.evaluate(([p, k, v]) => localStorage.setItem(p + k, JSON.stringify(v)), [K, k, v]);
const sinScrollH = async (page) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); expect(w[0]).toBeLessThanOrEqual(w[1]); };

test.describe('estados nuevos (malla)', () => {
  test('leyenda y selector ofrecen los 8 estados, con "Cursando" y "Recursando"', async ({ page }) => {
    await page.goto('malla/');
    await expect(page.locator('.leyenda .chip')).toHaveText(['Pendiente', 'Cursando', 'Recursando · regular', 'Regular', 'Promoción', 'Aprobada', 'Libre', 'Abandono']);
    await page.locator('button.mat[data-materia="1"]').click();
    const vals = await page.locator('[data-campo="estado"] option').evaluateAll((os) => os.map((o) => o.value));
    expect(vals).toEqual(['pendiente', 'cursando', 'recursando', 'regular', 'promocion', 'aprobada', 'libre', 'abandono']);
    await sinScrollH(page);
  });

  test('promoción: lleva nota, NO suma al avance y la materia cuenta como final por rendir', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="18"]').click(); // Economía: reg/aprob 1 y 2 (AGA no está aprobada)
    await page.locator('[data-campo="estado"]').selectOption('promocion');
    await expect(page.locator('[data-campo="nota"]')).toBeEnabled();
    await page.locator('[data-campo="nota"]').fill('9');
    await page.locator('[data-campo="nota"]').press('Tab');
    await expect(page.locator('button.mat[data-materia="18"]')).toHaveAttribute('data-estado', 'promocion');
    await expect(page.locator('button.mat[data-materia="18"] [data-nota-valor]')).toHaveText('9');
    expect((await leerLS(page, 'estado'))[18]).toEqual({ estado: 'promocion', nota: 9 });
    await page.goto('');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('14'); // sigue igual
  });

  test('libre y abandono: sin nota, no habilitan nada y se ven como estado aparte', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="1"]').click();
    await page.locator('[data-campo="estado"]').selectOption('libre');
    await expect(page.locator('[data-campo="nota"]')).toBeDisabled();
    await expect(page.locator('button.mat[data-materia="1"] .chip')).toHaveText('Libre');
    await page.locator('[data-campo="estado"]').selectOption('abandono');
    await expect(page.locator('button.mat[data-materia="1"]')).toHaveAttribute('data-estado', 'abandono');
    // AM I ya no está aprobada: Análisis Matemático II (reg 1,2) queda sin habilitar y el avance baja
    await expect(page.locator('button.mat[data-materia="9"]')).toHaveAttribute('data-habilitada', 'no');
    await page.goto('');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('13');
  });

  test('"recursando" es un estado válido (AGA arranca así) y uno desconocido cae en pendiente', async ({ page }) => {
    await page.goto('malla/');
    await expect(page.locator('button.mat[data-materia="2"]')).toHaveAttribute('data-estado', 'recursando');
    await expect(page.locator('button.mat[data-materia="2"] .chip')).toHaveText('Recursando · regular');
    await guardarLS(page, 'estado', { 1: { estado: 'recursando' }, 2: { estado: 'xx' } });
    await page.reload();
    await expect(page.locator('button.mat[data-materia="1"]')).toHaveAttribute('data-estado', 'recursando');
    await expect(page.locator('button.mat[data-materia="2"]')).toHaveAttribute('data-estado', 'pendiente');
  });

  test('a 390 y 1280 la etiqueta larga no desborda', async ({ page }) => {
    await page.goto('malla/');
    await sinScrollH(page);
    await page.goto('');
    await sinScrollH(page);
  });
});

test.describe('planificador: recursar', () => {
  test('marcar Recursar: aria-pressed, marca visible, persiste y sobrevive al reload', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2026-2C': [9], '2027-1C': [] });
    await page.reload();
    const fila = page.locator('[data-cuatri="2026-2C"] li[data-materia="9"]');
    const boton = fila.locator('[data-accion="recursar"]');
    await expect(boton).toHaveAttribute('aria-pressed', 'false');
    await expect(fila.locator('[data-marca="recursar"]')).toHaveCount(0);
    await boton.click();
    await expect(fila).toHaveAttribute('data-recursar', 'si');
    await expect(fila.locator('[data-marca="recursar"]')).toHaveText('Recursar');
    await expect(fila.locator('[data-accion="recursar"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(fila.locator('[data-accion="recursar"]')).toBeFocused();
    await expect(page.locator('[data-estado-plan]')).toContainText('recursar');
    expect(await leerLS(page, 'recursar')).toEqual([9]);
    await page.reload();
    await expect(page.locator('[data-cuatri="2026-2C"] li[data-materia="9"]')).toHaveAttribute('data-recursar', 'si');
    // no cambia las correlativas: los avisos del cuatrimestre son los mismos
    await expect(page.locator('[data-cuatri="2026-2C"] [data-avisos] li')).toHaveCount(0);
    await sinScrollH(page);
    // desmarcar
    await page.locator('[data-cuatri="2026-2C"] li[data-materia="9"] [data-accion="recursar"]').click();
    expect(await leerLS(page, 'recursar')).toEqual([]);
  });

  test('la marca viaja al mover y se limpia al quitar la materia', async ({ page, isMobile }) => {
    test.skip(isMobile, 'el arrastre es con mouse');
    await page.goto('planificador/');
    await guardarLS(page, 'plan', { '2026-2C': [9], '2027-1C': [] });
    await guardarLS(page, 'recursar', [9]);
    await page.reload();
    await page.locator('[data-cuatri="2026-2C"] li[data-materia="9"]').dragTo(page.locator('[data-cuatri="2027-1C"]'));
    await expect(page.locator('[data-cuatri="2027-1C"] li[data-materia="9"]')).toHaveAttribute('data-recursar', 'si');
    await page.locator('[data-cuatri="2027-1C"] li[data-materia="9"] [data-accion="quitar-materia"]').click();
    expect(await leerLS(page, 'recursar')).toEqual([]);
  });

  test('sin JS no aparece el control de Recursar', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4399/Correlativas/planificador/');
    await expect(page.locator('[data-accion="recursar"]')).toHaveCount(0);
    await ctx.close();
  });
});
