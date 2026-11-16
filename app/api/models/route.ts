import { authorize, AccessError } from "@/lib/auth";
import { meshyRequest } from "@/lib/meshy";
import { readImage, VisionError } from "@/lib/vision";
import { rpc } from "@/lib/grpc";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() { return Response.json({ configured: Boolean(process.env.MESHY_API_KEY?.trim()) }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  try { authorize(request); } catch (error) { return Response.json({ error: error instanceof AccessError ? error.message : "Acceso denegado." }, { status: error instanceof AccessError ? error.status : 401 }); }
  try {
    if (!process.env.MESHY_API_KEY?.trim()) throw new VisionError("Configura MESHY_API_KEY para generar modelos 3D.", 503, "MODEL_NOT_CONFIGURED");
    const image = await readImage(request);
    // Verifica almacenamiento antes de crear una tarea de pago.
    await rpc("GetProjects");
    return Response.json(await meshyRequest(undefined, image), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof VisionError ? error.message : "No se pudo iniciar el modelo. Comprueba el backend gRPC y la configuración." }, { status: error instanceof VisionError ? error.status : 502 }); }
}
