import { withStaff } from "@/lib/panel-route";

export async function GET(request: Request) {
  return withStaff(
    request,
    undefined,
    async (staff) =>
      Response.json({
        email: staff.email,
        displayName: staff.displayName,
        roleId: staff.roleId,
        roleName: staff.roleName,
        permissions: staff.permissions,
      }),
    "No se pudo comprobar la sesión.",
  );
}
