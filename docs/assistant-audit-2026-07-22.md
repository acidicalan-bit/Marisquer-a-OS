# Auditoría exhaustiva — Cerebro Mar y aplicaciones

Fecha: 2026-07-22
Proyecto Supabase verificado: `cbiwrzgglcutbjxvcaok`
Rama: `feat/fase-1-supabase`

## Evaluación general

**Listo para pruebas operativas controladas.** El cerebro local, su conmutación con OpenAI, los cálculos comerciales, los límites de rol y los artefactos instalables superaron las comprobaciones automatizadas y de datos descritas abajo. La generación real de texto e imágenes con OpenAI queda condicionada a cargar crédito; el modo local sí fue validado de extremo a extremo.

## Historia verificada

El usuario abre Mar desde Admin u Operación, envía una pregunta a `/api/assistant`, el servidor autentica la sesión, obtiene sólo el contexto de su sucursal, calcula evidencia con `menu_performance`, intenta OpenAI dentro de un límite de costo y devuelve una respuesta `openai` o `local` que la interfaz identifica explícitamente.

## Hallazgos materiales corregidos

1. **Crítico — mezcla potencial de sucursales.** Usuarios con `branches.all` podían recibir datos de más de una sucursal. La ruta y la función SQL ahora se limitan a `current_branch_id()`.
2. **Crítico — margen ficticio sin receta.** Un producto sin receta podía aparentar margen de 100%. Ahora no recibe recomendación positiva y su margen no se presenta como conocido.
3. **Alto — inventario no medido.** El componente de inventario usaba un valor constante. Ahora calcula porciones vendibles por encima del mínimo y las compara con la demanda diaria del periodo.
4. **Alto — margen mínimo ignorado.** `minimum_margin_basis_points` no afectaba el puntaje. Ahora cualquier producto debajo del umbral obtiene puntaje cero.
5. **Alto — acceso por rol incompleto.** Cocina y Host sólo exigían autenticación. Ahora página y acción de Cocina validan roles de cocina; Host valida roles de recepción; accesos incompatibles regresan a Operación.
6. **Alto — falta de distinción entre consulta fallida y dato vacío.** Mar podía afirmar “no hay inventario/ventas” cuando la consulta había fallado. Ahora declara indisponibilidad y evita tomar decisiones con datos no verificados.
7. **Medio — periodo fijo de 30 días.** API, Admin y Operación ignoraban `lookback_days`. Ahora usan el periodo configurado entre 7 y 365 días y lo muestran en la respuesta.
8. **Medio — prioridades de intención.** “Editar Tostada” devolvía precio y “recomendar Tostada” podía responder inventario. Se corrigió la precedencia entre administración, recomendación, ventas y entidad.
9. **Medio — lenguaje financiero ambiguo.** Mar ahora separa ventas, margen bruto estimado y utilidad neta; no atribuye causalidad a una tendencia.
10. **Medio — consumo sin guardia.** Se agregó límite por usuario y minuto. Al superarlo, Mar usa el cerebro local sin bloquear al usuario ni consumir crédito.
11. **Medio — secretos.** Se añadieron rechazo explícito de contraseñas, PIN, tokens y claves, aislamiento del bloque de datos enviado a OpenAI y validación de que instaladores no contienen `.env` ni valores secretos.
12. **Bajo — estado visual impreciso.** La interfaz ya diferencia OpenAI, cerebro local y error del servidor; se eliminó la afirmación de “tiempo real” donde sólo había renderizado al abrir.

## Evidencia de datos en Supabase

La función desplegada se verificó con el contexto autenticado del proyecto:

| Invariante                                         | Resultado |
| -------------------------------------------------- | --------: |
| Productos devueltos / esperados en sucursal        |   14 / 14 |
| Ámbito de sucursal coincide                        |        Sí |
| Todos los puntajes están entre 0 y 100             |        Sí |
| Recomendaciones positivas sin receta               |         0 |
| Recomendaciones positivas debajo del margen mínimo |         0 |

Metodología: ventas actuales y anteriores usan ventanas equivalentes; excluyen órdenes e ítems cancelados; costo estimado se deriva de receta por ingrediente; inventario conserva el mínimo como reserva; los pesos se normalizan aunque una escritura externa no sume exactamente 100.

## Matriz automatizada

