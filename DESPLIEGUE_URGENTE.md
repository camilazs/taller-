# Diagnóstico del despliegue actual

Actualización: Claude ya está integrado y configurado localmente. Consulta [CLAUDE_DESPLIEGUE.md](CLAUDE_DESPLIEGUE.md) para variables, prueba real y despliegue. Las secciones anteriores sobre ausencia de credenciales describen el estado previo.

Se consultó `https://taller-beta-gray.vercel.app/api/projects`: respondió 503 con `Configura APP_PASSWORD para proteger la aplicación`. `/api/analyze` respondió `configured: false`. El usuario confirmó que solamente desplegó Vercel.

## 1. Credenciales de la aplicación

Se crearon `.env.vercel` y `.env.grpc` con una contraseña y un token aleatorios nuevos, sin modificar credenciales existentes. Ambos están excluidos por `.gitignore` (`.env.*`) y `.dockerignore`.

En **Vercel → proyecto taller → Settings → Environment Variables**, configura para Production:

- `APP_PASSWORD`: valor generado en `.env.vercel`.
- `GRPC_TOKEN`: valor generado en `.env.vercel`; el backend debe usar el mismo valor de `.env.grpc`.
- `GRPC_TLS`: `true`.
- `GRPC_ADDRESS`: hostname público y puerto del backend real, por ejemplo `tu-app.fly.dev:443`, sin `https://`.

No configures `localhost:50051` en Vercel: se referiría al entorno de Vercel, no al computador donde está ejecutándose el backend local. No subas los archivos `.env.*` al repositorio ni a capturas públicas.

## 2. Backend gRPC obligatorio

La contraseña sola no permite crear proyectos: primero debe existir el backend. Sigue la sección de Fly.io del README usando `Dockerfile.grpc` y `fly.toml`; configura `GRPC_TOKEN` con el valor ya generado y monta `/data` en un volumen persistente. Revisa costos antes de crear recursos. Estos pasos debe ejecutarlos el usuario: no se creó infraestructura ni se desplegó automáticamente.

Después de desplegar, usa su hostname real como `GRPC_ADDRESS` en Vercel. Comprueba TLS/HTTP2 y GetProjects con `grpcurl` como explica el README.

## 3. IA real

Configura `AI_API_KEY` con una clave válida de tu propia cuenta del proveedor. Una contraseña del estudio o un token gRPC **no sirven como clave de IA**. No es posible inventar una clave funcional ni tomar credenciales de terceros.

Valores adicionales para OpenAI:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_RESPONSE_FORMAT=json_schema
```

## 4. Aplicar y probar

Después de cambiar las variables, vuelve a desplegar desde Vercel. En la web, escribe el valor de `APP_PASSWORD` en **Acceso al estudio**, pulsa Actualizar proyectos, crea uno y prueba guardar/recuperar. Después carga una fotografía y analiza con IA si configuraste una clave real.

Hasta completar backend y variables, la web publicada puede mostrar el dashboard, pero no se ha verificado ni se considera funcional la persistencia cloud. El proyecto local continúa disponible en http://localhost:3100 con su servidor gRPC local.
