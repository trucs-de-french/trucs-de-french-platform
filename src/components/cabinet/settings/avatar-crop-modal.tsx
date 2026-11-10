"use client";

// Модалка "Налаштуй фото" перед аплоадом (settings/profile-card.tsx) —
// кадрування в коло: drag/pinch/wheel пан+зум, клавіатура (стрілки 10px,
// +/- зум), Esc = скасувати, простий Tab-трап (той самий рецепт, що
// karaoke.tsx fullscreen: querySelectorAll фокусованих елементів усередині
// контейнера, замкнути перший/останній).
//
// Геометрія: CIRCLE_PX — видиме коло; STAGE_PX — квадратна "сцена" з
// затемненими кутами (box-shadow-трюк: елемент розміром CIRCLE_PX з
// box-shadow 0 0 0 9999px напівпрозорий чорний — малює темряву ВСЮДИ
// ЗА межами свого власного кола, без mask-image). offset — зсув картинки
// (у ПІКСЕЛЯХ ЕКРАНА) від центру сцени; scale — масштаб відносно
// природного розміру картинки (decodeToDrawable; та сама EXIF-корекція,
// що й компресія нижче). minZoom = "cover" (коло завжди повністю
// вкрите), maxZoom = minZoom*4.
//
// Кадр на "Застосувати" рахується у ПІКСЕЛЯХ ОРИГІНАЛУ (той самий
// простір, що повертає decodeToDrawable) — avatar-upload.ts
// compressImage(file, crop) перекадровує ТОЧНО цей квадрат замість
// старого завжди-центрованого.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { Z_MODAL } from "@/lib/z-layers";
import { decodeToDrawable, type CropRect } from "@/lib/cabinet/avatar-upload";

const CIRCLE_PX = 280;
const STAGE_PX = 320;
const ARROW_STEP = 10;
const WHEEL_SENSITIVITY = 0.0015;
const BUTTON_ZOOM_FACTOR = 1.15;

