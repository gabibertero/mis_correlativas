# Estética — Correlativas — 2026-10-27 — 78/100 (objetivo ≥90)

0 críticos. Capturas/mediciones en `/private/tmp/claude-501/estetica/`.
Cubierto: 390/768/1024/1280, claro y oscuro, 5 páginas + malla con panel abierto + simulador hipotético + planificador con avisos.

## Prioridad alta (las que más suben el puntaje)
1. **Malla ≥768 · panel lateral tapa la grilla** (`malla.astro` `.panel`, `position:fixed` 26rem). En 1280 tapa columnas 4-5; al elegir la 16 esconde sus "destraba". Fix: con panel abierto `main { padding-right: 26rem }` (o grid 2 col) para ≥1024; en 768 bottom-sheet como en 390.
2. **Malla 390 · bottom-sheet** (`.panel`, `.panel-cab`). Ocupa 82dvh, tapa nav y la caja elegida; el ✕ scrollea fuera. Fix: `.panel-cab { position:sticky; top:0; background:var(--sup); z-index:1 }`, handle/backdrop, `max-height:70dvh`.
3. **Simulador · lista "Podrías cursar" rota** (`simulador.astro` `.res-listas`; helper `filaMateria` en `comun.js`). El `li` no es flex: badge arriba, nombre abajo + bullet del navegador. Fix: reusar el estilo de la fila de Home: `ul { list-style:none; padding:0 }`, `li { display:flex; gap:var(--s-3); align-items:center }`.
4. **Bullets sobre estado vacío** (panel malla `.panel-cuerpo ul`; simulador `.res-listas ul`). `•` junto al cuadro punteado; en "necesitás" hay `•`+`✓` (doble marcador); "destraba" no tiene bullets → inconsistente. Fix: `list-style:none; padding:0` en todas, un solo marcador.
5. **Cajas atenuadas ilegibles** (`malla.astro` `[data-rel='atenuada']` `opacity:.35`). Contraste 1.8–2.9:1 y siguen clickeables. Fix: `opacity:.6` + `filter:saturate(.4)`.
6. **Planificador · fila de materia en 3 renglones** (`planificador.astro` `.slots li` `flex-wrap:wrap`) en 390 y 1280 (en 768 entra en 1 línea). Fix: grid `auto 1fr auto`, chip bajo el nombre, "Quitar" como botón ícono 44×44 (✕).
10. **Barras/anillo en claro · contraste gráfico** (`index.astro` usan `--marca` #33d17a → 1.7:1 sobre track). Planificador/Electivas usan `--acento`. Fix: en claro usar `--acento` para "aprobadas" (5.7:1); mover `.avance` y `progress{}` (duplicado en 4 páginas) a `global.css`.

## Prioridad media/baja
7. Footer ≥901 desalineado 16px (`.pie-in` sin gutter) → `padding-inline:var(--s-4)`.
8. Home 390 "Ver electivas" 25px alto → `min-height:44px; display:inline-flex; align-items:center`.
9. Padding de tarjetas inconsistente (24 vs 16) → unificar `.cuatri`/`.el` a `var(--s-6)` en desktop.
11. Nav inferior etiquetas 11px → `.75rem`.
12. Chips padding fuera de escala `2px 10px` → `4px 12px`.
13. Separadores "·" muy pegados → `<span class="sep">·</span>` con `margin-inline:.35em`.
14. Home 390 anillo abajo-izquierda → centrar o subir sobre el título, bajar a 120px.
15. Electivas ≥1024 huecos en tarjetas → `align-self:start`.
16. Footer redundante con tarjeta "Tus datos" → dejar solo aviso no oficial, fuente, repo, licencia.
17. Favicon 16px: líneas 1.4:1 desaparecen → `stroke-width` 5→7, trazo `#1f6b42`.
18. Hover botón primario casi imperceptible → `color-mix(in srgb, var(--acento) 85%, #000)`.

## Lo que está bien (no romper)
Hero de Home (título/anillo/CTA claros), sistema de estados (color+ícono+texto consistente en las 5 páginas), validación en rojo del planificador (AA, borde lateral).
