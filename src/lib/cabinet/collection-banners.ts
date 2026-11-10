import { COLLECTION_NUMBERS } from "@/lib/cabinet/achievements";

// Ключ дисмісса банера "Колекцію N зібрано" — спільний для full-
// achievements.tsx (читає/пише при закритті банера) і адмін-сторінки
// симулятора ("Показати плашку знову" знімає всі ключі одразу).
export function collectionBannerDismissKey(collection: number): string {
  return `tdf.collectionBannerDismissed.${collection}`;
}

export function clearAllCollectionBannerDismissals(): void {
  for (const n of COLLECTION_NUMBERS) {
    try {
      localStorage.removeItem(collectionBannerDismissKey(n));
    } catch {
      // приватний режим тощо — не критично
    }
  }
}
