import { applyRedemptionAction } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";
import { asRecord } from "@/lib/panel-values";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_canjes",
    async () => {
      const body = asRecord(await readJson(request));
      await applyRedemptionAction(id, body.accion);
      return Response.json({ ok: true });
    },
    "No se pudo actualizar el canje.",
  );
}
