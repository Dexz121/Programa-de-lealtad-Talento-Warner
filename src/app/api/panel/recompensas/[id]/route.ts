import { updateReward } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_catalogo",
    async () => Response.json(await updateReward(id, await readJson(request))),
    "No se pudo guardar la recompensa.",
  );
}
