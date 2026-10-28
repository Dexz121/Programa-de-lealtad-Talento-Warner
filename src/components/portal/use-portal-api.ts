"use client";

import { FirebaseError } from "firebase/app";

export {
  isUnauthorized,
  panelErrorMessage as portalErrorMessage,
  panelFetch as portalFetch,
  PanelError,
} from "@/components/panel/use-panel-api";

export function portalAuthMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "No se pudo iniciar sesión.";
  }

  if (
    error.code === "auth/invalid-credential" ||
    error.code === "auth/wrong-password" ||
    error.code === "auth/user-not-found" ||
    error.code === "auth/invalid-email"
  ) {
    return "Correo o contraseña incorrectos.";
  }

  if (error.code === "auth/too-many-requests") {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }

  if (error.code === "auth/operation-not-allowed" || error.code === "auth/configuration-not-found") {
    return "El acceso con correo y contraseña no está activo en Firebase.";
  }

  if (error.code === "auth/requires-recent-login") {
    return "Vuelve a entrar y después cambia la contraseña.";
  }

  return "No se pudo iniciar sesión.";
}
