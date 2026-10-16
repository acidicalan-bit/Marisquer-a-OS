# Seguridad de cobros y cancelaciones

La autorización sensible se implementa en PostgreSQL, no en la APK:

- Administración configura el NIP desde **Administración → Equipo → NIP de Administración**.
- Supabase guarda únicamente el hash con `pgcrypto`.
- Cobrar una cuenta exige método de pago, importe recibido y NIP.
- Cancelar una partida ya enviada exige motivo y NIP; se registra en auditoría y genera una comanda de cancelación para la estación.
- Cinco intentos incorrectos bloquean el NIP durante 15 minutos.

## Aplicar en Supabase

En el SQL Editor del proyecto `marisqueria-os` (`cbiwrzgglcutbjxvcaok`), ejecutar el contenido completo de:

`supabase/migrations/202610150004_admin_pin_authorization.sql`

Después comprobar que la consulta RPC `verify_admin_approval_pin` existe. La aplicación no debe desplegarse como “cobro listo” hasta que esta migración esté aplicada: sin ella, PostgREST devuelve `PGRST202` y el cliente bloqueará el cobro/cancelación por seguridad.

No colocar el NIP, `service_role` ni claves privilegiadas en la APK, variables públicas o repositorio.
