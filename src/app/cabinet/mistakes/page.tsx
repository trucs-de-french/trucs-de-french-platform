import Link from "next/link";
import { ListChecks, Film, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang, type UiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { plural } from "@/lib/i18n/plural";
import { getTaskBarText } from "@/lib/exercises/task-bar-text";
import { isMistakePracticeSupported } from "@/lib/exercises/error-review";
import { TASK_TYPE_ICON } from "@/lib/exercises/task-type-meta";
import {
  buildMistakesOverview,
  EMPTY_MISTAKES_OVERVIEW,
  type MistakesOverview,
  type MistakeTaskRow,
} from "@/lib/cabinet/mistakes-overview";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import type { Profile } from "@/lib/supabase/profile";

// "Робота над помилками", крок 1 — список завдань із невиправленими
// помилками, згрупований по сценах. Жодних нових шляхів оцінювання: лише
// читання mistakes/progress/mistake_corrections через звичайний
// RLS-скопований клієнт (той самий user-сесійний supabase, що решта
// кабінету), ЖОДНОГО service-role. Групування — чиста функція
// buildMistakesOverview (mistakes-overview.ts), що напряму викликає
// buildErrorReviewEntry (error-review.ts) — те саме правило, що вже
// рендерить сценова сторінка, тут не продубльоване.
async function loadOverview(userId: string): Promise<MistakesOverview> {
  const supabase = await createClient();

  // Лімітуємо 500 найновіших рядків mistakes (ORDER BY created_at DESC) —
  // той самий принцип стелі, що saved_words (dictionary/page.tsx):
  // студент із реалістичним обсягом помилок ніколи цю стелю не досягне,
  // захист від необмеженого росту запиту для давніх акаунтів.
  const { data: mistakeRows, error: mistakesError } = await supabase
    .from("mistakes")
    .select("task_id, ai_feedback, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (mistakesError) throw mistakesError;
  if (!mistakeRows || mistakeRows.length === 0) return EMPTY_MISTAKES_OVERVIEW;

  const taskIds = [...new Set(mistakeRows.map((m) => m.task_id))];

  // tasks_select (RLS) вимагає активний enrollment — цей запит сам
  // звужується до завдань, доступних студенту; завдання з продуктів, де
  // enrollment неактивний/відсутній, тут просто не прийдуть (не помилка).
  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("id, type, title, config, scene_id, task_group_id, product_id, order_index")
    .in("id", taskIds);
  if (tasksError) throw tasksError;
  if (!taskRows || taskRows.length === 0) return EMPTY_MISTAKES_OVERVIEW;

  // Ефективний scene_id (крок 2, виправлення): tasks.scene_id напряму, або,
  // якщо задача — член групи (scene_id обнулений, 0031_task_groups.sql),
  // scene_id САМОЇ ГРУПИ — resolveSceneId у mistakes-overview.ts робить це
  // так само, як scene-error-review.ts (сторінка /cabinet/mistakes/[sceneId]),
  // тож список тут не пропускає задачі, які та сторінка вже показує. ОДИН
  // додатковий запит (.in на унікальні task_group_id), без N+1.
  const groupIds = [...new Set(taskRows.map((r) => r.task_group_id).filter((id): id is string => !!id))];
  const { data: groupRows, error: groupsError } = groupIds.length
    ? await supabase.from("task_groups").select("id, scene_id").in("id", groupIds)
    : { data: [], error: null };
  if (groupsError) throw groupsError;

  const taskGroups: { id: string; sceneId: string | null }[] = (groupRows ?? []).map((g) => ({
    id: g.id,
    sceneId: g.scene_id,
  }));
  const groupSceneById = new Map(taskGroups.map((g) => [g.id, g.sceneId]));

  const tasks: MistakeTaskRow[] = taskRows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    config: r.config as Record<string, unknown> | null,
    sceneId: r.scene_id,
    taskGroupId: r.task_group_id,
    productId: r.product_id,
    orderIndex: r.order_index,
  }));

  const effectiveSceneId = (task: MistakeTaskRow): string | null =>
    task.sceneId ?? (task.taskGroupId ? groupSceneById.get(task.taskGroupId) ?? null : null);
  const sceneIds = [...new Set(tasks.map(effectiveSceneId).filter((id): id is string => !!id))];
  const productIds = [...new Set(tasks.map((t2) => t2.productId))];

  // pilotTaskIds — той самий фільтр, що сценова сторінка (pilotTaskIds,
  // scenes/[sceneId]/page.tsx): лише типи з реальною практикою потребують
  // RPC get_mistake_correction_state взагалі.
  const pilotTaskIds = tasks.filter((t2) => isMistakePracticeSupported(t2.type)).map((t2) => t2.id);

  const [{ data: sceneRows, error: scenesError }, { data: productRows, error: productsError }, { data: progressRows, error: progressError }, correctionResults] =
    await Promise.all([
      sceneIds.length
        ? supabase.from("scenes").select("id, title, product_id, order_index").in("id", sceneIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("products").select("id, title").in("id", productIds),
      supabase.from("progress").select("task_id, score").eq("user_id", userId).in("task_id", taskIds),
      Promise.all(
        pilotTaskIds.map((id) => supabase.rpc("get_mistake_correction_state", { p_user_id: userId, p_task_id: id }))
      ),
    ]);
  if (scenesError) throw scenesError;
  if (productsError) throw productsError;
  if (progressError) throw progressError;

  const correctionStates = pilotTaskIds.map((id, i) => {
    const row = correctionResults[i]?.data?.[0] as
      | { corrected_item_ids: string[]; failed_attempts: Record<string, number> }
      | undefined;
    return {
      taskId: id,
      correctedItemIds: row?.corrected_item_ids ?? [],
      failedAttempts: row?.failed_attempts ?? {},
    };
  });

  return buildMistakesOverview({
    mistakeRows: mistakeRows.map((m) => ({ taskId: m.task_id, createdAt: m.created_at, detail: m.ai_feedback })),
    tasks,
    taskGroups,
    scenes: (sceneRows ?? []).map((s) => ({ id: s.id, title: s.title, productId: s.product_id, orderIndex: s.order_index })),
    products: (productRows ?? []).map((p) => ({ id: p.id, title: p.title })),
    progress: (progressRows ?? []).map((p) => ({ taskId: p.task_id, score: p.score })),
    correctionStates,
  });
}

