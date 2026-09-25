// Єдине джерело дефолтного порядку 4 фіксованих типів блоку сцени + video —
// раніше цей самий масив (з тими самими значеннями) був продубльований
// окремо в адмінському й студентському page.tsx, і жоден з них не
// узгоджувався зі СПРАВЖНІМ порядком, у якому createScene реально створює
// рядки scene_blocks (script/vocab/link/task, без video — video з'являється
// пізніше, синхронно з video_url, updateSceneVideo). Один спільний масив —
// щоб дефолтний порядок не розійшовся знову.
export const DEFAULT_SCENE_BLOCK_ORDER = ["video", "script", "vocab", "link", "task"] as const;

export type SceneBlockType = (typeof DEFAULT_SCENE_BLOCK_ORDER)[number];
