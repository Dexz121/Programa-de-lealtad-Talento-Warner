import { listRedemptions } from "@/lib/panel-admin";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "gestionar_canjes",
    async () => Response.json({ canjes: await listRedemptions() }),
    "No se pudo cargar los canjes.",
  );
}
