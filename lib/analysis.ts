import { z } from "zod";
import { kinds, sceneSchema, type Scene } from "./scene";

const dimension = z.number().finite().min(0.1).max(30);
export const analysisSchema = z.strictObject({
  isInterior: z.boolean(),
  roomType: z.string().min(1).max(80),
  summary: z.string().min(1).max(1200),
  room: z.strictObject({
    width: z.number().finite().min(0.5).max(30),
    depth: z.number().finite().min(0.5).max(30),
    height: z.number().finite().min(0.5).max(30),
    floorVisible: z.boolean(),
    visibleWallCount: z.number().int().min(0).max(4),
  }),
  objects: z
    .array(
      z.union([
        z.strictObject({
          label: z.string().min(1).max(100),
          kind: z.enum(kinds),
          u: z.number().finite().min(0).max(1),
          v: z.number().finite().min(0).max(1),
          rotation: z.number().finite().min(-360).max(360),
          width: dimension,
          depth: dimension,
          height: dimension,
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          confidence: z.enum(["low", "medium", "high"]),
        }),
        // Thin unsupported objects (e.g. a picture frame) are observations, not scene meshes.
        z.strictObject({
          label: z.string().min(1).max(100),
          kind: z.literal("unsupported"),
          u: z.number().finite().min(0).max(1),
          v: z.number().finite().min(0).max(1),
          rotation: z.number().finite().min(-360).max(360),
          width: z.number().finite().min(0.001).max(30),
          depth: z.number().finite().min(0.001).max(30),
          height: z.number().finite().min(0.001).max(30),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          confidence: z.enum(["low", "medium", "high"]),
        }),
      ]),
    )
    .max(60),
  warnings: z.array(z.string().min(1).max(300)).max(12),
});
export type Analysis = z.infer<typeof analysisSchema>;

export function analysisToScene(
  input: unknown,
  excluded: number[] = [],
): { scene: Scene; warnings: string[] } {
  const analysis = analysisSchema.parse(input);
  if (!analysis.isInterior)
    throw new Error("La imagen no se identificó como un espacio interior.");
  const { width, depth, height } = analysis.room;
  const warnings = [...analysis.warnings];
  const objects: Scene["objects"] = [];
  analysis.objects.forEach((object, index) => {
    if (object.kind === "unsupported") {
      warnings.push(`${object.label}: sin modelo compatible; no se generó.`);
      return;
    }
    if (excluded.includes(index)) return;
    const radians = (object.rotation * Math.PI) / 180;
    const halfX =
      (Math.abs(Math.cos(radians)) * object.width +
        Math.abs(Math.sin(radians)) * object.depth) /
      2;
    const halfZ =
      (Math.abs(Math.sin(radians)) * object.width +
        Math.abs(Math.cos(radians)) * object.depth) /
      2;
    if (halfX * 2 > width || halfZ * 2 > depth || object.height > height)
      warnings.push(
        `${object.label}: sus dimensiones superan la habitación; revisa su tamaño en el editor.`,
      );
    objects.push({
      id: `detected-${index + 1}`,
      kind: object.kind,
      x: Number(
        ((object.u * 2 - 1) * Math.max(0, width / 2 - halfX)).toFixed(3),
      ),
      z: Number(
        ((object.v * 2 - 1) * Math.max(0, depth / 2 - halfZ)).toFixed(3),
      ),
      rotation: object.rotation,
      width: object.width,
      depth: object.depth,
      height: object.height,
      color: object.color,
    });
  });
  return {
    scene: sceneSchema.parse({
      roomType: analysis.roomType,
      width,
      depth,
      height,
      objects,
    }),
    warnings,
  };
}
