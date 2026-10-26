import { createToken, listTokens } from "@/lib/panel-admin";
import { readJson, withStaff } from "@/lib/panel-route";
import { asRecord, asText } from "@/lib/panel-values";

export async function GET(request: Request) {
  return withStaff(
    request,
    "gestionar_tokens",
    async () => Response.json({ tokens: await listTokens() }),
    "No se pudo cargar los tokens.",
  );
}

export async function POST(request: Request) {
  return withStaff(
    request,
    "gestionar_tokens",
    async (staff) => {
      const body = asRecord(await readJson(request));
      return Response.json(await createToken(asText(body.name), staff.uid), { status: 201 });
    },
    "No se pudo crear el token.",
  );
}
