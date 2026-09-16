// Секунди (float) -> "m:ss" для показу студенту. Округлення вниз — той
// самий принцип, що звичайні відеоплеєри (позначка "де приблизно звучить
// репліка", не точна мілісекунда).
export function formatTimecode(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
