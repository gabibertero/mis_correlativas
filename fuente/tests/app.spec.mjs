import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PAGINAS = ['', 'malla/', 'simulador/', 'planificador/', 'electivas/'];
const K = 'corr:v1:';
const leerLS = (page, k) => page.evaluate(([p, k]) => localStorage.getItem(p + k), [K, k]);
const guardarLS = (page, k, v) => page.evaluate(([p, k, v]) => localStorage.setItem(p + k, JSON.stringify(v)), [K, k, v]);

test.describe('todas las paginas', () => {
  for (const p of PAGINAS) {
    test(`sin errores de consola y sin scroll horizontal: /${p}`, async ({ page }) => {
      const errs = [];
      page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      expect(errs).toEqual([]);
      for (const tema of ['light', 'dark']) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), tema);
        const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        expect(w[0], `scrollWidth ${tema}`).toBeLessThanOrEqual(w[1]);
      }
    });
    test(`a11y basica: /${p}`, async ({ page }) => {
      await page.goto(p);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('header.sitio')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      await expect(page.locator('nav[aria-label]')).toHaveCount(1);
      expect(await page.locator('img:not([alt])').count()).toBe(0);
      const sinLabel = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter((e) => e.type !== 'hidden' && !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map((e) => e.outerHTML.slice(0, 90)));
      expect(sinLabel).toEqual([]);
      const sinNombre = await page.evaluate(() => [...document.querySelectorAll('button,a')].filter((e) => !e.textContent.trim() && !e.getAttribute('aria-label')).map((e) => e.outerHTML.slice(0, 90)));
      expect(sinNombre).toEqual([]);
    });
  }
  test('links internos del build dan 200 (base /Correlativas/)', async ({ page, request }) => {
    const vistos = new Set(); const rotos = [];
    for (const p of PAGINAS) {
      await page.goto(p);
      const hrefs = await page.$$eval('a[href],link[href],img[src],script[src]', (n) => n.map((e) => e.getAttribute('href') || e.getAttribute('src')));
      for (const h of hrefs) {
        if (!h || /^(https?:|mailto:|#|blob:|data:)/.test(h)) continue;
        const u = new URL(h, page.url()); u.hash = '';
        if (vistos.has(u.href)) continue; vistos.add(u.href);
        const r = await request.get(u.href);
        if (r.status() !== 200) rotos.push(`${p} -> ${h} = ${r.status()}`);
      }
    }
    expect(rotos).toEqual([]);
  });
});

test.describe('malla', () => {
  test('click resalta correlativas, abre panel, cambia estado/nota, persiste y se refleja en dashboard', async ({ page }) => {
    await page.goto('malla/');
    // Base de Datos (19): reg 13,16 ; aprob 5,6
    await page.locator('button.mat[data-materia="19"]').click();
    await expect(page.locator('#panel-materia')).toBeVisible();
    await expect(page.locator('button.mat[data-materia="13"]')).toHaveAttribute('data-rel', 'reg');
    await expect(page.locator('button.mat[data-materia="5"]')).toHaveAttribute('data-rel', 'aprob');
    await expect(page.locator('button.mat[data-materia="25"]')).toHaveAttribute('data-rel', 'destraba');
    await expect(page.locator('button.mat[data-materia="1"]')).toHaveAttribute('data-rel', 'atenuada');
    // AGA(2) recursando -> aprobada con nota 7
    await page.locator('button.mat[data-materia="2"]').click();
    await page.locator('[data-campo="estado"]').selectOption('aprobada');
    await page.locator('[data-campo="nota"]').fill('7');
    await page.locator('[data-campo="nota"]').press('Tab');
    const caja = page.locator('button.mat[data-materia="2"]');
    await expect(caja).toHaveAttribute('data-estado', 'aprobada');
    await expect(caja.locator('[data-nota-valor]')).toHaveText('7');
    await page.reload();
    await expect(page.locator('button.mat[data-materia="2"]')).toHaveAttribute('data-estado', 'aprobada');
    await expect(page.locator('button.mat[data-materia="2"] [data-nota-valor]')).toHaveText('7');
    await page.goto('');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('15');
    await expect(page.locator('[data-nivel-bar="1"] [data-ok]')).toHaveText('8');
  });
  test('nota invalida se ignora; nota 10 y 1 aceptadas; cambiar a no-aprobada borra nota', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="1"]').click();
    const nota = page.locator('[data-campo="nota"]');
    await nota.fill('11'); await nota.press('Tab');
    await expect(nota).toHaveValue('6');
    await nota.fill('0'); await nota.press('Tab');
    await expect(nota).toHaveValue('6');
    await nota.fill('10'); await nota.press('Tab');
    await expect(page.locator('button.mat[data-materia="1"] [data-nota-valor]')).toHaveText('10');
    await page.locator('[data-campo="estado"]').selectOption('regular');
    await expect(page.locator('button.mat[data-materia="1"] [data-nota]')).toBeHidden();
    await expect(nota).toBeDisabled();
  });
  test('Escape cierra el panel y devuelve foco a la caja', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="9"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel-materia')).toBeHidden();
    await expect(page.locator('button.mat[data-materia="9"]')).toBeFocused();
  });
  test('aprobar y desaprobar en cadena mantiene coherencia (habilitada)', async ({ page }) => {
    await page.goto('malla/');
    // Estado inicial: 15 (SO) regular, 7 aprobada -> 26 Redes necesita 21 regular
    await expect(page.locator('button.mat[data-materia="26"]')).toHaveAttribute('data-habilitada', 'no');
  });
});

