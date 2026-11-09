"use client";

// Карусель "Нове в бібліотеці" — без автоплею, scroll-snap + кнопки ‹ ›
// + крапки; activeIndex рахується зі scrollLeft треку (requestAnimationFrame
// на scroll), а не окремим стейтом-джерелом правди, щоб свайп/трекпад-скрол
// і кнопки завжди лишались синхронними з реальною позицією.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Film, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { NewLibraryItem } from "@/lib/cabinet/home-data";
import { CardTitle } from "@/components/cabinet/card-title";

function slideStep(track: HTMLDivElement): number {
  const first = track.firstElementChild as HTMLElement | null;
  if (!first) return track.clientWidth;
  const gap = parseFloat(getComputedStyle(track).columnGap || "0");
  return first.getBoundingClientRect().width + gap;
}

export function LibraryCarousel({ lang, items }: { lang: UiLang; items: NewLibraryItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const step = slideStep(track!);
        if (step <= 0) return;
        setActiveIndex(Math.round(track!.scrollLeft / step));
      });
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    track.scrollTo({ left: clamped * slideStep(track), behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.library.title")}</CardTitle>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex <= 0}
            aria-label={t(lang, "home.library.prev")}
            className="cabinet-carousel-arrow"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex >= items.length - 1}
            aria-label={t(lang, "home.library.next")}
            className="cabinet-carousel-arrow"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={trackRef} className="cabinet-carousel-track">
        {items.map((item) => (
          <div key={item.id} className="cabinet-carousel-slide">
            <div className="cabinet-carousel-slide-bg">
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- зовнішній R2-URL
                <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #4b46da, #2f2c6b)" }}
                >
                  <Film size={40} className="text-white/60" aria-hidden="true" />
                </div>
              )}
              <div className="cabinet-carousel-overlay" />
            </div>
            <div className="cabinet-carousel-content">
              <span className="cabinet-carousel-tag">
                {t(lang, "home.library.tagNew")} · {t(lang, item.type === "delf" ? "library.type.delf" : "library.type.film")}
                {item.level ? ` · ${item.level}` : ""}
              </span>
              <h3 className="font-heading text-2xl font-extrabold text-white">{item.title}</h3>
              {item.description && <p className="line-clamp-2 text-sm text-white/85">{item.description}</p>}
              <Link
                href={item.href}
                className="mt-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-[var(--cabinet-on-gold)]"
                style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
              >
                {t(lang, "home.library.open")}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={t(lang, "home.library.goToSlide", { n: idx + 1 })}
              aria-current={idx === activeIndex}
              className={`cabinet-carousel-dot ${idx === activeIndex ? "cabinet-carousel-dot--active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
