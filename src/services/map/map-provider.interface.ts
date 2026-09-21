export interface LatLng {
  lat: number;
  lng: number;
}

export type MapProviderKey = 'naver' | 'kakao' | 'google';

export interface PlaybackHandle {
  stop(): void;
}

export interface PlaybackOptions {
  /** Milliseconds between animation steps. Default 200. */
  stepMs?: number;
  onStep?(index: number, point: LatLng): void;
  onDone?(): void;
}

export class MapProviderKeyMissingError extends Error {
  constructor(public readonly provider: MapProviderKey) {
    super(`Missing API key for map provider "${provider}" — set the matching VITE_*_API key in .env (see .env.example).`);
    this.name = 'MapProviderKeyMissingError';
  }
}

/**
 * Common surface every map backend (Naver/Kakao/Google JS SDK) implements,
 * so screens can switch providers at runtime without caring which one is
 * active.
 */
export interface MapProvider {
  init(container: HTMLElement, center: LatLng, zoom?: number): Promise<void>;
  setCenter(center: LatLng): void;
  /** Replaces any previously drawn route with a polyline through `points`. */
  drawRoute(points: LatLng[]): void;
  /** Moves/zooms the camera so every point in `points` is visible at once. No-op for fewer than 1 point. */
  fitBounds(points: LatLng[]): void;
  /**
   * `color` (any CSS color) renders a filled pin in that color; omitted falls
   * back to each provider's default marker. `icon: 'camera'` draws a camera
   * glyph inside the pin instead of a plain dot (used for photo locations).
   */
  addMarker(position: LatLng, options?: { title?: string; color?: string; icon?: 'pin' | 'camera' }): void;
  clearMarkers(): void;
  /** Creates (once) or moves the single "current location" marker. */
  setCurrentLocationMarker(position: LatLng): void;
  /** Animates a marker along `points`; returns a handle to stop early. */
  animatePlayback(points: LatLng[], options?: PlaybackOptions): PlaybackHandle;
  destroy(): void;
}
