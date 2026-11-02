// Один аудіоелемент грає за раз на всій сторінці: старт нового ставить
// попередній на паузу. Спільно для AudioPlayer (великий плеєр, audio-
// player.tsx) і AudioPill (компактний, audio-pill.tsx: фонетика, flip_cards,
// crossword) — раніше кожен мав власний модульний трекер, тож великий
// плеєр і міні-плеєри могли грати одночасно. Модульний рівень, не React-
// стан — свідомо просто "хто зараз грає", без підписки/ререндерів чужих
// плеєрів.
let currentlyPlaying: HTMLAudioElement | null = null;

export function stopOthersAndRegister(el: HTMLAudioElement) {
  if (currentlyPlaying && currentlyPlaying !== el) currentlyPlaying.pause();
  currentlyPlaying = el;
}

export function clearIfCurrent(el: HTMLAudioElement) {
  if (currentlyPlaying === el) currentlyPlaying = null;
}
