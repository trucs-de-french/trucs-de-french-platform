"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { VocabItem, PartOfSpeech } from "@/lib/vocab";
import { firstVocabVariant, groupVocabByPartOfSpeech } from "@/lib/vocab";
import {
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
} from "@/lib/vocab-categories";
import { pluralizeWords } from "@/lib/pluralize-words";
import { categoryPalette, rgbToHex } from "@/lib/vocab-palette";
import { SectionHeaderBar, scrollToHeaderAndFocus } from "@/components/scene-header-bar";
import { resolveBlockIcon } from "@/lib/block-icons";

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

function BottomCollapseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="scene-collapse-btn">
      <span className="scene-collapse-badge">
        <CollapseChevronIcon stroke="#f6dc8e" />
      </span>
      {label}
    </button>
  );
}

// Темна тема — ОПАЦНІ пастельні чипи (фон/рамка/текст — фіксовані literal,
// без alpha/композиту з фоном панелі): попередня версія рахувала насичений
// текст проти напівпрозорої заливки НАД припущеним темним фоном панелі
// (--glass-panel-bg), але сама панель вокабуляру в темній темі світло-сіра
// скляна, не темно-індиго — текст виходив світлим на світлуватій плашці,
// нечитабельним. Опаційна заливка прибирає залежність від фону панелі
// взагалі: контраст текст/заливка (обчислено, усі ≥4.5:1, нижче з запасом)
// лишається тим самим незалежно від того, що під пігулкою. .vocab-category-
// pill/крапки рядків/PDF далі рахують свій textHex, як і раніше (не
// торкнуто).
const CHIP_DARK: Record<PartOfSpeech, { fill: string; border: string; text: string }> = {
  nom: { fill: "#f8d9bf", border: "#e9b48a", text: "#8a3d0c" }, // ratio 5.69
  verbe: { fill: "#f8cfcf", border: "#e7a3a3", text: "#9a1f1f" }, // ratio 5.72
  adjectif: { fill: "#cdeed8", border: "#9fd4b2", text: "#14653a" }, // ratio 5.70
  adverbe: { fill: "#ddd2f7", border: "#b9a8ea", text: "#4c2fa6" }, // ratio 6.46
  prepositions_conjonctions: { fill: "#e2e0dc", border: "#bdb9b2", text: "#4a4741" }, // ratio 7.02
  locutions: { fill: "#f8d2e4", border: "#e6a5c5", text: "#a01f5c" }, // ratio 5.39
  phrase: { fill: "#cfe0fa", border: "#9db9ea", text: "#1d4aa3" }, // ratio 6.13
  idiome: { fill: "#c9eaf0", border: "#98cbd6", text: "#0e6275" }, // ratio 5.46
};

