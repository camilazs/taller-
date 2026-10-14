import { rpc } from "@/lib/grpc";
import { authorize } from "@/lib/auth";
import { sceneSchema } from "@/lib/scene";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const project = await rpc("GetProject", { id });
    const result = await rpc<{ sceneJson: string }>("GetScene", { id });
    return Response.json({
      project,
      scene: sceneSchema.parse(JSON.parse(result.sceneJson)),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function PUT(req: Request, ctx: Context) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const scene = sceneSchema.parse(await req.json());
    return Response.json(
      await rpc("SaveScene", { id, sceneJson: JSON.stringify(scene) }),
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    authorize(req);
    return Response.json(
      await rpc("DeleteProject", { id: (await ctx.params).id }),
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
