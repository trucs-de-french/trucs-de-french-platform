// WCAG relative luminance — те саме, за чим орієнтується контрастність
// тексту в специфікації: кожен sRGB-канал гамма-коригується окремо перед
// зваженою сумою. Порог ~0.4 (не стандартний WCAG 0.5, обраний ширшим —
// "скоріше темний" для кольорів середньої яскравості, де білий текст
// усе одно читається краще за чорний на фотографічному/насиченому фоні).
function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Визначає, чи текст, що лежить прямо на фоні курсу (не в панелі), має
// бути світлим ("dark" — фон темний) чи темним ("light" — фон світлий).
// null — немає жодного валідного фону взагалі, сторінка виглядає як і
// раніше, жодної позначки не потрібно.
export function sceneBackgroundMode(
  fillColor: string | null,
  hasImages: boolean
): "dark" | "light" | null {
  if (fillColor) {
    return relativeLuminance(fillColor) < 0.4 ? "dark" : "light";
  }
  // Картинка без заявленого кольору заливки — свідомо вважаємо темним
  // (фотографічні фони частіше темні/насичені в кадрі, і світлий текст із
  // тінню краще переживає світлі ділянки фотографії, ніж темний текст —
  // темні ділянки без тіні взагалі не рендерить нічого видимого).
  return hasImages ? "dark" : null;
}