// Компактна легенда — тоновані чипи категорій, над списком груп, щоб
// орієнтуватись, не гортаючи до заголовка потрібної групи. Самі чипи — НЕ
// посилання, лише лейбли; порядок/вміст той самий, що й раніше. Колір/фон —
// через --chip-rgb/--chip-text-light (світла) і --chip-fill-dark/--chip-
// border-dark/--chip-text-dark (темна), не прямий inline background/color,
// щоб .dark .vocab-legend-chip (globals.css) міг перекрити заливку/рамку/
// текст без !important.
function Legend() {
  return (
    <div className="vocab-legend">
      {PART_OF_SPEECH_ORDER.map((pos) => {
        const palette = categoryPalette(PART_OF_SPEECH_COLORS[pos].rgb);
        const dark = CHIP_DARK[pos];
        return (
          <span
            key={pos}
            className="vocab-legend-chip"
            style={
              {
                "--chip-rgb": palette.rgbTriplet,
                "--chip-text-light": palette.textHex,
                "--chip-fill-dark": dark.fill,
                "--chip-border-dark": dark.border,
                "--chip-text-dark": dark.text,
              } as CSSProperties
            }
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
  isFirst,
}: {
  partOfSpeech: PartOfSpeech | null;
  items: VocabItem[];
  isFirst: boolean;
}) {
  const label = partOfSpeech ? PART_OF_SPEECH_LABELS_FR[partOfSpeech] : "Інше";
  // "Інше" (легасі-група без категорії) не входить у PART_OF_SPEECH_COLORS —
  // нейтральний сірий, не колір жодної реальної категорії.
  const palette = categoryPalette(partOfSpeech ? PART_OF_SPEECH_COLORS[partOfSpeech].rgb : [0.42, 0.447, 0.502]);
  const word = pluralizeWords(items.length);

  return (
    <div style={{ "--cat-rgb": palette.rgbTriplet } as CSSProperties}>
      {/* --first — явний прапорець від РЕАЛЬНОЇ позиції в списку груп
          (isFirst, переданий зверху), не CSS :first-child: кожна група —
          окрема div-обгортка, тож :first-child збігається в КОЖНІЙ з них
          (сам заголовок — буквально перша дитина своєї обгортки), а не
          лише в першій групі сторінки — звідси й був зламаний margin-top. */}
      <div className={`vocab-category-heading${isFirst ? " vocab-category-heading--first" : ""}`}>
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
              переклад, не настільки важким, як колишні 600. Колір —
              --glass-text/--glass-text-secondary (globals.css), не
              фіксований hex: рядок тепер сидить або на світлій, або на
              темній скляній панелі (data-scene-bg), фіксований темний
              колір на темній панелі був би нечитабельним.
              --glass-text-secondary (переклад) переозначений у темній темі
              на .vocab-translation нижче — .glass-block-panel сам НЕ має
              .dark-перевизначення (Скрипт/Вокабуляр свідомо лишені
              "скляними" й у темній темі, панель лишається світлою), тож без
              цього класу переклад мав би той самий сірий колір, що й у
              світлій темі, й зливався б із такою ж світлою панеллю. */}
          <span className="font-body" style={{ fontWeight: 500, fontSize: "16px", color: "var(--glass-text)" }}>
            {firstVocabVariant(v.word)}
          </span>
          <span
            className="font-heading vocab-translation"
            style={{ fontWeight: 400, fontSize: "16px" }}
          >
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
}: {
  vocab: VocabItem[];
  pdfHref: string;
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
    <div className="vocab-list mx-auto w-full max-w-[640px]">
      <Legend />
      {groups.map((g, i) => (
        <VocabGroupTable
          key={g.partOfSpeech ?? "other"}
          partOfSpeech={g.partOfSpeech}
          items={g.items}
          isFirst={i === 0}
        />
      ))}
    </div>
  );

  // Видима лише поки секція розгорнута — обидва місця виклику нижче вже
  // самі під умовою "розгорнуто" (expanded ? (...) : ... і !collapsed &&).
  const bottomCollapseButton = (
    <BottomCollapseButton label="Згорнути вокабуляр" onClick={collapseFromBottomButton} />
  );

  // Завжди скляний бар+панель, окремими сиблінгами з 14px відступом
  // (.scene-bar margin-bottom, globals.css) — та сама "скляна" мова, що й
  // GlassBlock-вправи. pdfLink сидить усередині панелі (не поряд із
  // тоглом) — та сама посилання/behavior, інше місце в розмітці.
  const expanded = !collapsed;
  return (
    <div className="flex flex-col gap-[14px]">
      <SectionHeaderBar
        title="Вокабуляр"
        icon={resolveBlockIcon("vocabulary")}
        collapsible
        expanded={expanded}
        onToggle={() => setCollapsed((c) => !c)}
        toggleRef={headerToggleRef}
      />
      {expanded && (
        <div className="glass-block-panel">
          <div className="flex justify-start" style={{ marginBottom: "18px" }}>
            {pdfLink}
          </div>
          {legendAndGroups}
          {bottomCollapseButton}
        </div>
      )}
    </div>
  );
}
