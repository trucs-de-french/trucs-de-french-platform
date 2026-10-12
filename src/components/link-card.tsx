import type { LucideIcon } from "lucide-react";

// Спільна картка-посилання — той самий вигляд для фіксованої "Практика"
// (scene_links) і для завдань типу "link" у списку "Завдання"
// (scenes/[sceneId]/page.tsx), щоб вигляд ніколи не розходився між двома
// місцями використання.
export function LinkCard({
  href,
  download,
  icon: Icon,
  name,
  subtitle,
  className = "",
}: {
  href: string;
  download?: boolean;
  icon: LucideIcon;
  name: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(download ? { download: true } : { target: "_blank" })}
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-heading text-base font-semibold">{name}</span>
        <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</span>
      </span>
    </a>
  );
}
