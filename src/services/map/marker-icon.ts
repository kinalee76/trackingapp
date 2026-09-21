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

const DOG_WIDTH = 48;
const DOG_HEIGHT = 40;

/**
 * A small running-dog animation for the route-replay ("재생") marker, built
 * entirely from inline SVG + CSS `@keyframes` — no external GIF/image file
 * needed. CSS/SMIL animation inside an SVG keeps animating even when the SVG
 * is only ever used as an `<img>`/data-URI source (Kakao/Google's marker
 * `image`/`icon.url`), not just when injected as HTML content (Naver).
 */
function runningDogSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DOG_WIDTH}" height="${DOG_HEIGHT}" viewBox="0 0 48 40">` +
    `<style>` +
    `.dg-body{animation:dg-bob .5s ease-in-out infinite}` +
    `.dg-leg-a{animation:dg-swing-a .5s ease-in-out infinite;transform-origin:16px 27px}` +
    `.dg-leg-b{animation:dg-swing-b .5s ease-in-out infinite;transform-origin:34px 27px}` +
    `.dg-tail{animation:dg-wag .3s ease-in-out infinite;transform-origin:38px 18px}` +
    `@keyframes dg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}` +
    `@keyframes dg-swing-a{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-24deg)}}` +
    `@keyframes dg-swing-b{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}` +
    `@keyframes dg-wag{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}` +
    `</style>` +
    `<g class="dg-body">` +
    `<rect class="dg-leg-b" x="32" y="27" width="3.5" height="10" rx="1.75" fill="#8B5A2B"/>` +
    `<rect class="dg-leg-a" x="14.5" y="27" width="3.5" height="10" rx="1.75" fill="#8B5A2B"/>` +
    `<ellipse cx="26" cy="24" rx="14" ry="8" fill="#D9A066"/>` +
    `<path class="dg-tail" d="M38 18 Q46 12 44 20" stroke="#D9A066" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="12" cy="16" r="8" fill="#D9A066"/>` +
    `<path d="M7 10 Q3 2 9 8 Z" fill="#8B5A2B"/>` +
    `<ellipse cx="4" cy="18" rx="4" ry="3" fill="#EAC28C"/>` +
    `<circle cx="1.2" cy="18" r="1.3" fill="#3B2A1A"/>` +
    `<circle cx="10" cy="14" r="1.2" fill="#3B2A1A"/>` +
    `</g>` +
    `</svg>`;
}

export function runningDogIconHtml(): string {
  return runningDogSvg();
}

export function runningDogIconDataUri(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(runningDogSvg())}`;
}

export const DOG_SIZE = { width: DOG_WIDTH, height: DOG_HEIGHT };
/** Centered — the dog marks a moving point, not a pin tip pointing at one. */
export const DOG_ANCHOR = { x: DOG_WIDTH / 2, y: DOG_HEIGHT / 2 };
