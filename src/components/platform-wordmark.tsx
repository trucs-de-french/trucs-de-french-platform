// Стилізована назва платформи — фінальний варіант після кількох ітерацій
// (замінює попередній Montserrat-капс Indigo-950/Cyan-500 — той факт, що
// цей файл раніше НЕ підключав Montserrat узагалі (лише успадковував Geist
// Sans сайту, без text-transform), був виправлений одночасно з цим
// переходом, а не раніше).
//
// Суть фінального рішення — єдиний колір (indigo-900/#312e81) на "TRUCS" і
// "d'French" замість двох різних відтінків раніше; апостроф лишається
// окремим кольором (cyan-500) з тим самим glow/scale на hover.
//
// Два шрифти (Montserrat 800, Cormorant Garamond italic 500) підключені в
// кореневому layout.tsx як --font-montserrat/--font-cormorant, зареєстровані
// тут-таки в globals.css як --font-brand-sans/--font-brand-serif — окрема
// пара змінних, свідомо не --font-heading (Nunito): вордмарк — фіксована
// латинська назва бренду, не має підлаштовуватись під заміну шрифтів
// решти інтерфейсу.
//
// Розміри — точні px з дизайну (28/34 — це "lg", дефолтний розмір),
// sm/xl масштабовані з тим самим співвідношенням, що мали текстові
// Tailwind-розміри в попередній версії (sm/lg = 0.75, xl/lg = 1.5).
const SIZES = {
  sm: { trucs: "text-[21px]", french: "text-[26px]" },
  lg: { trucs: "text-[28px]", french: "text-[34px]" },
  xl: { trucs: "text-[42px]", french: "text-[51px]" },
} as const;

// tone="onDark" — варіант для розміщення на насиченому індиго-фоні, що не
// залежить від теми (кабінет: бокова панель/мобільна шапка завжди на
// indigo-градієнті, не на звичайному панельному фоні) — TRUCS білий,
// d'French кремовий (#fdf8ea), апостроф лишається тим самим teal-акцентом.
// Дефолтний tone і всі наявні використання (дашборд, адмінка, лендінг) не
// змінюються.
export function PlatformWordmark({
  size = "lg",
  tone = "default",
}: {
  size?: keyof typeof SIZES;
  tone?: "default" | "onDark";
}) {
  const { trucs, french } = SIZES[size];
  const trucsColor = tone === "onDark" ? "text-white" : "text-indigo-900 dark:text-indigo-200";
  const frenchColor = tone === "onDark" ? "text-[#fdf8ea]" : "text-indigo-900 dark:text-indigo-200";

  return (
    <span className="group inline-flex items-baseline gap-1">
      <span className={`font-brand-sans font-extrabold uppercase tracking-[0.08em] ${trucs} ${trucsColor}`}>
        Trucs
      </span>
      <span className={`font-brand-serif font-medium italic ${french} ${frenchColor}`}>
        d
        <span className="mx-[1px] font-bold text-cyan-500 transition-all duration-300 ease-out group-hover:text-cyan-400 group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:drop-shadow-[0_0_10px_rgba(6,182,212,0.6)] dark:text-cyan-400">
          &rsquo;
        </span>
        French
      </span>
    </span>
  );
}

// Компактна марка для вузьких місць, де повний вордмарк не влазить
// (collapsed-рейка кабінету, 88px) — золоте коло з літерою T тим самим
// брендовим шрифтом, що TRUCS вище (font-brand-sans).
export function PlatformMark({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f3d98b,#d9b765)] font-brand-sans font-extrabold text-[#1a1640]"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      T
    </span>
  );
}
