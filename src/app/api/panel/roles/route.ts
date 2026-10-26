import { createRole, listRoles } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "gestionar_roles",
    async () => Response.json({ roles: await listRoles() }),
    "No se pudo cargar los roles.",
  );
}

export async function POST(request: Request) {
  return withStaff(
    request,
    "gestionar_roles",
    async () => Response.json(await createRole(await readJson(request)), { status: 201 }),
    "No se pudo crear el rol.",
  );
}
