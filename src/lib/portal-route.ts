import "server-only";

import type { PortalSession } from "@/domain/panel";
import { PanelActionError, requirePortal } from "@/lib/panel-auth";

export async function withPortal(
  request: Request,
  action: (portal: PortalSession) => Promise<Response>,
  fallback: string,
  options?: { allowTemporary?: boolean },
) {
  try {
    const auth = await requirePortal(request, options);
    if ("response" in auth) {
      return auth.response;
    }

    return await action(auth.portal);
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
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
