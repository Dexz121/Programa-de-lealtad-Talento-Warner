import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { SyncBusyError, runSync } from "@/lib/sync-run";

export const maxDuration = 60;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function secretsMatch(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const token = bearerToken(request);

  if (!secret || !token || !secretsMatch(token, secret)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runSync({ origen: "cron" });
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyncBusyError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    console.error(error);
    return Response.json({ error: "No se pudo sincronizar." }, { status: 500 });
  }
}
