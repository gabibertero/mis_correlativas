# Contribuir

- **Error en una correlativa o materia:** abrí un issue con la materia, la página y qué dice el plan oficial. Los datos viven en `fuente/src/data/plan.js`.
- **Tests:** desde `fuente/`, `npm test` (unitarios) y `npx playwright test --config tests/playwright.config.mjs` (E2E).
- Corré `npm run build` antes de abrir un PR; `docs/` es el build publicado.