test.describe('dashboard', () => {
  test('KPIs coherentes con la semilla', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('14');
    await expect(page.locator('[data-kpi="avance"] [data-valor]')).toHaveText('39'); // 14/36 (el Seminario es opcional y no cuenta)
    await expect(page.locator('[data-anillo-valor]')).toHaveText('39');
    await expect(page.locator('[data-kpi="aprobadas"] .de')).toHaveText('/36');
    await expect(page.locator('[data-kpi="proy-cursando"] [data-valor]')).toHaveText('50'); // 18/36 (AGA recursando no suma)
    await expect(page.locator('[data-kpi="proy-finales"] [data-valor]')).toHaveText('58'); // 21/36
    await expect(page.locator('[data-kpi="proy-finales"]')).toHaveAttribute('data-n', '21');
    await expect(page.locator('[data-kpi="finales"]')).toHaveAttribute('data-nivel-urgencia', 'alto'); // 3 finales (AGA, SO, ASI)
    await expect(page.locator('[data-nivel-bar="3"] [data-ok]')).toHaveText('2');
    await expect(page.locator('[data-nivel-bar="3"]')).toContainText('/6');
    await expect(page.locator('[data-lista="cursar"] li[data-materia="99"]')).toHaveCount(0);
    const prom = await page.locator('[data-kpi="promedio"] [data-valor]').textContent();
    expect(prom).toMatch(/^\d,\d\d$/);
    await expect(page.locator('[data-kpi="finales"] [data-valor]')).toHaveText(/^\d+$/);
    const filas = await page.locator('[data-lista="finales"] li[data-materia]').count();
    await expect(page.locator('[data-kpi="finales"] [data-valor]')).toHaveText(String(filas));
    await expect(page.locator('[data-countdown]')).toHaveAttribute('data-fecha', '2026-11-30');
    // Días hasta la mesa: se calculan desde hoy (no hardcodeados), igual que la app (fecha local a medianoche).
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const esperados = Math.round((new Date(2026, 10, 30) - hoy) / 86400000);
    await expect(page.locator('[data-dias]')).toHaveText(String(esperados));
  });
  test('estado vacio y estado corrupto en localStorage caen a la semilla sin errores', async ({ page }) => {
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('');
    for (const raw of ['{{{', 'null', '[]', '"x"', '{"1":{"estado":"hack"},"999":{"estado":"aprobada"}}']) {
      await page.evaluate(([k, r]) => localStorage.setItem(k + 'estado', r), [K, raw]);
      await page.reload();
      await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toBeVisible();
    }
    expect(errs).toEqual([]);
  });
  test('tema persiste', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    await page.locator('[data-accion="tema"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await leerLS(page, 'tema')).toBe('dark');
  });
});

