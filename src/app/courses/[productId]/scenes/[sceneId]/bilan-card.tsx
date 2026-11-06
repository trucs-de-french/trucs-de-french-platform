import Link from "next/link";
import { Trophy, Check, ArrowRight } from "lucide-react";
import type { UiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { frenchNbsp } from "@/lib/text/french-typography";
import { formatPointsLocalized, formatScoreLocalized } from "@/lib/exercises/format-points";
import { getTaskBarText } from "@/lib/exercises/task-bar-text";
import { bilanVerdict, type SceneSummary } from "@/lib/exercises/scene-summary";

// Новий сценовий підсумок (BILAN) — НЕ замінює "Підсумок завдання"
// (TaskSummaryCard, block-navigation.tsx): цей блок рахує ЦІЛУ сцену, той —
// лише блоки однієї вправи, обидва лишаються на сторінці одночасно.
//
// Вердикт (bilanVerdict) і сам підпис "BILAN" — завжди французькою,
// незалежно від ui_lang продукту (явна вимога задачі), тому НЕ через
// t()/i18n-словники нижче: лише ОДИН рядок французькою, не три. Решта
// підписів картки — звичайний t(lang, ...).
//
// wordsToReview — точка розширення на майбутнє ("слова на повторення"),
// навмисно НІЧОГО не рендерить поки не передано: немає жодного зв'язку
// mistakes <-> vocab сьогодні (аудит), будувати його зараз НЕ входить у цю
// задачу.
export function BilanCard({
  lang,
  productId,
  summary,
  newWordsCount,
  nextSceneHref,
}: {
  lang: UiLang;
  productId: string;
  summary: SceneSummary;
  newWordsCount: number;
  nextSceneHref: string | null;
  // Точка розширення на майбутнє (аудит, п.8: "слова на повторення") —
  // навмисно НЕ в деструктуризації вище (нема що з ним робити поки не
  // передано) і навмисно `unknown`, не конкретний тип: форма ще не
  // вирішена, аудит показав, що зв'язку mistakes<->vocab сьогодні нема.
  wordsToReview?: unknown;
}) {
  const verdict = frenchNbsp(bilanVerdict(summary.percent));
  const statusLabel = summary.allAttempted
    ? t(lang, "bilan.sceneCompleted")
    : t(lang, "bilan.sceneInProgress");
  const pointsLine = formatPointsLocalized(summary.pointsEarned, summary.pointsPossible, lang);
  const percentText = lang === "fr" ? `${summary.percent} %` : `${summary.percent}%`;

  return (
    <section aria-labelledby="bilan-heading">
      {/* Зовнішня плашка з трофеєм — суто декоративна (aria-hidden на самій
          іконці), "BILAN" як підпис секції, не h2 (STUDENT_SECTION_HEADING
          зайнятий "Відео"/"Скрипт"/.../"Завдання" вище по сторінці, цей
          підпис — частина картки, не ще одна секція того самого рівня). */}
      <div className="mb-3 inline-flex items-center gap-2 rounded-2xl border-[1.5px] border-[#d9b765] bg-[#fdf8ea] px-3 py-1.5 dark:border-[#f3d98b] dark:bg-[rgba(10,16,48,0.82)]">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f6dc8e,#e0aa3e)]"
        >
          <Trophy size={16} className="text-[#1a1640]" />
        </span>
        <span className="font-heading text-sm font-bold tracking-[0.18em] text-[#1a1640] dark:text-[#f6dc8e]">
          BILAN
        </span>
      </div>

      <div className="overflow-hidden rounded-[20px] border-[1.5px] border-[#d9b765] dark:border-[#f3d98b]">
        {/* Хедер — індиго-градієнт, завжди білий текст (не залежить від
            теми: і світла, і темна тема мають той самий градієнт тут, лише
            решта картки (тайли/фон) перемикається). */}
        <div className="relative flex items-center justify-between gap-4 bg-[linear-gradient(135deg,#2f2c6b,#4b46da)] px-5 py-6 sm:px-7">
          {/* Декоративні зірки/крапки — aria-hidden, той самий принцип, що
              задача просить ("subtle, 55% opacity"). */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-4 text-[#f3d98b] opacity-55"
          >
            ✦
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-16 top-9 h-1 w-1 rounded-full bg-white opacity-55"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-28 top-6 text-white opacity-55"
          >
            ✦
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-5 left-28 h-1 w-1 rounded-full bg-[#f3d98b] opacity-55"
          />

          <div className="relative z-10 min-w-0">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-[#f3d98b]">
              {statusLabel}
            </p>
            <h2
              id="bilan-heading"
              className="font-heading mt-1 text-[32px] font-bold leading-tight text-white sm:text-[44px]"
            >
              {verdict}
            </h2>
            <p className="mt-1 text-sm text-white/90 sm:text-base">
              {pointsLine} · <span aria-label={`${summary.percent} ${t(lang, "bilan.successRate")}`}>{percentText} {t(lang, "bilan.successRate")}</span>
            </p>
          </div>

          <div
            aria-hidden="true"
            className="relative z-10 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#fdf8ea] bg-[linear-gradient(135deg,#f3dc96,#d9b765)] sm:h-[112px] sm:w-[112px]"
          >
            <Trophy size={40} className="text-[#2f2c6b]" />
          </div>
        </div>

        {/* Тіло — панельний фон проєкту (світла/темна тема), тайли +
            "Exercices à refaire" + кнопка "Scène suivante". */}
        <div className="bg-[#fdf8ea] px-5 py-6 sm:px-7 dark:bg-[rgba(10,16,48,0.82)]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <BilanTile
              label={t(lang, "bilan.pointsLabel")}
              value={`${formatScoreLocalized(summary.pointsEarned, lang)} / ${formatScoreLocalized(summary.pointsPossible, lang)}`}
            />
            <BilanTile label={`% ${t(lang, "bilan.successRate")}`} value={percentText} />
            {newWordsCount > 0 && (
              <BilanTile label={t(lang, "bilan.newWords")} value={String(newWordsCount)} />
            )}
          </div>

          {summary.tasksToRedo.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-heading text-sm font-bold text-[#1a1640] dark:text-[#f6dc8e]">
                {t(lang, "bilan.redoTitle")}
              </h3>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {summary.tasksToRedo.map((task) => (
                  <li key={task.taskId}>
                    <a
                      href={`#task-${task.taskId}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border-[1.5px] border-[#dcbd6e] bg-white px-3 py-2 text-sm transition-colors hover:border-[#d9b765] dark:border-[rgba(243,217,139,0.3)] dark:bg-[rgba(255,255,255,0.06)] dark:hover:border-[#f3d98b]"
                    >
                      <span className="min-w-0 truncate text-[#1a1640] dark:text-white">
                        {getTaskBarText({ type: task.taskType, config: task.config })}
                        <span className="ml-2 font-heading text-xs font-semibold text-[#55546b] dark:text-[#b8b6d9]">
                          {task.attempted ? `${task.percent}%` : t(lang, "bilan.notDoneYet")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 font-heading text-xs font-semibold text-[#3b36c4] dark:text-[#a8a4ff]">
                        {t(lang, "bilan.redoLink")}
                        <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 font-heading text-sm font-semibold text-[#1a1640] dark:text-[#f6dc8e]">
              <Check size={18} aria-hidden="true" />
              {t(lang, "bilan.allMastered")}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            {nextSceneHref ? (
              <Link
                href={nextSceneHref}
                className="font-heading flex min-h-[56px] items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#5a55e6,#3b36c4)] px-8 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                {t(lang, "bilan.nextScene")}
              </Link>
            ) : (
              <Link
                href={`/courses/${productId}`}
                className="font-heading flex min-h-[56px] items-center justify-center rounded-[18px] border-[1.5px] border-[#d9b765] bg-white px-8 text-sm font-bold text-[#1a1640] shadow-sm transition-colors hover:bg-[#fdf8ea] dark:border-[#f3d98b] dark:bg-transparent dark:text-[#f6dc8e] dark:hover:bg-[rgba(243,217,139,0.08)]"
              >
                {t(lang, "bilan.backToCourse")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BilanTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-[#e4cf94] bg-white px-3 py-3 text-center dark:border-[rgba(243,217,139,0.3)] dark:bg-[rgba(255,255,255,0.06)]">
      <p className="font-heading text-xl font-bold text-[#1a1640] dark:text-white">{value}</p>
      <p className="mt-0.5 text-xs text-[#55546b] dark:text-[#b8b6d9]">{label}</p>
    </div>
  );
}
