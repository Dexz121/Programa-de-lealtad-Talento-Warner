import { bearerToken, corsHeaders, options } from "@/lib/evaluation-api";

export function OPTIONS() {
  return options();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!bearerToken(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401, headers: corsHeaders });
  }

  return Response.json(
    { error: "Contrato de fidelización aún no implementado", cliente_id: id },
    { status: 501, headers: corsHeaders },
  );
}
