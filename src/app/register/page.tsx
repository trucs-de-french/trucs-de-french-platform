import Link from "next/link";
import { signUp } from "../login/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Реєстрація</h1>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={signUp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            Ім&apos;я
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            className="rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-md border px-3 py-2"
          />
        </div>

        <SubmitButton
          pendingChildren="Реєструю..."
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Зареєструватися
        </SubmitButton>
      </form>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Вже є акаунт?{" "}
        <Link href="/login" className="underline">
          Увійти
        </Link>
      </p>
    </main>
  );
}
