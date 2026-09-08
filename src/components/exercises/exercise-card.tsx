import type {
  FillBlankPublic,
  MultipleChoicePublic,
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
  GradeResult,
} from "@/lib/exercises/types";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";
import { FillBlankExercise } from "./fill-blank";
import { MultipleChoiceExercise } from "./multiple-choice";
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

export const isExerciseType = isGradableTaskType;

export function ExerciseCard({
  taskId,
  type,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  type: string;
  config: Record<string, unknown>;
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
}) {
  switch (type) {
    case "fill_blank":
      return (
        <FillBlankExercise
          taskId={taskId}
          config={config as unknown as FillBlankPublic}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceExercise
          taskId={taskId}
          config={config as unknown as MultipleChoicePublic}
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "true_false":
      return (
        <TrueFalseExercise
          taskId={taskId}
          config={config as unknown as TrueFalsePublic}
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
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "open_answer":
      return (
        <OpenAnswerCheckExercise
          taskId={taskId}
          config={config as unknown as OpenAnswerPublic}
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
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    case "image_match":
      return (
        <ImageMatchExercise
          taskId={taskId}
          config={config as unknown as ImageMatchPublic}
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
          pointsVisible={pointsVisible ?? false}
          onResult={onResult}
          hidePoints={hidePoints}
        />
      );
    default:
      return null;
  }
}
