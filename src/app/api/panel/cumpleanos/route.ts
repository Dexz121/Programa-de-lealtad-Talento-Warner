import { birthdayList } from "@/lib/panel-loyalty";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "ver_riesgo_cumpleanos",
    async () => Response.json({ clientes: await birthdayList() }),
    "No se pudo cargar los cumpleaños.",
  );
}
