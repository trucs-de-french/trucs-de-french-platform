// Спільний рендер "вбудований сторонній контент" — iframe + завжди видимий
// (не опційний, без перемикача вимкнення) резервний варіант, якщо браузер
// заблокував сторонній вміст в iframe (траплялось із Wordwall). Раніше цей
// самий фрагмент був буквально скопійований у трьох місцях (тип завдання
// embed, content-блок сцени embed, заголовок блоку задач embed) — тепер
// одна точка правди. Без "use client" — сам по собі не має стану/обробників,
// однаково працює і в серверних, і в клієнтських батьках.
export function EmbedWithFallback({ url, height }: { url: string; height: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700"
        style={{ height }}
      >
        <iframe src={url} className="h-full w-full" allowFullScreen />
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Якщо вміст не відкривається,{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          перейдіть за посиланням
        </a>
        .
      </p>
    </div>
  );
}
