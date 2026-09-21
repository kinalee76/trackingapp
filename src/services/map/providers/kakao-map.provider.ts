import type { LatLng, MapProvider, PlaybackHandle, PlaybackOptions } from '../map-provider.interface';
import { MapProviderKeyMissingError } from '../map-provider.interface';
import { MAP_API_KEYS } from '../map-config';
import { loadScriptOnce } from '../script-loader';
import { runPlayback } from '../playback';
import { pinIconDataUri, cameraPinIconDataUri, runningDogIconDataUri, PIN_SIZE, PIN_ANCHOR, DOG_SIZE, DOG_ANCHOR } from '../marker-icon';

declare global {
  interface Window {
    kakao?: any;
  }
}

// See the matching comment in naver-map.provider.ts / docs/reports/14-white-screen-crash.md
// — a third-party map SDK left in a broken state (e.g. failed API key auth)
// can throw from inside its own code when we call into it during cleanup,
// and an uncaught throw there takes the whole React tree down.
function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn('[KakaoMapProvider] ignored error from Kakao SDK during cleanup', err);
  }
}

/**
 * Kakao Maps JS SDK, loaded into the WebView.
 * Note: Kakao's zoom "level" is inverted vs. Naver/Google (smaller number =
 * more zoomed in, range roughly 1-14) — callers pass Naver/Google-style zoom
 * and this adapter is the one place that would need remapping if exact
 * cross-provider zoom parity is ever required (not done for MVP).
 */
export class KakaoMapProvider implements MapProvider {
  private map: any = null;
  private polyline: any = null;
  private markers: any[] = [];
  private playbackMarker: any = null;
  private currentLocationMarker: any = null;

  async init(container: HTMLElement, center: LatLng, zoom = 5): Promise<void> {
    const appKey = MAP_API_KEYS.kakao;
    if (!appKey) throw new MapProviderKeyMissingError('kakao');

    await loadScriptOnce(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`);
    await new Promise<void>((resolve) => window.kakao.maps.load(resolve));

    const kakao = window.kakao;
    this.map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: zoom,
    });
  }

  setCenter(center: LatLng): void {
    this.map?.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
  }

  drawRoute(points: LatLng[]): void {
    if (this.polyline) safeCall(() => this.polyline.setMap(null));
    if (!this.map || points.length === 0) return;
    const kakao = window.kakao;
    this.polyline = new kakao.maps.Polyline({
      map: this.map,
      path: points.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
      strokeColor: 'rgb(134, 229, 127)',
      strokeWeight: 4,
    });
  }

  addMarker(position: LatLng, options?: { title?: string; color?: string; icon?: 'pin' | 'camera' }): void {
    if (!this.map) return;
    const kakao = window.kakao;
    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(position.lat, position.lng),
      map: this.map,
      image: options?.color
        ? new kakao.maps.MarkerImage(
            options.icon === 'camera' ? cameraPinIconDataUri(options.color) : pinIconDataUri(options.color),
            new kakao.maps.Size(PIN_SIZE.width, PIN_SIZE.height),
            { offset: new kakao.maps.Point(PIN_ANCHOR.x, PIN_ANCHOR.y) },
          )
        : undefined,
    });
    if (options?.title) marker.setTitle(options.title);
    this.markers.push(marker);
  }

  clearMarkers(): void {
    this.markers.forEach((m) => safeCall(() => m.setMap(null)));
    this.markers = [];
  }

  fitBounds(points: LatLng[]): void {
    if (!this.map || points.length === 0) return;
    const kakao = window.kakao;
    if (points.length === 1) {
      this.setCenter(points[0]);
      return;
    }
    const bounds = new kakao.maps.LatLngBounds();
    for (const p of points) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
    this.map.setBounds(bounds);
  }

  setCurrentLocationMarker(position: LatLng): void {
    if (!this.map) return;
    const kakao = window.kakao;
    const latLng = new kakao.maps.LatLng(position.lat, position.lng);
    if (this.currentLocationMarker) {
      this.currentLocationMarker.setPosition(latLng);
    } else {
      this.currentLocationMarker = new kakao.maps.Marker({ position: latLng, map: this.map, title: '현재 위치' });
    }
  }

  animatePlayback(points: LatLng[], options?: PlaybackOptions): PlaybackHandle {
    const kakao = window.kakao;
    if (this.playbackMarker) safeCall(() => this.playbackMarker.setMap(null));
    if (this.map && points.length > 0) {
      this.playbackMarker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(points[0].lat, points[0].lng),
        map: this.map,
        image: new kakao.maps.MarkerImage(
          runningDogIconDataUri(),
          new kakao.maps.Size(DOG_SIZE.width, DOG_SIZE.height),
          { offset: new kakao.maps.Point(DOG_ANCHOR.x, DOG_ANCHOR.y) },
        ),
      });
    }
    return runPlayback(
      points,
      (p) => this.playbackMarker?.setPosition(new kakao.maps.LatLng(p.lat, p.lng)),
      options,
    );
  }

  destroy(): void {
    if (this.polyline) safeCall(() => this.polyline.setMap(null));
    this.clearMarkers();
    if (this.playbackMarker) safeCall(() => this.playbackMarker.setMap(null));
    if (this.currentLocationMarker) safeCall(() => this.currentLocationMarker.setMap(null));
    this.currentLocationMarker = null;
    this.map = null;
  }
}
