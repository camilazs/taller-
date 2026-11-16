import * as grpc from "@grpc/grpc-js";
import { definition } from "../lib/grpc";
import {
  sceneSchema,
  emptyScene,
  type Project,
  type Scene,
} from "../lib/scene";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { downloadModel } from "../lib/model-file";
const dir = path.resolve(process.env.DATA_DIR || "data");
const file = (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw Object.assign(new Error("ID inválido"), {
      code: grpc.status.INVALID_ARGUMENT,
    });
  return path.join(dir, id + ".json");
};
type Stored = { project: Project; scene: Scene };
async function read(id: string): Promise<Stored> {
  try {
    return JSON.parse(await readFile(file(id), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw Object.assign(new Error("Proyecto no encontrado"), {
        code: grpc.status.NOT_FOUND,
      });
    throw e;
  }
}
async function persist(data: Stored) {
  await mkdir(dir, { recursive: true });
  const dest = file(data.project.id);
  const temp = dest + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(data), "utf8");
  await rename(temp, dest);
}
const server = new grpc.Server({
  "grpc.max_receive_message_length": 1024 * 1024,
  "grpc.max_send_message_length": 34 * 1024 * 1024,
});
const modelFile = (id: string) => {
  file(id);
  return path.join(dir, "models", id + ".glb");
};
const modelWrites = new Map<string, Promise<object>>();
const handlers: Record<string, (request: any) => Promise<object>> = {
  async StoreModelAsset(r) {
    const dest = modelFile(r.id);
    try { const bytes = await readFile(dest); return { id: r.id, size: bytes.length }; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    if (modelWrites.has(r.id)) return modelWrites.get(r.id)!;
    const operation = (async () => {
      const bytes = await downloadModel(r.url);
      await mkdir(path.dirname(dest), { recursive: true });
      const temp = dest + "." + randomUUID() + ".tmp";
      await writeFile(temp, bytes); await rename(temp, dest);
      return { id: r.id, size: bytes.length };
    })();
    modelWrites.set(r.id, operation);
    try { return await operation; } finally { modelWrites.delete(r.id); }
  },
  async GetModelAsset(r) {
    try { const source = modelFile(r.id); if (r.metadataOnly) return { id: r.id, size: (await stat(source)).size, content: Buffer.alloc(0) }; const bytes = await readFile(source); return { id: r.id, size: bytes.length, content: bytes }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") throw Object.assign(new Error("Modelo no encontrado"), { code: grpc.status.NOT_FOUND }); throw e; }
  },
  async CreateProject(r) {
    const name = String(r.name || "").trim();
    if (!name || name.length > 100)
      throw new Error("Nombre requerido (máximo 100 caracteres)");
    const now = new Date().toISOString();
    const project = { id: randomUUID(), name, createdAt: now, updatedAt: now };
    await persist({ project, scene: emptyScene });
    return project;
  },
  async GetProjects() {
    await mkdir(dir, { recursive: true });
    const names = await readdir(dir);
    const projects = await Promise.all(
      names
        .filter((n) => n.endsWith(".json"))
        .map(async (n) => (await read(n.slice(0, -5))).project),
    );
    return {
      projects: projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  },
  async GetProject(r) {
    return (await read(r.id)).project;
  },
  async SaveScene(r) {
    const scene = sceneSchema.parse(JSON.parse(r.sceneJson));
    const data = await read(r.id);
    data.scene = scene;
    data.project.updatedAt = new Date().toISOString();
    await persist(data);
    return { id: r.id, sceneJson: JSON.stringify(scene) };
  },
  async GetScene(r) {
    return { id: r.id, sceneJson: JSON.stringify((await read(r.id)).scene) };
  },
  async DeleteProject(r) {
    await read(r.id);
    await unlink(file(r.id));
    return {};
  },
};
server.addService(
  definition().ProjectService.service,
  Object.fromEntries(
    Object.entries(handlers).map(([name, handler]) => [
      name,
      async (
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>,
      ) => {
        try {
          const expected = process.env.GRPC_TOKEN;
          const actual = String(call.metadata.get("authorization")[0] || "");
          if (
            expected &&
            (Buffer.byteLength(actual) !==
              Buffer.byteLength("Bearer " + expected) ||
              !timingSafeEqual(
                Buffer.from(actual),
                Buffer.from("Bearer " + expected),
              ))
          )
            return callback({
              code: grpc.status.UNAUTHENTICATED,
              message: "Token inválido",
            });
          callback(null, await handler(call.request));
        } catch (e) {
          callback({
            code:
              typeof (e as any).code === "number"
                ? (e as any).code
                : grpc.status.INVALID_ARGUMENT,
            message: (e as Error).message,
          });
        }
      },
    ]),
  ),
);
async function main() {
  const cert = process.env.GRPC_CERT_PATH,
    key = process.env.GRPC_KEY_PATH;
  const credentials =
    cert && key
      ? grpc.ServerCredentials.createSsl(
          null,
          [
            {
              cert_chain: await readFile(cert),
              private_key: await readFile(key),
            },
          ],
          false,
        )
      : grpc.ServerCredentials.createInsecure();
  server.bindAsync(
    process.env.GRPC_BIND || "127.0.0.1:50051",
    credentials,
    (err, port) => {
      if (err) throw err;
      console.log(`SpaceAI gRPC escuchando en ${port}`);
    },
  );
}
process.on("SIGTERM", () => server.tryShutdown(() => process.exit(0)));
process.on("SIGINT", () => server.tryShutdown(() => process.exit(0)));
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
