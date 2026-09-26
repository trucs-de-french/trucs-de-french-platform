"use client";

import { useEffect, useState } from "react";

// Підсвічує щойно створені задачі (bulk-from-vocab: ?newTasks=id1,id2,...)
// на ~3с, потім забуває. ids читається лише ОДИН РАЗ при монтуванні (сам
// запуск через query-параметр — річ одноразова, "щойно приземлились сюди
// після створення"), тож useEffect з порожніми deps навмисно, не
// eslint-виправлення. Спільний для TaskDragList/TestSectionDragList
// (список "Завдання") і GroupMemberDragList (список членів блоку) — обидва
// можуть бути ціллю bulk-from-vocab.
export function useNewTaskHighlight(ids: string[]): Set<string> {
  const [highlighted, setHighlighted] = useState<Set<string>>(() => new Set(ids));

  useEffect(() => {
    if (ids.length === 0) return;
    const timer = setTimeout(() => setHighlighted(new Set()), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return highlighted;
}
