import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ContinueTarget } from "@/lib/cabinet/home-data";

export function ContinueCard({ lang, target }: { lang: UiLang; target: ContinueTarget | null }) {
  if (!target) {
    return (
      <div className="cabinet-card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-base text-[var(--cabinet-ink)]">{t(lang, "home.continue.empty")}</p>
        <Link
          href="/cabinet/library"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-[var(--cabinet-on-gold)]"
          style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        >
          {t(lang, "home.continue.emptyButton")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const progressPercent =
    target.scenesTotalInProduct > 0
      ? Math.round((100 * target.scenesCompletedInProduct) / target.scenesTotalInProduct)
      : 0;

  return (
    <div
      className="flex flex-col gap-4 rounded-[24px] p-5 text-white sm:flex-row sm:items-center sm:gap-5"
      style={{
        background:
          "linear-gradient(135deg, var(--cabinet-continue-from), var(--cabinet-continue-to))",
      }}
    >
      <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-white/10">
        {target.productCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- зовнішній R2-URL, next/image вимагав би remotePatterns у next.config
          <img src={target.productCoverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
          >
            <Film size={28} className="text-[var(--cabinet-on-gold)]" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wide text-[#f6dc8e]">
          {t(lang, target.kind === "start" ? "home.continue.start" : "home.continue.label")}
          {" · "}
          {target.productType === "delf" ? "DELF" : "Film"}
          {target.productLevel ? ` · ${target.productLevel}` : ""}
        </div>
        <h3 className="mt-1 truncate font-body text-[27px] font-semibold leading-tight">
          {target.productTitle}
        </h3>
        {target.sceneTitle && target.sceneIndex && target.sceneTotal ? (
          <p className="mt-1 truncate text-sm text-white/80">
            {t(lang, "home.continue.sceneOf", { n: target.sceneIndex, total: target.sceneTotal })}
            {target.taskTypeName ? ` · ${target.taskTypeName}` : ""}
          </p>
        ) : null}

        {target.scenesTotalInProduct > 0 && (
          <div
            className="mt-3 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${progressPercent}%`, background: "#f6dc8e" }}
            />
          </div>
        )}

        <Link
          href={target.href}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-[var(--cabinet-on-gold)]"
          style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        >
          {t(lang, target.kind === "start" ? "home.continue.start" : "home.continue.label")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
