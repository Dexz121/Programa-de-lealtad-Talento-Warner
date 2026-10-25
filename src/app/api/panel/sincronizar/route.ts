import { listSyncRuns } from "@/lib/panel-admin";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "ejecutar_sincronizacion",
    async () => Response.json({ corridas: await listSyncRuns() }),
    "No se pudo cargar la sincronización.",
  );
}

export async function POST(request: Request) {
  return withStaff(
    request,
    "ejecutar_sincronizacion",
    async () =>
      Response.json({
        ok: false,
        mensaje: "La descarga desde la tienda todavía no está conectada. La corrida diaria sigue protegida en /api/cron/sync.",
      }),
    "No se pudo iniciar la sincronización.",
  );
}
