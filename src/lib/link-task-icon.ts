import {
  Link2,
  Download,
  FileText,
  Play,
  Headphones,
  Gamepad2,
  Puzzle,
  Layers,
  Presentation,
  Cloud,
  Globe,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

// Набір нейтральних лінійних іконок для картки завдання типу "link"
// (LinkCard) — без логотипів брендів, бо посилання може вести куди завгодно
// (ігровий тренажер, файл на Google Диску, відео, будь-який сайт). Конкретна
// іконка або обирається вручну (config.icon), або підбирається автоматично
// за URL (detectLinkTaskIcon) — те саме, що й scene_links-картки "Практика"
// (Puzzle/Layers/Gamepad2 — ті самі іконки, той самий вигляд).
export type LinkTaskIconKey =
  | "link"
  | "download"
  | "file-text"
  | "play"
  | "headphones"
  | "gamepad"
  | "puzzle"
  | "layers"
  | "presentation"
  | "cloud"
  | "globe";

export const LINK_TASK_ICONS: Record<LinkTaskIconKey, { icon: LucideIcon; label: string }> = {
  link: { icon: Link2, label: "Посилання" },
  download: { icon: Download, label: "Завантаження" },
  "file-text": { icon: FileText, label: "Документ" },
  play: { icon: Play, label: "Відео" },
  headphones: { icon: Headphones, label: "Аудіо" },
  gamepad: { icon: Gamepad2, label: "Гра" },
  puzzle: { icon: Puzzle, label: "Головоломка" },
  layers: { icon: Layers, label: "Картки" },
  presentation: { icon: Presentation, label: "Презентація" },
  cloud: { icon: Cloud, label: "Хмара/диск" },
  globe: { icon: Globe, label: "Сайт" },
};

// Для <select> у конструкторі (task-config-fields.tsx) — "auto" першим.
export const LINK_TASK_ICON_OPTIONS: { value: "auto" | LinkTaskIconKey; label: string }[] = [
  { value: "auto", label: "Авто" },
  { value: "link", label: "Посилання" },
  { value: "download", label: "Завантаження" },
  { value: "file-text", label: "Документ" },
  { value: "play", label: "Відео" },
  { value: "headphones", label: "Аудіо" },
  { value: "gamepad", label: "Гра" },
  { value: "puzzle", label: "Головоломка" },
  { value: "layers", label: "Картки" },
  { value: "presentation", label: "Презентація" },
  { value: "cloud", label: "Хмара/диск" },
  { value: "globe", label: "Сайт" },
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extensionOf(url: string): string {
  try {
    const match = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

const DOWNLOAD_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "zip", "mp3", "mp4"]);

const CLOUD_HOSTS = ["drive.google.com", "docs.google.com", "dropbox.com", "onedrive.live.com", "1drv.ms"];

// Відомі сервіси (за доменом) — дають і впізнавану іконку, і людську назву
// для підпису картки за замовчуванням (linkTaskDefaultSubtitle нижче).
const KNOWN_SERVICES: { host: string; icon: LinkTaskIconKey; label: string }[] = [
  { host: "wordwall.net", icon: "puzzle", label: "Wordwall" },
  { host: "quizlet.com", icon: "layers", label: "Quizlet" },
  { host: "genial.ly", icon: "presentation", label: "Genially" },
  { host: "youtube.com", icon: "play", label: "YouTube" },
  { host: "youtu.be", icon: "play", label: "YouTube" },
];

type LinkTaskIconParams = { url?: string; platform?: string; download?: boolean };

// platform (youtube/wordwall/genially/custom) — старе поле, лишене для
// сумісності; слугує підказкою auto, коли URL не вдалося розпізнати за
// доменом (напр. скорочувач посилань, порожній/невалідний url).
const PLATFORM_HINT: Partial<Record<string, LinkTaskIconKey>> = {
  youtube: "play",
  wordwall: "puzzle",
  genially: "presentation",
};

export function detectLinkTaskIcon(params: LinkTaskIconParams): LinkTaskIconKey {
  const url = params.url ?? "";
  const hostname = hostnameOf(url);
  const ext = extensionOf(url);

  const known = KNOWN_SERVICES.find((s) => hostname.includes(s.host));
  if (known) return known.icon;

  if (CLOUD_HOSTS.some((h) => hostname.includes(h))) return "cloud";

  if (params.download || DOWNLOAD_EXTENSIONS.has(ext)) {
    if (ext === "mp3") return "headphones";
    if (ext === "mp4") return "play";
    return "download";
  }

  if (hostname && PLATFORM_HINT[params.platform ?? ""]) {
    return PLATFORM_HINT[params.platform ?? ""]!;
  }
  if (!hostname && PLATFORM_HINT[params.platform ?? ""]) {
    return PLATFORM_HINT[params.platform ?? ""]!;
  }

  return "globe";
}

// Явно обрана іконка (config.icon, якщо не "auto"/відсутня) завжди перемагає
// auto-детекцію.
export function resolveLinkTaskIcon(
  params: LinkTaskIconParams & { icon?: string }
): { icon: LucideIcon; label: string } {
  const key =
    params.icon && params.icon !== "auto" && params.icon in LINK_TASK_ICONS
      ? (params.icon as LinkTaskIconKey)
      : detectLinkTaskIcon(params);
  return LINK_TASK_ICONS[key];
}

// platform у scene_links — НЕ те саме поле, що params.platform вище (CHECK-
// обмеження рівно на 'quizlet' | 'wordwall' | 'custom', 0001_init.sql/0043) —
// спільна для фіксованої "Практики" (scenes/[sceneId]/page.tsx) і посилань
// усередині контент-блоку (scene-content-block.tsx), щоб LinkCard виглядала
// однаково в обох місцях. featured — власна HTML-гра ("custom") отримує
// золотий variant="featured" на LinkCard.
// wordwall/quizlet — назви сторонніх платформ, НЕ перекладаються в жодній
// мові інтерфейсу (той самий принцип, що KNOWN_SERVICES нижче). "custom"
// (власна HTML-гра вчительки) — наш власний текст, не назва платформи,
// тож перекладається через linkCard.ownGame (uk/fr/en, src/lib/i18n/
// messages/*.ts); lang за замовчуванням "uk" — викликачі поза студентською
// сторінкою (адмінський прев'ю, task-config-fields.tsx) не передають lang
// і лишаються українською, як і раніше.
const SCENE_LINK_PLATFORM_META: Record<string, { icon: LucideIcon; label: string; featured?: boolean }> = {
  wordwall: { icon: Puzzle, label: "Wordwall" },
  quizlet: { icon: Layers, label: "Quizlet" },
};
const CUSTOM_PLATFORM_META = { icon: Gamepad2, featured: true };
const DEFAULT_SCENE_LINK_META = { icon: ExternalLink };

export function resolveSceneLinkMeta(
  platform: string,
  lang: UiLang = "uk"
): { icon: LucideIcon; label: string; featured: boolean } {
  if (platform === "custom") {
    return { icon: CUSTOM_PLATFORM_META.icon, label: t(lang, "linkCard.ownGame"), featured: true };
  }
  const meta = SCENE_LINK_PLATFORM_META[platform];
  if (meta) return { icon: meta.icon, label: meta.label, featured: false };
  return { icon: DEFAULT_SCENE_LINK_META.icon, label: t(lang, "linkCard.genericLink"), featured: false };
}

// Підпис картки, коли немає description: людська назва відомого сервісу
// (Wordwall/Quizlet/Genially/YouTube — НЕ перекладається, назви платформ),
// інакше домен посилання (drive.google.com тощо), для download —
// перекладений "Завантажити файл"/"Télécharger le fichier"/"Download the
// file". lang за замовчуванням "uk" — той самий принцип, що вище.
export function linkTaskDefaultSubtitle(params: LinkTaskIconParams, lang: UiLang = "uk"): string {
  if (params.download) return t(lang, "linkCard.downloadFile");
  const hostname = hostnameOf(params.url ?? "");
  const known = KNOWN_SERVICES.find((s) => hostname.includes(s.host));
  if (known) return known.label;
  return hostname || t(lang, "linkCard.genericLink");
}
