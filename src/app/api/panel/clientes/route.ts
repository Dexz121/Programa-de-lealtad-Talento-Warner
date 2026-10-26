import { searchCustomers } from "@/lib/panel-loyalty";
import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    "buscar_cliente",
    async (staff) => {
      const query = new URL(request.url).searchParams.get("q") ?? "";
      return Response.json(await searchCustomers(query, staff.permissions));
    },
    "No se pudo buscar clientes.",
  );
}
