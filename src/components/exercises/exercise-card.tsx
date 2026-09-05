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

export const isExerciseType = isGradableTaskType;

export function ExerciseCard({
  taskId,
  type,
  config,
  pointsVisible,
}: {
  taskId: string;
  type: string;
  config: Record<string, unknown>;
  // Пілот системи балів — поки має ефект лише для type === "true_false".
  pointsVisible?: boolean;
}) {
  switch (type) {
    case "fill_blank":
      return (
        <FillBlankExercise
          taskId={taskId}
          config={config as unknown as FillBlankPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceExercise
          taskId={taskId}
          config={config as unknown as MultipleChoicePublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "true_false":
      return (
        <TrueFalseExercise
          taskId={taskId}
          config={config as unknown as TrueFalsePublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "matching":
      return (
        <MatchingExercise
          taskId={taskId}
          config={config as unknown as MatchingPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "listening":
      return (
        <ListeningExercise
          taskId={taskId}
          config={config as unknown as ListeningPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "reorder":
      return (
        <ReorderExercise
          taskId={taskId}
          config={config as unknown as ReorderPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "drag_drop":
      return (
        <DragDropExercise
          taskId={taskId}
          config={config as unknown as DragDropPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "sort_columns":
      return (
        <SortColumnsExercise
          taskId={taskId}
          config={config as unknown as SortColumnsPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "open_answer":
      return (
        <OpenAnswerCheckExercise
          taskId={taskId}
          config={config as unknown as OpenAnswerPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "table_fill":
      return (
        <TableFillExercise
          taskId={taskId}
          config={config as unknown as TableFillPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "image_match":
      return (
        <ImageMatchExercise
          taskId={taskId}
          config={config as unknown as ImageMatchPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    case "checkbox_grid":
      return (
        <CheckboxGridExercise
          taskId={taskId}
          config={config as unknown as CheckboxGridPublic}
          pointsVisible={pointsVisible ?? false}
        />
      );
    default:
      return null;
  }
}
