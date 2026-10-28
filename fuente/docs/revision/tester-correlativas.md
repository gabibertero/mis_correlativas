# Tester · Correlativas · 2026-10-27

## Conteos
| Suite | Pasan | Fallan |
|---|---|---|
| `node --test` | 33 | 0 |
| `npm run build` | 5 páginas, limpio | - |
| Playwright desktop (1280x800) | 45 | 5 |
| Playwright celular (390x844) | 46 | 4 |
| Total Playwright | 91 de 100 | 9 (= 5 bugs reales, abajo) |
| Online | no se corrió (no hubo URL) |

Tests nuevos: `tests/app.spec.mjs` (50 por proyecto) + `tests/playwright.config.mjs`.
Correr: `npm i --no-save @playwright/test` (no está en package.json) y `npx playwright test -c tests/playwright.config.mjs` (levanta `astro preview` en :4399, necesita el build hecho).
Correcciones a tests míos (no del sitio): total de materias es 37 (no 38); `abc` no se puede tipear en input number; materias elegidas en el test ya estaban usadas/aprobadas.

Sin fallos: consola/pageerror limpios en las 5 páginas, sin scroll horizontal (390px y 844x390, claro y oscuro), links internos/assets con 200 bajo `/Correlativas/`, h1 único/landmarks/alt/labels, malla (resalte, panel, estado, nota, persistencia, reflejo en dashboard), KPIs, exportar/importar (6 archivos inválidos rechazados en rojo sin tocar estado, confirm cancelado, ida y vuelta), simulador (no escribe localStorage, reset), planificador (avisos, sobrecarga, fecha de mesa por impacto, persistencia, doble click), electivas (habilitada/bloqueada, créditos, persistencia), localStorage bloqueado y setItem con cuota excedida, estado corrupto, back/forward, tema persistente, XSS por importación.

## Fallos (por severidad). No hay bloqueantes ni altos.

### MEDIO 1 · Simulador: al volver atrás los radios quedan marcados pero el resumen dice "Todavía no marcaste nada"
Pasos: `/simulador/` -> marcar "Aprobada" en AGA (2) -> ir a `/malla/` -> botón Atrás.
Esperado: resumen y listas coherentes con lo marcado (o radios reseteados).
Obtenido: radio "Aprobada" checked, resumen "Todavía no marcaste nada", botón "volver a mi estado real" oculto. El `pintar()` corre antes de que el navegador restaure el formulario; el comentario en el código dice que lo resuelve y no lo hace. Test: `simulador › volver atras...`.
Archivo: `src/scripts/simulador.js` (final; falta repintar en `pageshow`/tras restauración, o `autocomplete="off"` en el form).

### MEDIO 2 · Sin JS: el simulador muestra 69 radios que no hacen nada
Pasos: javaScriptEnabled:false -> `/simulador/` (captura: /private/tmp/claude-501/sim-nojs.png).
Esperado: controles solo-JS ocultos. Obtenido: segmentos "Como está/Regular/Aprobada" visibles y marcables, sin ningún efecto. Test: `robustez › sin JS: contenido visible y controles solo-JS ocultos` (falla solo por /simulador/; el resto de páginas OK).
Archivo: `src/pages/simulador.astro` (ocultar con `.js` en CSS o `hidden` y mostrar desde el script; igual que exportar/importar).

### BAJO 3 · Sin JS: los 37 botones de materia de la malla se ven clickeables y no hacen nada
Pasos: sin JS -> `/malla/`. Esperado: sin panel no deberían parecer botones (hover/elevación). Obtenido: 37 `button.mat` habilitados que no responden. La info (estado, nota) sí se lee, por eso es bajo. Test: `sin JS: malla ...`. Archivo: `src/components/MateriaCaja.astro` (`disabled` por defecto y habilitar desde `malla.js`, o estilos de hover solo con `.js`).

### BAJO 4 · Botón de tema sin `aria-pressed`
Pasos: `/` -> inspeccionar `[data-accion="tema"]`. Esperado: `aria-pressed` true/false (regla de toggles). Obtenido: solo `aria-label` fijo "Cambiar tema claro u oscuro" y `data-modo`. Archivo: `src/layouts/Layout.astro` (en `pintar()` setear `aria-pressed`). Test: `teclado › toggle de tema tiene aria-pressed`.

### BAJO 5 · Planificador: el icono de calendario del `input[type=date]` no muestra foco con Tab
Pasos: desktop, `/planificador/`, Tab hasta las fechas de feb/mar y julio; 4º stop de cada fecha (el botón de calendario) tiene `outline: none`, `:focus-visible` false. Los campos día/mes/año sí tienen anillo. Archivo: `src/styles/global.css` (pseudo `::-webkit-calendar-picker-indicator:focus-visible`). Test: `teclado › ...: /planificador/` (solo desktop).

### Observaciones (no fallan tests)
- Panel de malla: con estado "aprobada" la misma frase "Ya la aprobaste." sale dos veces (veredicto y "Para rendir el final", esta última dentro de una caja punteada con viñeta). Cosmético.
- El planificador sigue listando en un cuatrimestre una materia que después se marca aprobada en la malla (el plan guardado no se reconcilia). Revisar si es intencional.
- `ESTADO-SITIO.md` dice "aprobadas/37": el total es 37 (36 + Seminario 99); el avance de la semilla da 38% (14/37). Coherente.
- Higiene: no es repo git todavía (no hay `.gitignore`); antes de commitear ignorar `fuente/node_modules`, `fuente/.astro`, `fuente/test-results`. No hay copias de iCloud. `docs/` tiene `.nojekyll`.
