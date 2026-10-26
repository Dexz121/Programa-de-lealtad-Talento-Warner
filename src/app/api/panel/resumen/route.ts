import { buildSummary } from "@/lib/panel-loyalty";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "ver_resumen",
    async (staff) => Response.json(await buildSummary(staff.permissions)),
    "No se pudo cargar el resumen.",
  );
}
