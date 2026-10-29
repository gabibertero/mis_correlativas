// Lógica pura de sync: ¿dos snapshots validados (salida de validarImport().datos) son el mismo progreso?
// Se compara solo lo sanitizado (`exportado` no entra) e ignorando el orden de claves (jsonb lo reordena).
const canon = (x) => JSON.stringify(x, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
export const mismosDatos = (a, b) => canon(a) === canon(b);
