"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type VideoSubtitlesState = {
  subFr: string;
  subUk: string;
  setSubFr: Dispatch<SetStateAction<string>>;
  setSubUk: Dispatch<SetStateAction<string>>;
};

const VideoSubtitlesContext = createContext<VideoSubtitlesState | null>(null);

// Піднятий над SceneBlockList (той самий рівень, що DialogueStateProvider) —
// єдине місце, де "Скрипт" і "Відео" сцени ОБИДВА мають однозначну пару
// (scene.video_url/scene.subtitles + scene.dialogue, дивись аудит). Тримає
// ПОТОЧНЕ (не збережене) значення URL FR/UA субтитрів — SceneVideoFields
// пише сюди при введенні й при завантаженні файлу, кнопка імпорту в
// DialogueEditor звідси ж читає, тож бачить щойно завантажений файл ще до
// натискання "Зберегти" у формі відео.
export function VideoSubtitlesProvider({
  initialSubFr,
  initialSubUk,
  children,
}: {
  initialSubFr: string;
  initialSubUk: string;
  children: ReactNode;
}) {
  const [subFr, setSubFr] = useState(initialSubFr);
  const [subUk, setSubUk] = useState(initialSubUk);

  return (
    <VideoSubtitlesContext.Provider value={{ subFr, subUk, setSubFr, setSubUk }}>
      {children}
    </VideoSubtitlesContext.Provider>
  );
}

// На відміну від useDialogueState — НЕ кидає без Provider: DialogueEditor
// рендериться і для додаткових script-блоків сцени, де пари відео немає
// (кнопка імпорту там просто не показується, див. коментар у dialogue-editor.tsx).
export function useVideoSubtitlesUrls(): VideoSubtitlesState | null {
  return useContext(VideoSubtitlesContext);
}
