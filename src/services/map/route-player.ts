import type { LatLng, MapProvider, PlaybackHandle } from './map-provider.interface';

export interface RoutePlayerState {
  index: number;
  total: number;
  playing: boolean;
}

/**
 * Framework-agnostic playback controller: owns the current index/playing
 * state and drives a MapProvider, independent of React so it can be unit
 * tested with a stub MapProvider (see docs/reports/04-route-replay.md).
 */
export class RoutePlayer {
  private map: MapProvider | null = null;
  private points: LatLng[] = [];
  private index = 0;
  private playing = false;
  private handle: PlaybackHandle | null = null;
  private stepMs: number;
  private readonly onStateChange?: (state: RoutePlayerState) => void;

  constructor(options: { stepMs?: number; onStateChange?: (state: RoutePlayerState) => void } = {}) {
    this.stepMs = options.stepMs ?? 200;
    this.onStateChange = options.onStateChange;
  }

  setMap(map: MapProvider | null): void {
    this.map = map;
    if (map && this.points.length > 0) map.drawRoute(this.points);
  }

  setPoints(points: LatLng[]): void {
    this.pause();
    this.points = points;
    this.index = 0;
    this.map?.drawRoute(points);
    this.notify();
  }

  setSpeed(stepMs: number): void {
    this.stepMs = stepMs;
    if (this.playing) {
      this.pause();
      this.play();
    }
  }

  play(): void {
    if (!this.map || this.playing || this.points.length === 0) return;
    if (this.index >= this.points.length) this.index = 0;

    const startIndex = this.index;
    const remaining = this.points.slice(startIndex);
    this.playing = true;
    this.handle = this.map.animatePlayback(remaining, {
      stepMs: this.stepMs,
      onStep: (i) => {
        this.index = startIndex + i + 1;
        this.notify();
      },
      onDone: () => {
        this.playing = false;
        this.handle = null;
        this.notify();
      },
    });
    this.notify();
  }

  pause(): void {
    this.handle?.stop();
    this.handle = null;
    this.playing = false;
    this.notify();
  }

  restart(): void {
    this.pause();
    this.index = 0;
    this.notify();
    this.play();
  }

  getState(): RoutePlayerState {
    return { index: this.index, total: this.points.length, playing: this.playing };
  }

  private notify(): void {
    this.onStateChange?.(this.getState());
  }
}
