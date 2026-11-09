// Клієнтський хелпер для фото профілю (settings/profile-card.tsx):
// валідація типу/розміру, потім crop по центру в квадрат + resize 256x256
// через canvas, експорт у webp (фолбек jpeg, якщо браузер не вміє
// кодувати webp) — ПЕРЕД аплоадом у Supabase Storage, щоб бакет ніколи не
// зберігав оригінали довільного розміру/формату.
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TARGET_SIZE = 256;

export type PhotoValidationError = "type" | "size";

export function validatePhotoFile(file: File): PhotoValidationError | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_BYTES) return "size";
  return null;
}

export async function cropToSquareWebp(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unavailable");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const webp = await canvasToBlob(canvas, "image/webp");
  if (webp) return webp;
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.9);
  if (jpeg) return jpeg;
  throw new Error("canvas-encode-failed");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image-load-failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
