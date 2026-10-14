import { timingSafeEqual } from "node:crypto";
export function authorize(request: Request) {
  const expected = process.env.APP_PASSWORD;
  if (process.env.NODE_ENV === "production" && !expected)
    throw new Error("Configura APP_PASSWORD para proteger la aplicación");
  if (expected) {
    const actual = request.headers.get("x-app-password") || "";
    if (
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new Error("Acceso denegado: revisa la contraseña");
  }
}
