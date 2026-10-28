# Correlativas — sitio de estudio (estado)

Carpeta: `Correlativas/github/` · Fuente Astro en `fuente/` · build a `../docs` (GitHub Pages, base `/Correlativas/`).
**Publicación en GitHub: opcional/a decidir** — dejarlo listo, no publicar sin pedido de Gabi.

App web interactiva de las **correlativas de Ingeniería en Sistemas de Información (Plan 2023, UTN FRC)**: reemplaza y mejora muchísimo la planilla "Mis Correlativas". Referencia de calidad aprobada: el sitio de AGA (`1º Año/AGA/github/fuente/`). Reusar su enfoque técnico (Astro estático, Layout + `global.css` con tokens en `:root`, localStorage con try/catch), **con identidad propia** y **tema claro/oscuro** (AGA sacó el oscuro; acá SÍ va).

## Preferencias de Gabi (entrevista 2026-10-27)
- **Formato**: web app estática estilo AGA. Español rioplatense.
- **Celular primero**: 390px sin scroll horizontal; que se vea muy lindo, no solo funcional.
- **Estética**: **identidad propia** (paleta + favicon nuevos para "Correlativas"), tema **claro/oscuro**, nivel de pulido AGA.
- **Estado de Gabi** (aprobadas/cursando/notas): vive en **localStorage** con **exportar/importar** a archivo `.json` (respaldo y pasar entre dispositivos). Sin login, offline. Semilla inicial en `plan.js` (`ESTADO_INICIAL`); después manda localStorage.
- **Home = Dashboard de avance**: primero los números (avance %, promedio, por nivel, créditos, "qué puedo hacer ahora", cuenta regresiva a la próxima mesa), y de ahí se entra a la malla.
- **Datos verificados**: `fuente/src/data/plan.js` ya está cotejado contra el PDF oficial (`Correlativas/sistemas.pdf`) al 100%. No cambiar correlativas sin avisar.

## Secciones
1. **Inicio / Dashboard** (`index.astro`): KPIs (aprobadas/36, avance %, promedio sobre notas cargadas, finales por rendir), avance por nivel, créditos electivos (20 Ing / 4 Analista nivel 3), panel "Qué puedo hacer ahora" (materias habilitadas para cursar, finales que puede rendir, qué se destraba), **cuenta regresiva** a la próxima mesa (de `EXAMENES`). Botones exportar/importar estado.
2. **Malla visual** (`malla`): diagrama por nivel (5 niveles), cajas por materia pintadas por estado; al tocar una materia resalta de qué depende (reg/aprob) y qué destraba (directa+indirecta), y abre un panel para ver "qué me falta para cursar/rendir el final" y **cambiar estado y nota**. Flechas o resaltado de correlatividad. Debe leerse en 390px (puede ser scroll por nivel / columnas apiladas en celular).
3. **Simulador "y si…"** : modo hipotético — marcar materias como aprobadas/regulares de prueba y ver qué se desbloquea, SIN tocar el estado real; botón "volver a mi estado real".
4. **Planificador** (cursado + finales en UNO, por cuatrimestre, **manual con validación**): Gabi arma cada cuatrimestre poniendo materias; la web valida correlativas (avisa si no cumple) y suma horas (avisa sobrecarga). Los **finales** se agrupan por turno (diciembre, febrero/marzo, julio), **priorizados por impacto** (cuánto destraba aprobar ese final), con **cuenta regresiva** a las fechas de `EXAMENES`. Fechas de feb/mar y julio 2027 todavía no están → placeholders editables desde la web.
5. **Electivas** (`electivas`): las 19 de `ELECTIVAS` con créditos, estado habilitada/bloqueada y qué falta; contador de créditos 20 (Ing) / 4 (Analista, nivel 3).

