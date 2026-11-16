import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SpaceAI 3D · Diseña tu espacio",
  description:
    "Organizador de espacios 3D: captura una fotografía, analízala con IA y genera una escena editable para distribuir tus muebles.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
