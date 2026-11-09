// Типи products.type, що вважаються "екзаменаційними" (готують до іспиту) —
// єдиний список, щоб додати DALF/TCF/TEF-продукти пізніше однією строкою.
// Звичайний модуль (не "use server"), бо клієнтські компоненти (exam-card)
// можуть напряму імпортувати лише async-функції з "use server"-файлів.
export const EXAM_PRODUCT_TYPES = ["delf"] as const;

export function isExamProductType(type: string): boolean {
  return (EXAM_PRODUCT_TYPES as readonly string[]).includes(type);
}
