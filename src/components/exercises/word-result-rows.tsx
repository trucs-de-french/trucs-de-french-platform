import { LIVE_CORRECT_CLASS, LIVE_INCORRECT_CLASS } from "./selection-style";

// Клітинка результату одного символу — літера-плитка (з рамкою, кольором
// correct/incorrect) чи звичайний текст без рамки (видима літера
// letter_gaps). Обидва варіанти мають ОДНАКОВУ геометрію (.word-result-cell),
// щоб колонки двох рядків ("Ваша відповідь"/"Правильно") збігались символ
// до символу.
export type ResultCell =
  | { kind: "tile"; text: string; state: "correct" | "incorrect" }
  | { kind: "text"; text: string };

function cellAriaLabel(cell: ResultCell): string | undefined {
  if (cell.kind !== "tile") return undefined;
  return cell.state === "correct" ? `${cell.text}, правильно` : `${cell.text || "порожньо"}, неправильно`;
}

// forceAnswerStyle — рядок "Правильно" під час НЕПРАВИЛЬНОЇ відповіді:
// фіксований зелений (.word-result-cell--answer, інший відтінок, ніж
// "живий" border-green-500/bg-green-50 рядка "Ваша відповідь") — два ряди
// мають різнитись не лише підписом. Рядок повністю правильної відповіді
// (одинарний, без підпису) лишається на "живому" зеленому — він і так уже
// показував саме цей колір до результату.
function ResultTileRow({
  cells,
  ariaLabel,
  forceAnswerStyle,
}: {
  cells: ResultCell[];
  ariaLabel: string;
  forceAnswerStyle?: boolean;
}) {
  return (
    <div className="word-result-tile-row" role="group" aria-label={ariaLabel}>
      {cells.map((cell, i) =>
        cell.kind === "text" ? (
          <span key={i} className="word-result-cell word-result-cell--text" aria-hidden={cell.text.trim() === ""}>
            {cell.text}
          </span>
        ) : (
          <span
            key={i}
            className={`word-result-cell word-result-cell--tile ${
              forceAnswerStyle
                ? "word-result-cell--answer"
                : cell.state === "correct"
                  ? LIVE_CORRECT_CLASS
                  : LIVE_INCORRECT_CLASS
            }`}
            aria-label={cellAriaLabel(cell)}
          >
            {cell.text}
          </span>
        )
      )}
    </div>
  );
}

// Результат картки-слова (letter_gaps/letter_rearrangement) ПІСЛЯ
// "Перевірити" — заміняє колишній текстовий рядок "Правильне слово: ...".
// Повністю правильна відповідь — один рядок (студентські плитки, усі
// зелені); неправильна — два рядки з підписами й розділювачем.
export function WordResultRows({
  studentCells,
  correctCells,
  studentWordText,
  correctWordText,
  fullyCorrect,
}: {
  studentCells: ResultCell[];
  correctCells: ResultCell[];
  studentWordText: string;
  correctWordText: string;
  fullyCorrect: boolean;
}) {
  if (fullyCorrect) {
    return (
      <div className="word-result-rows">
        <ResultTileRow cells={studentCells} ariaLabel={`Правильно: ${correctWordText}`} />
      </div>
    );
  }
  return (
    <div className="word-result-rows">
      <div className="word-result-row">
        <span className="word-result-row-label">Ваша відповідь</span>
        <ResultTileRow cells={studentCells} ariaLabel={`Ваша відповідь: ${studentWordText}`} />
      </div>
      <div className="word-result-divider" aria-hidden="true" />
      <div className="word-result-row">
        <span className="word-result-row-label">Правильно</span>
        <ResultTileRow cells={correctCells} ariaLabel={`Правильно: ${correctWordText}`} forceAnswerStyle />
      </div>
    </div>
  );
}