test.describe('exportar / importar', () => {
  test('exporta .json valido y lo reimporta', async ({ page }, ti) => {
    await page.goto('');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-accion="exportar"]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^correlativas-\d{4}-\d{2}-\d{2}\.json$/);
    const f = ti.outputPath('exp.json'); await dl.saveAs(f);
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    expect(j.app).toBe('correlativas'); expect(j.version).toBe(1);
    j.estado['2'] = { estado: 'aprobada', nota: 9 };
    fs.writeFileSync(f, JSON.stringify(j));
    page.once('dialog', (d) => d.accept());
    await page.locator('[data-importar-archivo]').setInputFiles(f);
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('15');
    await expect(page.locator('[data-estado-import]')).toContainText('Listo');
    await page.reload();
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('15');
  });
  for (const [nombre, contenido] of [['no json', 'hola'], ['otra app', '{"app":"x","version":1,"estado":{}}'], ['sin estado', '{"app":"correlativas","version":1}'], ['materias invalidas', '{"app":"correlativas","version":1,"estado":{"500":{"estado":"aprobada"}}}'], ['version 2', '{"app":"correlativas","version":2,"estado":{}}'], ['vacio', '']]) {
    test(`importar invalido (${nombre}) se rechaza en rojo y no cambia el estado`, async ({ page }, ti) => {
      await page.goto('');
      const f = ti.outputPath('mal.json'); fs.writeFileSync(f, contenido);
      let dialogos = 0; page.on('dialog', (d) => { dialogos++; d.accept(); });
      await page.locator('[data-importar-archivo]').setInputFiles(f);
      const av = page.locator('[data-estado-import]');
      await expect(av).toContainText('No se importó');
      await expect(av).toHaveAttribute('data-error', '');
      const color = await av.evaluate((e) => getComputedStyle(e).color);
      const [r, g, b] = color.match(/\d+/g).map(Number);
      expect(r, `color ${color} deberia ser rojo`).toBeGreaterThan(g + 40);
      expect(dialogos).toBe(0);
      await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('14');
      expect(await leerLS(page, 'estado')).toBeNull();
    });
  }
  test('rechazar el confirm no cambia nada', async ({ page }, ti) => {
    await page.goto('');
    const f = ti.outputPath('ok.json'); fs.writeFileSync(f, JSON.stringify({ app: 'correlativas', version: 1, estado: { 1: { estado: 'aprobada' } } }));
    page.once('dialog', (d) => d.dismiss());
    await page.locator('[data-importar-archivo]').setInputFiles(f);
    await expect(page.locator('[data-estado-import]')).toContainText('cancelada');
    await expect(page.locator('[data-kpi="aprobadas"] [data-valor]')).toHaveText('14');
  });
});

test.describe('simulador', () => {
  test('hipoteticos muestran desbloqueos y NO escriben en localStorage; reset', async ({ page }) => {
    await page.goto('simulador/');
    const antes = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    const f = page.locator('fieldset[data-sim-materia="2"]');
    await expect(f).toBeVisible();
    await f.locator('input[value="aprobada"]').check({ force: true });
    await expect(page.locator('[data-sim-resumen]')).toContainText('materia de prueba');
    await expect(page.locator('[data-sim-resumen]')).toContainText('Tu estado real no cambia');
    await expect(page.locator('[data-accion="reset-simulacion"]')).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(antes);
    expect(await leerLS(page, 'estado')).toBeNull();
    await page.locator('[data-accion="reset-simulacion"]').click();
    await expect(page.locator('[data-sim-resumen]')).toContainText('Todavía no marcaste nada');
    await expect(page.locator('[data-accion="reset-simulacion"]')).toBeHidden();
    await page.goto('malla/');
    await expect(page.locator('button.mat[data-materia="2"]')).toHaveAttribute('data-estado', 'recursando');
  });
  test('volver atras: el resumen coincide con los radios restaurados', async ({ page }) => {
    await page.goto('simulador/');
    await page.locator('fieldset[data-sim-materia="2"] input[value="aprobada"]').check({ force: true });
    await expect(page.locator('[data-sim-resumen]')).toContainText('materia de prueba');
    await page.goto('malla/');
    await page.goBack();
    await expect(page.locator('fieldset[data-sim-materia="2"] input[value="aprobada"]')).toBeChecked();
    await expect(page.locator('[data-sim-resumen]')).toContainText('materia de prueba');
    await expect(page.locator('[data-accion="reset-simulacion"]')).toBeVisible();
    expect(await leerLS(page, 'estado')).toBeNull();
  });
  test('simulador respeta estado real guardado: aprobadas ocultas', async ({ page }) => {
    await page.goto('simulador/');
    await expect(page.locator('fieldset[data-sim-materia="1"]')).toBeHidden();
  });
  test('volver atras tras marcar no deja resultados inconsistentes', async ({ page }) => {
    await page.goto('simulador/');
    await page.locator('fieldset[data-sim-materia="2"] input[value="aprobada"]').check({ force: true });
    await page.goto('malla/'); await page.goBack();
    const marcado = await page.locator('fieldset[data-sim-materia="2"] input[value="aprobada"]').isChecked();
    const txt = await page.locator('[data-sim-resumen]').textContent();
    expect(marcado ? /materia de prueba/.test(txt) : /Todavía no marcaste/.test(txt)).toBe(true);
  });
});

