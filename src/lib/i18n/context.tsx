"use client";

import { createContext, useContext, useMemo } from "react";
import type { UiLang } from "@/lib/ui/product-lang";
import { t as translate, type MessageKey } from "./t";

type LangContextValue = { lang: UiLang };

// Дефолт 'uk' без провайдера — той самий принцип, що theme-script.tsx:
// компонент поза продуктом (каталог/кабінет/авторизація) ніколи не бачить
// LangProvider і просто лишається українським.
const LangContext = createContext<LangContextValue>({ lang: "uk" });

export function LangProvider({ lang, children }: { lang: UiLang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT(): { lang: UiLang; t: (key: MessageKey, params?: Record<string, string | number>) => string } {
  const { lang } = useContext(LangContext);
  return useMemo(
    () => ({
      lang,
      t: (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params),
    }),
    [lang]
  );
}
