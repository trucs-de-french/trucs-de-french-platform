// DOM-безпечна форма ключа блоку сцени ("content:{refId}" -> "content-{refId}",
// двокрапка в id-атрибуті/URL-хеші не всюди безпечна). Навмисно в ОКРЕМОМУ
// файлі БЕЗ "use client": scene-block-list.tsx має "use client", а звідти
// плаский (не-компонентний) експорт не можна ВИКЛИКАТИ напряму з серверного
// page.tsx — лише рендерити як JSX. Викликало 500 на проді ("Attempted to
// call blockDomId() from the server but blockDomId is on the client").
export function blockDomId(key: string): string {
  return key.replace(":", "-");
}
