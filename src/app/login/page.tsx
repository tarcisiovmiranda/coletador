import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          FISP 2026 · Estande C93B
        </p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900">Coletador</h1>
        <p className="mt-2 text-lg text-slate-600">Digite o seu código pessoal para entrar.</p>
      </div>
      <LoginForm />
    </main>
  );
}