// "N помилка/помилки/помилок" — той самий принцип, що pluralizeMistakes
// (error-review-block.tsx): власна mod10/mod100-логіка для uk, бо
// Intl.PluralRules("uk") дає категорії few/many, які код елсе не
// використовує в проєкті — лишаємось на тому самому перевіреному підході.
function mistakesWord(lang: UiLang, n: number): string {
  if (lang === "uk") {
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "помилка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "помилки";
    return "помилок";
  }
  return plural(lang, n, lang === "fr" ? { one: "erreur", other: "erreurs" } : { one: "mistake", other: "mistakes" });
}
function scenesWord(lang: UiLang, n: number): string {
  if (lang === "uk") {
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "сцена";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сцени";
    return "сцен";
  }
  return plural(lang, n, lang === "fr" ? { one: "scène", other: "scènes" } : { one: "scene", other: "scenes" });
}

export default async function CabinetMistakesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();
  const lang = normalizeUiLang(profile?.ui_lang);

  let overview: MistakesOverview;
  let loadFailed = false;
  try {
    overview = await loadOverview(user.id);
  } catch {
    overview = EMPTY_MISTAKES_OVERVIEW;
    loadFailed = true;
  }

  const summaryPills = !loadFailed && overview.scenesCount > 0 && (
    <div className="mistakes-summary-pills">
      <span className="mistakes-summary-pill">
        <ListChecks size={15} aria-hidden="true" />
        {overview.totalMistakes} {mistakesWord(lang, overview.totalMistakes)}
      </span>
      <span className="mistakes-summary-pill">
        <Film size={15} aria-hidden="true" />
        {overview.scenesCount} {scenesWord(lang, overview.scenesCount)}
      </span>
    </div>
  );

  return (
    <div>
      <CabinetMobileHeader />
      <PageHeader
        title={t(lang, "cabinet.nav.mistakes")}
        subtitle={t(lang, "cabinet.mistakes.subtitle")}
        actions={summaryPills || undefined}
      />

      {loadFailed ? (
        <p className="mistakes-load-error">{t(lang, "cabinet.mistakes.loadError")}</p>
      ) : overview.scenes.length === 0 ? (
        <div className="mistakes-empty-card">
          <CheckCircle2 size={28} aria-hidden="true" className="mistakes-empty-icon" />
          <p className="mistakes-empty-title">{t(lang, "cabinet.mistakes.emptyTitle")}</p>
          <p className="mistakes-empty-text">{t(lang, "cabinet.mistakes.emptyText")}</p>
          <Link href="/cabinet/library" className="mistakes-empty-btn">
            {t(lang, "cabinet.mistakes.toCourses")}
          </Link>
        </div>
      ) : (
        <div className="mistakes-scenes-grid">
          {overview.scenes.map((scene) => (
            <div key={scene.sceneId} className="mistakes-scene-card">
              <div className="mistakes-scene-card-head">
                <div className="mistakes-scene-card-head-text">
                  <p className="mistakes-scene-title" title={scene.sceneTitle}>
                    {scene.sceneTitle}
                  </p>
                  <p className="mistakes-scene-course">{scene.courseTitle}</p>
                  {scene.tasks.length > 1 && (
                    <Link href={`/cabinet/mistakes/${scene.sceneId}`} className="mistakes-scene-all-link">
                      {t(lang, "cabinet.mistakes.allMistakesLink")}
                    </Link>
                  )}
                </div>
                <span className="mistakes-scene-count">
                  {scene.totalUnresolved} {mistakesWord(lang, scene.totalUnresolved)}
                </span>
              </div>
              <ul className="mistakes-task-list">
                {scene.tasks.map((task) => {
                  const Icon = TASK_TYPE_ICON[task.taskType];
                  const typeName = getTaskBarText({ type: task.taskType, config: task.config });
                  return (
                    <li key={task.taskId} className="mistakes-task-row">
                      <span className="mistakes-task-icon" aria-hidden="true">
                        {Icon && <Icon size={17} />}
                      </span>
                      <div className="mistakes-task-text">
                        <p className="mistakes-task-title" title={task.title}>
                          {task.title}
                        </p>
                        <p className="mistakes-task-subtitle">
                          {typeName} · {task.unresolvedCount} {mistakesWord(lang, task.unresolvedCount)}
                        </p>
                      </div>
                      <Link href={`/cabinet/mistakes/${task.sceneId}?task=${task.taskId}`} className="mistakes-fix-btn">
                        {t(lang, "cabinet.mistakes.fix")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
