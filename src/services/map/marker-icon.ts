/** Shared teardrop pin marker rendering, kept identical across all three map SDKs so "출발"/"도착"/사진 마커가 어떤 지도든 같은 모양으로 보인다. */

const PIN_WIDTH = 32;
const PIN_HEIGHT = 42;

function pinOutline(color: string): string {
  return `<path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>`;
}

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 32 42">` +
    pinOutline(color) +
    `<circle cx="16" cy="16" r="6" fill="white"/>` +
    `</svg>`;
}

/** Same pin outline, with a small white camera glyph instead of a plain dot — used for "사진 촬영" locations on a route's detail map. */
function cameraPinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 32 42">` +
    pinOutline(color) +
    `<rect x="9" y="13" width="14" height="10" rx="2" fill="white"/>` +
    `<rect x="13" y="10" width="6" height="3" rx="1" fill="white"/>` +
    `<circle cx="16" cy="18" r="3" fill="${color}"/>` +
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

export function cameraPinIconHtml(color: string): string {
  return cameraPinSvg(color);
}

export function cameraPinIconDataUri(color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(cameraPinSvg(color))}`;
}

export const PIN_SIZE = { width: PIN_WIDTH, height: PIN_HEIGHT };
/** The pin's visual tip (bottom-center) — anchor markers here so they point at the exact coordinate. */
export const PIN_ANCHOR = { x: PIN_WIDTH / 2, y: PIN_HEIGHT };
