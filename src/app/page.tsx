import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">Trucs de French</h1>
      <p className="text-xl font-medium text-neutral-700 dark:text-neutral-300">
        Французьке кіно — вивчаємо мову
      </p>
      <p className="text-neutral-600 dark:text-neutral-400">
        Курси на основі фільмів і серіалів та підготовка до DELF.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Увійти
        </Link>
        <Link
          href="/register"
          className="rounded-md border px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Реєстрація
        </Link>
      </div>
    </main>
  );
}
