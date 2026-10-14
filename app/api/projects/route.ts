import { rpc } from "@/lib/grpc";
import { authorize } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    authorize(req);
    return Response.json(await rpc("GetProjects"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
export async function POST(req: Request) {
  try {
    authorize(req);
    const body = await req.json();
    return Response.json(await rpc("CreateProject", { name: body.name }));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
