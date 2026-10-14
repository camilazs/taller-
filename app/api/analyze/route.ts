import { authorize } from "@/lib/auth";
import { analyzeImage, readImage, VisionError } from "@/lib/vision";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  return Response.json(
    {
      configured: Boolean(process.env.AI_API_KEY),
      authRequired:
        Boolean(process.env.APP_PASSWORD) ||
        process.env.NODE_ENV === "production",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    authorize(request);
  } catch {
    return Response.json(
      {
        error: "Acceso denegado. Revisa la contraseña del estudio.",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }
  try {
    if (!process.env.AI_API_KEY)
      throw new VisionError(
        "Análisis automático no configurado. Crea una habitación manualmente.",
        503,
        "AI_NOT_CONFIGURED",
      );
    const image = await readImage(request);
    const analysis = await analyzeImage(image);
    return Response.json(
      { analysis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof VisionError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return Response.json(
      {
        error:
          "No se pudo procesar la solicitud de análisis. La escena actual se conserva.",
        code: "ANALYSIS_ERROR",
      },
      { status: 500 },
    );
  }
}
