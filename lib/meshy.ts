import { z } from "zod";
import { readBoundedJson, VisionError } from "./vision";
import { validateModelUrl } from "./model-file";
const taskId = z.string().uuid();
const endpoint = "https://api.meshy.ai/openapi/v1/image-to-3d";
export async function meshyRequest(id?: string, image?: string, fetcher: typeof fetch = fetch) {
  const key = process.env.MESHY_API_KEY?.trim();
  if (!key) throw new VisionError("Configura MESHY_API_KEY para convertir una fotografía en una malla 3D.", 503, "MODEL_NOT_CONFIGURED");
  if (id) taskId.parse(id);
  let response: Response;
  try {
    response = await fetcher(id ? `${endpoint}/${id}` : endpoint, {
      method: id ? "GET" : "POST", signal: AbortSignal.timeout(id ? 10000 : 45000), redirect: "error",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(id ? {} : { body: JSON.stringify({ image_url: image, ai_model: process.env.MESHY_MODEL || "latest", should_texture: true, should_remesh: true, target_polycount: 30000, target_formats: ["glb"] }) }),
    });
  } catch { throw new VisionError("No se obtuvo respuesta de Meshy. Si estabas creando una tarea, revisa tu cuenta antes de volver a generar para evitar duplicados.", 502, "MODEL_CONNECTION_ERROR"); }
  if (!response.ok) throw new VisionError(response.status === 401 || response.status === 403 ? "Meshy rechazó la clave o los permisos." : response.status === 402 || response.status === 429 ? "Revisa los créditos y límites de tu cuenta de Meshy." : response.status === 404 ? "La tarea ya no está disponible en Meshy." : "Meshy no pudo procesar la solicitud.", response.status === 404 ? 404 : 502, "MODEL_PROVIDER_ERROR");
  const json = await readBoundedJson(response, 512 * 1024);
  if (!id) return { id: taskId.parse(z.object({ result: taskId }).parse(json).result), status: "PENDING", progress: 0 };
  const task = z.object({ id: taskId, status: z.enum(["PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"]), progress: z.number().min(0).max(100).optional(), model_urls: z.object({ glb: z.string().optional() }).optional() }).parse(json);
  if (task.id !== id) throw new Error("Tarea de modelo incorrecta.");
  if (task.status === "SUCCEEDED") {
    if (!task.model_urls?.glb) throw new Error("La tarea no devolvió un GLB.");
    validateModelUrl(task.model_urls.glb);
  }
  return { id: task.id, status: task.status, progress: task.progress || 0, glb: task.model_urls?.glb };
}
