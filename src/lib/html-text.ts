// Чи HTML/текстовий рядок порожній ПІСЛЯ прибирання тегів — не просто
// falsy-перевірка (`!value`). "" — порожньо, звісно, але й "<p></p>",
// "<p><br></p>", "<hr>", "   " теж мають рахуватись порожніми: TipTap
// регулярно лишає саме такі "напівпорожні" залишки (порожній абзац після
// видалення тексту, самотній роздільник) — usePlain `!value` пропустив би
// їх як "є контент". Працює і для звичайного тексту без тегів (title, url)
// — заміна тегів на "" там просто no-op, лишається сам trim().
export function isBlankHtml(value: string | null | undefined): boolean {
  if (!value) return true;
  return htmlToPlainText(value).length === 0;
}

// Той самий підхід до прибирання тегів, що isBlankHtml вище, лише
// повертає сам текст (не булеве порожньо/не порожньо) — для місць, де
// потрібен ПЛЕЙН-текст з HTML-поля (напр. компактний бар задачі,
// getTaskBarText), а не санітизований HTML для dangerouslySetInnerHTML.
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
