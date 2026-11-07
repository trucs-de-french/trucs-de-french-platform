"use client";

import { useTransition } from "react";
import type { UiLang } from "@/lib/ui/product-lang";
import { setCabinetUiLang } from "@/app/cabinet/actions";

const LANGS: UiLang[] = ["uk", "fr", "en"];

// Три pill-кнопки UK/FR/EN — вжито і в expanded sidebar (label "cabinet.
// nav.language" над ними), і compact-режим (один <CabinetLangCycle>
// нижче) на collapsed rail/мобільному "Ще".
export function LanguagePills({ current }: { current: UiLang }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-1.5">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          disabled={isPending}
          aria-pressed={lang === current}
          onClick={() => startTransition(() => setCabinetUiLang(lang))}
          className={`cabinet-lang-pill ${lang === current ? "cabinet-lang-pill--active" : ""}`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Collapsed rail: один ґудзик, циклічно перемикає мову (найпростіший
// прийнятний варіант за ТЗ — без спливного меню).
export function CabinetLangCycle({ current }: { current: UiLang }) {
  const [isPending, startTransition] = useTransition();
  const next = LANGS[(LANGS.indexOf(current) + 1) % LANGS.length];

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => setCabinetUiLang(next))}
      aria-label={`${current.toUpperCase()} → ${next.toUpperCase()}`}
      className="cabinet-lang-pill cabinet-lang-pill--active"
    >
      {current.toUpperCase()}
    </button>
  );
}
