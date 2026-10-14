# Registro de validación — 13 de octubre de 2026

## Actualización: flujo completo de análisis y revisión

Se completó la integración existente conservando el editor, los seis métodos gRPC, el contrato `.proto`, la persistencia y las configuraciones de Fly.io/Vercel. No se instalaron dependencias nuevas.

### Verificaciones de esta actualización

- `npm run typecheck`: código 0.
- `npm test`: **14 pruebas aprobadas, 0 fallidas**, incluidos subcasos de proveedor.
- `npm run build`: código 0; rutas de análisis y proyectos dinámicas, runtime Node.js.
- No existe script lint ni configuración ESLint; no se declara una ejecución de lint.
- Se comprobó la inclusión de `proto/space.proto` en el trazado del build.
- Contrato HTTP del proveedor probado con respuestas sustituidas **solo dentro de tests**: envío de imagen y esquema estricto, compatibilidad `json_object`, salida válida, JSON inválido, respuesta incompleta/truncada, datos fuera de rango, rechazo, imagen no interior, errores 400/401/403/429/500, red y timeout.
- Validación de MIME/firma, base64, tamaño máximo, JSON de entrada y límite de cuerpos en streaming sin Content-Length. Las respuestas no exponen mensajes privados del proveedor.
- Conversión de JSON **de prueba, no detecciones reales**: categorías existentes, posiciones relativas, rotaciones, corrección de dimensiones, exclusión de muebles, advertencia de objetos demasiado grandes y omisión explícita de objetos sin modelo.
- La prueba gRPC guarda una escena convertida desde el fixture y la recupera después de reiniciar el servidor.
- `npm run test:smoke` contra producción local en puerto 3102: página, autenticación, creación/listado/guardado/recuperación y eliminación por Next.js → gRPC aprobados.
- La misma prueba contra la aplicación principal en `http://localhost:3100` también pasó. Se abrió el proyecto existente sin modificarlo y se observaron sus cuatro objetos, catálogo, transformaciones y mensaje “Modo manual · IA no configurada”.
- Prueba visual aislada en puerto 3102 con `tests/helpers/vision-provider.mjs` en localhost: **no es IA real**. El resultado muestra “DATOS DE PRUEBA” y no analiza el contenido de la imagen.
  - JPEG válido cargado y previsualizado con la nueva validación.
  - Analizar mostró el panel de revisión sin reemplazar los cero objetos de la escena actual.
  - Se corrigió el ancho a 7 m y se excluyó la mesa; la lámpara apareció como “Sin modelo”.
  - Se observó el diálogo de confirmación al generar. Se generó una habitación de 7 × 5 m con un sofá.
  - Se guardó por gRPC, se regresó al dashboard y se recuperaron dimensiones y mueble.
  - El proyecto temporal de esta prueba se eliminó por el adaptador gRPC; se conservaron los proyectos anteriores.
  - Se cerraron el proveedor fixture, la instancia de producción temporal y su pestaña; permanecieron activos la aplicación principal en 3100 y el backend gRPC en 50051.

![Flujo con datos explícitamente de prueba, no IA real](docs/flujo-ia-datos-de-prueba.jpg)

### Estado real de IA y pendientes

**No se encontró `AI_API_KEY` ni `OPENAI_API_KEY` en el entorno, y no existía `.env.local` ni `.env`.** No se realizó una llamada a OpenAI ni a otro proveedor real. Las pruebas de contrato usan fixtures identificados como pruebas; no demuestran calidad de detección ni disponibilidad de un modelo en una cuenta real.

Para verificar con IA real, configurar `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` y `AI_RESPONSE_FORMAT` en el servidor, reiniciar Next.js y usar una fotografía real de un interior. Verificar resultados, corregir dimensiones, generar, guardar y recuperar. La app del puerto 3100 permanece en modo manual mientras no se configure una clave. No se cambiaron credenciales existentes ni se desplegó.