test.describe('planificador', () => {
  test('agregar materia que no cumple correlativas avisa que falta; persiste', async ({ page }) => {
    await page.goto('planificador/');
    const c = page.locator('[data-cuatri="2027-1C"]');
    await c.locator('select').selectOption('36');
    await c.locator('[data-accion="agregar-materia"]').click();
    await expect(c.locator('[data-avisos] li').first()).toBeVisible();
    const txt = await c.locator('[data-avisos]').innerText();
    expect(txt.length).toBeGreaterThan(5);
    await page.reload();
    await expect(page.locator('[data-cuatri="2027-1C"] li[data-materia="36"]')).toBeVisible();
    await expect(page.locator('[data-cuatri="2027-1C"] [data-avisos] li').first()).toBeVisible();
    await page.locator('[data-cuatri="2027-1C"] [data-accion="quitar-materia"]').click();
    await expect(page.locator('[data-cuatri="2027-1C"] li[data-materia="36"]')).toHaveCount(0);
  });
  test('pasar 30 hs avisa sobrecarga', async ({ page }) => {
    await page.goto('planificador/');
    const c = page.locator('[data-cuatri="2027-2C"]');
    for (const n of [30, 36, 23, 25, 26, 27, 31]) { await c.locator('select').selectOption(String(n)); await c.locator('[data-accion="agregar-materia"]').click(); }
    await expect(c).toHaveAttribute('data-sobrecarga', 'si');
    await expect(c.locator('[data-avisos]')).toContainText('Te pasás por');
  });
  test('cargar fecha de mesa lista finales por impacto y persiste', async ({ page }) => {
    await page.goto('planificador/');
    const t = page.locator('[data-turno="feb-mar-2027"]');
    await t.locator('[data-fecha-editable] input').fill('2027-02-23');
    await expect(t.locator('[data-turno-cuenta]')).toContainText('Mesa');
    const imp = await t.locator('[data-examen]').evaluateAll((l) => l.map((x) => Number(x.dataset.impacto)));
    expect([...imp].sort((a, b) => b - a)).toEqual(imp);
    await page.reload();
    await expect(page.locator('[data-turno="feb-mar-2027"] [data-fecha-editable] input')).toHaveValue('2027-02-23');
    await expect(page.locator('[data-turno="feb-mar-2027"] [data-turno-cuenta]')).toBeVisible();
    await page.locator('[data-turno="feb-mar-2027"] [data-fecha-editable] input').fill('');
    await expect(page.locator('[data-turno="feb-mar-2027"] [data-turno-cuenta]')).toHaveCount(0);
  });
  test('dashboard muestra la próxima mesa desde las fechas de final de la cuenta', async ({ page }) => {
    await page.goto(''); await guardarLS(page, 'finales', { 1: '2099-12-11' }); await page.reload();
    await expect(page.locator('[data-countdown]')).toBeVisible();
  });
});

test.describe('electivas', () => {
  test('habilitada/bloqueada, contador y persistencia', async ({ page }) => {
    await page.goto('electivas/');
    const hab = page.locator('li[data-electiva][data-habilitada="si"]');
    const blo = page.locator('li[data-electiva][data-habilitada="no"]');
    expect((await hab.count()) + (await blo.count())).toBe(19);
    await expect(blo.first().locator('select')).toBeDisabled();
    await expect(blo.first().locator('[data-faltan]')).toBeVisible();
    const el = hab.first(); const id = await el.getAttribute('data-electiva');
    await el.locator('select').selectOption('aprobada');
    const ing = page.locator('[data-creditos="ing"] [data-valor]');
    const v = Number(await ing.textContent());
    expect(v).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator(`li[data-electiva="${id}"] select`)).toHaveValue('aprobada');
    await expect(ing).toHaveText(String(v));
    await page.goto('');
    await expect(page.locator('[data-creditos="ing"] [data-valor]')).toHaveText(String(v));
  });
});