## Reglas de correlatividad (implementar en lógica, NO hardcodear)
- **Para CURSAR** una materia: todas sus `reg` en estado ≥ regular (regular/aprobada), y todas sus `aprob` en aprobada.
- **Para RENDIR EL FINAL**: la materia en regular + **todas** sus correlativas (`reg` ∪ `aprob`) aprobadas.
- **Seminario (99)**: el final exige materias **1 a 23** aprobadas. **Proyecto Final (36)**: el final exige **todo** el plan aprobado + PPS.
- **"Destraba"** de una materia = materias del plan (no electivas) que dependen de ella directa o indirectamente. Calcular por cierre transitivo sobre `reg`+`aprob`.
- **"Se desbloquea / naranja"**: materia que hoy no puede cursar/rendir pero sí podría si aprueba lo que está cursando.

## Datos
- `fuente/src/data/plan.js`: `MATERIAS` (36 + Seminario 99 opcional), `ELECTIVAS` (19), `ESTADOS`, `ESTADO_INICIAL` (semilla de Gabi, conservador), `EXAMENES` (mesas dic-2026), `DIRECTAS_A_CONFIRMAR`, constantes de créditos. Correlativas: `reg` (regular) y `aprob` (final aprobado) por Nº.
- Estado real de Gabi hoy (dashboard muestra lo confirmado): 14 aprobadas, 2 regulares (SO, ASI), cursando AM II / Física II / COM / Legislación, recursando AGA, Economía pendiente (equivalencia). Las directas (AGA, Física II, COM, Legislación) y los finales de diciembre son lo que el simulador/planificador proyecta.

## Técnico (reusar de AGA, adaptar)
- Astro estático, `output: 'static'`, `outDir: '../docs'` (NUNCA la raíz), `build.assets: 'assets-astro'`, `public/.nojekyll`, `base: '/Correlativas/'`. Links internos con `import.meta.env.BASE_URL`.
- **Sin** KaTeX/MDX/remark (no hay matemática). Fuentes: elegir para identidad propia (puede seguir Instrument Sans para UI).
- localStorage: prefijo **`corr:v1:`**, SIEMPRE try/catch, nunca romper si está vacío/bloqueado; la app renderiza bien sin estado guardado (cae a `ESTADO_INICIAL`).
- Tema claro/oscuro: tokens en `:root` + `@media (prefers-color-scheme: dark)` y toggle manual persistido en localStorage.
- Verificación: `npm run build` limpio; tests de la lógica de correlativas con `node --test`; auditoría visual con `estetica` (capturas 390px + desktop, claro + oscuro) y `tester`.
- Repo potencialmente público: nada de datos personales sensibles (las notas de Gabi viven solo en su localStorage, no en el repo salvo la semilla que ella aceptó).

## Plan de construcción (orquestador delega)
1. **[orquestador, HECHO]** Verificación de datos vs PDF oficial (100% OK) + `plan.js` + esta spec.
2. **[disenador]** Scaffold Astro (identidad propia, Layout, `global.css` con tokens + claro/oscuro + toggle, favicon) y base visual de las 5 secciones renderizando desde `plan.js` (estático, sin interactividad todavía). Dashboard como Home. Audita `estetica`.
3. **[web]** Lógica: motor de correlativas (puedeCursar / puedeRendirFinal / destraba / habilitadas / se-desbloquea) con `node --test`; malla interactiva (panel, cambiar estado/nota); simulador "y si"; planificador manual con validación + finales por turno/impacto/cuenta regresiva; electivas; localStorage `corr:v1:` + exportar/importar. Audita `ecc:code-reviewer` + `tester`.
4. **[estetica + tester]** Auditoría final (390px + desktop, claro + oscuro; flujos reales; sin JS; localStorage roto). `disenador`/`web` corrigen lo crítico.
5. **[readme]** Solo si Gabi decide publicar.

