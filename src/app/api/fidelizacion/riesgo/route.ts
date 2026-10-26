import { authorizeEvaluation, json, options } from "@/lib/evaluation-api";
import { fidelizacionRiesgo } from "@/lib/fidelizacion-read";

export function OPTIONS() {
  return options();
}

export async function GET(request: Request) {
  const denied = await authorizeEvaluation(request);
  if (denied) {
    return denied;
  }

  return json(await fidelizacionRiesgo(), 200);
}
