import { listPortalCatalog } from "@/lib/portal-read";
import { withPortal } from "@/lib/portal-route";

export async function GET(request: Request) {
  return withPortal(
    request,
    async () => Response.json({ recompensas: await listPortalCatalog() }),
    "No se pudo cargar el catálogo.",
  );
}
