import "server-only";

import type { PanelSession } from "@/domain/panel";
import type { PermissionId } from "@/domain/permissions";
import { PanelActionError, requireStaff } from "@/lib/panel-auth";

type StaffActor = PanelSession & { uid: string };

export async function withStaff(
  request: Request,
  permission: PermissionId | undefined,
  action: (staff: StaffActor) => Promise<Response>,
  fallback: string,
) {
  try {
    const auth = await requireStaff(request, permission);
    if ("response" in auth) {
      return auth.response;
    }

    return await action(auth.staff);
  } catch (error) {
    if (error instanceof PanelActionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error(error);
    return Response.json({ error: fallback }, { status: 500 });
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
