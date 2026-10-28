"use client";

import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import type { ReactNode } from "react";

// Спільна темно-скляна картка-посилання — один вигляд для "Практики"
// (scene_links, і фіксованої, і всередині контент-блоку), задач типу
// "link"/"game" (студентська сторінка/DELF/матеріали через exercise-
// block.tsx) і прев'ю в конструкторі (task-config-fields.tsx), щоб вигляд
// ніколи не розходився між місцями використання. Стилі — .link-card*
// (globals.css), фіксовані кольори, однакові в обох темах сайту і з/без
// фону курсу (той самий підхід, що .scene-pdf-button/.scene-fullscreen-btn).
//
// icon — ReactNode (вже змонтований <Icon .../> елемент), НЕ компонент/
// функція: LinkCard — "use client" (useT() нижче), а server-компоненти
// (page.tsx, scene-content-block.tsx, exercise-block.tsx) не можуть
// передавати функції/компоненти як пропи через межу server→client ("Only
// plain objects can be passed... Classes or other objects with methods
// are not supported" / "Functions cannot be passed directly") — React-
// елемент (результат викличення компонента) серіалізується нормально,
// сам компонент (посилання на функцію) — ні. Викликачі самі монтують
// іконку (`<Icon size={22} strokeWidth={2} />`) і передають готовий JSX.
export function LinkCard({
  href,
  download,
  icon,
  title,
  subtitle,
  variant = "default",
  className = "",
}: {
  href: string;
  download?: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  // "featured" — власна гра (scene_links platform "custom"): золота рамка,
  // заповнене градієнтом коло іконки замість контурного.
  variant?: "default" | "featured";
  className?: string;
}) {
  // Сьогодні download-картки відкриваються в ТІЙ Ж вкладці (атрибут
  // download), решта — завжди в новій (target="_blank") — той самий
  // поділ, що був і до уніфікації. Стрілка ↗ і прихований текст "(відкриється
  // в новій вкладці)" показуються лише для другого випадку.
  const opensInNewTab = !download;
  const { t } = useT();

  return (
    <a
      href={href}
      {...(download ? { download: true } : { target: "_blank" })}
      rel="noopener noreferrer"
      className={`link-card ${variant === "featured" ? "link-card--featured" : ""} ${className}`}
    >
      <span className="link-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="link-card-text">
        <span className="link-card-title">{title}</span>
        <span className="link-card-subtitle">{subtitle}</span>
      </span>
      {opensInNewTab && (
        <>
          <ArrowUpRight className="link-card-arrow" aria-hidden="true" size={18} strokeWidth={2.4} />
          <span className="sr-only">{t("linkCard.opensInNewTabAria")}</span>
        </>
      )}
    </a>
  );
}
