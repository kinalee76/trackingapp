function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-09-20 14:23:05" */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "14:23" — used to build "시간_장소" titles. */
export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-09-20_14:23" — used to build "날짜_시간" titles. */
export function formatDateTimeTitle(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "00:00" (MM:SS) — minutes are left unpadded past 2 digits (e.g. "125:07" for a 2h+ session) rather than rolling into an hours field. */
export function formatDurationClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  return `${pad(minutes)}:${pad(remainderSeconds)}`;
}
