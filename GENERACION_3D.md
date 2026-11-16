# Fotografía → malla 3D con IA

El estudio incluye dos flujos complementarios:

1. **Generar modelo 3D desde esta foto**: Meshy genera una malla GLB con texturas. El backend descarga el archivo, lo valida y lo conserva en `DATA_DIR/models`. Puedes añadirlo a la escena, moverlo, girarlo, ajustar sus dimensiones, guardar el proyecto y descargar el GLB.
2. **Analizar con IA → Generar espacio 3D**: un proveedor de visión estima la habitación y los muebles y crea una distribución con geometrías paramétricas. Este segundo flujo no genera mallas detalladas.

## Activación

La generación de mallas requiere una cuenta Meshy con API y créditos. El usuario indicó que aún no dispone de cuenta; **no se ha ejecutado ni verificado una generación real**.

Completa en `.env.local`, sin subirlo a Git:

```dotenv
MESHY_API_KEY=tu_clave_privada
MESHY_MODEL=latest
```

Para el análisis de habitación, `AI_API_KEY` es otra integración independiente. No se necesita esa clave para generar una malla con Meshy. Las claves permanecen en Next.js, nunca se envían al navegador. El backend gRPC no necesita la clave de Meshy.

Reinicia **Next.js y el backend gRPC actualizado**, porque el contrato agrega `StoreModelAsset` y `GetModelAsset`:

```powershell
npm.cmd run dev:all
```

En Vercel, establece `MESHY_API_KEY` y actualiza también el backend separado. El almacenamiento reside en el volumen del backend, no en el sistema efímero de Vercel. Se mantiene una sola instancia de almacenamiento como en la arquitectura original.

## Uso

1. Crea o abre un proyecto.
2. Toma o carga una fotografía (JPEG, PNG o WebP, hasta 3 MB).
3. En **Fotografía → modelo 3D con IA**, pulsa generar y confirma el envío y consumo de créditos.
4. La tarea se consulta cada ocho segundos, sin repetir automáticamente la creación. El progreso corresponde al proveedor. Las consultas se detienen al terminar o ante un error; puedes reanudarlas con el botón. El identificador de la última tarea de cada proyecto se conserva en el navegador para recuperarla tras recargar.
5. Una tarea terminada se descarga automáticamente al consultar su estado. Solo se anuncia como guardada cuando el backend confirmó el archivo.
6. Añade la malla al espacio. Se centra y apoya en el suelo; empieza con dimensiones 1×1×1 m, **definidas por la interfaz, no medidas por la IA**. Corrígelas según el objeto real. Se conservan texturas del GLB. El control de color del catálogo no recolorea las texturas del modelo.
7. Ajusta posición X/Z, giro y dimensiones y pulsa guardar. Se guarda la referencia al GLB mediante el mismo `SaveScene` gRPC. Reabrir el proyecto recupera la malla almacenada sin depender del proveedor.

Para mejores resultados, usa un solo mueble u objeto, bien iluminado y visible. Una foto de una habitación completa puede producir una sola malla combinada; no se promete separar automáticamente todos sus muebles ni reconstruir las superficies ocultas con exactitud. El organizador permite combinar modelos generados y objetos del catálogo en una habitación.

## Persistencia y límites

- Meshy entrega enlaces temporales: el archivo se descarga y conserva en el backend. Fuente oficial: https://docs.meshy.ai/en/api/asset-retention.
- Se aceptan GLB 2 integrados con mallas y recursos embebidos, hasta 32 MB. Se rechazan firmas corruptas, tamaños inconsistentes, enlaces a servidores arbitrarios y referencias externas en el GLB.
- Las descargas del proveedor solo permiten HTTPS en `assets.meshy.ai`, sin redirecciones. Los enlaces firmados no se guardan en la escena ni se entregan al navegador.
- El visor usa Three.js GLTFLoader y dispone de decodificador Draco para modelos comprimidos. Requiere WebGL y conexión al decodificador cuando corresponda.
- Los archivos binarios no pasan por JSON de escena: se consultan mediante los nuevos RPC, con límite de respuesta 34 MB. El adaptador HTTP entrega el GLB por streaming, sin `Content-Length`, para evitar la respuesta bufferizada de más de 4.5 MB en Vercel. Se verificó localmente con un GLB sintético de más de 5 MB; falta probar el streaming en la cuenta desplegada. Referencia: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions.
- Los límites se coordinan con la función de 60 s: consulta al proveedor 10 s, descarga del archivo 30 s, RPC de almacenamiento 40 s y RPC de metadatos 8 s. Las escenas mantienen su límite de entrada de 1 MB.
- Las mallas se conservan al borrar un proyecto, porque podrían estar referenciadas por otros proyectos. El administrador debe gestionar cuota y limpieza de archivos sin referencias.
- Si una creación pierde la respuesta, no se reintenta automáticamente: consulta las tareas en la cuenta de Meshy antes de volver a generar para evitar consumir créditos por duplicado.
- Si se cierra la web mientras se genera, la tarea continúa en Meshy, pero la descarga al backend requiere volver a consultar antes de que venza. No hay un trabajador de descarga en segundo plano sin navegador.

## Evidencia

El código incluye pruebas del contrato de creación/progreso/éxito, errores de cuota, falta de clave, validación y descarga de GLB con respuestas HTTP simuladas. También verifica el transporte de un GLB sintético de más de 5 MB, recuperación tras reinicio del backend, descarga HTTP por streaming y apertura con el cargador real de Three.js. Estas pruebas no acreditan calidad ni disponibilidad en una cuenta real. No se puede afirmar 100 % de precisión desde una sola imagen.

Contrato utilizado: https://docs.meshy.ai/en/api/image-to-3d.
