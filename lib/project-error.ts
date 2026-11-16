import { AccessError } from "./auth";
export function projectError(error: unknown) {
  if (error instanceof AccessError)
    return Response.json({ error: error.message }, { status: error.status });
  const code = (error as { code?: number })?.code;
  if (code === 14 || code === 4)
    return Response.json(
      {
        error:
          "No se pudo conectar con el backend gRPC. Revisa GRPC_ADDRESS, GRPC_TLS y que el servidor esté desplegado y activo.",
      },
      { status: code === 4 ? 504 : 503 },
    );
  if (code === 16)
    return Response.json(
      {
        error:
          "El backend gRPC rechazó el token. GRPC_TOKEN debe coincidir en Vercel y en el backend.",
      },
      { status: 502 },
    );
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo procesar la operación.";
  return Response.json(
    { error: message },
    {
      status:
        code === 5 ? 404 : message.startsWith("Falta GRPC_ADDRESS") ? 503 : 400,
    },
  );
}
