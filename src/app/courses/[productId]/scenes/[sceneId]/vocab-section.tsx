"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem, PartOfSpeech } from "@/lib/vocab";
import { firstVocabVariant, groupVocabByPartOfSpeech } from "@/lib/vocab";
import {
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
} from "@/lib/vocab-categories";
import { pluralizeWords } from "@/lib/pluralize-words";
import { categoryPalette, rgbToHex } from "@/lib/vocab-palette";
import { STUDENT_TOGGLE_HEADER_BUTTON, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import { H2_TO_CONTENT } from "@/lib/spacing";
import { EXERCISE_BLOCK_SURFACE_CLASS } from "@/components/task-card-style";
import { SectionHeaderBar, SCENE_CARD_CLASS, scrollToHeaderAndFocus } from "@/components/scene-header-bar";

// Той самий шеврон/кнопка, що script-section.tsx (BottomCollapseButton) —
// дрібний дублікат тут навмисно: ярлик і сама умова onBackground різні, а
// спільна поведінка (куди дивиться колір штриха/клас) — лише ці ~20 рядків.
function CollapseChevronIcon({ stroke }: { stroke: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke={stroke}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

function BottomCollapseButton({
  label,
  onBackground,
  onClick,
}: {
  label: string;
  onBackground: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        onBackground
          ? "scene-collapse-btn"
          : `${STUDENT_BUTTON_SECONDARY_TOUCH} mt-[18px] flex w-full items-center justify-center gap-2`
      }
    >
      <CollapseChevronIcon stroke={onBackground ? "#f6dc8e" : "currentColor"} />
      {label}
    </button>
  );
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
          style={{ backgroundColor: palette.pillHex, boxShadow: `0 3px 10px rgba(${palette.rgbTriplet}, 0.35)` }}
        >
          {label}
        </h3>
        <span
          className="vocab-category-line"
          style={{ background: `linear-gradient(to right, ${rgbToHex(palette.rgb255)}, transparent)` }}
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

  // Та сама дія, що тогл-заголовок, без дубльованого стану — див.
  // коментар при headerToggleRef у script-section.tsx.
  const headerToggleRef = useRef<HTMLButtonElement>(null);
  const pendingHeaderFocusRef = useRef(false);

  useEffect(() => {
    if (collapsed && pendingHeaderFocusRef.current) {
      pendingHeaderFocusRef.current = false;
      scrollToHeaderAndFocus(headerToggleRef.current);
    }
  }, [collapsed]);

  function collapseFromBottomButton() {
    pendingHeaderFocusRef.current = true;
    setCollapsed(true);
  }

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

  // Видима лише поки секція розгорнута — обидва місця виклику нижче вже
  // самі під умовою "розгорнуто" (expanded ? (...) : ... і !collapsed &&).
  const bottomCollapseButton = (
    <BottomCollapseButton label="Згорнути вокабуляр" onBackground={onBackground} onClick={collapseFromBottomButton} />
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
              toggleRef={headerToggleRef}
            />
            <div className={EXERCISE_BLOCK_SURFACE_CLASS}>
              <div className="flex justify-start" style={{ marginBottom: "18px" }}>
                {pdfLink}
              </div>
              {legendAndGroups}
              {bottomCollapseButton}
            </div>
          </div>
        ) : (
          <SectionHeaderBar
            title="Вокабуляр"
            attached={false}
            collapsible
            expanded={false}
            onToggle={() => setCollapsed((c) => !c)}
            toggleRef={headerToggleRef}
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
          ref={headerToggleRef}
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

      {!collapsed && (
        <div className={H2_TO_CONTENT}>
          {legendAndGroups}
          {bottomCollapseButton}
        </div>
      )}
    </div>
  );
}
