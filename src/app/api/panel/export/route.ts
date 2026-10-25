import { birthdayCsv, customersCsv, riskCsv } from "@/lib/panel-loyalty";
import { withStaff } from "@/lib/panel-route";

function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  return withStaff(
    request,
    "exportar_reportes",
    async (staff) => {
      const tipo = new URL(request.url).searchParams.get("tipo");

      if (tipo === "clientes") {
        return csvResponse("clientes.csv", await customersCsv(staff.permissions));
      }

      if (tipo === "riesgo") {
        if (!staff.permissions.includes("ver_riesgo_cumpleanos")) {
          return Response.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
        }

        return csvResponse("riesgo.csv", await riskCsv());
      }

      if (tipo === "cumpleanos") {
        if (!staff.permissions.includes("ver_riesgo_cumpleanos")) {
          return Response.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
        }

        return csvResponse("cumpleanos.csv", await birthdayCsv());
      }

      return Response.json({ error: "El reporte no existe." }, { status: 400 });
    },
    "No se pudo exportar el reporte.",
  );
}
