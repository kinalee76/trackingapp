import type { LatLng, PlaybackHandle, PlaybackOptions } from './map-provider.interface';

/** Steps through `points` on a timer, calling `moveTo` at each step. Shared by every provider adapter. */
export function runPlayback(points: LatLng[], moveTo: (point: LatLng) => void, options: PlaybackOptions = {}): PlaybackHandle {
  const stepMs = options.stepMs ?? 200;

  if (points.length === 0) {
    options.onDone?.();
    return { stop() {} };
  }

  let index = 0;
  const timer = setInterval(() => {
    const point = points[index];
    moveTo(point);
    options.onStep?.(index, point);
    index += 1;
    if (index >= points.length) {
      clearInterval(timer);
      options.onDone?.();
    }
  }, stepMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