Pendientes: prueba real de visión con credenciales, calidad espacial con fotografías reales, prueba cloud con TLS/HTTP2 y Docker. Las medidas y profundidades son estimadas; las paredes/suelo del editor son referencias geométricas, no una reconstrucción exacta ni mallas generadas desde píxeles.

### Archivos de esta actualización

- Nuevos: `lib/analysis.ts`, `lib/image.ts`, `lib/vision.ts`, `components/PhotoAnalysis.tsx`, `tests/analysis.test.ts`, `tests/fixtures/interior.json`, `tests/helpers/vision-provider.mjs`, evidencia visual.
- Modificados: `app/api/analyze/route.ts`, `components/Studio.tsx`, `app/globals.css`, `.env.example`, `tests/ai.test.ts`, `tests/grpc.test.ts`, `README.md`, `VALIDACION.md`.
- Sin cambios de contrato/infraestructura: `proto/space.proto`, `backend/server.ts`, `lib/grpc.ts`, `next.config.ts`, `fly.toml`, `Dockerfile.grpc`.

## Validación anterior del MVP

## Resultados observados

- Dependencias instaladas con npm; auditoría de instalación: 0 vulnerabilidades reportadas (no equivale a auditoría de seguridad completa).
- `npm run typecheck`: terminó con código 0.
- `npm test`: **3 pruebas aprobadas, 0 fallidas**.
  - Validación de dimensiones y clases de muebles.
  - Servidor gRPC real en proceso separado, seis RPC, token inválido, escena inválida, ID inválido, persistencia después de reiniciar y eliminación.
  - Sin clave de IA: respuesta 503 explícita, ninguna llamada externa y rechazo de acceso sin contraseña.
- `npm run build`: compilación de producción aprobada; rutas de proyectos y análisis ejecutadas como funciones dinámicas Node.js.
- `npm run test:smoke` contra `next start` en puerto 3101: página 200, rechazo sin contraseña, creación/listado/guardado/recuperación mediante Next.js → gRPC y eliminación del proyecto temporal aprobados.
- Verificado en los archivos de trazado de producción que `proto/space.proto` se incluye en ambos adaptadores de proyectos.
- Navegador en `http://localhost:3100`:
  - Renderizado WebGL de habitación y sofá observado visualmente.
  - Proyecto creado a través de Next.js → gRPC.
  - Sofá agregado, movido a X=1 y girado 45 grados.
  - Guardado confirmado; al volver al dashboard y abrir, se recuperaron X=1 y 45 grados.
  - Carga de un JPEG de prueba (captura propia del editor) y vista previa verificadas. No se envió a un proveedor de IA.
  - Estado “Modo manual · IA no configurada” visible y análisis deshabilitado.

![Editor verificado](docs/editor-verificado.jpg)

## Pendiente de validación externa

- Análisis con proveedor real: no se proporcionó una clave; no se realizaron llamadas pagadas ni detecciones simuladas.
- Despliegue Vercel/Fly.io, TLS público y volumen cloud: preparados y documentados, no ejecutados.
- Imagen real de una habitación: la prueba de carga usó un JPEG de prueba; la calidad de la estimación necesita evaluación con fotografías reales y credenciales.
- No se automatizaron pruebas de todos los tamaños responsive, todos los gestos de cámara ni todos los dispositivos WebGL.
- Docker no se compiló ni se ejecutó durante la validación local.

## Incidencias del entorno resueltas

- npm fue bloqueado inicialmente por permisos de red/caché; se instaló con ejecución autorizada.
- tsx falló en el sandbox al consultar información del usuario (`uv_os_get_passwd`); las pruebas pasaron al ejecutarse fuera de ese entorno restringido.
- El puerto 3000 estaba ocupado por otra aplicación. La prueba visual de SpaceAI utilizó 3100 sin modificar esa aplicación.
- Una recarga automática del servidor interrumpió el primer selector de archivos; al reabrir el proyecto y repetir, la vista previa JPEG funcionó.

No se ejecutaron operaciones de Git, no se desplegó y no se crearon servicios de pago.