type Point = { x: number; y: number };
type Decoded = { previewUrl: string; width: number; height: number; minZoom: number; maxZoom: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampOffset(offset: Point, scale: number, width: number, height: number): Point {
  const dispW = width * scale;
  const dispH = height * scale;
  const maxX = Math.max(0, (dispW - CIRCLE_PX) / 2);
  const maxY = Math.max(0, (dispH - CIRCLE_PX) / 2);
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
}

function computeCrop(scale: number, offset: Point, width: number, height: number): CropRect {
  const size = CIRCLE_PX / scale;
  const x = width / 2 - size / 2 - offset.x / scale;
  const y = height / 2 - size / 2 - offset.y / scale;
  return { x, y, size };
}

function cropToView(crop: CropRect, width: number, height: number): { scale: number; offset: Point } {
  const scale = CIRCLE_PX / crop.size;
  const dispW = width * scale;
  const dispH = height * scale;
  return {
    scale,
    offset: { x: dispW / 2 - CIRCLE_PX / 2 - crop.x * scale, y: dispH / 2 - CIRCLE_PX / 2 - crop.y * scale },
  };
}

export function AvatarCropModal({
  lang,
  file,
  initialCrop = null,
  onApply,
  onCancel,
}: {
  lang: UiLang;
  file: File;
  initialCrop?: CropRect | null;
  onApply: (crop: CropRect) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [decodeError, setDecodeError] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const pointersRef = useRef<Map<number, Point>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; offset: Point } | null>(null);
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  // Декод (createImageBitmap orientation:"from-image" — той самий
  // хелпер, що compressImage) → один раз рендериться на canvas у
  // природний розмір і експортується в object URL для <img> у стейджі
  // (ImageBitmap не можна поставити напряму в src, а малювати на canvas
  // ЩОКАДРУ під час драгу — дорого). Малюнок стабільний для файлу,
  // оскільки decodeToDrawable детерміновний — той самий простір пікселів,
  // що й фінальний crop.
  useEffect(() => {
    let canceled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { source, width, height, dispose } = await decodeToDrawable(file);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas-2d-unavailable");
          ctx.drawImage(source, 0, 0, width, height);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("canvas-encode-failed");
          if (canceled) return;
          objectUrl = URL.createObjectURL(blob);
          const minZoom = Math.max(CIRCLE_PX / width, CIRCLE_PX / height);
          const maxZoom = minZoom * 4;
          setDecoded({ previewUrl: objectUrl, width, height, minZoom, maxZoom });
          if (initialCrop) {
            const view = cropToView(initialCrop, width, height);
            const clampedScale = clamp(view.scale, minZoom, maxZoom);
            setScale(clampedScale);
            setOffset(clampOffset(view.offset, clampedScale, width, height));
          } else {
            setScale(minZoom);
            setOffset({ x: 0, y: 0 });
          }
        } finally {
          dispose();
        }
      } catch {
        if (!canceled) {
          setDecoded(null);
          setDecodeError(true);
        }
      }
    })();
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // initialCrop — очікується стабільним значенням від виклично (той
    // самий об'єкт, доки не збережено новий crop), а не новим літералом
    // щоразу.
  }, [file, initialCrop]);

  const setScaleClamped = useCallback(
    (next: number) => {
      if (!decoded) return;
      const clamped = clamp(next, decoded.minZoom, decoded.maxZoom);
      setScale(clamped);
      setOffset((o) => clampOffset(o, clamped, decoded.width, decoded.height));
    },
    [decoded]
  );

  // Esc = скасувати, Tab-трап, стрілки (10px), +/- зум — один слухач на
  // document, доки модалка змонтована (той самий принцип, що
  // karaoke.tsx fullscreen-ефект).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        const root = containerRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (!decoded) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setOffset(clampOffset({ x: offset.x - ARROW_STEP, y: offset.y }, scale, decoded.width, decoded.height));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setOffset(clampOffset({ x: offset.x + ARROW_STEP, y: offset.y }, scale, decoded.width, decoded.height));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOffset(clampOffset({ x: offset.x, y: offset.y - ARROW_STEP }, scale, decoded.width, decoded.height));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setOffset(clampOffset({ x: offset.x, y: offset.y + ARROW_STEP }, scale, decoded.width, decoded.height));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScaleClamped(scale * BUTTON_ZOOM_FACTOR);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setScaleClamped(scale / BUTTON_ZOOM_FACTOR);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [decoded, scale, offset, onCancel, setScaleClamped]);

  // wheel/trackpad-зум — нативний слухач (не passive), щоб preventDefault
  // реально блокував скрол сторінки під час зуму картинки в модалці.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !decoded) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScaleClamped(scale * Math.exp(-e.deltaY * WHEEL_SENSITIVITY));
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [decoded, scale, setScaleClamped]);

  useEffect(() => {
    if (decoded) stageRef.current?.focus();
  }, [decoded]);

  function handlePointerDown(e: React.PointerEvent) {
    if (!decoded) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, offset };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchStartRef.current = { dist: distance(pts[0], pts[1]), scale };
      panStartRef.current = null;
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!decoded || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = [...pointersRef.current.values()];
      const ratio = distance(pts[0], pts[1]) / pinchStartRef.current.dist;
      setScaleClamped(pinchStartRef.current.scale * ratio);
      return;
    }
    if (pointersRef.current.size === 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setOffset(
        clampOffset(
          { x: panStartRef.current.offset.x + dx, y: panStartRef.current.offset.y + dy },
          scale,
          decoded.width,
          decoded.height
        )
      );
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 1) {
      const [pos] = [...pointersRef.current.values()];
      panStartRef.current = { x: pos.x, y: pos.y, offset };
    } else {
      panStartRef.current = null;
    }
  }

  function handleApply() {
    if (!decoded) return;
    onApply(computeCrop(scale, offset, decoded.width, decoded.height));
  }

  const dispW = decoded ? decoded.width * scale : 0;
  const dispH = decoded ? decoded.height * scale : 0;

  return createPortal(
    <div className={`fixed inset-0 ${Z_MODAL} flex items-center justify-center bg-black/50 p-4`} onClick={onCancel}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(lang, "settings.photo.crop.title")}
        onClick={(e) => e.stopPropagation()}
        className="avatar-crop-dialog flex w-full max-w-sm flex-col items-center gap-4 p-6"
      >
        <h3 className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
          {t(lang, "settings.photo.crop.title")}
        </h3>

        {decodeError && (
          <p className="text-xs text-[#9b4a44] dark:text-[#e2a49c]">{t(lang, "settings.photo.error.upload")}</p>
        )}

        <div
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-label={t(lang, "settings.photo.crop.title")}
          className="avatar-crop-stage"
          style={{ width: STAGE_PX, height: STAGE_PX }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {decoded && (
            <img
              src={decoded.previewUrl}
              alt=""
              draggable={false}
              className="avatar-crop-image"
              style={{
                width: dispW,
                height: dispH,
                left: STAGE_PX / 2 - dispW / 2 + offset.x,
                top: STAGE_PX / 2 - dispH / 2 + offset.y,
              }}
            />
          )}
          <div className="avatar-crop-mask" aria-hidden="true" style={{ width: CIRCLE_PX, height: CIRCLE_PX }} />
        </div>

        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            disabled={!decoded}
            onClick={() => setScaleClamped(scale / BUTTON_ZOOM_FACTOR)}
            aria-label={t(lang, "settings.photo.crop.zoomOut")}
            className="avatar-crop-zoom-btn"
          >
            −
          </button>
          <input
            type="range"
            min={decoded?.minZoom ?? 0}
            max={decoded?.maxZoom ?? 1}
            step={decoded ? (decoded.maxZoom - decoded.minZoom) / 200 || 0.001 : 1}
            value={decoded ? scale : 0}
            disabled={!decoded}
            aria-label={t(lang, "settings.photo.crop.zoomLabel")}
            onChange={(e) => setScaleClamped(Number(e.target.value))}
            className="avatar-crop-zoom-slider"
          />
          <button
            type="button"
            disabled={!decoded}
            onClick={() => setScaleClamped(scale * BUTTON_ZOOM_FACTOR)}
            aria-label={t(lang, "settings.photo.crop.zoomIn")}
            className="avatar-crop-zoom-btn"
          >
            +
          </button>
        </div>

        <div className="mt-1 flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-11 items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent px-4 text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)]"
          >
            {t(lang, "settings.photo.crop.cancel")}
          </button>
          <button
            type="button"
            disabled={!decoded}
            onClick={handleApply}
            className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
          >
            {t(lang, "settings.photo.crop.apply")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
