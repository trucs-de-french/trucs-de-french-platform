"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { saveWord as saveWordAction, removeWord as removeWordAction } from "@/app/cabinet/dictionary/actions";
import {
  computeWordKey,
  type SavedWordSourceEntry,
  type SavedWordSourceType,
  type SavedWordTranslationSource,
} from "@/lib/cabinet/saved-words";

// Снімок слова для save() — без джерельних полів (sourceType/sourceId/
// productId/sourceTitle): провайдер сам додає їх з власних пропів, щоб
// кожен викликач (бульбашка вокабуляру, картка відео, рядок таблиці,
// звичайне слово скрипту) не повторював контекст сцени.
export type SaveWordSnapshot = {
  word: string;
  translation?: string | null;
  translationSource: SavedWordTranslationSource;
  // Сирий partOfSpeech (VocabItem.partOfSpeech, можливо легасі-ключ) —
  // нормалізується одним місцем усередині saveWord (actions.ts), не тут.
  partOfSpeech?: string | null;
  note?: string | null;
  imageUrl?: string | null;
  vocabId?: string | null;
  contextFr?: string | null;
  contextUk?: string | null;
};

type SavedEntry = { id: string; translation: string | null };

export type SavedWordsContextValue = {
  isSaved: (word: string) => boolean;
  getSaved: (word: string) => SavedEntry | null;
  save: (snapshot: SaveWordSnapshot) => Promise<{ ok: boolean; error?: string }>;
  remove: (word: string) => Promise<{ ok: boolean; error?: string }>;
  isPending: (word: string) => boolean;
  getError: (word: string) => string | null;
  clearError: (word: string) => void;
  // true після ПЕРШОГО успішного save() за цю сесію провайдера — читає
  // підказка над скриптом (script-section.tsx DictHint), щоб сховатись
  // одразу після першого збереження, без чекання наступного завантаження
  // сторінки.
  hasSavedAny: boolean;
};

const SavedWordsContext = createContext<SavedWordsContextValue | null>(null);

// null — немає провайдера (сторінка матеріалів/DELF без контексту сцени)
// АБО провайдер є, але студент не залогінений (page.tsx тоді просто не
// рендерить SavedWordsProvider узагалі) — в обох випадках кнопка
// збереження має сховатись, тому компоненти просто перевіряють `if
// (!saved) return null`, без додаткового прапорця isLoggedIn.
export function useSavedWords(): SavedWordsContextValue | null {
  return useContext(SavedWordsContext);
}

export function SavedWordsProvider({
  sourceType,
  sourceId,
  productId,
  sourceTitle,
  initialSaved,
  children,
}: {
  sourceType: SavedWordSourceType;
  sourceId: string;
  productId: string;
  sourceTitle: string;
  initialSaved: SavedWordSourceEntry[];
  children: React.ReactNode;
}) {
  const [savedByKey, setSavedByKey] = useState<Map<string, SavedEntry>>(
    () => new Map(initialSaved.map((w) => [w.wordKey, { id: w.id, translation: w.translation }]))
  );
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [errorByKey, setErrorByKey] = useState<Map<string, string>>(new Map());
  const [hasSavedAny, setHasSavedAny] = useState(false);

  const isSaved = useCallback((word: string) => savedByKey.has(computeWordKey(word)), [savedByKey]);
  const getSaved = useCallback((word: string) => savedByKey.get(computeWordKey(word)) ?? null, [savedByKey]);
  const isPending = useCallback((word: string) => pendingKeys.has(computeWordKey(word)), [pendingKeys]);
  const getError = useCallback((word: string) => errorByKey.get(computeWordKey(word)) ?? null, [errorByKey]);
  const clearError = useCallback(
    (word: string) =>
      setErrorByKey((prev) => {
        const key = computeWordKey(word);
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }),
    []
  );

  const save = useCallback(
    async (snapshot: SaveWordSnapshot) => {
      const key = computeWordKey(snapshot.word);
      setPendingKeys((prev) => new Set(prev).add(key));
      setErrorByKey((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      const result = await saveWordAction({
        sourceType,
        sourceId,
        productId,
        sourceTitle,
        vocabId: snapshot.vocabId ?? null,
        word: snapshot.word,
        translation: snapshot.translation ?? null,
        translationSource: snapshot.translationSource,
        partOfSpeech: snapshot.partOfSpeech ?? null,
        note: snapshot.note ?? null,
        imageUrl: snapshot.imageUrl ?? null,
        contextFr: snapshot.contextFr ?? null,
        contextUk: snapshot.contextUk ?? null,
      });

      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      if (result.ok && result.id) {
        setSavedByKey((prev) => {
          const next = new Map(prev);
          next.set(key, { id: result.id as string, translation: snapshot.translation ?? null });
          return next;
        });
        setHasSavedAny(true);
        return { ok: true };
      }

      const message = result.error ?? "db";
      setErrorByKey((prev) => new Map(prev).set(key, message));
      return { ok: false, error: message };
    },
    [sourceType, sourceId, productId, sourceTitle]
  );

  const remove = useCallback(
    async (word: string) => {
      const key = computeWordKey(word);
      const entry = savedByKey.get(key);
      if (!entry) return { ok: true };

      setPendingKeys((prev) => new Set(prev).add(key));
      const result = await removeWordAction(entry.id);
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      if (result.ok) {
        setSavedByKey((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        return { ok: true };
      }

      setErrorByKey((prev) => new Map(prev).set(key, result.error ?? "db"));
      return { ok: false, error: result.error };
    },
    [savedByKey]
  );

  const value = useMemo(
    () => ({ isSaved, getSaved, save, remove, isPending, getError, clearError, hasSavedAny }),
    [isSaved, getSaved, save, remove, isPending, getError, clearError, hasSavedAny]
  );

  return <SavedWordsContext.Provider value={value}>{children}</SavedWordsContext.Provider>;
}
