import Link from "next/link";
import { PortalLoginForm } from "@/components/portal/login-form";

export default function PortalLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Programa de lealtad</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Portal del cliente</h1>
      <p className="mt-3 text-zinc-600">Entra con el correo y la contraseña que te dio la tienda.</p>
      <PortalLoginForm />
      <nav className="mt-8 text-sm">
        <Link className="underline" href="/login">
          Acceso del equipo
        </Link>
      </nav>
    </main>
  );
}
