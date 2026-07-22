# Marisquería OS

Sistema operativo web para una marisquería en Ciudad de México. Esta primera fase entrega la base productiva: Next.js, Supabase Auth/PostgreSQL/Realtime, separación por organización y sucursal, roles, menú, mesas, migraciones, seed y panel operativo inicial.

## Requisitos

- Node.js 20.9 o superior.
- npm 11 o superior.
- Un proyecto Supabase **exclusivo para Marisquería OS**.
- Supabase CLI para aplicar migraciones localmente o acceso al SQL Editor del proyecto correcto.

## Inicio rápido

1. Copia `.env.example` a `.env.local`.
2. Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del proyecto de Marisquería OS.
3. Ejecuta la migración `supabase/migrations/202607220001_foundation.sql`.
4. Ejecuta `supabase/seed.sql` en desarrollo.
5. Instala y levanta la aplicación:

```bash
npm install
npm run dev
```

La aplicación no usa datos simulados. Sin configuración válida muestra un estado de instalación pendiente.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
```

## Variables

| Variable                               | Ámbito                        | Uso                                |
| -------------------------------------- | ----------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Cliente/servidor              | URL del proyecto exclusivo         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente/servidor              | Llave publicable protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY`            | Sólo scripts locales/servidor | Seed de usuarios; jamás se expone  |
| `NEXT_PUBLIC_APP_URL`                  | Público                       | URL canónica y callbacks           |

## Estructura

- `src/app`: rutas App Router y acciones de servidor.
- `src/components`: interfaz y proveedores.
- `src/lib/supabase`: clientes SSR/browser y sesión.
- `supabase/migrations`: esquema versionado, RLS y funciones.
- `supabase/seed.sql`: sucursal, roles, mesas, menú e inventario demostrativo.
- `docs`: arquitectura, decisiones y plan por fases.

## Seguridad

Las consultas usan la llave publicable y dependen de RLS. La llave `service_role` sólo se admite en procesos administrativos locales. Los PIN se verifican con `crypt()`/bcrypt en PostgreSQL y nunca se almacenan ni registran en texto plano. Los importes se guardan en centavos como enteros.

## Estado de la fase 1

Incluido: estructura, modelo de datos base, RLS, seed, autenticación por correo, selección contextual de sucursal, panel de mesas y menú con datos reales. El acceso rápido por PIN queda modelado de forma segura y se completará con una función de autenticación privilegiada antes del piloto; no se emiten sesiones desde el navegador a partir de un PIN.

Consulta [docs/technical-plan.md](docs/technical-plan.md) y [docs/architecture.md](docs/architecture.md).
