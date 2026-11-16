import { timingSafeEqual } from "node:crypto";
export class AccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function authorize(request: Request) {
  const expected = process.env.APP_PASSWORD;
  if (process.env.NODE_ENV === "production" && !expected)
    throw new AccessError(
      "Falta APP_PASSWORD en las variables de Vercel. Configúrala y vuelve a desplegar; después ingresa esa contraseña en Acceso al estudio.",
      503,
    );
  if (expected) {
    const actual = request.headers.get("x-app-password") || "";
    if (
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new AccessError(
        "Acceso denegado: ingresa la contraseña APP_PASSWORD en Acceso al estudio.",
        401,
      );
  }
}
