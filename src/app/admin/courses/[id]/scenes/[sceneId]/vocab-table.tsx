"use client";

import { HINT_TEXT } from "@/lib/typography-styles";
import { useDialogueState } from "./dialogue-state";
import { VocabItemRow } from "./vocab-item-row";

// Плоский, редагований список усіх vocab-записів зі "Скрипту" цієї сцени —
// той самий lines-стан, що DialogueEditor (через useDialogueState),
// редагування тут мутує ОДИН і той самий масив, що й підредактор словника в
// "Скрипті". Додавання НОВИХ слів лишається виключно там (кнопка "+ слово в
// лексику" при конкретній репліці) — у плоскій таблиці немає природного
// способу вибрати, до якої репліки прив'язати новий запис.
export function VocabTable() {
  const { lines } = useDialogueState();

  const rows = lines.flatMap((line, lineIndex) =>
    line.vocab.map((v, vocabIndex) => ({ line, lineIndex, vocabIndex, v }))
  );

  if (rows.length === 0) {
    return (
      <p className={HINT_TEXT}>
        Немає лексики — додайте через &quot;+ слово в лексику&quot; в блоці &quot;Скрипт&quot;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ line, lineIndex, vocabIndex, v }) => (
        <div
          key={v.id ?? `${lineIndex}-${vocabIndex}`}
          className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700"
        >
          <p className={`${HINT_TEXT} truncate`}>
            {line.speaker || "—"}: {line.text}
          </p>
          <VocabItemRow lineIndex={lineIndex} vocabIndex={vocabIndex} />
        </div>
      ))}
    </div>
  );
}
