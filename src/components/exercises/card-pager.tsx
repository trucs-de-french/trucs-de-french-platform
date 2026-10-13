"use client";

// Пейджер "‹ 1 2 3 … ›" під сіткою flip-карток — немає готового спільного
// пейджера в проєкті (перевірено: інші вправи навігують блоками питань, не
// нумерованими сторінками), тож цей невеликий компонент новий, локальний
// для flip-cards.tsx. page/onPageChange — 0-індексовані, підписи користувачу
// (aria-label "Сторінка N", номери на кнопках) — 1-індексовані.
function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages = new Set<number>([0, total - 1, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev: number | null = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

const PAGE_BUTTON_BASE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40";
const PAGE_BUTTON_ACTIVE = "bg-[#4f46e5] text-white";
const PAGE_BUTTON_INACTIVE = "border border-[#dcdaea] bg-white text-[#4f46e5] hover:bg-neutral-50";

export function CardPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Сторінки карток" className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        aria-label="Попередня сторінка"
        className={`${PAGE_BUTTON_BASE} ${PAGE_BUTTON_INACTIVE}`}
      >
        ‹
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-neutral-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Сторінка ${p + 1}`}
            aria-current={p === page ? "page" : undefined}
            className={`${PAGE_BUTTON_BASE} ${p === page ? PAGE_BUTTON_ACTIVE : PAGE_BUTTON_INACTIVE}`}
          >
            {p + 1}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages - 1}
        aria-label="Наступна сторінка"
        className={`${PAGE_BUTTON_BASE} ${PAGE_BUTTON_INACTIVE}`}
      >
        ›
      </button>
    </nav>
  );
}
