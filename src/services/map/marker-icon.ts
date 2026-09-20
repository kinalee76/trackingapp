/** Shared teardrop pin marker rendering, kept identical across all three map SDKs so "출발"/"도착" look the same regardless of provider. */

const PIN_WIDTH = 32;
const PIN_HEIGHT = 42;

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 32 42">` +
    `<path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>` +
    `<circle cx="16" cy="16" r="6" fill="white"/>` +
    `</svg>`;
}

/** Raw SVG markup, for providers (Naver) that accept inline HTML content markers. */
export function pinIconHtml(color: string): string {
  return pinSvg(color);
}

/** data: URI form, for providers (Kakao, Google) that take an image URL for a marker icon. */
export function pinIconDataUri(color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg(color))}`;
}

export const PIN_SIZE = { width: PIN_WIDTH, height: PIN_HEIGHT };
/** The pin's visual tip (bottom-center) — anchor markers here so they point at the exact coordinate. */
export const PIN_ANCHOR = { x: PIN_WIDTH / 2, y: PIN_HEIGHT };
