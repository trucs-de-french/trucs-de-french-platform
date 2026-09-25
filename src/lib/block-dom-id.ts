// DOM-безпечна форма ключа блоку сцени ("content:{refId}" -> "content-{refId}",
// двокрапка в id-атрибуті/URL-хеші не всюди безпечна). Спільний, без "use
// client" — потрібен і клієнтським компонентам (scene-block-list.tsx), і
// серверним actions (task-groups/actions.ts, tasks/actions.ts), що будують
// redirect-адресу з якорем на той самий блок.
export function blockDomId(key: string): string {
  return key.replace(":", "-");
}
