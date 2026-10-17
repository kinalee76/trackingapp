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

/**
 * "00:00" (MM:SS) under an hour, "1:21:58" (H:MM:SS) from an hour up —
 * e.g. a 4918-second (81분 58초) walk used to render as "81:58", which reads
 * like a bogus "81시간". Rolling over into an hours field once minutes hit
 * 60 keeps it unambiguous. See docs/reports/22-duration-display-and-orphaned-routes.md.
 */
export function formatDurationClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainderSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainderSeconds)}`;
  }
  return `${pad(minutes)}:${pad(remainderSeconds)}`;
}
