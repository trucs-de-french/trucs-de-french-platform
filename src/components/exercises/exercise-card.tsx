import type {
  FillBlankPublic,
  MultipleChoicePublic,
  WordChoicePublic,
  WordSearchPublic,
  TrueFalsePublic,
  MatchingPublic,
  ListeningPublic,
  ReorderPublic,
  DragDropPublic,
  SortColumnsPublic,
  OpenAnswerPublic,
  TableFillPublic,
  ImageMatchPublic,
  CheckboxGridPublic,
  ChronologicalOrderPublic,
  LetterGapsPublic,
  LetterRearrangementPublic,
  CrosswordPublic,
  KaraokePublic,
  GradeResult,
} from "@/lib/exercises/types";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";
import { ExerciseErrorBoundary } from "./exercise-error-boundary";
import { FillBlankExercise } from "./fill-blank";
import { MultipleChoiceExercise } from "./multiple-choice";
import { WordChoiceExercise } from "./word-choice";
import { WordSearchExercise } from "./word-search";
import { CrosswordExercise } from "./crossword";
import { TrueFalseExercise } from "./true-false";
import { MatchingExercise } from "./matching";
import { ListeningExercise } from "./listening";
import { ReorderExercise } from "./reorder";
import { DragDropExercise } from "./drag-drop";
import { SortColumnsExercise } from "./sort-columns";
import { OpenAnswerCheckExercise } from "./open-answer-check";
import { TableFillExercise } from "./table-fill";
import { ImageMatchExercise } from "./image-match";
import { CheckboxGridExercise } from "./checkbox-grid";
import { ChronologicalOrderExercise } from "./chronological-order";
import { LetterGapsExercise } from "./letter-gaps";
import { LetterRearrangementExercise } from "./letter-rearrangement";
import { KaraokeExercise } from "./karaoke";

export const isExerciseType = isGradableTaskType;

export function ExerciseCard({
  taskId,
  type,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  type: string;
  config: Record<string, unknown>;
  // Назва типу для плашки смужки над панеллю (BlockTabs, мокап
  // "варіант 4") — рахується викликачем із СИРОГО task.config
  // (getTaskBarText, task-bar-text.ts), не з цього `config` (той уже
  // пройшов sanitizeConfigForStudent, де cardTitle не входить у жоден
  // per-типовий whitelist).
  plaqueText?: string;
  // Пілот системи балів — поки має ефект лише для type === "true_false".
  pointsVisible?: boolean;
  // Опційний — для блоків (TaskGroupBlock), щоб рахувати живий підсумок
  // балів усіх задач блоку (режим "сума"). Прокидається без змін у кожен
  // з 13 gradable-компонентів нижче.
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано" (TaskGroupBlock), щоб
  // безумовно ховати індивідуальний бал задачі (і до, і після перевірки),
  // коли на рівні блоку показується лише один загальний підсумок.
  hidePoints?: boolean;
  // Задача належить DELF-тесту (визначається один раз — delf-test-tasks.tsx
  // — і прокидається сюди, а не перевіряється в кожному компоненті окремо):
  // вимикає підказки в 6 типів, де вони є (word_search, crossword,
  // letter_gaps, letter_rearrangement, fill_blank, table_fill); ігнорується
  // рештою типів.
  isDelf?: boolean;
}) {
  return (
    <ExerciseErrorBoundary>
      {renderExerciseByType({ taskId, type, config, plaqueText, pointsVisible, onResult, hidePoints, isDelf })}
    </ExerciseErrorBoundary>
  );
}

function renderExerciseByType({
  taskId,
  type,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  type: string;
  config: Record<string, unknown>;
  plaqueText?: string;
  pointsVisible?: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  isDelf?: boolean;
}) {
  switch (type) {
    case "fill_blank":
      return (
        <FillBlankExercise
          taskId={taskId}
          config={config as unknown as FillBlankPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "letter_gaps":
      return (
        <LetterGapsExercise
          taskId={taskId}
          config={config as unknown as LetterGapsPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "letter_rearrangement":
      return (
        <LetterRearrangementExercise
          taskId={taskId}
          config={config as unknown as LetterRearrangementPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceExercise
          taskId={taskId}
          config={config as unknown as MultipleChoicePublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "word_choice":
      return (
        <WordChoiceExercise
          taskId={taskId}
          config={config as unknown as WordChoicePublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "word_search":
      return (
        <WordSearchExercise
          taskId={taskId}
          config={config as unknown as WordSearchPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "crossword":
      return (
        <CrosswordExercise
          taskId={taskId}
          config={config as unknown as CrosswordPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "true_false":
      return (
        <TrueFalseExercise
          taskId={taskId}
          config={config as unknown as TrueFalsePublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "matching":
      return (
        <MatchingExercise
          taskId={taskId}
          config={config as unknown as MatchingPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "listening":
      return (
        <ListeningExercise
          taskId={taskId}
          config={config as unknown as ListeningPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "reorder":
      return (
        <ReorderExercise
          taskId={taskId}
          config={config as unknown as ReorderPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "drag_drop":
      return (
        <DragDropExercise
          taskId={taskId}
          config={config as unknown as DragDropPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "sort_columns":
      return (
        <SortColumnsExercise
          taskId={taskId}
          config={config as unknown as SortColumnsPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "open_answer":
      return (
        <OpenAnswerCheckExercise
          taskId={taskId}
          config={config as unknown as OpenAnswerPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "table_fill":
      return (
        <TableFillExercise
          taskId={taskId}
          config={config as unknown as TableFillPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      );
    case "image_match":
      return (
        <ImageMatchExercise
          taskId={taskId}
          config={config as unknown as ImageMatchPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "checkbox_grid":
      return (
        <CheckboxGridExercise
          taskId={taskId}
          config={config as unknown as CheckboxGridPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "chronological_order":
      return (
        <ChronologicalOrderExercise
          taskId={taskId}
          config={config as unknown as ChronologicalOrderPublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "karaoke":
      return (
        <KaraokeExercise
          taskId={taskId}
          config={config as unknown as KaraokePublic}
          plaqueText={plaqueText}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    default:
      return null;
  }
}
