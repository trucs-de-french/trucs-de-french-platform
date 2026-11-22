"use client";

import { useEffect } from "react";

// Задача-виправлення "reload lands on Karaoke block mid-page" — не
// Karaoke-специфічна й не браузерне scrollRestoration (перевірено: ні
// тут, ні деінде в проєкті history.scrollRestoration не виставляється,
// тож навіщось спеціально керувати ним НЕ потрібно для самого фіксу
// нижче). Корінь: BilanCard ("Exercices à refaire", bilan-card.tsx) і
// deep-лінки "Продовжити" (cabinet/home-data.ts, cabinet/library-data.ts)
// ведуть на /courses/.../scenes/[sceneId]#task-<id> — звичайний <a href>,
// не Link, свідомо: саме так браузер сам, одразу при завантаженні,
// скролить до елемента з id={`task-${task.id}`} (page.tsx, список задач)
// — це БАЖАНА поведінка при першому переході за таким посиланням.
// Проблема лише в тому, що URL-хеш лишається в адресному рядку й ПІСЛЯ
// переходу: Cmd+R перезавантажує ТОЙ САМИЙ URL із тим самим #task-<id>,
// і браузер слухняно повторює той самий автоскрол — щоразу, незалежно від
// того, де студент насправді гортав сторінку перед перезавантаженням.
// Якщо той task — Karaoke (чи будь-яка інша задача всередині сцени),
// сцена після Cmd+R відкривається саме там, а не з самого початку.
//
// Фікс — лише для СПРАВЖНЬОГО reload (Navigation Timing API, не легасі
// performance.navigation): перший перехід за хеш-лінком (type "navigate")
// лишається недоторканим (автоскрол до задачі — та сама функція, що й
// раніше), але коли сторінку саме ПЕРЕЗАВАНТАЖИЛИ — автоскрол браузера
// вже встиг спрацювати ДО гідратації, тож тут лише ПОВЕРТАЄ скрол нагору
// одразу після монтування. Не чіпає історію/back-forward (type
// "back_forward" теж не зачіпається, той самий принцип — якщо студент
// повернувся сюди кнопкою "Назад", попередній скрол лишається, як і
// очікується) і не чіпає сам #task-<id> у рядку адреси (strip хеша тут
// не потрібен — ефект звіряє лише type навігації, не сам факт наявності
// хеша).
export function ScrollTopOnReload() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof performance === "undefined") return;
    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navEntry?.type !== "reload") return;
    window.scrollTo(0, 0);
  }, []);

  return null;
}
