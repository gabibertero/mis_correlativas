# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]
### Agregado
- Inicio: «Finales habilitados» lista cuáles son, por nivel; «Orden recomendado de finales» (1º, 2º, 3º…) según cuántas materias futuras traba cada final que debés.
- Planificador: electivas (violeta) y materias de licenciatura (rosa) con sus créditos, resumen de créditos planificados y leyenda de colores.
- Planificador: resaltado amarillo de las correlativas que debés (empezadas y no completadas) en las materias futuras; lo nunca cursado no se resalta.
- Planificador: intensivos de febrero por año (se suma solo el año elegido) con migración del interruptor anterior.
- Planificador: «Copiar plan AAAA para WhatsApp» (de noviembre en adelante copia el año siguiente) con vista previa.
- Simulador simplificado: acciones rápidas por fila, filtros «Lo que debo / Puedo cursar / Todas», escenarios rápidos, resultado con deltas y barra fija en celular.

### Agregado (anterior)
- Períodos opcionales de febrero, con básicas y oferta excepcional de Sistemas confirmada por año.
- Resultados de cursado y finales previstos explícitos en el planificador, sin aprobar materias automáticamente.
- Simulación de todos los estados de obligatorias y electivas, con comparación de créditos y habilitaciones ganadas o perdidas.
- Elección única de licenciatura: Seguridad Informática, Inteligencia Artificial o Ciencia de Datos (plan aún pendiente de publicación).
- Seguimiento de las materias nuevas anunciadas de Seguridad e IA, con 3 créditos por aprobación del trayecto elegido, sin duplicar materias compartidas.

### Corregido
- Navbar: sin desbordes de 320 a 1440 px (marca compacta en PC angosta, etiquetas en una línea en celular); «Trayectos» pasa a «Licenciaturas».
- Correlativas para rendir según la Ordenanza 1878: se respetan las columnas de cursadas y aprobadas, en lugar de exigir todos los finales.
- Dependencias directas e indirectas separadas del efecto real de regularizar o aprobar una materia.
- Electivas con regularidad, libre, abandono y los demás estados académicos; conservación en respaldos y sincronización.
- Cantidades del anillo y del paso «Hoy» sincronizadas con el progreso de la cuenta.
- HTML inicial sin estados ni notas personales históricos.
- Resumen actualizado al volver desde la malla o cambiar el progreso en otra pestaña.
- Filtro de electivas habilitadas consistente con su contador.
- Etiqueta «Finales habilitados» para distinguirlos de los finales pendientes bloqueados.
- Pruebas de regresión de conteos y configuración E2E con la ruta actual del sitio.

## [0.1.0] - 2026-10-28
### Agregado
- Dashboard, malla visual, simulador, planificador (con electivas) y tabla de electivas.
- Motor de correlatividades con tests; estado en `localStorage` con exportar/importar.
- Tema claro/oscuro, diseño mobile-first y animaciones sutiles.
