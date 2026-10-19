import type { CSSProperties } from "react";

// Клітинка результату одного символу — літера-плитка (з рамкою, кольором
// correct/incorrect) чи звичайний текст без рамки (видима літера
// letter_gaps). Обидва варіанти мають ОДНАКОВУ геометрію (.word-result-cell,
// розмір через --cell/--n нижче), щоб колонки двох рядків ("Ваша
// відповідь"/"Правильно") збігались символ до символу. empty — порожній
// пропуск letter_gaps (студент нічого не ввів): показує тьмяне тире "–"
// замість порожньої плитки, щоб відсутня відповідь була ВИДНА, а не просто
// зникала.
export type ResultCell =
  | { kind: "tile"; text: string; state: "correct" | "incorrect"; empty?: boolean }
  | { kind: "text"; text: string };

// Група — одне "слово" (одиниця переносу, розділена пробілом у фразі):
// рядок клітинок, що НЕ переноситься сам по собі (word-result-group,
// flex-wrap лише як останній резерв для задовгого одиничного слова).
// Фраза — кілька груп в одному word-result-tile-row (переноситься між
// групами, не всередині).
export type ResultGroup = ResultCell[];

function cellAriaLabel(cell: ResultCell): string | undefined {
  if (cell.kind !== "tile") return undefined;
  if (cell.state === "correct") return `${cell.text}, правильно`;
  return cell.empty ? "порожньо, неправильно" : `${cell.text}, неправильно`;
}

function ResultTileRow({ groups, ariaLabel }: { groups: ResultGroup[]; ariaLabel: string }) {
  return (
    <div className="word-result-tile-row" role="group" aria-label={ariaLabel}>
      {groups.map((group, gi) => (
        <div key={gi} className="word-result-group">
          {group.map((cell, ci) =>
            cell.kind === "text" ? (
              <span key={ci} className="word-result-cell word-result-cell--text">
                {cell.text}
              </span>
            ) : (
              <span
                key={ci}
                className={`word-result-cell word-result-cell--tile ${
                  cell.state === "correct" ? "word-result-cell--correct" : "word-result-cell--incorrect"
                } ${cell.empty ? "word-result-cell--empty" : ""}`}
                aria-label={cellAriaLabel(cell)}
              >
                {cell.text}
              </span>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function maxGroupLen(groups: ResultGroup[]): number {
  return groups.reduce((max, g) => Math.max(max, g.length), 1);
}

// Результат картки-слова (letter_gaps/letter_rearrangement) ПІСЛЯ
// "Перевірити" — заміняє колишній текстовий рядок "Правильне слово: ...".
// Повністю правильна відповідь — один рядок (студентські плитки, усі
// зелені, уже позначені state:"correct" викликачем); неправильна — два
// рядки з підписами й розділювачем. --n (найдовша група З ОБОХ рядків) —
// ОДИН розмір клітинки на всю картку (обидва рядки, усі групи), щоб
// літери збігались колонка в колонку й короткі слова не ставали різного
// розміру між картками — рахується тут, не викликачем.
export function WordResultRows({
  studentGroups,
  correctGroups,
  studentWordText,
  correctWordText,
  fullyCorrect,
}: {
  studentGroups: ResultGroup[];
  correctGroups: ResultGroup[];
  studentWordText: string;
  correctWordText: string;
  fullyCorrect: boolean;
}) {
  const n = Math.max(maxGroupLen(studentGroups), maxGroupLen(correctGroups));
  const style = { "--n": n } as CSSProperties;

  if (fullyCorrect) {
    return (
      <div className="word-result-rows" style={style}>
        <ResultTileRow groups={studentGroups} ariaLabel={`Правильно: ${correctWordText}`} />
      </div>
    );
  }
  return (
    <div className="word-result-rows" style={style}>
      <div className="word-result-row">
        <span className="word-result-row-label">Ваша відповідь</span>
        <ResultTileRow groups={studentGroups} ariaLabel={`Ваша відповідь: ${studentWordText}`} />
      </div>
      <div className="word-result-divider" aria-hidden="true" />
      <div className="word-result-row">
        <span className="word-result-row-label">Правильно</span>
        <ResultTileRow groups={correctGroups} ariaLabel={`Правильно: ${correctWordText}`} />
      </div>
    </div>
  );
}