test.describe('robustez', () => {
  test('localStorage bloqueado: nada se cae', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    for (const p of PAGINAS) { await page.goto(`http://localhost:4399/Correlativas/${p}`); await page.waitForLoadState('networkidle'); }
    await page.goto('http://localhost:4399/Correlativas/malla/');
    await page.locator('button.mat[data-materia="2"]').click();
    await page.locator('[data-campo="estado"]').selectOption('aprobada');
    await page.goto('http://localhost:4399/Correlativas/');
    await page.locator('[data-accion="tema"]').click();
    expect(errs).toEqual([]);
    await ctx.close();
  });
  test('setItem tira excepcion (cuota): nada se cae', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); }; });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('http://localhost:4399/Correlativas/malla/');
    await page.locator('button.mat[data-materia="2"]').click();
    await page.locator('[data-campo="estado"]').selectOption('aprobada');
    await page.goto('http://localhost:4399/Correlativas/planificador/');
    await page.goto('http://localhost:4399/Correlativas/electivas/');
    expect(errs).toEqual([]);
    await ctx.close();
  });
  test('sin JS: contenido visible y controles solo-JS ocultos', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const p of PAGINAS) {
      await page.goto(`http://localhost:4399/Correlativas/${p}`);
      await expect(page.locator('h1')).toBeVisible();
      const muertos = await page.evaluate(() => [...document.querySelectorAll('button,select,input:not([type=hidden])')].filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && !(e.tagName === 'BUTTON' && e.classList.contains('mat'))).map((e) => e.outerHTML.slice(0, 100)));
      expect(muertos, `/${p}`).toEqual([]);
    }
    await ctx.close();
  });
  test('sin JS: malla muestra materias (cajas) sin boton interactivo roto', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4399/Correlativas/malla/');
    await expect(page.locator('button.mat').first()).toBeVisible();
    const cajasBotonVivo = await page.evaluate(() => [...document.querySelectorAll('button.mat')].filter((b) => !b.disabled).length);
    expect(cajasBotonVivo, 'botones de materia clickeables que no hacen nada sin JS').toBe(0);
    await ctx.close();
  });
  test('back/forward conserva estado', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="2"]').click();
    await page.locator('[data-campo="estado"]').selectOption('aprobada');
    await page.goto(''); await page.goto('electivas/');
    await page.goBack(); await page.goBack();
    await expect(page.locator('button.mat[data-materia="2"]')).toHaveAttribute('data-estado', 'aprobada');
  });
});

test.describe('teclado', () => {
  for (const p of PAGINAS) {
    test(`todo lo interactivo se alcanza con Tab y tiene foco visible: /${p}`, async ({ page }) => {
      await page.goto(p);
      const n = await page.evaluate(() => [...document.querySelectorAll('a[href],button,select,input,[tabindex="0"]')].filter((e) => e.offsetParent !== null && !e.disabled).length);
      const sinFoco = [];
      for (let i = 0; i < n + 3; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { t: e.outerHTML.slice(0, 70), ol: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, bs: s.boxShadow !== 'none' }; });
        if (info && !info.ol && !info.bs) sinFoco.push(info.t);
      }
      expect(sinFoco).toEqual([]);
    });
  }
  test('toggle de tema tiene aria-pressed', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-accion="tema"]')).toHaveAttribute('aria-pressed', /true|false/);
  });
});

test.describe('estudiante apurada', () => {
  test('rotar a horizontal sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    for (const p of PAGINAS) { await page.goto(p); const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); expect(w[0], p).toBeLessThanOrEqual(w[1]); }
  });
  test('doble click rapido en cambiar estado / agregar no duplica', async ({ page }) => {
    await page.goto('planificador/');
    const c = page.locator('[data-cuatri="2027-1C"]');
    await c.locator('select').selectOption("27");
    await c.locator('[data-accion="agregar-materia"]').dblclick();
    await expect(c.locator('li[data-materia="27"]')).toHaveCount(1);
  });
  test('misma materia en dos cuatrimestres no se puede', async ({ page }) => {
    await page.goto('planificador/');
    await expect(page.locator('[data-cuatri="2027-1C"] select option[value="9"]')).toHaveCount(0); // 9 ya esta en 2026-2C
  });
  test('cambiar tema con panel abierto en malla', async ({ page }) => {
    await page.goto('malla/');
    await page.locator('button.mat[data-materia="9"]').click();
    await page.locator('[data-accion="tema"]').click();
    await expect(page.locator('#panel-materia')).toBeVisible();
  });
  test('XSS: estado importado con nombres raros no inyecta', async ({ page }, ti) => {
    await page.goto('');
    const f = ti.outputPath('xss.json');
    fs.writeFileSync(f, JSON.stringify({ app: 'correlativas', version: 1, estado: { 1: { estado: 'aprobada', nota: '<img src=x onerror=alert(1)>' } }, fechas: { 'feb-mar-2027': '<script>' }, plan: { '2027-1C': ['<b>'] } }));
    page.on('dialog', (d) => d.accept());
    await page.locator('[data-importar-archivo]').setInputFiles(f);
    await expect(page.locator('[data-estado-import]')).toContainText('Listo');
  });
});
