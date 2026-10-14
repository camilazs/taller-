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
  const Client = definition().ProjectService;
  const client = new Client(
    process.env.GRPC_ADDRESS || "localhost:50051",
    process.env.GRPC_TLS === "true"
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure(),
  );
  const meta = new grpc.Metadata();
  if (process.env.GRPC_TOKEN)
    meta.set("authorization", `Bearer ${process.env.GRPC_TOKEN}`);
  return new Promise((resolve, reject) => {
    (client[method] as Function)(
      payload,
      meta,
      { deadline: Date.now() + 8000 },
      (error: Error | null, result: T) => {
        client.close();
        if (error) reject(error);
        else resolve(result);
      },
    );
  });
}
