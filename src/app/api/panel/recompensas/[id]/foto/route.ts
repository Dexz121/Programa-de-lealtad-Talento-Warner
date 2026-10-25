import { uploadRewardPhoto } from "@/lib/panel-admin";
import { PanelActionError } from "@/lib/panel-auth";
import { withStaff } from "@/lib/panel-route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return withStaff(
    request,
    "gestionar_catalogo",
    async () => {
      const form = await request.formData();
      const file = form.get("foto");
      if (!(file instanceof File)) {
        throw new PanelActionError("Selecciona una foto.", 400);
      }

      return Response.json(await uploadRewardPhoto(id, file));
    },
    "No se pudo subir la foto.",
  );
}
