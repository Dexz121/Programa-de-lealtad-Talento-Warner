import { createReward, listRewards } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "gestionar_catalogo",
    async () => Response.json({ recompensas: await listRewards() }),
    "No se pudo cargar el catálogo.",
  );
}

export async function POST(request: Request) {
  return withStaff(
    request,
    "gestionar_catalogo",
    async () => Response.json(await createReward(await readJson(request)), { status: 201 }),
    "No se pudo crear la recompensa.",
  );
}
