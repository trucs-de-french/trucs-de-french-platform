// Клієнтський хелпер для фото профілю (settings/profile-card.tsx):
// валідація типу/розміру ОРИГІНАЛУ (до 15 МБ — компресія нижче сама
// зводить його до набагато меншого файлу), потім декод через
// createImageBitmap({imageOrientation:"from-image"}) — поважає EXIF-
// поворот телефонних фото (фолбек на <img>+canvas, якщо браузер не вміє
// createImageBitmap чи не декодує конкретний формат, напр. HEIC у не-
// Safari) — crop по центру в квадрат, downscale до 512x512 МАКСИМУМ (не
// апскейлимо менші джерела — target = min(сторона_джерела, 512)), потім
// експорт у webp (сходинки якості 0.82→0.72→0.62, поки розмір не впаде
// нижче м'якого орієнтира 150КБ) із фолбеком на jpeg (0.85→0.75→0.65),
// якщо браузер не вміє кодувати webp. Жорсткий ліміт 2МБ (той самий,
// що бакет) — перевіряється тут-таки, ДО аплоаду.
const ORIGINAL_MAX_BYTES = 15 * 1024 * 1024;
const BLOB_HARD_MAX_BYTES = 2 * 1024 * 1024;
const SOFT_TARGET_BYTES = 150 * 1024;
const MAX_SIDE = 512;
// HEIC/HEIF — best-effort: приймаємо за розширенням (Safari часто взагалі
// не виставляє file.type для них), декодування нижче саме падає дружньою
// помилкою, якщо браузер не вміє їх decode'ити.
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const HEIC_EXT_RE = /\.(heic|heif)$/i;

export type PhotoValidationError = "type" | "size";

export function validatePhotoFile(file: File): PhotoValidationError | null {
  const isAllowedType = ALLOWED_MIME.includes(file.type) || (file.type === "" && HEIC_EXT_RE.test(file.name));
  if (!isAllowedType) return "type";
  if (file.size > ORIGINAL_MAX_BYTES) return "size";
  return null;
}

type Drawable = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

async function decodeToDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      // Формат, який createImageBitmap у цьому браузері не декодує
      // (напр. HEIC поза Safari) — пробуємо фолбек нижче перед тим, як
      // здатись.
    }
  }
  const img = await loadImageElement(file);
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, dispose: () => {} };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image-decode-failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Сходинки якості для кожного формату — зупиняється на першій, що влазить
// у SOFT_TARGET_BYTES; якщо жодна не влазить, повертає найменшу спробувану
// (м'який орієнтир, не жорсткий — жорсткий ліміт перевіряє compressImage).
async function encodeWithQualityLadder(canvas: HTMLCanvasElement): Promise<Blob> {
  const webpSteps = [0.82, 0.72, 0.62];
  let bestWebp: Blob | null = null;
  for (const quality of webpSteps) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") {
      // Браузер узагалі не вміє кодувати webp (мовчки повернув інший
      // тип/null) — немає сенсу пробувати решту сходинок цього формату.
      break;
    }
    bestWebp = blob;
    if (blob.size <= SOFT_TARGET_BYTES) return blob;
  }
  if (bestWebp) return bestWebp;

  const jpegSteps = [0.85, 0.75, 0.65];
  let bestJpeg: Blob | null = null;
  for (const quality of jpegSteps) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) continue;
    bestJpeg = blob;
    if (blob.size <= SOFT_TARGET_BYTES) return blob;
  }
  if (bestJpeg) return bestJpeg;

  throw new Error("canvas-encode-failed");
}

export async function compressImage(file: File): Promise<Blob> {
  const { source, width, height, dispose } = await decodeToDrawable(file);
  try {
    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;
    // Ніколи не апскейлимо — якщо джерело вже менше за 512, target =
    // його власний (обрізаний у квадрат) розмір.
    const targetSize = Math.min(side, MAX_SIDE);

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-2d-unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, side, side, 0, 0, targetSize, targetSize);

    const blob = await encodeWithQualityLadder(canvas);
    if (blob.size >= BLOB_HARD_MAX_BYTES) {
      throw new Error("image-too-large-after-compression");
    }
    return blob;
  } finally {
    dispose();
  }
}
