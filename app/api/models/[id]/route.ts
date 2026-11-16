import { authorize, AccessError } from "@/lib/auth";
import { meshyRequest } from "@/lib/meshy";
import { rpc } from "@/lib/grpc";
import { VisionError } from "@/lib/vision";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { authorize(request); } catch (error) { return Response.json({ error: error instanceof AccessError ? error.message : "Acceso denegado." }, { status: error instanceof AccessError ? error.status : 401 }); }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Identificador de modelo inválido." }, { status: 400 });
  const download = new URL(request.url).searchParams.get("asset") === "1";
  try {
    const asset = await rpc<{ content: Buffer; size: number }>("GetModelAsset", { id, metadataOnly: !download });
    if (download) {
      // Vercel limita las respuestas bufferizadas a 4.5 MB. Entrega por streaming sin Content-Length.
      let offset = 0;
      const stream = new ReadableStream<Uint8Array>({ pull(controller) {
        if (offset >= asset.content.length) { controller.close(); return; }
        const end = Math.min(offset + 256 * 1024, asset.content.length);
        controller.enqueue(new Uint8Array(asset.content.subarray(offset, end))); offset = end;
      } });
      return new Response(stream, { headers: { "Content-Type": "model/gltf-binary", "Content-Disposition": `attachment; filename="spaceai-${id}.glb"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return Response.json({ id, status: "SUCCEEDED", progress: 100, stored: true, size: asset.size }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if ((e as { code?: number }).code !== 5) return Response.json({ error: "No se pudo consultar el almacén de modelos. Verifica el backend gRPC actualizado." }, { status: 502 });
  }
  if (download) return Response.json({ error: "El modelo aún no se ha guardado." }, { status: 404 });
  try {
    const task = await meshyRequest(id);
    if (task.status === "SUCCEEDED") {
      const stored = await rpc<{ size: number }>("StoreModelAsset", { id, url: task.glb });
      return Response.json({ id, status: task.status, progress: 100, stored: true, size: stored.size }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ id, status: task.status, progress: task.progress, stored: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof VisionError ? error.message : "No se pudo recuperar o guardar el GLB. Reintenta consultar la misma tarea; no generes otra." }, { status: error instanceof VisionError ? error.status : 502 }); }
}
