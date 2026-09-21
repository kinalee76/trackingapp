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
 *
 * Chibi-proportioned (oversized head, big glossy eye, floppy ear, blush,
 * tongue out, curled tail, cream belly patch) rather than a plain silhouette
 * — legs/ear/tail/body each animate on their own cycle for a livelier,
 * cuter running motion.
 */
function runningDogSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DOG_WIDTH}" height="${DOG_HEIGHT}" viewBox="0 0 48 40">` +
    `<style>` +
    `.dg-body{animation:dg-bob .5s ease-in-out infinite}` +
    `.dg-leg-a{animation:dg-swing-a .5s ease-in-out infinite;transform-origin:17px 27px}` +
    `.dg-leg-b{animation:dg-swing-b .5s ease-in-out infinite;transform-origin:32px 27px}` +
    `.dg-tail{animation:dg-wag .3s ease-in-out infinite;transform-origin:36px 20px}` +
    `.dg-ear{animation:dg-flop .5s ease-in-out infinite;transform-origin:6px 8px}` +
    `@keyframes dg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}` +
    `@keyframes dg-swing-a{0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}` +
    `@keyframes dg-swing-b{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}` +
    `@keyframes dg-wag{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}` +
    `@keyframes dg-flop{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}` +
    `</style>` +
    `<g class="dg-body">` +
    `<rect class="dg-leg-b" x="30" y="27" width="4" height="9" rx="2" fill="#8B5A2B"/>` +
    `<rect class="dg-leg-a" x="15" y="27" width="4" height="9" rx="2" fill="#8B5A2B"/>` +
    `<path class="dg-tail" d="M36 20 Q44 10 40 22 Q38 26 34 22 Z" fill="#D9A066"/>` +
    `<ellipse cx="25" cy="24" rx="12" ry="8" fill="#E8B084"/>` +
    `<ellipse cx="25" cy="27" rx="7" ry="4" fill="#FCEBD5"/>` +
    `<circle cx="12" cy="15" r="10" fill="#E8B084"/>` +
    `<path class="dg-ear" d="M6 8 Q-1 6 3 16 Q7 15 8 10 Z" fill="#B9814F"/>` +
    `<circle cx="6" cy="18" r="2" fill="#F4A6A6" opacity="0.7"/>` +
    `<ellipse cx="4" cy="17" rx="4.5" ry="3.5" fill="#FCEBD5"/>` +
    `<ellipse cx="1" cy="16.5" rx="1.6" ry="1.3" fill="#3B2A1A"/>` +
    `<path d="M3 19 Q4.5 20.5 6 19" stroke="#3B2A1A" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M4.5 19.3 Q5 21.5 3.5 21 Z" fill="#F28FA0"/>` +
    `<circle cx="9" cy="12" r="2.2" fill="#2B1B10"/>` +
    `<circle cx="9.7" cy="11.2" r="0.7" fill="white"/>` +
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
