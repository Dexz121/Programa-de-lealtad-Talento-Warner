import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { readJson, withPortal } from "@/lib/portal-route";
import { invalidateReads } from "@/lib/read-cache";

export async function POST(request: Request) {
  return withPortal(
    request,
    async (portal) => {
      const body = await readJson(request);
      const password =
        body && typeof body === "object" && "password" in body && typeof body.password === "string"
          ? body.password
          : "";

      if (password.length < 8) {
        return Response.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
      }

      try {
        await getAdminAuth().updateUser(portal.uid, { password });
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (code === "auth/invalid-password" || code === "auth/weak-password") {
          return Response.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
        }

        throw error;
      }
      await getAdminDb().collection("customers").doc(portal.customerId).set(
        {
          portalStatus: "activo",
          mustChangePassword: false,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      invalidateReads(`portal:session:${portal.uid}:`);

      return Response.json({ ok: true });
    },
    "No se pudo cambiar la contraseña.",
    { allowTemporary: true },
  );
}
