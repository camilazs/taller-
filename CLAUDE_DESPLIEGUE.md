# Claude configurado en SpaceAI 3D

## Configuración preparada

Se conserva el proyecto existente, los servicios gRPC, la generación aproximada editable y los cambios previos de modelos GLB. No se añadieron dependencias.

- Proveedor: API nativa de Anthropic, POST /v1/messages.
- Modelo verificado en la cuenta: claude-haiku-4-5-20251001.
- Autenticación: ANTHROPIC_API_KEY exclusivamente en el servidor.
- Las imágenes se envían en base64; la salida usa una herramienta de formato con strict:true. No ejecuta comandos ni herramientas externas: solo devuelve datos del análisis.
- El esquema enviado se adapta al subconjunto admitido por Claude. La respuesta completa vuelve a validarse con Zod. No se inventan resultados cuando el proveedor falla.
- Se admiten observaciones sin modelo de objetos finos (por ejemplo, un cuadro). No se convierten en geometrías; los muebles compatibles conservan el límite mínimo de 0.1 m.

## Variables

En .env.local ya quedó configurada la clave autorizada por el usuario. En .env.vercel se añadieron las mismas variables de IA conservando la contraseña y token existentes. Ambos archivos están excluidos de Git. No subirlos al repositorio.

En Vercel → Settings → Environment Variables configura para Production:

| Variable          | Valor                                   |
| ----------------- | --------------------------------------- |
| AI_PROVIDER       | anthropic                               |
| ANTHROPIC_API_KEY | valor privado de tu archivo .env.vercel |
| AI_BASE_URL       | https://api.anthropic.com/v1            |
| AI_MODEL          | claude-haiku-4-5-20251001               |

AI_RESPONSE_FORMAT solo se utiliza para el adaptador OpenAI; no es necesario para Claude. No usar NEXT_PUBLIC_ en claves. Si se configura OpenAI, AI_PROVIDER=openai conserva el adaptador anterior.

La clave fue compartida en el chat. Recomendación: revocarla y crear una nueva antes de dejar el sitio publicado; reemplazar solo el valor local y el de Vercel, nunca escribirla en código.

## Verificación real

Se consultó la API de modelos con respuesta 200. Después se analizó una fotografía pública de una sala de Spacejoy: https://unsplash.com/photos/9M66C_w_ToM .

- Tiempo de la petición satisfactoria: 14495 ms.
- Objetos observados: 11.
- Representaciones compatibles generadas: 8.
- Objetos sin modelo: 3.
- Resultado estructurado y escena: docs/claude-validacion-real.json. No contiene claves.

Es análisis real de Claude, no el fixture usado en pruebas automatizadas. Las medidas no están verificadas y la escena sigue siendo una aproximación, no fotogrametría ni reconstrucción exacta. Claude no genera archivos GLB: la función de mallas existente continúa dependiendo de Meshy y de su propia clave si se desea utilizarla.

## Ejecución y despliegue

Node 24. Para ejecutar localmente usar npm.cmd run grpc y, en otra terminal, npm.cmd run dev -- --port 3100. No volver a iniciar procesos si los puertos ya están ocupados. Los scripts dev/start usan los certificados del sistema de Windows, sin desactivar TLS. Se usa Webpack por un fallo interno observado de Turbopack en esta ubicación de Windows.

El frontend continúa preparado para Vercel y el backend para una plataforma con gRPC HTTP/2 y TLS. La clave de Claude **no sustituye el servidor gRPC**: el backend debe estar desplegado y Vercel debe tener GRPC_ADDRESS=hostname:443, GRPC_TLS=true, GRPC_TOKEN coincidente y APP_PASSWORD. Consulta README.md y DESPLIEGUE_URGENTE.md.

No se ejecutó Git ni se desplegó. Las variables guardadas localmente no se transfieren automáticamente a Vercel.

## Fuentes oficiales

- https://platform.claude.com/docs/en/build-with-claude/vision
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs

## Parche de seguridad aplicado

Se actualizó la dependencia existente Next.js de 16.4.0 a 16.4.6 y su package-lock.json. La auditoría de npm posterior reportó 0 vulnerabilidades conocidas. Esta actualización corrige los avisos que interrumpieron el primer arranque local; no se crearon ramas ni worktrees y no se ejecutó Git.

Referencia oficial del aviso: https://github.com/advisories/GHSA-2464-fhr4-w9xw . Las 25 pruebas automatizadas se repitieron después de actualizar.
