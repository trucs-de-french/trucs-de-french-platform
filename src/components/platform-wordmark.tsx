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
// тут-таки в globals.css як --font-brand-sans/--font-brand-serif — той
// самий паттерн, що вже є для --font-heading (Playfair Display).
//
// Розміри — точні px з дизайну (28/34 — це "lg", дефолтний розмір),
// sm/xl масштабовані з тим самим співвідношенням, що мали текстові
// Tailwind-розміри в попередній версії (sm/lg = 0.75, xl/lg = 1.5).
const SIZES = {
  sm: { trucs: "text-[21px]", french: "text-[26px]" },
  lg: { trucs: "text-[28px]", french: "text-[34px]" },
  xl: { trucs: "text-[42px]", french: "text-[51px]" },
} as const;

export function PlatformWordmark({ size = "lg" }: { size?: keyof typeof SIZES }) {
  const { trucs, french } = SIZES[size];

  return (
    <span className="group inline-flex items-baseline gap-1">
      <span
        className={`font-brand-sans font-extrabold uppercase tracking-[0.08em] ${trucs} text-indigo-900 dark:text-indigo-200`}
      >
        Trucs
      </span>
      <span
        className={`font-brand-serif font-medium italic ${french} text-indigo-900 dark:text-indigo-200`}
      >
        d
        <span className="mx-[1px] font-bold text-cyan-500 transition-all duration-300 ease-out group-hover:text-cyan-400 group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:drop-shadow-[0_0_10px_rgba(6,182,212,0.6)] dark:text-cyan-400">
          &rsquo;
        </span>
        French
      </span>
    </span>
  );
}
