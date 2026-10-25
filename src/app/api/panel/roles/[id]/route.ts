import { deleteRole, updateRole } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_roles",
    async () => Response.json(await updateRole(id, await readJson(request))),
    "No se pudo guardar el rol.",
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_roles",
    async () => {
      await deleteRole(id);
      return Response.json({ ok: true });
    },
    "No se pudo eliminar el rol.",
  );
}
