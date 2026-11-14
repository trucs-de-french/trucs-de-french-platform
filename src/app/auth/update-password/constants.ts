// Виокремлено з actions.ts: "use server"-файл може експортувати ЛИШЕ
// async-функції (Next білд-тайм перевіряє це буквально, включно з
// export type) — MIN_PASSWORD_LENGTH і UpdatePasswordError мусять жити
// в звичайному модулі, щоб і actions.ts (сервер), і update-password-
// form.tsx (клієнт) могли їх імпортувати без порушення правила.
export const MIN_PASSWORD_LENGTH = 8;

export type UpdatePasswordError =
  | "too_short"
  | "mismatch"
  | "same_password"
  | "weak_password"
  | "session_missing"
  | "generic";
