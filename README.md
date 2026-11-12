# Marisquería OS

Sistema operativo premium para restaurante: operación de meseros, cocina y anfitrión; consola administrativa; menú con imágenes; inventario; mesas; usuarios; turnos; inteligencia de ventas; marca; copiloto de IA y bandeja omnicanal.

El copiloto Mar es híbrido: usa OpenAI cuando hay disponibilidad y cambia automáticamente a un cerebro local basado en ventas, márgenes, inventario, mesas y turnos cuando no hay crédito o conexión con el proveedor.

El repositorio y el proyecto Supabase son exclusivos de Marisquería OS. No comparten configuración, base de datos ni despliegue con Virro u otro proyecto.

## Desarrollo

Requiere Node.js 20.9+, npm 11+, Java 21 y Android SDK para generar APK.

```bash
npm install
npm run dev
```

Las migraciones se aplican en orden desde `supabase/migrations`; `supabase/seed.sql` carga la sucursal inicial. La aplicación nunca sustituye una conexión ausente con datos simulados.

## Verificación

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

## Instaladores

### Windows

```bash
npm run desktop:pack
```

Genera `dist-installers/Marisqueria-OS-Admin-Setup-0.1.0.exe`. La aplicación inicia el servidor local en `0.0.0.0:3210`; la consola de la PC usa `http://127.0.0.1:3210`.

La PC funciona como caja desde `/cash`: apertura con fondo, cobro en efectivo/tarjeta/transferencia, cambio, propina, cierre y diferencia. Cada venta genera un ticket de 80 mm imprimible en la impresora predeterminada de Windows. El ticket es comprobante interno y no sustituye un CFDI.

### Android

```powershell
npm run mobile:sync
cd android
.\gradlew.bat assembleAdminDebug assembleServiceDebug assembleCashierDebug
```

Los tres APKs tienen responsabilidades y rutas independientes:

- `mx.marisqueria.os.admin` → `/admin`
- `mx.marisqueria.os.service` → `/dashboard`
- `mx.marisqueria.os.cashier` → `/cash`

Al abrir una APK se verifica la dirección de la PC, por ejemplo `http://192.168.1.20:3210`. Si la dirección guardada es errónea o deja de responder, se elimina y vuelve a mostrarse el configurador; la APK no queda bloqueada. La dirección vigente aparece en el panel administrativo. Ambos dispositivos deben estar en la misma red y el firewall debe permitir el puerto 3210. Para una operación fuera de una LAN controlada se requiere HTTPS; no expongas directamente ese puerto a Internet.

Después de iniciar sesión y sincronizar al menos una vez, meseros pueden guardar pedidos localmente si la PC no responde; al volver, se sincronizan con idempotencia. Caja y administración muestran una vista local de consulta, pero para cobrar, alterar catálogo/configuración o imprimir el ticket del cliente necesitan conexión. La carta está agrupada por categoría e incluye fotos cuando la copia local contiene las imágenes.

## Variables

| Variable                               | Ámbito        | Uso                                                  |
| -------------------------------------- | ------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Público       | URL del proyecto exclusivo                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Público       | Llave publicable protegida por RLS                   |
| `SUPABASE_SECRET_KEY`                  | Sólo servidor | Altas, bajas y cambio de contraseña en Supabase Auth |
| `OPENAI_API_KEY`                       | Sólo servidor | Copiloto Mar y generación de logos                   |
| `OPENAI_ASSISTANT_MODEL`               | Sólo servidor | Modelo del copiloto                                  |
| `OPENAI_IMAGE_MODEL`                   | Sólo servidor | Modelo de imagen                                     |
| `OPENAI_ASSISTANT_REQUESTS_PER_MINUTE` | Sólo servidor | Límite por usuario antes de usar respaldo local      |
| `META_APP_SECRET`                      | Sólo servidor | Firma de webhooks Meta                               |
| `META_VERIFY_TOKEN`                    | Sólo servidor | Verificación inicial del webhook                     |
| `WHATSAPP_ACCESS_TOKEN`                | Sólo servidor | Envío por WhatsApp Cloud API                         |
| `WHATSAPP_PHONE_NUMBER_ID`             | Sólo servidor | Número emisor de WhatsApp                            |

Los secretos no se incrustan en el instalador. En Windows deben configurarse como variables de entorno del usuario o de la máquina antes de iniciar la app; después hay que cerrarla y abrirla otra vez. Nunca pegues secretos en tickets, commits o chats.

## Seguridad

- RLS está habilitado en todas las tablas públicas y limita organización, sucursal y permiso.
- `shifts.manage` pertenece sólo al rol administrador y existe como máximo un turno abierto por sucursal.
- Contraseñas y altas Auth requieren la clave secreta exclusivamente en el proceso servidor.
- Los webhooks Meta validan `x-hub-signature-256` antes de escribir datos.
- Importes monetarios se guardan en centavos enteros; inventario usa movimientos atómicos.
- Apertura, cobro, ticket y cierre de caja se ejecutan mediante funciones transaccionales, idempotentes y auditadas en Supabase.
- La cola offline está ligada al usuario y sucursal que la generaron; otra sesión no puede apropiarse de sus operaciones.
- La recomendación comercial devuelve cero si no hay ventas y reduce la confianza cuando falta receta/costo.
- El instalador Windows necesita un certificado comercial de firma de código para eliminar advertencias de SmartScreen. Las APK actuales usan firma de depuración para instalación directa; una publicación en Play Store necesita un keystore de producción custodiado por el propietario.

Consulta [docs/architecture.md](docs/architecture.md) y [docs/technical-plan.md](docs/technical-plan.md).
