import { customerDetail } from "@/lib/panel-loyalty";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "buscar_cliente",
    async (staff) => Response.json(await customerDetail(id, staff.permissions)),
    "No se pudo cargar el cliente.",
  );
}
