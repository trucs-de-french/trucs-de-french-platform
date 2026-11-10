import {
  Clapperboard,
  Film,
  Flame,
  Star,
  Pencil,
  RotateCcw,
  Target,
  GraduationCap,
  BookMarked,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { AchievementCategory } from "@/lib/cabinet/achievements";
import type { MessageKey } from "@/lib/i18n/t";

export const CATEGORY_ICON: Record<AchievementCategory, LucideIcon> = {
  scenes: Clapperboard,
  films: Film,
  streak: Flame,
  points: Star,
  exercises: Pencil,
  mistakes: RotateCcw,
  weeklyGoal: Target,
  exam: GraduationCap,
  dictionary: BookMarked,
  collection: Trophy,
};

export const CATEGORY_LABEL_KEY: Record<AchievementCategory, MessageKey> = {
  scenes: "achievements.category.scenes",
  films: "achievements.category.films",
  streak: "achievements.category.streak",
  points: "achievements.category.points",
  exercises: "achievements.category.exercises",
  mistakes: "achievements.category.mistakes",
  weeklyGoal: "achievements.category.weeklyGoal",
  exam: "achievements.category.exam",
  dictionary: "achievements.category.exam",
  collection: "achievements.category.collection",
};

// "dictionary" свідомо виключено — available:false, нема джерела даних,
// не показуємо її ні в чипах, ні в зонах повної сторінки.
export const CATEGORY_ORDER: AchievementCategory[] = [
  "scenes",
  "films",
  "streak",
  "points",
  "exercises",
  "mistakes",
  "weeklyGoal",
  "exam",
  "collection",
];

// Номер колекції → римська цифра для текстів ("Колекція {n}" тощо) —
// запасний варіант String(n), якщо колекцій колись стане більше 5.
export const COLLECTION_ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
