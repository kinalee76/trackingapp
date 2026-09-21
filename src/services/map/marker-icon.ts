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
 * A small running baby-puppy ("애기 강아지") animation for the route-replay
 * ("재생") marker, built entirely from inline SVG + CSS `@keyframes` — no
 * external GIF/image file needed. CSS/SMIL animation inside an SVG keeps
 * animating even when the SVG is only ever used as an `<img>`/data-URI
 * source (Kakao/Google's marker `image`/`icon.url`), not just when injected
 * as HTML content (Naver).
 *
 * Baby-proportioned (head noticeably bigger than the body, triple-highlight
 * glossy eye, floppy two-tone ear, rosy blush, tongue out, curled tail)
 * rather than a plain silhouette — legs/ear/tail/body each animate on their
 * own cycle for a livelier, cuter running motion. An original generic-puppy
 * design, not any particular character.
 */
function runningDogSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DOG_WIDTH}" height="${DOG_HEIGHT}" viewBox="0 0 48 40">` +
    `<style>` +
    `.dg-body{animation:dg-bob .5s ease-in-out infinite}` +
    `.dg-leg-a{animation:dg-swing-a .5s ease-in-out infinite;transform-origin:17px 26px}` +
    `.dg-leg-b{animation:dg-swing-b .5s ease-in-out infinite;transform-origin:31px 26px}` +
    `.dg-tail{animation:dg-wag .3s ease-in-out infinite;transform-origin:35px 19px}` +
    `.dg-ear{animation:dg-flop .5s ease-in-out infinite;transform-origin:7px 7px}` +
    `@keyframes dg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}` +
    `@keyframes dg-swing-a{0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}` +
    `@keyframes dg-swing-b{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}` +
    `@keyframes dg-wag{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}` +
    `@keyframes dg-flop{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}` +
    `</style>` +
    `<g class="dg-body">` +
    `<rect class="dg-leg-b" x="29" y="26" width="3.5" height="7" rx="1.75" fill="#7A4A24"/>` +
    `<rect class="dg-leg-a" x="15" y="26" width="3.5" height="7" rx="1.75" fill="#7A4A24"/>` +
    `<path class="dg-tail" d="M35 19 Q42 10 39 21 Q37 24 33 21 Z" fill="#C1793F"/>` +
    `<ellipse cx="24" cy="23" rx="10" ry="6.5" fill="#D89150"/>` +
    `<ellipse cx="24" cy="25.5" rx="6" ry="3.5" fill="#FBE3C4"/>` +
    `<circle cx="13" cy="14" r="11" fill="#D89150"/>` +
    `<path class="dg-ear" d="M6 7 Q-3 4 1 17 Q7 16 9 9 Z" fill="#7A4A24"/>` +
    `<circle cx="6.5" cy="18.5" r="2.4" fill="#F4A6A6" opacity="0.75"/>` +
    `<ellipse cx="4" cy="17.5" rx="4.8" ry="3.7" fill="#FBE3C4"/>` +
    `<ellipse cx="1" cy="17" rx="1.7" ry="1.4" fill="#2B1B10"/>` +
    `<path d="M3 19.5 Q4.5 21 6 19.5" stroke="#2B1B10" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M4.5 19.8 Q5 22 3.5 21.5 Z" fill="#F28FA0"/>` +
    `<circle cx="9" cy="12" r="2.8" fill="#241207"/>` +
    `<circle cx="10" cy="10.7" r="1" fill="white"/>` +
    `<circle cx="8" cy="13.2" r="0.5" fill="white" opacity="0.85"/>` +
    `<circle cx="10.3" cy="12.8" r="0.35" fill="white" opacity="0.7"/>` +
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

const TRACKING_ICON_WIDTH = 36;
const TRACKING_ICON_HEIGHT = 40;

/**
 * A small walking baby-chick ("병아리") animation for the "현재 위치" marker
 * while tracking is active, built the same way as the dog (inline SVG + CSS
 * `@keyframes`, no external asset). Deliberately an original, generic
 * design — round fluffy body, tiny wing, waddling stick legs — not a
 * rendering of any particular licensed character. (This marker's character
 * has changed a few times — see docs/reports/ — so the export names stay
 * generic rather than tied to whichever animal/character is current.)
 */
function trackingIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TRACKING_ICON_WIDTH}" height="${TRACKING_ICON_HEIGHT}" viewBox="0 0 36 40">` +
    `<style>` +
    `.ck-body{animation:ck-bob .4s ease-in-out infinite}` +
    `.ck-leg-a{animation:ck-swing-a .4s ease-in-out infinite;transform-origin:14px 28px}` +
    `.ck-leg-b{animation:ck-swing-b .4s ease-in-out infinite;transform-origin:21px 28px}` +
    `.ck-wing{animation:ck-flap .4s ease-in-out infinite;transform-origin:11px 17px}` +
    `@keyframes ck-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}` +
    `@keyframes ck-swing-a{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-16deg)}}` +
    `@keyframes ck-swing-b{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}` +
    `@keyframes ck-flap{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(18deg)}}` +
    `</style>` +
    `<g class="ck-body">` +
    `<path class="ck-leg-a" d="M14 28 L12 33" stroke="#FF9F1C" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M9.5 33 L14.5 33" stroke="#FF9F1C" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path class="ck-leg-b" d="M21 28 L23 33" stroke="#FF9F1C" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M20.5 33 L25.5 33" stroke="#FF9F1C" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path class="ck-wing" d="M9 14 Q3 16 7 24 Q11 22 11 15 Z" fill="#F5C242"/>` +
    `<circle cx="19" cy="19" r="12" fill="#FFDD57"/>` +
    `<ellipse cx="19" cy="24" rx="7.5" ry="5" fill="#FFEEA8"/>` +
    `<path d="M15 6 Q18 1 21 6 Q18 5 15 6 Z" fill="#F5C242"/>` +
    `<path d="M3 16 L10 14 L10 20 Z" fill="#FF9F1C"/>` +
    `<circle cx="9.5" cy="21" r="2" fill="#F9AFAF" opacity="0.7"/>` +
    `<circle cx="11" cy="14.5" r="1.9" fill="#241207"/>` +
    `<circle cx="11.8" cy="13.3" r="0.65" fill="white"/>` +
    `</g>` +
    `</svg>`;
}

export function trackingIconHtml(): string {
  return trackingIconSvg();
}

export function trackingIconDataUri(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(trackingIconSvg())}`;
}

export const TRACKING_ICON_SIZE = { width: TRACKING_ICON_WIDTH, height: TRACKING_ICON_HEIGHT };
/** Centered — marks a moving point, not a pin tip pointing at one. */
export const TRACKING_ICON_ANCHOR = { x: TRACKING_ICON_WIDTH / 2, y: TRACKING_ICON_HEIGHT / 2 };
