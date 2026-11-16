import { test } from "node:test";
import assert from "node:assert/strict";
import { meshyRequest } from "../lib/meshy";
import { validateGLB, validateModelUrl, downloadModel } from "../lib/model-file";
import { sceneSchema, emptyScene, catalog } from "../lib/scene";
const id = "12345678-1234-4234-8234-123456789abc";
import { fixtureGLB } from "./helpers/model-fixture";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Vector3 } from "three";

test("el cargador real de Three.js abre la malla GLB de prueba con geometría visible", async () => {
  const bytes = new Uint8Array(fixtureGLB());
  const model = await new GLTFLoader().parseAsync(bytes.buffer, "");
  const size = new Box3().setFromObject(model.scene).getSize(new Vector3());
  assert.deepEqual(size.toArray(), [1, 1, 1]);
});
test("GLB y URLs: rechaza referencias remotas, descargas arbitrarias y archivos corruptos", () => {
  validateGLB(fixtureGLB());
  assert.throws(() => validateGLB(Buffer.from("no es GLB")));
  const corrupt = fixtureGLB(); corrupt.writeUInt32LE(1, 8); assert.throws(() => validateGLB(corrupt));
  assert.equal(validateModelUrl("https://assets.meshy.ai/model.glb?sig=test").hostname, "assets.meshy.ai");
  for (const url of ["https://example.org/model.glb", "http://assets.meshy.ai/model.glb", "https://assets.meshy.ai.evil.org/m.glb", "https://user:secret@assets.meshy.ai/m.glb"]) assert.throws(() => validateModelUrl(url));
  const scene = sceneSchema.parse({ ...emptyScene, objects: [{ id: "mesh", kind: "cabinet", meshId: id, name: "Modelo de PRUEBA", ...catalog.cabinet, x: 0, z: 0, rotation: 0 }] });
  assert.equal(scene.objects[0].meshId, id);
});
test("Meshy sin clave se informa sin llamadas ni modelos inventados", async () => {
  const previous = process.env.MESHY_API_KEY; delete process.env.MESHY_API_KEY;
  try { await assert.rejects(() => meshyRequest(id, undefined, async () => { throw new Error("No debe llamar"); }), /MESHY_API_KEY/); }
  finally { if (previous === undefined) delete process.env.MESHY_API_KEY; else process.env.MESHY_API_KEY = previous; }
});
test("descarga validada de GLB no acepta archivos incompletos ni recursos externos", async () => {
  const glb = fixtureGLB();
  assert.deepEqual(await downloadModel("https://assets.meshy.ai/test.glb", async () => new Response(glb)), glb);
  await assert.rejects(() => downloadModel("https://assets.meshy.ai/test.glb", async () => new Response("<html>error</html>")), /GLB/);
  await assert.rejects(() => downloadModel("https://assets.meshy.ai/test.glb", async () => new Response(glb, { headers: { "Content-Length": String(40 * 1024 * 1024) } })), /32 MB/);
});
test("contrato Meshy: creación, progreso y GLB generado (HTTP simulado, NO IA real)", async () => {
  const previous = process.env.MESHY_API_KEY; process.env.MESHY_API_KEY = "test-only";
  try {
    const task = await meshyRequest(undefined, "data:image/png;base64,PRUEBA", async (url, options) => {
      assert.equal(String(url), "https://api.meshy.ai/openapi/v1/image-to-3d"); assert.equal(options?.method, "POST");
      const body = JSON.parse(String(options?.body)); assert.equal(body.image_url, "data:image/png;base64,PRUEBA"); assert.deepEqual(body.target_formats, ["glb"]);
      return Response.json({ result: id });
    });
    assert.equal(task.status, "PENDING");
    assert.equal((await meshyRequest(id, undefined, async () => Response.json({ id, status: "IN_PROGRESS", progress: 42 }))).progress, 42);
    assert.equal((await meshyRequest(id, undefined, async () => Response.json({ id, status: "SUCCEEDED", progress: 100, model_urls: { glb: "https://assets.meshy.ai/test/model.glb" } }))).glb, "https://assets.meshy.ai/test/model.glb");
    await assert.rejects(() => meshyRequest(id, undefined, async () => Response.json({ id, status: "SUCCEEDED", model_urls: {} })), /GLB/);
    await assert.rejects(() => meshyRequest(id, undefined, async () => Response.json({ id, status: "SUCCEEDED", model_urls: { glb: "https://example.org/model.glb" } })), /permitida/);
    await assert.rejects(() => meshyRequest(id, undefined, async () => new Response("", { status: 402 })), /créditos/);
  } finally { if (previous === undefined) delete process.env.MESHY_API_KEY; else process.env.MESHY_API_KEY = previous; }
});
