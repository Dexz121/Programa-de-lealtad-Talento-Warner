import { listPortalMovements } from "@/lib/portal-read";
import { withPortal } from "@/lib/portal-route";

export async function GET(request: Request) {
  const limit = new URL(request.url).searchParams.get("limit") === "3" ? 3 : 30;

  return withPortal(
    request,
    async (portal) => Response.json({ movimientos: await listPortalMovements(portal.customerId, limit) }),
    "No se pudieron cargar los movimientos.",
  );
}
