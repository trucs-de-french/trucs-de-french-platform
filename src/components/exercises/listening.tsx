"use client";

import { useState } from "react";
import type { ListeningPublic, ListeningDetail } from "@/lib/exercises/types";
import { isYouTubeUrl, toEmbedUrl } from "@/lib/video";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { AudioPlayer } from "@/components/audio-player";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";

export function ListeningExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: ListeningPublic;
  pointsVisible: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ListeningDetail | undefined;

  const allAnswered = config.questions.every((q) => answers[q.id]);

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.listening}
        subText={config.subInstructions}
        className="mb-2 font-medium"
      />

      {isYouTubeUrl(config.audioUrl) ? (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            src={toEmbedUrl(config.audioUrl, "youtube")}
            className="h-full w-full"
            allowFullScreen
          />
        </div>
      ) : (
        <AudioPlayer src={config.audioUrl} />
      )}

      <div className="mt-3 flex flex-col gap-3">
        {config.questions.map((q) => {
          const qDetail = detail?.questions.find((d) => d.id === q.id);
          return (
            <div key={q.id}>
              <p className="text-sm font-medium">
                {q.question}
                {/* До перевірки — лише якщо pointsVisible; після — завжди. */}
                {(pointsVisible || qDetail) && (
                  <span className="ml-2 text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
                    {qDetail
                      ? `${qDetail.options.every((o) => o.correct === o.selected) ? q.points : 0}/${q.points} ${pluralizePoints(q.points)}`
                      : `${q.points} ${pluralizePoints(q.points)}`}
                  </span>
                )}
              </p>
              <div className="mt-1 flex flex-col gap-1">
                {q.options.map((o) => {
                  const od = qDetail?.options.find((x) => x.id === o.id);
                  const cls = od
                    ? od.correct && od.selected
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : od.correct && !od.selected
                        ? "border-green-500 border-dashed"
                        : !od.correct && od.selected
                          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : "opacity-60"
                    : answers[q.id] === o.id
                      ? SELECTED_OPTION_CLASS
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800";
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      className={`rounded-md border px-3 py-1.5 text-left text-sm ${cls}`}
                    >
                      {o.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(config.questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] })))
          }
          disabled={pending || !allAnswered}
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
          {result.pointsPossible !== undefined && (
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
