import { redeemReward } from "@/lib/portal-redeem";
import { listPortalRedemptions } from "@/lib/portal-read";
import { readJson, withPortal } from "@/lib/portal-route";

export async function GET(request: Request) {
  return withPortal(
    request,
    async (portal) => Response.json({ canjes: await listPortalRedemptions(portal.customerId) }),
    "No se pudieron cargar los canjes.",
  );
}

export async function POST(request: Request) {
  return withPortal(
    request,
    async (portal) => {
      const body = await readJson(request);
      const rewardId =
        body && typeof body === "object" && "rewardId" in body && typeof body.rewardId === "string"
          ? body.rewardId.trim()
          : "";

      if (!rewardId) {
        return Response.json({ error: "Elige una recompensa." }, { status: 400 });
      }

      return Response.json(await redeemReward(portal, rewardId));
    },
    "No se pudo registrar el canje.",
  );
}
