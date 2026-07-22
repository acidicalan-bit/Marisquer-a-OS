# Plan técnico

## Fase 1 — Fundamentos

Riesgos: cruce entre sucursales, secretos en cliente, PIN inseguros y datos huérfanos. Criterios: migración reproducible; RLS comprobable; sesión SSR; menú y mesas leídos desde PostgreSQL; lint, tipos, unitarias y build en verde.

Entregables: proyecto Next.js, Supabase SSR, RBAC, organizaciones/sucursales, estaciones, mesas, menú, inventario inicial, seed y panel responsive.

## Fase 2 — Operación

Pedidos idempotentes, separación transaccional por estación, KDS, expedición, alertas persistentes de alergia y Realtime. Criterio principal: un pedido aparece en cada estación correcta en menos de dos segundos y no se duplica.

## Fase 3 — Caja

Cuentas divididas, pagos parciales/mixtos, propinas, descuentos y cortes. Todas las operaciones financieras se validan en funciones PostgreSQL y se bloquean sin conexión.

## Fase 4 — Administración

CRUD con permisos para usuarios, restaurante, inventario, reportes y auditoría. Exportaciones CSV/PDF asincrónicas.

## Fase 5 — Confiabilidad

Cola IndexedDB, outbox, idempotencia, conflictos explícitos, rate limiting, telemetría, respaldos y suite crítica E2E/RLS.

## Fase 6 — Entrega

PWA completa, accesibilidad, manuales por rol, pruebas de carga, despliegue y piloto controlado.
