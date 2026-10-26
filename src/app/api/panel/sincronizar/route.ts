import { PanelActionError } from "@/lib/panel-auth";
import { listSyncRuns } from "@/lib/panel-admin";
import { withStaff } from "@/lib/panel-route";
import { SyncBusyError, runSync } from "@/lib/sync-run";

export const maxDuration = 60;

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
    async (staff) => {
      try {
        return Response.json(await runSync({ origen: "manual", actor: staff.uid }));
      } catch (error) {
        if (error instanceof SyncBusyError) {
          throw new PanelActionError(error.message, 409);
        }

        if (error instanceof Error && error.message.length > 0 && error.message.length < 240) {
          throw new PanelActionError(error.message, 502);
        }

        throw error;
      }
    },
    "No se pudo sincronizar con la tienda.",
  );
}
