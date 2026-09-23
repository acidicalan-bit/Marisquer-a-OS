# Reglas de trabajo — Marisquería OS

## Aislamiento obligatorio

- Este repositorio pertenece únicamente a Marisquería OS.
- No copiar variables, referencias de Supabase, remotos, ramas ni código de Virro u otros proyectos.
- Antes de enlazar Supabase o GitHub, comprobar nombre, identificador y ruta del proyecto.
- Nunca incluir secretos, `service_role`, PIN sin hash ni datos completos de tarjetas en el cliente o en Git.

## Arquitectura y seguridad

- Next.js App Router, TypeScript estricto y Server Components por defecto.
- La base de datos Supabase/PostgreSQL es la única fuente de verdad.
- Toda tabla de negocio debe incluir `organization_id` y, cuando aplique, `branch_id`.
- Toda tabla expuesta por PostgREST debe tener RLS; validar permisos también en servidor.
- Importes monetarios en centavos (`bigint`), nunca `float`.
- Mutaciones críticas deben ser transaccionales, idempotentes y auditadas.
- No confiar únicamente en `proxy.ts` ni en ocultar controles de interfaz para autorizar.

## Calidad

- Una función no está terminada sin estados de carga/error, validación, pruebas y documentación.
- Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y las E2E correspondientes.
- Commits pequeños y descriptivos en español o Conventional Commits.
- Mantener accesibilidad WCAG AA, navegación por teclado y objetivos táctiles de al menos 44 px.

## Git

- Trabajar en ramas `feat/*`, `fix/*`, `docs/*` o `chore/*`.
- No hacer push directo a la rama principal.
- No mezclar cambios no relacionados ni sobrescribir trabajo del usuario.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
