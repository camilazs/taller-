import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SpaceAI 3D · Diseña tu espacio",
  description:
    "Organizador de interiores 3D con análisis de fotografías y persistencia gRPC.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
