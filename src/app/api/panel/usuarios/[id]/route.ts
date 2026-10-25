import { updateStaffUser } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_usuarios",
    async (staff) => Response.json(await updateStaffUser(staff.uid, id, await readJson(request))),
    "No se pudo actualizar la cuenta.",
  );
}
