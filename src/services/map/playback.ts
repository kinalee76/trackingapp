import type { LatLng, PlaybackHandle, PlaybackOptions } from './map-provider.interface';

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Steps through `points`, calling `moveTo` on every animation frame with a
 * position linearly interpolated between the surrounding recorded points —
 * not just once per `stepMs` jumping straight to the next point. A marker
 * that only ever teleports point-to-point every `stepMs` reads as choppy,
 * especially where consecutive GPS points are far apart; interpolating
 * smoothly at ~60fps between them reads as continuous movement instead.
 *
 * `onStep`/`onDone` still fire with the exact same count and timing as
 * before (once per point, every `stepMs`) so `RoutePlayer`'s index/total
 * counter and pause/resume behavior are unaffected — only the visual
 * position feed in between is smoothed.
 */
export function runPlayback(points: LatLng[], moveTo: (point: LatLng) => void, options: PlaybackOptions = {}): PlaybackHandle {
  const stepMs = options.stepMs ?? 200;

  if (points.length === 0) {
    options.onDone?.();
    return { stop() {} };
  }

  const total = points.length;
  const totalDurationMs = total * stepMs;
  let rafId: number | null = null;
  let stopped = false;
  let startTime: number | null = null;
  let firedThrough = -1; // highest index i for which onStep(i, points[i]) has already fired

  function fireStepsUpTo(index: number) {
    while (firedThrough < index) {
      firedThrough += 1;
      options.onStep?.(firedThrough, points[firedThrough]);
    }
  }

  function frame(now: number) {
    if (stopped) return;
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;

    if (elapsed >= totalDurationMs) {
      moveTo(points[total - 1]);
      fireStepsUpTo(total - 1);
      options.onDone?.();
      return;
    }

    const windowIndex = Math.min(Math.floor(elapsed / stepMs), total - 1);
    const progress = (elapsed - windowIndex * stepMs) / stepMs;
    const from = points[Math.max(windowIndex - 1, 0)];
    const to = points[windowIndex];
    moveTo(lerp(from, to, progress));

    if (windowIndex - 1 > firedThrough) fireStepsUpTo(windowIndex - 1);

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    stop() {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}
