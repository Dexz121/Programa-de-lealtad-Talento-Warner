import { withPortal } from "@/lib/portal-route";

export async function GET(request: Request) {
  return withPortal(
    request,
    async (portal) =>
      Response.json({
        uid: portal.uid,
        customerId: portal.customerId,
        nombre: portal.nombre,
        email: portal.email,
        portal: portal.portal,
        mustChangePassword: portal.mustChangePassword,
        nivel: portal.nivel,
        puntos: portal.puntos,
        puntosDisponibles: portal.puntosDisponibles,
      }),
    "No se pudo comprobar la sesión.",
    { allowTemporary: true },
  );
}
