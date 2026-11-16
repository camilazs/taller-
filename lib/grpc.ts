import * as grpc from "@grpc/grpc-js";
import * as loader from "@grpc/proto-loader";
import path from "node:path";
export function definition() {
  return grpc.loadPackageDefinition(
    loader.loadSync(path.join(process.cwd(), "proto/space.proto"), {
      keepCase: true,
      defaults: true,
      oneofs: true,
    }),
  ).spaceai as unknown as { ProjectService: grpc.ServiceClientConstructor };
}
export async function rpc<T>(method: string, payload: object = {}): Promise<T> {
  if (process.env.VERCEL && !process.env.GRPC_ADDRESS) {
    throw new Error(
      "Falta GRPC_ADDRESS en Vercel. Despliega el backend gRPC por separado y configura su hostname:puerto; localhost no apunta a tu computador desde Vercel.",
    );
  }
  const Client = definition().ProjectService;
  const client = new Client(
    process.env.GRPC_ADDRESS || "localhost:50051",
    process.env.GRPC_TLS === "true"
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure(),
    { "grpc.max_receive_message_length": 34 * 1024 * 1024 },
  );
  const meta = new grpc.Metadata();
  if (process.env.GRPC_TOKEN)
    meta.set("authorization", `Bearer ${process.env.GRPC_TOKEN}`);
  return new Promise((resolve, reject) => {
    (client[method] as Function)(
      payload,
      meta,
      { deadline: Date.now() + (method === "StoreModelAsset" ? 40000 : method === "GetModelAsset" && !(payload as { metadataOnly?: boolean }).metadataOnly ? 30000 : 8000) },
      (error: Error | null, result: T) => {
        client.close();
        if (error) reject(error);
        else resolve(result);
      },
    );
  });
}
