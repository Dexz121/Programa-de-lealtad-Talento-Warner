import { grantPortalAccess } from "@/lib/panel-admin";
import { withStaff } from "@/lib/panel-route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "generar_acceso_portal",
    async () => Response.json(await grantPortalAccess(id)),
    "No se pudo generar el acceso al portal.",
  );
}