| Capa                            |          Resultado |
| ------------------------------- | -----------------: |
| Pruebas Vitest totales          |              78/78 |
| Casos del cerebro local         |              54/54 |
| Clasificación de errores OpenAI |              11/11 |
| Guardia de consumo              |                4/4 |
| UI del copiloto                 |                5/5 |
| E2E público escritorio/tablet   |                2/2 |
| Cruces autenticados por rol     |              15/15 |
| TypeScript estricto             |           Aprobado |
| ESLint sin advertencias         |           Aprobado |
| Formato Prettier                |           Aprobado |
| Build Next.js de producción     |           Aprobado |
| `npm audit --omit=dev`          | 0 vulnerabilidades |

Los casos incluyen errores ortográficos, acentos omitidos, entidades parciales, intenciones cruzadas, datos vacíos, consultas fallidas, puntajes corruptos, recomendaciones desactivadas, protección de secretos, ventanas de tiempo, totales monetarios en centavos, tendencia sin causalidad y diferencias entre margen bruto y utilidad neta.

## Acceso por aplicación

| Rol de prueba | Operación | Admin      | Cocina     | Host       |
| ------------- | --------- | ---------- | ---------- | ---------- |
| Administrador | Permitido | Permitido  | Permitido  | Permitido  |
| Mesero        | Permitido | Redirigido | Redirigido | Redirigido |
| Cocina fría   | Permitido | Redirigido | Permitido  | Redirigido |
| Host          | Permitido | Redirigido | Redirigido | Permitido  |

Se crearon cuentas temporales con metadata de organización/sucursal/rol, se inició sesión por la interfaz real, se recorrieron las rutas y se eliminaron en `finally`. Verificación posterior: **0 usuarios QA restantes**.

## Android

Gradle completó 316 tareas incluyendo pruebas debug/release y ensamblado de los cuatro sabores.

| APK     | Paquete                     | Firma v2  | SHA-256                                                            |
| ------- | --------------------------- | --------- | ------------------------------------------------------------------ |
| Admin   | `mx.marisqueria.os.admin`   | Sí, debug | `6AAB5000A427C0E7B0315131062182F338B9A7A4EEA761B12EA12284DF655006` |
| Meseros | `mx.marisqueria.os.service` | Sí, debug | `A39C43C89FA56748B356B7B4C2B465F2E88C23D7ED6C4ABE0DAB864F84239178` |
| Cocina  | `mx.marisqueria.os.kitchen` | Sí, debug | `10A056DAC291348454BCC7B179FFB2922A263DF1450988F628B3128695B3ECA3` |
| Host    | `mx.marisqueria.os.host`    | Sí, debug | `6BED1196E3F15FB16FD879C15E6A130F88080EB8F704E3476C9549A292D3533C` |

## Windows

- Instalador NSIS: `Marisqueria-OS-Admin-Setup-0.1.0.exe`
- Tamaño: 104,887,003 bytes
- SHA-256: `C83015CCD7D3ED35ECF7410FC4B21E3DE26959607D939185380114478FD059F7`
- Coincidencias de secretos en paquete: 0
- Archivos `.env` empaquetados: 0
- Authenticode: **no firmado**; funcionará localmente, pero Windows puede mostrar SmartScreen.

## Limitaciones y pruebas pendientes

1. La clave OpenAI está autenticada, pero falta crédito. No se pudo validar una respuesta generativa cobrada ni una generación de logo; sí se validó el cambio automático al cerebro local.
2. Los APK usan firma de depuración. La instalación directa funciona, pero Play Store requiere un keystore de producción.
3. No se ejecutaron pruebas instrumentadas en hardware Android físico; se verificaron builds, paquetes, firmas y pruebas Gradle.
4. La guardia de consumo es por proceso, adecuada para el servidor único en PC. Un despliegue con varias réplicas necesitará un contador distribuido.
5. La precisión comercial depende de mantener recetas, costos, mínimos y movimientos de inventario completos y actuales. Mar rechaza recomendar cuando falta evidencia, pero no puede corregir datos fuente incorrectos.

## Veredicto

El cerebro y las cuatro superficies están técnicamente preparados para un piloto local controlado. Los bloqueos restantes para distribución pública son externos al código auditado: crédito OpenAI, certificados comerciales y prueba física en los dispositivos objetivo.
