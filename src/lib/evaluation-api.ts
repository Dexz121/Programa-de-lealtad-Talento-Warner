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

export function requireEvaluationToken(request: Request) {
  if (!bearerToken(request)) {
    return json({ error: "No autorizado" }, 401);
  }

  return json({ error: "Contrato de fidelización aún no implementado" }, 501);
}
