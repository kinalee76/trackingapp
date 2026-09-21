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
 * A small running brown-puppy ("댕댕이") animation for the route-replay
 * ("재생") marker, built entirely from inline SVG + CSS `@keyframes` — no
 * external GIF/image file needed. CSS/SMIL animation inside an SVG keeps
 * animating even when the SVG is only ever used as an `<img>`/data-URI
 * source (Kakao/Google's marker `image`/`icon.url`), not just when injected
 * as HTML content (Naver).
 *
 * Chibi-proportioned (oversized head, big glossy eye with a double
 * highlight, floppy two-tone ear, rosy blush, tongue out, curled tail)
 * rather than a plain silhouette — legs/ear/tail/body each animate on their
 * own cycle for a livelier, cuter running motion. An original generic-puppy
 * design, not any particular character.
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
    `<rect class="dg-leg-b" x="30" y="27" width="4" height="9" rx="2" fill="#7A4A24"/>` +
    `<rect class="dg-leg-a" x="15" y="27" width="4" height="9" rx="2" fill="#7A4A24"/>` +
    `<path class="dg-tail" d="M36 20 Q44 10 40 22 Q38 26 34 22 Z" fill="#C1793F"/>` +
    `<ellipse cx="25" cy="24" rx="12" ry="8" fill="#D89150"/>` +
    `<ellipse cx="25" cy="27" rx="7" ry="4" fill="#FBE3C4"/>` +
    `<circle cx="12" cy="15" r="10" fill="#D89150"/>` +
    `<path class="dg-ear" d="M6 8 Q-2 5 2 17 Q7 16 8 10 Z" fill="#7A4A24"/>` +
    `<circle cx="6" cy="18" r="2.2" fill="#F4A6A6" opacity="0.75"/>` +
    `<ellipse cx="4" cy="17" rx="4.5" ry="3.5" fill="#FBE3C4"/>` +
    `<ellipse cx="1" cy="16.5" rx="1.6" ry="1.3" fill="#2B1B10"/>` +
    `<path d="M3 19 Q4.5 20.5 6 19" stroke="#2B1B10" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M4.5 19.3 Q5 21.5 3.5 21 Z" fill="#F28FA0"/>` +
    `<circle cx="9" cy="12" r="2.4" fill="#241207"/>` +
    `<circle cx="9.8" cy="11" r="0.8" fill="white"/>` +
    `<circle cx="8.3" cy="12.6" r="0.4" fill="white" opacity="0.8"/>` +
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

const KID_WIDTH = 36;
const KID_HEIGHT = 44;

/**
 * A small walking-girl animation for the "현재 위치" marker while tracking is
 * active, built the same way as the dog (inline SVG + CSS `@keyframes`, no
 * external asset). Deliberately an original, generic chibi girl — round
 * head, twin pigtails with a bow, a flared dress instead of pants — not a
 * rendering of any particular licensed cartoon character.
 */
function walkingKidSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KID_WIDTH}" height="${KID_HEIGHT}" viewBox="0 0 36 44">` +
    `<style>` +
    `.kd-body{animation:kd-bob .45s ease-in-out infinite}` +
    `.kd-leg-a{animation:kd-swing-a .45s ease-in-out infinite;transform-origin:14px 30px}` +
    `.kd-leg-b{animation:kd-swing-b .45s ease-in-out infinite;transform-origin:22px 30px}` +
    `.kd-arm-a{animation:kd-swing-b .45s ease-in-out infinite;transform-origin:12px 20px}` +
    `.kd-arm-b{animation:kd-swing-a .45s ease-in-out infinite;transform-origin:24px 20px}` +
    `.kd-tail-a{animation:kd-swing-a .45s ease-in-out infinite;transform-origin:6px 12px}` +
    `.kd-tail-b{animation:kd-swing-b .45s ease-in-out infinite;transform-origin:30px 12px}` +
    `@keyframes kd-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}` +
    `@keyframes kd-swing-a{0%,100%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}}` +
    `@keyframes kd-swing-b{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}` +
    `</style>` +
    `<g class="kd-body">` +
    `<rect class="kd-leg-a" x="12" y="28" width="4" height="14" rx="2" fill="#F6D2A8"/>` +
    `<rect class="kd-leg-b" x="20" y="28" width="4" height="14" rx="2" fill="#F6D2A8"/>` +
    `<path class="kd-arm-a" d="M12 20 L8 28" stroke="#F6D2A8" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<path class="kd-arm-b" d="M24 20 L28 28" stroke="#F6D2A8" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M11 18 L25 18 L29 32 L7 32 Z" fill="#FF7FA0"/>` +
    `<path d="M11 18 L25 18 L23.5 23 L12.5 23 Z" fill="#FF9BB8"/>` +
    `<ellipse class="kd-tail-a" cx="6" cy="16" rx="2.6" ry="5" fill="#3B2A20"/>` +
    `<ellipse class="kd-tail-b" cx="30" cy="16" rx="2.6" ry="5" fill="#3B2A20"/>` +
    `<circle cx="18" cy="11" r="9" fill="#F6D2A8"/>` +
    `<path d="M8 9 Q18 -3 28 9 Q28 4 18 3 Q8 4 8 9 Z" fill="#3B2A20"/>` +
    `<circle cx="6" cy="10" r="3.4" fill="#3B2A20"/>` +
    `<circle cx="30" cy="10" r="3.4" fill="#3B2A20"/>` +
    `<path d="M26 7 L29.5 5.3 L29 8.3 Z" fill="#FF6B8B"/>` +
    `<path d="M33 7 L29.5 5.3 L30 8.3 Z" fill="#FF6B8B"/>` +
    `<circle cx="29.5" cy="7.2" r="1.1" fill="#E8496C"/>` +
    `<circle cx="12" cy="14" r="1.7" fill="#F9AFAF" opacity="0.7"/>` +
    `<circle cx="24" cy="14" r="1.7" fill="#F9AFAF" opacity="0.7"/>` +
    `<circle cx="14" cy="12" r="1.4" fill="#2B1B10"/>` +
    `<circle cx="22" cy="12" r="1.4" fill="#2B1B10"/>` +
    `<circle cx="14.5" cy="11.3" r="0.4" fill="white"/>` +
    `<circle cx="22.5" cy="11.3" r="0.4" fill="white"/>` +
    `<path d="M12.3 10.3 L10.7 9.3" stroke="#2B1B10" stroke-width="0.7" stroke-linecap="round"/>` +
    `<path d="M23.7 10.3 L25.3 9.3" stroke="#2B1B10" stroke-width="0.7" stroke-linecap="round"/>` +
    `<path d="M14 16 Q18 18.5 22 16" stroke="#2B1B10" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `</g>` +
    `</svg>`;
}

export function walkingKidIconHtml(): string {
  return walkingKidSvg();
}

export function walkingKidIconDataUri(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(walkingKidSvg())}`;
}

export const KID_SIZE = { width: KID_WIDTH, height: KID_HEIGHT };
/** Centered — marks a moving point, not a pin tip pointing at one. */
export const KID_ANCHOR = { x: KID_WIDTH / 2, y: KID_HEIGHT / 2 };
