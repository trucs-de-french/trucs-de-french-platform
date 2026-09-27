"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

// Мінімальна підмножина типів YouTube IFrame Player API — саме те, що
// реально використовується (play/pause/seekTo/getCurrentTime/
// getPlayerState + подія onStateChange). Офіційного @types/youtube пакета
// на npm нема, тож замість залежності заради 6 методів — мінімум тут.
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
};

type YTPlayerEvent = { target: YTPlayer; data: number };

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
      };
    }
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Офіційні числові стани YouTube IFrame Player API (event.data в
// onStateChange, і те саме з getPlayerState()) — щоб виклична сторона не
// тримала магічні числа у своєму коді.
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

// Одноразове завантаження iframe_api на всю сторінку — незалежно від того,
// скільки компонентів (розмітка часу в адмінці й студентський плеєр можуть
// існувати на сторінці одночасно) викликають useYoutubePlayer, скрипт
// вставляється й довантажується РІВНО ОДИН раз (спільний module-level
// Promise, не useEffect-локальний прапорець — інакше другий змонтований
// хук почав би вставляти <script> вдруге, поки перший ще не довантажився).
let apiReadyPromise: Promise<YTNamespace> | null = null;

function loadYoutubeApi(): Promise<YTNamespace> {
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    if (window.YT) {
      resolve(window.YT);
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return apiReadyPromise;
}

// Обгортка над YouTube IFrame Player API для React — спільна і для розмітки
// часу в адмінці (karaoke-fields.tsx), і для студентського плеєра
// (karaoke.tsx). containerRef СТВОРЮЄ й передає викликач (useRef у СВОЄМУ
// компоненті, не тут) — React Compiler незалежно аналізує кожен компонент і
// не визнає безпечним ref, повернений із чужого хука, у своєму `ref=`; ref,
// створений локальним useRef(), він трасує коректно. Сам DOM-вузол під цим
// ref має лишатись СТАБІЛЬНИМ порожнім <div>, який React більше НІКОЛИ не
// чіпає після монтування (ніяких React-дітей у нього): усередині нього
// створюється окремий, звичайний DOM-вузол (mountNode) поза контролем
// React, і саме ЙОГО YT.Player замінює на <iframe> (так документовано
// працює API — переданий елемент видаляється з DOM, а на його місце встає
// iframe). Якби ми віддали YT.Player сам containerRef.current, React пізніше
// міг би спробувати прибрати вузол, якого вже нема, і впасти з
// "removeChild"-помилкою при анмаунті — цей рівень непрямої обгортки існує
// саме заради цього.
export function useYoutubePlayer({
  videoId,
  containerRef,
  onStateChange,
}: {
  videoId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  onStateChange?: (state: number) => void;
}) {
  const playerRef = useRef<YTPlayer | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  // Запис у ref — в ефекті, не напряму в тілі рендеру (мутація ref.current
  // під час рендеру небезпечна під конкурентним рендерингом: React може
  // викликати функцію рендеру кілька разів без коміту).
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let cancelled = false;
    setIsReady(false);

    const mountNode = document.createElement("div");
    containerRef.current.appendChild(mountNode);

    loadYoutubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mountNode, {
        videoId,
        // "100%" (не фіксовані px) — контейнер (aspect-video-обгортка
        // виклика) сам задає реальний розмір, плеєр лише заповнює його.
        width: "100%",
        height: "100%",
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (e) => onStateChangeRef.current?.(e.data),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      mountNode.remove();
    };
  }, [videoId, containerRef]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const seekTo = useCallback((seconds: number) => playerRef.current?.seekTo(seconds, true), []);
  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);
  const getPlayerState = useCallback(
    () => playerRef.current?.getPlayerState() ?? YT_PLAYER_STATE.UNSTARTED,
    []
  );

  return { isReady, play, pause, seekTo, getCurrentTime, getPlayerState };
}
