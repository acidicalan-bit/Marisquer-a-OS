# Arquitectura

## Principios

- PostgreSQL/Supabase es la única fuente de verdad.
- Next.js renderiza el contexto inicial en servidor; TanStack Query mantiene caché de interacción.
- Realtime invalida consultas por sucursal; no reemplaza confirmaciones de escritura.
- RLS limita organización y sucursal incluso si la interfaz o el proxy fallan.
- Las operaciones críticas evolucionan como funciones SQL transaccionales y patrón outbox.

## Flujo de acceso

1. Supabase Auth emite la sesión.
2. El servidor carga `user_profiles` y `role_permissions`.
3. RLS resuelve organización/sucursal desde el perfil autenticado.
4. Los componentes sólo muestran acciones permitidas, pero el servidor y RLS vuelven a autorizar.

## Modelo de datos

`organizations` contiene `branches`. Cada perfil pertenece a una organización y puede tener una sucursal. Roles y permisos son asignaciones de organización. Mesas, menú, pedidos, caja e inventario conservan las llaves de ámbito. `audit_logs`, `idempotency_keys` y `outbox_events` soportan trazabilidad y sincronización.

## Flujo futuro de órdenes

Mesero → función transaccional `submit_order` → `orders`/`order_items` → tickets por estación → evento outbox → Realtime/KDS → expedición → entrega. La clave de idempotencia impide que un doble toque o una reconexión duplique la comanda.

## Decisiones

- Importes en centavos `bigint` para evitar errores de punto flotante.
- UUID v4 generado por PostgreSQL.
- Eliminación lógica sólo en catálogos; transacciones financieras son inmutables o compensadas.
- PIN con bcrypt mediante `pgcrypto`; el navegador nunca obtiene el hash.
- Ningún cliente Supabase se inicializa en módulo durante el build.
