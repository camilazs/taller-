export class VisionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function readBoundedJson(
  response: Request | Response,
  limit: number,
): Promise<unknown> {
  if (Number(response.headers.get("content-length") || 0) > limit)
    throw new VisionError(
      "El contenido supera el tamaño permitido.",
      413,
      "PAYLOAD_TOO_LARGE",
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new VisionError(
      "No se recibió contenido JSON.",
      400,
      "INVALID_INPUT",
    );
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new VisionError(
          "El contenido supera el tamaño permitido.",
          413,
          "PAYLOAD_TOO_LARGE",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new VisionError("Se recibió JSON inválido.", 400, "INVALID_JSON");
  }
}
