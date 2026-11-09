import { CheckCircle2, Film, Flame, Star, PenLine, RotateCcw, Target, GraduationCap, BookOpen, type LucideIcon } from "lucide-react";
import type { AchievementIcon } from "@/lib/cabinet/achievements";

export const ACHIEVEMENT_ICON_MAP: Record<AchievementIcon, LucideIcon> = {
  check: CheckCircle2,
  film: Film,
  flame: Flame,
  star: Star,
  pencil: PenLine,
  rotate: RotateCcw,
  target: Target,
  graduation: GraduationCap,
  book: BookOpen,
};
