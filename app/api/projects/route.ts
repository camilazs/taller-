import { rpc } from "@/lib/grpc";
import { authorize } from "@/lib/auth";
import { projectError } from "@/lib/project-error";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    authorize(req);
    return Response.json(await rpc("GetProjects"));
  } catch (e) {
    return projectError(e);
  }
}
export async function POST(req: Request) {
  try {
    authorize(req);
    const body = await req.json();
    return Response.json(await rpc("CreateProject", { name: body.name }));
  } catch (e) {
    return projectError(e);
  }
}
