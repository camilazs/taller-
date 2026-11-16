// Native Claude Messages API. Secrets and image requests stay on the server.
import { z } from "zod";
import { analysisSchema, type Analysis } from "./analysis";
import { getVisionConfig } from "./ai-config";
import { VisionError, readBoundedJson } from "./vision-common";

// Claude's strict grammar does not support numeric/string size bounds.
// Preserve those as descriptions and enforce the original full schema with Zod.
export function claudeToolSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(claudeToolSchema);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const constraints: string[] = [];
  for (const [key, entry] of Object.entries(input)) {
    if (
      [
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minLength",
        "maxLength",
        "maxItems",
      ].includes(key) ||
      (key === "minItems" && entry !== 0 && entry !== 1)
    )
      constraints.push(key + "=" + entry);
    else output[key] = claudeToolSchema(entry);
  }
  if (constraints.length)
    output.description =
      String(output.description || "") +
      " Restricciones a respetar: " +
      constraints.join(", ");
  return output;
}

export async function analyzeWithClaude(
  image: string,
  instructions: string,
): Promise<Analysis> {
  const { key, model, baseUrl } = getVisionConfig();
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new VisionError(
      "AI_BASE_URL no es una URL válida.",
      503,
      "AI_CONFIGURATION",
    );
  }
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw new VisionError(
      "El proveedor de IA debe usar HTTPS, salvo localhost.",
      503,
      "AI_CONFIGURATION",
    );
  if (!key)
    throw new VisionError(
      "Configura ANTHROPIC_API_KEY para usar Claude.",
      503,
      "AI_NOT_CONFIGURED",
    );
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      image,
    );
  if (!match)
    throw new VisionError(
      "La imagen no tiene un formato compatible con Claude.",
      400,
      "INVALID_IMAGE",
    );
  const schema = z.toJSONSchema(analysisSchema);
  delete schema.$schema;
  try {
    const response = await fetch(
      base.toString().replace(/\/$/, "") + "/messages",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(45000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          system: instructions,
          tools: [
            {
              name: "submit_interior_analysis",
              description:
                "Devuelve exclusivamente el análisis estimado de la fotografía interior conforme al contrato.",
              strict: true,
              input_schema: claudeToolSchema(schema),
            },
          ],
          tool_choice: { type: "tool", name: "submit_interior_analysis" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: match[1],
                    data: match[2],
                  },
                },
                {
                  type: "text",
                  text: "Analiza esta imagen y devuelve la distribución interior estimada usando submit_interior_analysis.",
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      const errors: Record<number, string> = {
        401: "Claude rechazó la clave. Revisa ANTHROPIC_API_KEY.",
        403: "La cuenta no tiene permiso para usar Claude o el modelo configurado.",
        400: "Claude rechazó la petición. Revisa el saldo, AI_MODEL y el formato de la imagen.",
        404: "El modelo de Claude no está disponible. Revisa AI_MODEL.",
        429: "Claude alcanzó el límite o cuota de la cuenta. Intenta más tarde.",
        529: "Claude está temporalmente sobrecargado. Intenta más tarde.",
      };
      throw new VisionError(
        errors[response.status] || "Claude no está disponible en este momento.",
        response.status === 429 ? 429 : 502,
        "PROVIDER_ERROR",
      );
    }
    const raw = await readBoundedJson(response, 256000).catch((error) => {
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        throw error;
      throw new VisionError(
        "Claude devolvió una respuesta inválida o demasiado grande.",
        502,
        "INVALID_ANALYSIS",
      );
    });
    const envelope = z
      .object({
        stop_reason: z.string().nullable(),
        content: z.array(
          z.object({
            type: z.string(),
            name: z.string().optional(),
            input: z.unknown().optional(),
          }),
        ),
      })
      .safeParse(raw);
    if (!envelope.success)
      throw new VisionError(
        "La respuesta de Claude está incompleta o no cumple el contrato.",
        502,
        "INVALID_ANALYSIS",
      );
    if (envelope.data.stop_reason === "refusal")
      throw new VisionError(
        "Claude no pudo analizar esta imagen. Prueba con otra fotografía.",
        422,
        "ANALYSIS_REFUSED",
      );
    if (envelope.data.stop_reason !== "tool_use")
      throw new VisionError(
        "El análisis de Claude quedó incompleto. Tu escena se conserva.",
        502,
        "INCOMPLETE_ANALYSIS",
      );
    const blocks = envelope.data.content.filter(
      (block) =>
        block.type === "tool_use" && block.name === "submit_interior_analysis",
    );
    if (blocks.length !== 1)
      throw new VisionError(
        "Claude no devolvió un único análisis válido.",
        502,
        "INVALID_ANALYSIS",
      );
    const result = analysisSchema.safeParse(blocks[0].input);
    if (!result.success)
      throw new VisionError(
        "El análisis de Claude contiene valores incompletos o fuera de rango. La escena actual se conserva.",
        502,
        "INVALID_ANALYSIS",
      );
    if (!result.data.isInterior)
      throw new VisionError(
        "La imagen no se identificó como un interior. Usa una fotografía clara de una habitación.",
        422,
        "NOT_INTERIOR",
      );
    return result.data;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new VisionError(
        "El análisis de Claude superó 45 segundos. Tu escena se conserva.",
        504,
        "ANALYSIS_TIMEOUT",
      );
    throw new VisionError(
      "No se pudo conectar con Claude. Revisa la conexión HTTPS y AI_BASE_URL.",
      502,
      "PROVIDER_UNAVAILABLE",
    );
  }
}
