import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Programa de lealtad</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-3 text-zinc-600">
        El acceso con Firebase Auth se conecta en la siguiente fase. Esta pantalla todavía no envía el formulario.
      </p>
      <form className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Correo
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-normal text-zinc-900"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="correo@ejemplo.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contraseña
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-normal text-zinc-900"
            type="password"
            name="password"
            autoComplete="current-password"
          />
        </label>
        <button
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          type="button"
        >
          Entrar
        </button>
      </form>
      <nav className="mt-8 flex gap-4 text-sm">
        <Link className="underline" href="/panel">
          Panel
        </Link>
        <Link className="underline" href="/portal">
          Portal
        </Link>
      </nav>
    </main>
  );
}
