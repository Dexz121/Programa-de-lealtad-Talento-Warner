import "server-only";

import { createHash } from "node:crypto";
import { connection } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}

export function options() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function authorizeEvaluation(request: Request) {
  await connection();
  const token = bearerToken(request);
  if (!token) {
    return json({ error: "No autorizado" }, 401);
  }

  const hash = createHash("sha256").update(token).digest("hex");
  const snap = await getAdminDb().collection("apiTokens").where("hash", "==", hash).limit(1).get();
  const match = snap.docs[0];
  if (!match || match.data().revoked === true) {
    return json({ error: "No autorizado" }, 401);
  }

  return null;
}
