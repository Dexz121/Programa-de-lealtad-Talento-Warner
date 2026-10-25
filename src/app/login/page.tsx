import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Programa de lealtad</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-3 text-zinc-600">
        Entra con el correo y la contraseña del equipo interno.
      </p>
      <LoginForm />
    </main>
  );
}
