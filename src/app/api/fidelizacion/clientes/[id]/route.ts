import { fidelizacionCliente } from "@/lib/fidelizacion-read";
import { authorizeEvaluation, corsHeaders, json, options } from "@/lib/evaluation-api";

export function OPTIONS() {
  return options();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await authorizeEvaluation(request);
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const cliente = await fidelizacionCliente(id);
  if (!cliente) {
    return json({ error: "No encontrado" }, 404);
  }

  return Response.json(cliente, { headers: corsHeaders });
}
