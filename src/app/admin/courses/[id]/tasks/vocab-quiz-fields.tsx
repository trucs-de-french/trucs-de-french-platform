"use client";

import { useState } from "react";
import type { VocabQuizConfig } from "@/lib/exercises/types";

export function VocabQuizFields({
  initialConfig,
  scenes,
}: {
  initialConfig?: Partial<VocabQuizConfig>;
  scenes: { id: string; title: string }[];
}) {
  const [sceneIds, setSceneIds] = useState<string[]>(initialConfig?.sceneIds ?? []);

  function toggle(id: string) {
    setSceneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="vocab_quiz_scene_ids" value={JSON.stringify(sceneIds)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Джерело лексики — сцени курсу
        </label>
        {scenes.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            У цьому курсі ще немає сцен.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {scenes.map((scene) => (
              <label key={scene.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sceneIds.includes(scene.id)}
                  onChange={() => toggle(scene.id)}
                />
                {scene.title}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Лексика тягнеться автоматично зі скрипту обраних сцен (позначені слова в діалозі).
          Рекомендовано обирати сцени, що разом дають щонайменше 4 слова — інакше кількість
          варіантів відповіді автоматично зменшиться.
        </p>
      </div>
    </div>
  );
}
