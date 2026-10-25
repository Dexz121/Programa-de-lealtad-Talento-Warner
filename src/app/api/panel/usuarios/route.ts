import { createStaffUser, listStaff } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(request, "gestionar_usuarios", async () => Response.json(await listStaff()), "No se pudo cargar el equipo.");
}

export async function POST(request: Request) {
  return withStaff(
    request,
    "gestionar_usuarios",
    async () => Response.json(await createStaffUser(await readJson(request)), { status: 201 }),
    "No se pudo crear la cuenta.",
  );
}
