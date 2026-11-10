"use client";

// Оркестратор сторінки Налаштування: тримає dirty-стан лише для полів, що
// йдуть одним збереженням (ім'я/фото-маскот/сповіщення — saveProfileSettings).
// Мова/тема/тижнева ціль/іспит застосовують свої ВЛАСНІ дії одразу
// (interface-card.tsx/learning-card.tsx) і сюди не входять.
import { useState } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ExamInfo } from "@/lib/cabinet/home-data";
import type { FrenchLevel, FrenchLevelSource, LearningGoal, NotificationPrefs } from "@/lib/supabase/profile";
import { saveProfileSettings } from "@/app/cabinet/settings/actions";
import { SettingsProfileCard } from "./profile-card";
import { AboutMeCard } from "./about-me-card";
import { InterfaceCard } from "./interface-card";
import { LearningCard } from "./learning-card";
import { NotificationsCard } from "./notifications-card";
import { AccountCard } from "./account-card";
import { SettingsSaveBar } from "./save-bar";

type DirtyState = {
  name: string;
  mascot: string | null;
  avatarUrl: string | null;
  notifReview: boolean;
  notifWeeklyGoal: boolean;
  notifNews: boolean;
};

export function SettingsForm({
  lang,
  userId,
  email,
  isTeacher,
  initialName,
  initialMascot,
  initialAvatarUrl,
  initialNotificationPrefs,
  weeklyGoal,
  exam,
  showExamCard,
  aboutMeAvailable,
  initialLearningGoals,
  initialFrenchLevel,
  initialFrenchLevelSource,
  initialIsDark = null,
  onSignOut,
}: {
  lang: UiLang;
  userId: string;
  email: string;
  isTeacher: boolean;
  initialName: string;
  initialMascot: string | null;
  initialAvatarUrl: string | null;
  initialNotificationPrefs: NotificationPrefs;
  weeklyGoal: number;
  exam: ExamInfo | null;
  showExamCard: boolean;
  aboutMeAvailable: boolean;
  initialLearningGoals: LearningGoal[];
  initialFrenchLevel: FrenchLevel | null;
  initialFrenchLevelSource: FrenchLevelSource | null;
  initialIsDark?: boolean | null;
  onSignOut: () => Promise<void>;
}) {
  const [savedState, setSavedState] = useState<DirtyState>(() => ({
    name: initialName,
    mascot: initialMascot,
    avatarUrl: initialAvatarUrl,
    notifReview: initialNotificationPrefs.review,
    notifWeeklyGoal: initialNotificationPrefs.weekly_goal,
    notifNews: initialNotificationPrefs.news,
  }));
  const [state, setState] = useState<DirtyState>(savedState);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    state.name !== savedState.name ||
    state.mascot !== savedState.mascot ||
    state.avatarUrl !== savedState.avatarUrl ||
    state.notifReview !== savedState.notifReview ||
    state.notifWeeklyGoal !== savedState.notifWeeklyGoal ||
    state.notifNews !== savedState.notifNews;

  function handleCancel() {
    setState(savedState);
    setError(null);
  }

  async function handleSave(): Promise<boolean> {
    setError(null);
    const formData = new FormData();
    formData.set("name", state.name);
    formData.set("mascot", state.mascot ?? "");
    formData.set("avatarUrl", state.avatarUrl ?? "");
    if (state.notifReview) formData.set("notifReview", "on");
    if (state.notifWeeklyGoal) formData.set("notifWeeklyGoal", "on");
    if (state.notifNews) formData.set("notifNews", "on");

    const result = await saveProfileSettings(formData);
    if (!result.ok) {
      setError(t(lang, "settings.save.error"));
      return false;
    }
    setSavedState(state);
    return true;
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <AboutMeCard
        lang={lang}
        available={aboutMeAvailable}
        initialGoals={initialLearningGoals}
        initialLevel={initialFrenchLevel}
        initialLevelSource={initialFrenchLevelSource}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SettingsProfileCard
          lang={lang}
          userId={userId}
          name={state.name}
          email={email}
          mascot={state.mascot}
          avatarUrl={state.avatarUrl}
          onNameChange={(name) => setState((s) => ({ ...s, name }))}
          onMascotChange={(mascot) => setState((s) => ({ ...s, mascot }))}
          onAvatarUrlChange={(avatarUrl) => setState((s) => ({ ...s, avatarUrl }))}
        />
        <InterfaceCard lang={lang} initialIsDark={initialIsDark} />
        <LearningCard lang={lang} goal={weeklyGoal} exam={exam} showExamCard={showExamCard} />
        <NotificationsCard
          lang={lang}
          review={state.notifReview}
          weeklyGoal={state.notifWeeklyGoal}
          news={state.notifNews}
          onReviewChange={(v) => setState((s) => ({ ...s, notifReview: v }))}
          onWeeklyGoalChange={(v) => setState((s) => ({ ...s, notifWeeklyGoal: v }))}
          onNewsChange={(v) => setState((s) => ({ ...s, notifNews: v }))}
        />
        <AccountCard lang={lang} isTeacher={isTeacher} onSignOut={onSignOut} />
      </div>

      <SettingsSaveBar lang={lang} dirty={dirty} error={error} onCancel={handleCancel} onSave={handleSave} />
    </div>
  );
}
