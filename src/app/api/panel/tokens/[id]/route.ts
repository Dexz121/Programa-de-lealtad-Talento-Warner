import { revokeToken } from "@/lib/panel-admin";
import { withStaff } from "@/lib/panel-route";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_tokens",
    async () => {
      await revokeToken(id);
      return Response.json({ ok: true });
    },
    "No se pudo revocar el token.",
  );
}
