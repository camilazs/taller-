import { z } from "zod";
const dimension = z.number().finite().min(0.1).max(30);
export const kinds = [
  "bed",
  "table",
  "chair",
  "sofa",
  "cabinet",
  "plant",
] as const;
export const sceneSchema = z.object({
  roomType: z.string().max(80),
  width: dimension,
  depth: dimension,
  height: dimension,
  objects: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        kind: z.enum(kinds),
        x: z.number().finite().min(-30).max(30),
        z: z.number().finite().min(-30).max(30),
        rotation: z.number().finite().min(-360).max(360),
        width: dimension,
        depth: dimension,
        height: dimension,
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(100),
});
export type Scene = z.infer<typeof sceneSchema>;
export type Furniture = Scene["objects"][number];
export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
export const emptyScene: Scene = {
  roomType: "Habitación",
  width: 6,
  depth: 5,
  height: 2.8,
  objects: [],
};
export const catalog: Record<
  Furniture["kind"],
  { label: string; width: number; depth: number; height: number; color: string }
> = {
  bed: {
    label: "Cama",
    width: 1.6,
    depth: 2.1,
    height: 0.65,
    color: "#ddd4c4",
  },
  table: {
    label: "Mesa",
    width: 1.5,
    depth: 0.9,
    height: 0.8,
    color: "#b88a5b",
  },
  chair: {
    label: "Silla",
    width: 0.55,
    depth: 0.55,
    height: 0.9,
    color: "#c59d72",
  },
  sofa: {
    label: "Sofá",
    width: 2.2,
    depth: 0.9,
    height: 0.85,
    color: "#7c9186",
  },
  cabinet: {
    label: "Armario",
    width: 1.5,
    depth: 0.6,
    height: 2,
    color: "#a9815c",
  },
  plant: {
    label: "Planta",
    width: 0.5,
    depth: 0.5,
    height: 1.1,
    color: "#608568",
  },
};
