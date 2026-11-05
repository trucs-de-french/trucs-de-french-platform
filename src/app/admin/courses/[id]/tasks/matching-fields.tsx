"use client";

import { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { MatchingConfig, MatchingPair } from "@/lib/exercises/types";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import {
  MATCHING_MAX_WORD_LEN,
  MATCHING_MAX_ITEM_LEN,
  validateMatchingItem,
  findMatchingLimitViolations,
} from "@/lib/exercises/matching-limits";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { StripArticlesToggle } from "./strip-articles-toggle";
import { INPUT_BORDER, INPUT_BORDER_WARNING, INPUT_BORDER_ERROR } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { ConstructorBlock } from "./constructor-block";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/t";

function emptyPair(): MatchingPair {
  return { id: crypto.randomUUID(), left: "", right: "" };
}

export const MatchingFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<MatchingConfig>,
  { initialConfig?: Partial<MatchingConfig>; pointsVisibilityCheckbox?: ReactNode; importVocabPanel?: ReactNode }
>(function MatchingFields({ initialConfig, pointsVisibilityCheckbox, importVocabPanel }, ref) {
  const { t } = useT();
  // Старі пари (до пілоту балів) не мали id — тут, на відміну від
  // sanitize.ts (getMatchingPairs, стабільний `pair-${index}`), можна
  // згенерувати справжній id саме зараз: після першого збереження цієї
  // форми пара матиме постійний id у БД, "самозцілення" застарілих даних.
  const [pairs, setPairs] = useState<MatchingPair[]>(
    initialConfig?.pairs?.length
      ? initialConfig.pairs.map((p) => ({ ...p, id: p.id ?? crypto.randomUUID() }))
      : [emptyPair()]
  );
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.matching ?? false);
  // Завдання "limit word and card length (13/30), block saving" — рахуємо
  // порушення з ЖИВОГО стану pairs на кожен рендер, тож підсвічування рамки
  // й повідомлення під полем оновлюються на кожен символ без затримки. На
  // сабміті SaveForm (save-form.tsx) незалежно перераховує те саме з
  // FormData (matchingLimitsBlockMessage, matching-limits.ts) — жодного
  // спільного React-стану з цим компонентом не потрібно, той самий принцип,
  // що вже переносить pairs туди через JSON.stringify нижче.
  const hasLimitViolation = findMatchingLimitViolations(pairs).length > 0;

  useImperativeHandle(ref, () => ({
    // buildConfigFromVocab (task-config-builder.ts) — MatchingPair не має
    // власного поля під картинку/аудіо, тож переносити тут нічого, окрім
    // left/right (те саме мапування, що раніше було inline).
    importWords(words) {
      const { pairs: newPairs } = buildConfigFromVocab("matching", words, { stripArticles }) as {
        pairs: MatchingPair[];
      };
      setPairs((prev) => {
        // Прибираємо порожню плейсхолдер-пару за замовчуванням, якщо
        // вчитель ще нічого не ввів — інакше лишався б сміттєвий рядок.
        const withoutEmpty = prev.filter((p) => p.left.trim() || p.right.trim());
        return [...withoutEmpty, ...newPairs];
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      subInstructionsEn: initialConfig?.subInstructionsEn,
      pairs,
    }),
  }));

  function addPair() {
    setPairs((prev) => [...prev, emptyPair()]);
  }

  function removePair(i: number) {
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePair(i: number, field: "left" | "right", value: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function updatePoints(i: number, points: number) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, points } : p)));
  }

  return (
    <>
      <input type="hidden" name="matching_pairs" value={JSON.stringify(pairs)} readOnly />

      <ConstructorBlock
        n={2}
        title="Інструкція для студента"
        description="Французькою, українською та англійською"
        tone="instruction"
      >
        <InstructionsRichTextField
          name="matching_instructions"
          label="Інструкція для студента"
          initialValue={initialConfig?.instructions ?? ""}
        />

        <InstructionsRichTextField
          name="matching_sub_instructions"
          label="Додаткові інструкції (опційно)"
          initialValue={initialConfig?.subInstructions ?? ""}
          compact
        />

        <InstructionsRichTextField
          name="matching_sub_instructions_en"
          label="Переклад завдання англійською (для англомовного інтерфейсу)"
          initialValue={initialConfig?.subInstructionsEn ?? ""}
          compact
        />
      </ConstructorBlock>

      {pointsVisibilityCheckbox && (
        <ConstructorBlock n={3} title="Бали та підказки" description="Оцінювання" tone="points">
          {pointsVisibilityCheckbox}
        </ConstructorBlock>
      )}

      {importVocabPanel}

      <ConstructorBlock
        n={4}
        title="Варіанти вправи"
        description="Пари елементів для з'єднання"
        tone="content"
      >
      <p className={HINT_TEXT}>
        Уникайте однакового тексту зліва і справа в різних парах — це заважає перевірці.
      </p>

      <StripArticlesToggle checked={stripArticles} onChange={setStripArticles} />

      {pairs.map((p, i) => {
        const leftValidation = validateMatchingItem(p.left);
        const rightValidation = validateMatchingItem(p.right);
        return (
          <div key={p.id} className="flex items-start gap-2">
            <MatchingItemField
              value={p.left}
              onChange={(value) => updatePair(i, "left", value)}
              placeholder="Лівий елемент"
              validation={leftValidation}
              isEmpty={!p.left.trim()}
              t={t}
            />
            <span className="mt-2 text-neutral-400 dark:text-neutral-500">→</span>
            <MatchingItemField
              value={p.right}
              onChange={(value) => updatePair(i, "right", value)}
              placeholder="Правий елемент"
              validation={rightValidation}
              isEmpty={!p.right.trim()}
              t={t}
            />
            <span className={`mt-2 ${HINT_TEXT}`}>Бали</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={p.points ?? 1}
              onChange={(e) => updatePoints(i, Number(e.target.value))}
              title="Бали за цю пару"
              className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
            />
            <button
              type="button"
              onClick={() => removePair(i)}
              aria-label="Видалити пару"
              title="Видалити"
              className="mt-0.5 rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addPair}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + пара
      </button>

      <p className={HINT_TEXT}>
        {t("matching.lengthLimitsHint", { wordMax: MATCHING_MAX_WORD_LEN, itemMax: MATCHING_MAX_ITEM_LEN })}
      </p>
      {hasLimitViolation && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {t("matching.limitsBlocked", { wordMax: MATCHING_MAX_WORD_LEN, itemMax: MATCHING_MAX_ITEM_LEN })}
        </p>
      )}
      </ConstructorBlock>
    </>
  );
});

// Одне поле пари (ліве чи праве) — лічильник "{len}/{max}" + рамка/
// повідомлення червоним, коли порушено MATCHING_MAX_WORD_LEN/
// MATCHING_MAX_ITEM_LEN (matching-limits.ts). БЕЗ maxLength на самому
// input — задача явно забороняє блокувати ввід посередині слова (вчителька
// має побачити задовгий текст і сама вирішити, як скоротити), ліміт лише
// підсвічує й (через matching_limits_ok, hidden-інпут вище) блокує
// збереження в SaveForm.
function MatchingItemField({
  value,
  onChange,
  placeholder,
  validation,
  isEmpty,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  validation: ReturnType<typeof validateMatchingItem>;
  isEmpty: boolean;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}) {
  const borderClass = isEmpty ? INPUT_BORDER_WARNING : validation.ok ? INPUT_BORDER : INPUT_BORDER_ERROR;
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${borderClass} px-2 py-2 text-base font-medium font-content`}
      />
      <div className="flex items-center justify-end">
        <span
          className={`text-xs ${validation.tooLong ? "text-red-600 dark:text-red-400" : "text-neutral-400 dark:text-neutral-500"}`}
          title={t("matching.lengthCounterAria", { len: validation.length, max: MATCHING_MAX_ITEM_LEN })}
        >
          {validation.length}/{MATCHING_MAX_ITEM_LEN}
        </span>
      </div>
      {validation.tooLongWord && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t("matching.wordTooLong", { max: MATCHING_MAX_WORD_LEN, word: validation.tooLongWord })}
        </p>
      )}
      {validation.tooLong && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t("matching.itemTooLong", { max: MATCHING_MAX_ITEM_LEN })}
        </p>
      )}
    </div>
  );
}
