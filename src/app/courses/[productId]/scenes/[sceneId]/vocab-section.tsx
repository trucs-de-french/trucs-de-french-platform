"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem, PartOfSpeech } from "@/lib/vocab";
import { firstVocabVariant, groupVocabByPartOfSpeech } from "@/lib/vocab";
import {
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
} from "@/lib/vocab-categories";
import { pluralizeWords } from "@/lib/pluralize-words";
import { STUDENT_TOGGLE_HEADER_BUTTON } from "@/lib/button-styles";
import { STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import { H2_TO_CONTENT } from "@/lib/spacing";
import { EXERCISE_BLOCK_SURFACE_CLASS } from "@/components/task-card-style";
import { SectionHeaderBar, SCENE_CARD_CLASS } from "@/components/scene-header-bar";

// Той самий RGB (0-1 на канал), що вже живе в PART_OF_SPEECH_COLORS (dot
// класи/pdf), переведений у 0-255 для CSS (hex/rgba) — жодних нових
// кольорів категорій тут не з'являється, лише похідні відтінки нижче.
function toRgb255(rgb: [number, number, number]): [number, number, number] {
  return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// WCAG relative luminance — той самий підхід, що scene-background-mode.ts
// (окремий, невеликий дублікат тут: той файл не експортує цю функцію, а
// зачіпати його поза списком дозволених файлів задача не дозволяє).
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Темнішає колір категорії (крок -18% яскравості на канал, до 6 кроків),
// поки контраст із білим не досягне 4.5:1 — для надто світлих категорій
// (adjectif/зелений і т.п.) даємо темнішу пігулку/текст замість того, щоб
// міняти колір тексту (простіший варіант, дозволений умовою задачі).
function darkenUntilContrast(rgb: [number, number, number], minRatio: number): [number, number, number] {
  let current = rgb;
  for (let i = 0; i < 6; i++) {
    if (contrastRatio(relativeLuminance(current), 1) >= minRatio) break;
    current = current.map((c) => c * 0.82) as [number, number, number];
  }
  return current;
}

type CategoryPalette = {
  /** rgb "r, g, b" рядок для --cat-rgb / rgba() у підсвітці рядка й чипі легенди. */
  rgbTriplet: string;
  /** Пігулка заголовка — сам колір категорії, темніший за потреби для білого тексту. */
  pillHex: string;
  pillShadowRgba: string;
  lineHex: string;
  /** Темніший відтінок для лічильника слів і тексту чипа легенди (читабельний на майже білому). */
  textHex: string;
};

function categoryPalette(rgb01: [number, number, number]): CategoryPalette {
  const base = toRgb255(rgb01);
  const pill = contrastRatio(relativeLuminance(base), 1) >= 4.5 ? base : darkenUntilContrast(base, 4.5);
  const text = darkenUntilContrast(base, 4.5);
  return {
    rgbTriplet: `${base[0]}, ${base[1]}, ${base[2]}`,
    pillHex: rgbToHex(pill),
    pillShadowRgba: `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.35)`,
    lineHex: rgbToHex(base),
    textHex: rgbToHex(text),
  };
}

// Компактна легенда — тоновані чипи категорій, над списком груп, щоб
// орієнтуватись, не гортаючи до заголовка потрібної групи. Самі чипи — НЕ
// посилання, лише лейбли; порядок/вміст той самий, що й раніше.
function Legend() {
  return (
    <div className="vocab-legend">
      {PART_OF_SPEECH_ORDER.map((pos) => {
        const palette = categoryPalette(PART_OF_SPEECH_COLORS[pos].rgb);
        return (
          <span
            key={pos}
            className="vocab-legend-chip"
            style={{ backgroundColor: `rgba(${palette.rgbTriplet}, 0.13)`, color: palette.textHex }}
          >
            {PART_OF_SPEECH_LABELS_FR[pos]}
          </span>
        );
      })}
    </div>
  );
}

function VocabGroupTable({
  partOfSpeech,
  items,
}: {
  partOfSpeech: PartOfSpeech | null;
  items: VocabItem[];
}) {
  const label = partOfSpeech ? PART_OF_SPEECH_LABELS_FR[partOfSpeech] : "Інше";
  // "Інше" (легасі-група без категорії) не входить у PART_OF_SPEECH_COLORS —
  // нейтральний сірий, не колір жодної реальної категорії.
  const palette = categoryPalette(partOfSpeech ? PART_OF_SPEECH_COLORS[partOfSpeech].rgb : [0.42, 0.447, 0.502]);
  const word = pluralizeWords(items.length);

  return (
    <div style={{ "--cat-rgb": palette.rgbTriplet } as CSSProperties}>
      <div className="vocab-category-heading">
        <h3
          className="vocab-category-pill"
          style={{ backgroundColor: palette.pillHex, boxShadow: `0 3px 10px ${palette.pillShadowRgba}` }}
        >
          {label}
        </h3>
        <span
          className="vocab-category-line"
          style={{ background: `linear-gradient(to right, ${palette.lineHex}, transparent)` }}
          aria-hidden
        />
        <span className="vocab-category-count" style={{ color: palette.textHex }}>
          {items.length} {word}
        </span>
      </div>
      {items.map((v) => (
        <div key={v.id ?? v.word} className="vocab-row">
          {/* 16px — той самий розмір, що EXERCISE_BODY (typography-styles.ts,
              text-base/Lora) — текст вправ на цій же сторінці сцени;
              500 (не 600), бо EXERCISE_BODY сам БЕЗ font-weight класу
              (звичайні 400) — 500 лишає FR-слово трохи жирнішим за
              переклад, не настільки важким, як колишні 600. */}
          <span className="font-body" style={{ fontWeight: 500, fontSize: "16px", color: "#1f1d3a" }}>
            {firstVocabVariant(v.word)}
          </span>
          <span className="font-heading" style={{ fontWeight: 400, fontSize: "16px", color: "#6b6a80" }}>
            {v.translation}
          </span>
        </div>
      ))}
    </div>
  );
}

// Той самий тогл-патерн, що ScriptSection (script-section.tsx) — заголовок
// клікабельний, згорнуто за замовчуванням.
export function VocabSection({
  vocab,
  pdfHref,
  onBackground = false,
}: {
  vocab: VocabItem[];
  pdfHref: string;
  onBackground?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const groups = groupVocabByPartOfSpeech(vocab);

  const pdfLink = (
    <a href={pdfHref} className="scene-pdf-button shrink-0">
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="#1a1640"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M12 4v11" />
        <path d="M7 11l5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      Завантажити PDF
    </a>
  );

  // Легенда й усі групи — ОДНА центрована колонка (640px, вузча за
  // попередню max-w-3xl), не текст по центру (вміст усередині лишається
  // вирівняним по лівому краю) — на мобільній ширині колонка природно
  // займає всю ширину.
  const legendAndGroups = (
    <div className="mx-auto w-full max-w-[640px]">
      <Legend />
      {groups.map((g) => (
        <VocabGroupTable key={g.partOfSpeech ?? "other"} partOfSpeech={g.partOfSpeech} items={g.items} />
      ))}
    </div>
  );

  // Скляний бар (SectionHeaderBar) замінює звичайний тогл-заголовок лише
  // коли активний фон курсу — інакше розмітка/класи нижче лишаються
  // байтово тими самими, що й сьогодні (onBackground=false).
  if (onBackground) {
    const expanded = !collapsed;
    return (
      <div>
        {expanded ? (
          <div className={SCENE_CARD_CLASS}>
            <SectionHeaderBar
              title="Вокабуляр"
              attached
              collapsible
              expanded
              onToggle={() => setCollapsed((c) => !c)}
            />
            <div className={EXERCISE_BLOCK_SURFACE_CLASS}>
              <div className="flex justify-start" style={{ marginBottom: "18px" }}>
                {pdfLink}
              </div>
              {legendAndGroups}
            </div>
          </div>
        ) : (
          <SectionHeaderBar
            title="Вокабуляр"
            attached={false}
            collapsible
            expanded={false}
            onToggle={() => setCollapsed((c) => !c)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Кнопка-тогл і посилання PDF — окремі елементи в одному ряду, НЕ
          вкладені одне в одне (button/a всередині іншого button — невалідний
          HTML і зламана доступність): тогл сам розміром під контент (без
          flex-1) — PDF стоїть одразу після заголовка, не притиснутий до
          правого краю. items-center — PDF (менша, py-1.5) вирівнюється по
          центру висоти тогла (py-2), не розтягується на всю висоту. Клік по
          PDF не спливає до тогла просто тому, що це сиблінги, а не вкладені
          елементи — жодного stopPropagation не треба. */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={STUDENT_TOGGLE_HEADER_BUTTON}
        >
          <ChevronDown
            size={18}
            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
          <h2 className={`student-on-bg ${STUDENT_SECTION_HEADING}`}>Вокабуляр</h2>
        </button>

        {pdfLink}
      </div>

      {!collapsed && <div className={H2_TO_CONTENT}>{legendAndGroups}</div>}
    </div>
  );
}
