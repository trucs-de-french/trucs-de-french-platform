import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Шрифти для PDF-генерації (src/lib/pdf/vocab-pdf.ts) читаються через
  // fs у рантаймі API-роуту, а не через import — file-tracing не завжди
  // підхоплює такі динамічні шляхи автоматично, тож вказуємо явно.
  // ОБОВ'ЯЗКОВО перевірити завантаження PDF після деплою на Netlify,
  // не лише локально (next dev/build цей клас проблем не показує).
  outputFileTracingIncludes: {
    "/api/scenes/[sceneId]/vocab-pdf": ["src/lib/pdf/fonts/**/*"],
  },
};

export default nextConfig;