## Paso 2 HECHO (disenador, 2026-10-27): base visual estática
- Proyecto en `fuente/` (Astro 7 estático, deps: astro + fuentes Instrument Sans y Bricolage Grotesque). `npm run build` limpio → `../docs`.
- Identidad: índigo `--acento` (#4338ca / #9a9bff oscuro) + ámbar `--acento2` (cuenta regresiva, destacados). Estados con color + ícono/texto: `--e-aprobada|regular|cursando|recursando|pendiente` (+ `-bg`). Tokens con `light-dark()` en `src/styles/global.css`; oscuro por sistema o `data-theme` en `<html>`, toggle persistido en `corr:v1:tema`.
- Favicon SVG (`public/favicon.svg`) + `apple-touch-icon.png` 180. Nav inferior en celular/tablet (<=900px), arriba en desktop.
- Páginas: `index` (dashboard), `malla`, `simulador`, `planificador`, `electivas`. Componente `MateriaCaja.astro`. `src/lib/vista.js` = helpers SOLO para el render estático (reemplazar por el motor testeado de `web`).
- Hooks para `web`: ver respuesta del disenador (data-materia / data-estado / data-reg / data-aprob / data-rel / data-habilitada, `#panel-materia` con data-campo y data-lista, data-sim-*, data-cuatri / data-slot-lista / data-avisos / data-agregar, data-examen / data-fecha-editable, data-electiva, data-creditos, data-accion="exportar|importar|tema|reset-simulacion|agregar-materia|cerrar-panel").
- Placeholders: botones exportar/importar y controles que requieren JS están `hidden`; límite de horas del planificador (30) provisorio; `Math` de cuenta regresiva mínimo inline en index.

## Pendientes para Gabi
- Fechas de las mesas de febrero/marzo y julio 2027 (hoy placeholders en el planificador).
- Decidir si se publica en GitHub Pages.

## Paso 3 HECHO (web, 2026-10-27): interactividad
- **Motor puro** `fuente/src/lib/motor.js` (firma `fn(est, n)`, `est = {n:{estado,nota?}}`): `puedeCursar`, `estaHabilitada`, `puedeRendirFinal`, `queFaltaParaCursar`, `queFaltaParaFinal` (`{regular, aprobar[], extra[]}`), `destraba(n)` (Set, cierre transitivo), `seDesbloquea` (`{cursar, final}`), `analizarMateria/analizar`, `veredicto`, `habilitadas`, `rendibles`, `finalesPorImpacto`, `masDestraban`, `resumen`, `creditos`, `proximaMesa`, `diasHasta`, planificador (`proyectarPrevias`, `avisosMateria`, `horasDe`), `aplicar` (copia con cambios, para el simulador).
- **Persistencia** `src/lib/progreso.js` (prefijo `corr:v1:`, try/catch, memoria si localStorage está bloqueado): claves `estado`, `plan`, `fechas`, `electivas`; exportar/importar `.json` con validación y sanitizado. `vista.js` ahora solo adapta el motor + etiquetas.
- **UI** en `src/scripts/` (`inicio, malla, simulador, planificador, electivas, comun`); cada página importa el suyo. Los `<style>` de las páginas pasaron a `is:global` (los nodos que crea el JS no llevan el atributo de scope de Astro).
- Tests: `fuente/tests/motor.test.mjs` y `progreso.test.mjs` (`npm test`, 33 tests).
- Decisiones: la PPS de Proyecto Final no se registra (solo se avisa); el planificador asume que lo de cuatrimestres previos queda REGULAR (el final es otro paso); límite 30 hs provisorio; fechas feb/mar y jul = una fecha por turno (lista los finales que hoy puede rendir, por impacto); simulador no persiste nada.

## Re-skin VERDE ESMERALDA HECHO (disenador, 2026-10-27)
- Reemplaza índigo/ámbar. Tokens en `fuente/src/styles/global.css` (light-dark): `--marca #33d17a` (+ `--marca-2 #2dbc6d`, `--marca-3 #31945d`) solo para fills/anillo/barras/favicon; `--acento` #0e6f3f claro / #3ddc84 oscuro (texto, links, CTA); `--acento2` (cuenta regresiva, relaciones, créditos) = verde más profundo #075c30 / #5ff0a0 con fondo `--acento2-suave` más saturado: jerarquía por peso, no por color. Fondos neutros con tinte verde (#f0f6f2 / #0a120e).
- Único rojo: `--error` / `--error-bg` (#b42318 / #ff9d94) para avisos del planificador, veredicto "falta" de la malla y "No se importó…" (`data-error` en `.aviso`; 1 línea en `scripts/inicio.js` `decir`).
- Estados: aprobada verde, regular lima/oliva, cursando azul, recursando violeta, pendiente gris (todos ≥5.3:1 en claro y oscuro, más ícono/forma).
- Malla: 5 columnas desde 1100px (antes 980; partía palabras), 3 columnas 800–1099, 2 columnas 540–799.
- Favicon verde (nodos blancos sobre #33d17a), apple-touch regenerado, theme-color actualizado.

## Correcciones de la auditoría estética (disenador, 2026-10-27, 78 -> ~91 estimado)
- Malla: panel lateral solo >=1024 y la grilla le cede lugar (`main:has(.panel:not([hidden]))`, 3 columnas entre 1100-1499); bottom-sheet <1024 sobre la nav, 60dvh, cabecera sticky con ✕ 44px y handle; `abrir()` en `malla.js` hace `scrollIntoView` (única línea de lógica tocada). Atenuadas: opacity .65 + saturate.
- Listas del panel y del simulador sin bullets (un solo marcador); simulador con filas flex. Planificador: fila en grid, chip bajo el nombre, "Quitar" como ✕ 44x44 (CSS, aria-label intacto).
- Token `--relleno` (esmeralda oscuro en claro) para barras/anillo/progress; `.n` y `progress` movidos a `global.css`; "regular o cursando" en barras = rayado.
- Footer alineado y reducido (+ "Hecho con Claude"), chips/cards en escala, nav 12px, separadores `.sep`, anillo Home arriba 120px, hover primario, favicon trazo grueso (+ apple-touch regenerado).
- Mejora progresiva: `html:not(.js) [data-solo-js]` oculto, `.sin-js` aviso (simulador y malla; cajas de la malla no clickeables sin JS). Toggle de tema con `aria-pressed` sincronizado. Foco visible en input/select.
- Fixes del tester (2026-10-27): el simulador recalcula el resumen desde los radios en `pageshow` (back/bfcache), sigue sin escribir en localStorage; las cajas de la malla (`MateriaCaja.astro`) vienen `disabled` en el HTML (fuera del Tab sin JS) y `malla.js` las habilita.

## Cambios de lógica (web, 2026-10-27): Seminario opcional, proyecciones, urgencia, planificador
- **Seminario (99) opcional** (`opcional:true`, `creditosElectivos:6` en `plan.js`; `MATERIAS_PLAN` = las 36): sigue en la malla (etiqueta "Opcional · título Analista", `data-opcional`) pero fuera de totales, niveles (nivel 3 = /6), `habilitadas/rendibles/masDestraban` y del requisito de Proyecto Final. Aprobado suma 6 créditos SOLO a Ingeniería: `creditos(elect, electivas, est)`.
- **Proyecciones** en `resumen(est)`: `proyCursando {n,pct}` (aprobadas+cursando) y `proyFinales {n,pct}` (+ finales que hoy puede rendir), `finales`, `urgencia`. Gabi hoy: 14/36 = 39% · 19/36 = 53% · 21/36 = 58%.
- **Hooks dashboard**: `[data-kpi=proy-cursando]`, `[data-kpi=proy-finales]` (cada uno con `[data-valor]`, `data-n`; `[data-valor]` lleva `data-objetivo` con el número crudo para animar); `[data-kpi=finales][data-nivel-urgencia=ok|medio|alto]` (0 / 1-2 / 3+). La grilla de KPIs pasó provisoriamente a 3 columnas (6 tarjetas): el diseño fino es del disenador.
- **Planificador**: `proponerPlan(est, ids, {hsLimite, fijo})`, `avisosCuatri`, `estadoEnCuatri`, `horasCuatri`, `continuan` en `motor.js`. Reglas: cuatris previos del plan quedan APROBADOS (cambió: antes regular) y lo que hoy cursás/tenés regular se da por rendido; anuales pendientes van en 1C y ocupan también el 2C siguiente (fila `li[data-continua]`); 1C/2C según modalidad; prioriza lo que más destraba; no incluye electivas ni PPS. `CUATRIS` ahora llega a 2030-2C (los 3 primeros siempre visibles, el resto `hidden` hasta usarse / "Sumar un cuatrimestre").
- **Hooks planificador**: `[data-herramientas]`, `[data-accion=proponer-plan|sumar-cuatri]`, `[data-estado-plan]` (role=status), `[data-accion=mover-anterior|mover-siguiente]` por fila (con `data-materia`), `li[draggable]` con `data-arrastrando`, `[data-cuatri][data-drop-activo]`, `data-extra` en cuatris, `li[data-continua]`.
- **Electivas**: `[data-seminario-creditos]` (se muestra si el Seminario está aprobado).
- Tests: `node --test` 42 verdes; Playwright 121 verdes (`tests/planificador.spec.mjs` nuevo).

## Rediseño v2 HECHO (disenador, 2026-10-27): feedback de Gabi
- Paleta: verde sigue dominando; secundario = AZUL profundo (`--acento2` #1d4ed8 claro / #60a5fa oscuro, `--acento2-suave` #dde6fd / #172554, `--azul-solido`, `--sobre-azul`). Cursando pasó a cian (`--e-cursando`) para no chocar con el azul. Semáforo de finales con tokens `--sem-ok|medio|alto` (verde fuerte / amarillo / naranja; único uso de cálidos junto a `--error`).
- Home: hero nuevo (mini-malla real con 36 nodos/correlativas coloreados por estado + anillo en degradé verde-azul), panel "Hacia dónde vas" (hoy 39% -> 53% -> 58%, barra apilada), KPIs, barras por nivel con % y shimmer, listas como filas con jerarquía. Count-up y barras en `src/scripts/ui.js` (solo presentación; lee `data-objetivo`; respeta reduced-motion; reduced-motion global en `global.css`).
- Habilitada para cursar: insignia verde sólida con rayo ("Podés cursar") + borde pleno + brillo que late (malla y dashboard). Opcional (99): borde punteado, número redondo, etiqueta azul.
- Electivas: tabla compacta (nombre, nivel, créditos, estado) con buscador y filtros (`src/scripts/electivas-filtro.js`), contadores grandes de créditos.
- Planificador: barra de herramientas, ayuda plegable, drop activo azul con "Soltar acá", cuatris extra con etiqueta, botones de mover en fila propia.

## Electivas en el planificador (web, 2026-10-28)
- **Modelo**: en `plan` (`corr:v1:plan`) una materia sigue siendo su Nº (number); una electiva es el string `'e:<slug del nombre>'` (`M.idElectiva(e)`, mismo slug que usa `corr:v1:electivas` sin el prefijo `e:`). `limpiarPlan` acepta ambos y descarta ids inventados; planes viejos siguen válidos.
- **Motor** (`motor.js`): `idElectiva`, `esElectiva`, `electivaPorId`, `hsDe(n)` (hs de la materia; para la electiva, sus `creditos` como proxy de horas semanales). `horasDe`, `avisosMateria` (reg/aprob contra el estado proyectado), `avisosCuatri` (modalidad 1C/2C/1C-2C) y `nombreCorto` aceptan ambos tipos. No cambia estado real ni créditos ganados.
- **UI** (`scripts/planificador.js`): el select "Agregar" tiene dos `optgroup` (Materias del plan / Electivas; se omiten las ya usadas y las electivas aprobadas). Fila de electiva: `li[data-electiva="si"]`, número "E", `small` "Electiva · N cr · cuenta N hs", chip con el estado real de la electiva. Drag/◂▸/Quitar funcionan igual (el drag usa `lastIndexOf(':')`). `proponerPlan` sigue sin meter electivas.
- Tests: `node --test` 46 verdes; Playwright 125 verdes + 2 fallos previos ajenos (`app.spec` KPIs: espera "34" días a la mesa y hoy da 33, depende de la fecha).

## Nuevo modelo de estados (web, 2026-10-28)
- **8 estados** (`ESTADOS` en `plan.js`, `ETIQUETA` en `vista.js`): `pendiente` Pendiente · `cursando` **Cursando** · `recursando` **Recursando · regular** · `regular` Regular · `promocion` Promoción (debe un final reducido; NO terminada) · `aprobada` Aprobada (final rendido) · `libre` Libre · `abandono` Abandono. `recursando` (vuelve): está regular (podés rendir el final) pero la volvés a cursar; el motor lo trata igual que `regular` (satisface "necesita regular", final rendible, NO satisface "necesita aprobada", NO suma al avance ni a "si apruebo lo que curso", sí a "+ finales"; sin nota). Sin migración: `recursando` es válido; un estado desconocido se descarta (`limpiarEstado` → pendiente). No confundir con la marca "Recursar" del planificador (`corr:v1:recursar`).
- **Semántica** (motor): "necesita regular" = regular/promoción/aprobada; "necesita aprobada" (cursar y rendir finales) = solo aprobada; final rendible = regular o promoción con reg ∪ aprob aprobadas; avance (x/36), promedio y créditos del Seminario = solo aprobada; `proyCursando` = aprobada+cursando; `proyFinales` = + rendibles. Libre/abandono no satisfacen nada, no suman, y se pueden retomar (`sinCursar`: entran en "habilitada", en el planificador y en `proponerPlan` como pendiente). Nota: solo aprobada y promoción (`admiteNota`); la nota de una promoción no entra al promedio hasta aprobar el final. `asumirRendidos` (planificador) da por rendido regular/promoción/cursando.
- **Semilla**: AGA (2) vuelve a `recursando`. Gabi: 14 aprobadas · 18 ("si apruebo lo que curso", AGA ya no suma) · 21 (+ finales AGA, SO, ASI; 3 finales = urgencia alta).
- **Recursar (planificador)**: flag por ítem del plan (materia Nº o `e:<slug>`), guardado aparte en `corr:v1:recursar` (array; `cargarRecursar/guardarRecursar/limpiarRecursar`), incluido en exportar/importar (respaldos viejos sin la clave funcionan). Se limpia al sacar el ítem del plan y viaja al moverlo. No cambia correlativas ni avisos. Hooks: `li[data-recursar=si|no]`, botón `.toggle-recursar[data-accion=recursar][aria-pressed]`, marca `small.marca-recursar[data-marca=recursar]` "Recursar".
- **Hooks para el disenador**: `[data-estado=promocion|libre|abandono]` en `.chip`, `button.mat`, `.nodos circle` (falta pintar: tokens `--e-promocion|libre|abandono` no existen todavía y `--e-recursando` quedó huérfano en `global.css`; hoy esos estados caen al color por defecto/pendiente). Falta pintar `[data-estado=recursando]` (`.chip`, `button.mat`, `.nodos circle`): hoy cae al color de regular (fallback `var(--e-recursando, var(--e-regular))`); el disenador debe recrear `--e-recursando` y `-bg`. Etiquetas largas ("Recursando · regular"): revisar el chip a 390px.
- Tests: 60 `node --test` + Playwright (`tests/estados.spec.mjs` nuevo). Test de la cuenta regresiva ya no hardcodea los días.

## Pasada visual 2026-10-28 (disenador): aire, 7 estados, planificador
- Malla con aire: gap entre niveles 48px, entre cajas 16px, padding de caja 16px; en desktop `main` de la malla a 84rem (5 columnas cómodas); con panel abierto 3 cols (<1500) o 2 cols (1024-1279).
- Tokens de estado (texto / fondo, claro | oscuro): aprobada #0b6a38/#cdf1db | #5ff0a0/#14472c; promocion #0a5c58/#c8ece8 | #5eead4/#0f3d3a; regular lima; cursando cian; pendiente gris; libre #7a4300/#fbe9c2 | #fcd34d/#45330d; abandono #56625b/#e4e9e6 | #9aa89f/#1f2a25. `--e-recursando` hay que recrearlo. Ícono por estado: ✓, ◐, ●, ■, ○, ◇, tachado. Convención: `--e-X` (texto) y `--e-X-bg`.
- Chip largo ("Recursando · regular") envuelve (max-width 100%, radio 14px).
- Planificador: sin botones ◂ ▸ (la lógica mover-anterior/siguiente quedó en el JS), ✕ centrada con máscara SVG arriba a la derecha, chip "Electiva · N cr" azul, toggle y marca "Recursar" con ícono. Sin flechas, en celular mover = quitar y re-agregar (el arrastre es con mouse). Tests que usaban flechas pasaron a dragTo (skip en celular).

## Color de `recursando` (disenador, 2026-10-28)
- Tokens (texto / fondo, claro | oscuro): `--e-recursando` #3f6212/#dcefc0 (5.8:1) | #b4e46a/#2b4a14 (6.8:1). Lima-verde más hoja que regular (#4d6209), lejos del cian de cursando.
- Ícono propio ↻ (máscara `--i-recursar`) + contorno de 1px en el chip; nodos del hero con relleno `--e-recursando` y borde punteado. Aplicado en `.chip`, `button.mat` (sin fallback) y `.nodos circle`.
- "Recursando · regular" entra en una línea a 390px (leyenda, caja y panel); la leyenda muestra los 8 estados prolijos. Sin overflow horizontal. Capturas: `/private/tmp/claude-501/disenador/rec-*`.

## Planificador: modalidad, orden y recursar (motor.js / planificador.js)
- `modalidadInfo(item)` -> `{ anual, principal, contra, soloCuatri, label }`; label: Anual · "1º cuatri" (1C-2C) · "2º cuatri" (2C-1C) · "Solo 1º/2º cuatri" (1C/2C). `esContracuatri(n, idCuatri)` y `notasCuatri(plan, ids, i)` (aviso informativo, no error).
- Validación: 1C-2C/2C-1C valen en ambos cuatris (el no principal es contracuatri: nota suave `.contra-cuatri[data-contracuatri]`); solo 1C/2C dan error en el cuatri equivocado; A solo arranca en 1C.
- Orden por cuatri (`ordenarPlan`): anuales, cuatrimestrales, electivas; por Nº (electivas por id). Se aplica al render y a `proponerPlan`.
- Recursar (`corr:v1:recursar`): `avisosCuatri(..., recursar)` omite solo "ya la aprobaste/tenés regular"; siguen correlativas, modalidad y horas. Texto según estado real.
- Hooks de estilo: `.modalidad[data-modalidad]`, `.contra-cuatri[data-contracuatri="si"]` dentro de `.s-nom` (sin estilo propio aún).

## Correcciones de la auditoría estética final (disenador, 2026-10-28)
- Malla: 5 columnas solo desde 1360px (3 cajas por nivel apilado en 800-1359); con panel abierto 3 columnas hasta 1799px. Encabezado (`.cab`) alineado con el logo (66rem), solo la grilla usa 84rem. Atenuadas: opacity .85, saturate .5, sin sombra. Etiqueta "Opcional · Analista" nowrap y radio 12px.
- Planificador: fila de materia compacta (nombre + "5 hs · Anual" en línea, chip abajo, Recursar como ícono 44x44 con aria-label), materias en 2 columnas dentro del cuatri entre 600 y 1099px, 3 cuatris por fila desde 1100px. Nota "Contracuatrimestre: menos cátedras" sin partir la palabra. Avisos rojos a 500, aviso de estado con borde, "Cómo funciona" en la fila de botones.
- Home: mini-malla al 44% del ancho con máscara (no pisa el texto); animaciones de fondo acotadas (líneas 1 vez, nodos pulsan 2 veces, brillo 1 vez; `brillo-hab` de las tarjetas 3 ciclos). KPI con padding 24 en desktop, listas "Qué puedo hacer" con align-items:start, eyebrow con text-wrap:balance.
- Escala de espacios: reemplazados los 2px/34px sueltos.
- Pendientes (no hechas): simulador "Como está" neutro y ancho fijo del control (8); electivas filtros a 768 (7), filas compactas (17), estado vacío de créditos (18); leyenda colapsable de la malla (12); diferenciar mejor regular/recursando (13); aviso único por materia (14); chip "Recursando · regular" corto (el test exige el texto); etiquetas de la nav inferior quedan en 12px porque "Planificador" a 13px se parte en 390px.

## Home: capas por nivel, próximos finales, plan 2027 (web, 2026-10-28)
- **Motor** (`motor.js`, con tests): `resumenPorNivel(est)` -> `[{nv,total,aprobadas,masCursando,masFinales}]` (incrementos sobre la base, sin doble conteo; suma = `proyCursando`/`proyFinales` de `resumen`); `proximosFinales(examenes, est, hoy)` (fecha >= hoy, ascendente, sin materias aprobadas); `razonEntrada(n)` y `planProximoAnio(est)` -> `[{id:'2027-1C'|'2027-2C', hs, items:[{n, electiva, razon}]}]` (usa `proponerPlan` con ids 2026-2C/2027-1C/2027-2C, mismo orden).
- **Hooks a estilizar (disenador)**: 
  - Barras de nivel `[data-nivel-bar]` (attrs `data-aprobadas|mas-cursando|mas-finales`): dentro de `.barra` ahora `i.b-ok`, `i.b-cursando`, `i.b-finales` (tres tonos, de firme a tenue). `.b-curso` ya no existe en el HTML: reemplazar su CSS. Leyenda `.leyenda-barra` usa las mismas 3 clases.
  - "Próximos finales" (antes "Próxima mesa", `#cuenta-regresiva`): se mantiene `[data-countdown]` (el más próximo) y debajo `ol.proximos[data-proximos-finales] > li[data-materia][data-fecha][data-tipo][data-opcional] > time + strong + small` (sin estilo aún).
  - Plan 2027 en `#ahora`: `.card.plan-anio[data-plan-anio] > .plan-cuatris > section[data-cuatri-plan="2027-1C|2027-2C"] > h4 (+ small[data-hs]) + ul > li[data-materia][data-electiva=si|no] > span.n + span(nombre + small[data-razon])`. Electiva se muestra "Electiva" con "E". Sin estilo aún (reusar `.tres li`).
- Las listas "Podés cursar / rendir / destraba" siguen igual.

## Diseño: estados de malla, capas por nivel, animaciones (disenador, 2026-10-28)
- Malla (`MateriaCaja.astro` + tokens `--m-*` en global.css): aprobada = relleno verde pleno + tilde; regular/recursando/promoción = verde medio con borde; cursando = anillo cian + barra de rayas animada; habilitada = borde verde + aro que late (igual); pendiente bloqueada = punteada, opacity .72, saturate .3, candado; libre/abandono = gris neutro.
- Barras de nivel: `.b-ok` / `.b-cursando` / `.b-finales` en 3 verdes (la tenue con rayas); leyenda `.leyenda-barra`; `.b-curso` eliminado. Estilos de `ol.proximos` y `.plan-anio` en index.astro.
- Transición entre páginas: CSS nativo `@view-transition { navigation: auto }` (global.css), header/nav con view-transition-name fijo. Se eligió esto en vez de `<ClientRouter/>` porque los scripts son módulos con efectos al cargar y no se re-ejecutan tras navegar con el router; la versión nativa no toca JS. Solo Chrome/Edge/Safari 18.2+; en otros navegadores navega normal.
- Reveal al scroll: `src/scripts/reveal.js` (importado en Layout), IntersectionObserver una vez, solo lo que está bajo el pliegue; desactivado con reduced-motion.
