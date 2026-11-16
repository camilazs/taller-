export const MAX_MODEL_BYTES = 32 * 1024 * 1024;
export function validateModelUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "assets.meshy.ai" || url.port || url.username || url.password) throw new Error("URL de modelo no permitida.");
  return url;
}
export function validateGLB(bytes: Buffer) {
  if (bytes.length < 24 || bytes.length > MAX_MODEL_BYTES || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error("El proveedor no devolvió un GLB 2 válido o supera 32 MB.");
  const jsonLength = bytes.readUInt32LE(12);
  if (jsonLength > bytes.length - 20) throw new Error("GLB incompleto.");
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength).trim());
  if (gltf.asset?.version !== "2.0" || !Array.isArray(gltf.meshes) || !gltf.meshes.length) throw new Error("El archivo no contiene mallas 3D.");
  // El archivo persistido debe ser autosuficiente; el navegador no carga dependencias remotas.
  for (const item of [...(gltf.buffers || []), ...(gltf.images || [])]) if (item.uri && !/^data:/.test(item.uri)) throw new Error("El GLB contiene recursos externos; se requiere un modelo integrado.");
}
export async function downloadModel(value: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(validateModelUrl(value), { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("No se pudo descargar el modelo generado.");
  if (Number(response.headers.get("content-length")) > MAX_MODEL_BYTES) { await response.body.cancel(); throw new Error("El modelo supera 32 MB."); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > MAX_MODEL_BYTES) { await reader.cancel(); throw new Error("El modelo supera 32 MB."); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks); validateGLB(bytes); return bytes;
}
