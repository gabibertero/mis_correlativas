import { test, expect } from '@playwright/test';

const K = 'corr:v1:';
const leerPlan = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k + 'plan') ?? 'null'), K);
const guardarLS = (page, k, v) => page.evaluate(([p, k, v]) => localStorage.setItem(p + k, JSON.stringify(v)), [K, k, v]);

// El planificador es una página con sesión: sesión ficticia local y Supabase interceptado
// (no se crean cuentas ni se leen datos reales). Los datos se cargan con guardarLS + reload.
async function sesionFalsa(page, datos = {}) {
  await page.context().route(/https:\/\/[^/]+\.supabase\.co\/.*/, (route) => route.fulfill({ json: {} }));
  await page.addInitScript((datos) => {
    if (sessionStorage.getItem('planificador:iniciado')) return;
    sessionStorage.setItem('planificador:iniciado', '1');
    sessionStorage.setItem('corr:pulled', '1');
    const user = { id: '00000000-0000-4000-8000-000000000003', aud: 'authenticated', role: 'authenticated', email: 'planificador@example.test' };
    // Vence en años: algunas pruebas fijan el reloj de la página (page.clock) en el futuro.
    const exp = Math.floor(Date.now() / 1000) + 5 * 365 * 24 * 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, aud: user.aud, role: user.role, exp }))}.firma-de-prueba`;
    localStorage.setItem('sb-sqxfimanxgrzvjzbnumj-auth-token', JSON.stringify({ access_token: token, refresh_token: 'solo-prueba', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
    for (const [k, v] of Object.entries(datos)) localStorage.setItem(`corr:v1:${k}`, JSON.stringify(v));
  }, datos);
}
test.beforeEach(async ({ page }) => { await sesionFalsa(page); });

test.describe('planificador: proponer y mover', () => {
  test('proponer arma un plan sin avisos, persiste y sobrevive al reload', async ({ page }) => {
    await page.goto('planificador/');
    await page.locator('[data-accion="proponer-plan"]').click();
    await expect(page.locator('[data-estado-plan]')).toContainText(/Propuesta (de cursado armada|parcial)/);
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
    await expect(c1.locator('li[data-materia="25"]')).toBeVisible();
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
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('planificador/');
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
  test('aprobar el Seminario por el momento no suma créditos', async ({ page }) => {
    await page.goto('');
    await guardarLS(page, 'estado', { 99: { estado: 'aprobada' } });
    await page.reload();
    await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText('0');
    await expect(page.locator('[data-creditos="analista"] [data-valor]')).toHaveText('0');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('0');
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
    await expect(fila).toContainText('+4 créditos');
    await expect(fila).toHaveAttribute('data-tipo', 'electiva');
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

test.describe('planificador: intensivos de febrero por año', () => {
  test('sumar febrero 2027 muestra solo esa tarjeta; quitarlo con materias pide confirmación', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'estado', { 1: { estado: 'aprobada' }, 2: { estado: 'regular' } });
    await page.reload();
    const veranos = page.locator('[data-cuatri$="-VER"]:visible');
    await expect(veranos).toHaveCount(0);
    await page.locator('[data-verano-sumar-anio]').selectOption('2027');
    await page.locator('[data-accion="sumar-verano"]').click();
    await expect(veranos).toHaveCount(1);
    await expect(page.locator('[data-cuatri="2027-VER"]')).toBeVisible();
    await expect(page.locator('[data-verano-sumar-anio] option[value="2027"]')).toHaveCount(0);
    await expect(page.locator('[data-veranos-activos]')).toContainText('Febrero 2027');
    const v = page.locator('[data-cuatri="2027-VER"]');
    await v.locator('[data-campo="materia"]').selectOption('9');
    await v.locator('[data-accion="agregar-materia"]').click();
    expect((await leerPlan(page))['2027-VER']).toEqual([9]);
    // Cancelar no quita nada; aceptar quita el período y sus materias.
    page.once('dialog', (d) => d.dismiss());
    await v.locator('[data-accion="quitar-verano"]').click();
    await expect(v).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await v.locator('[data-accion="quitar-verano"]').click();
    await expect(veranos).toHaveCount(0);
    expect((await leerPlan(page))['2027-VER']).toEqual([]);
    expect((await page.evaluate((k) => JSON.parse(localStorage.getItem(k + 'opcionesPlan')), K)).veranos).toEqual([]);
  });

  test('migración: el interruptor viejo activa solo 2027 y un febrero con materias se conserva', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'opcionesPlan', { incluirVerano: true });
    await guardarLS(page, 'plan', { '2029-VER': [1] });
    await page.reload();
    await expect(page.locator('[data-cuatri="2027-VER"]')).toBeVisible();
    await expect(page.locator('[data-cuatri="2028-VER"]')).toBeHidden();
    await expect(page.locator('[data-cuatri="2029-VER"]')).toBeVisible();
    expect((await page.evaluate((k) => JSON.parse(localStorage.getItem(k + 'opcionesPlan')), K)).veranos).toEqual(['2027', '2029']);
  });
});

test.describe('planificador: resaltado de deuda', () => {
  // AM II cursando, AGA recursando (debe el final), Simulación nunca cursada.
  const estado = { 9: { estado: 'cursando' }, 2: { estado: 'recursando' }, 1: { estado: 'aprobada' }, 17: { estado: 'aprobada' }, 28: { estado: 'pendiente' } };
  test('marca solo lo que debés y deja de marcarlo si el plan lo resuelve antes', async ({ page }) => {
    await page.goto('planificador/');
    await guardarLS(page, 'estado', estado);
    await guardarLS(page, 'plan', { '2026-2C': [2], '2027-1C': [22], '2027-2C': [32] });
    await page.reload();
    const numerico = page.locator('[data-cuatri="2027-1C"] li[data-materia="22"]');
    await expect(numerico).toHaveAttribute('data-deuda', 'si');
    await expect(numerico).toContainText('Depende de algo que debés');
    await expect(numerico.locator('mark.deuda[data-deuda="reg"]')).toHaveText('Análisis Matemático II');
    await expect(numerico.locator('mark.deuda[data-deuda="aprob"]')).toHaveText('Álgebra y Geometría Analítica');
    await expect(numerico.locator('.requisitos-plan .sr-only').first()).toHaveText(/la debés: regularizala/);
    // Ciencia de Datos pide Simulación regular, que nunca cursaste: no es deuda.
    const datos = page.locator('[data-cuatri="2027-2C"] li[data-materia="32"]');
    await expect(datos.locator('mark.deuda')).toHaveCount(0);
    await expect(datos).not.toHaveAttribute('data-deuda', 'si');
    // AM II en febrero 2027: ya no se resalta; AGA sigue debiendo el final.
    await page.locator('[data-verano-sumar-anio]').selectOption('2027');
    await page.locator('[data-accion="sumar-verano"]').click();
    const v = page.locator('[data-cuatri="2027-VER"]');
    await v.locator('[data-campo="materia"]').selectOption('9');
    await v.locator('[data-accion="agregar-materia"]').click();
    await expect(numerico.locator('mark.deuda[data-deuda="reg"]')).toHaveCount(0);
    await expect(numerico.locator('mark.deuda[data-deuda="aprob"]')).toHaveText('Álgebra y Geometría Analítica');
  });
});

test.describe('planificador: copiar plan para WhatsApp', () => {
  const plan = { '2027-VER': [9], '2027-1C': [23, 22, 'e:desarrollo-y-operaciones-devops'], '2027-2C': [29] };
  test('noviembre copia el año siguiente, con sus secciones, y se puede ver el mensaje', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.clock.setFixedTime(new Date(2026, 10, 24, 12));
    await page.goto('planificador/');
    await guardarLS(page, 'estado', { 1: { estado: 'aprobada' }, 2: { estado: 'recursando' }, 9: { estado: 'cursando' } });
    await guardarLS(page, 'plan', plan);
    await guardarLS(page, 'opcionesPlan', { veranos: ['2027'] });
    await guardarLS(page, 'nombre', 'Gavi');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
    const b = page.locator('[data-accion="copiar-whatsapp"]');
    await expect(b).toHaveText('Copiar plan 2027 para WhatsApp');
    await b.click();
    await expect(page.locator('[data-estado-plan]')).toContainText('Copiado: pegalo en WhatsApp');
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado.startsWith('📚 *Plan 2027 · Gavi*')).toBe(true);
    for (const t of ['☀️ *Intensivo de febrero*\n1. Análisis Matemático II', '📅 *Anuales*\n1. Diseño de Sistemas de Información', '1️⃣ *1er cuatrimestre*',
      '1. Análisis Numérico _(si regularizo Análisis Matemático II y apruebo Álgebra y Geometría Analítica)_', '— electiva · 3 créditos', '2️⃣ *2do cuatrimestre*']) expect(copiado).toContain(t);
    await page.locator('[data-whatsapp-vista] summary').click();
    await expect(page.locator('[data-whatsapp-texto]')).toHaveText(copiado);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]);
  });

  test('septiembre copia el año en curso; sin materias ese año el botón queda deshabilitado', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2028, 8, 15, 12));
    await page.goto('planificador/');
    await guardarLS(page, 'plan', plan);
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-sesion', 'si');
    const b = page.locator('[data-accion="copiar-whatsapp"]');
    await expect(b).toHaveText('Copiar plan 2028 para WhatsApp');
    await expect(b).toBeDisabled();
    await expect(page.locator('[data-whatsapp-ayuda]')).toContainText('Todavía no planificaste materias para 2028');
  });
});
