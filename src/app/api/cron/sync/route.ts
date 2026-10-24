import { timingSafeEqual } from "node:crypto";

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
  const secret = process.env.CRON_SECRET;
  const token = bearerToken(request);

  if (!secret || !token || !secretsMatch(token, secret)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  return Response.json({
    ok: true,
    sincronizado: false,
    mensaje: "La corrida aún no sincroniza datos.",
  });
}
