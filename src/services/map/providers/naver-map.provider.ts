import type { LatLng, MapProvider, PlaybackHandle, PlaybackOptions } from '../map-provider.interface';
import { MapProviderKeyMissingError } from '../map-provider.interface';
import { MAP_API_KEYS } from '../map-config';
import { loadScriptOnce } from '../script-loader';
import { runPlayback } from '../playback';
import { pinIconHtml, PIN_SIZE, PIN_ANCHOR } from '../marker-icon';

declare global {
  interface Window {
    naver?: any;
  }
}

// The Naver SDK's own Marker/Map internals can end up in a broken state when
// the API key fails to authenticate (its map object never finishes real
// initialization). Calling .setMap(null)/.destroy() on markers tied to such
// a map throws INSIDE the SDK's own minified code — and since that happens
// synchronously while React is unmounting this component, an uncaught
// exception here takes the whole app down to a blank screen (no error
// boundary catches effect-cleanup throws by default). See
// docs/reports/14-white-screen-crash.md for the reproduction.
function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn('[NaverMapProvider] ignored error from Naver SDK during cleanup', err);
  }
}

/** Naver Maps JS SDK v3, loaded into the WebView (no native plugin — see docs/reports/03-map-providers.md). */
export class NaverMapProvider implements MapProvider {
  private map: any = null;
  private polyline: any = null;
  private markers: any[] = [];
  private playbackMarker: any = null;
  private currentLocationMarker: any = null;

  async init(container: HTMLElement, center: LatLng, zoom = 14): Promise<void> {
    const clientId = MAP_API_KEYS.naver;
    if (!clientId) throw new MapProviderKeyMissingError('naver');

    await loadScriptOnce(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`);
    const naver = window.naver;
    this.map = new naver.maps.Map(container, {
      center: new naver.maps.LatLng(center.lat, center.lng),
      zoom,
    });
  }

  setCenter(center: LatLng): void {
    this.map?.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
  }

  drawRoute(points: LatLng[]): void {
    if (this.polyline) safeCall(() => this.polyline.setMap(null));
    if (!this.map || points.length === 0) return;
    const naver = window.naver;
    this.polyline = new naver.maps.Polyline({
      map: this.map,
      path: points.map((p) => new naver.maps.LatLng(p.lat, p.lng)),
      strokeColor: 'rgb(134, 229, 127)',
      strokeWeight: 4,
    });
  }

  addMarker(position: LatLng, options?: { title?: string; color?: string }): void {
    if (!this.map) return;
    const naver = window.naver;
    this.markers.push(
      new naver.maps.Marker({
        position: new naver.maps.LatLng(position.lat, position.lng),
        map: this.map,
        title: options?.title,
        icon: options?.color
          ? {
              content: pinIconHtml(options.color),
              size: new naver.maps.Size(PIN_SIZE.width, PIN_SIZE.height),
              anchor: new naver.maps.Point(PIN_ANCHOR.x, PIN_ANCHOR.y),
            }
          : undefined,
      }),
    );
  }

  fitBounds(points: LatLng[]): void {
    if (!this.map || points.length === 0) return;
    const naver = window.naver;
    if (points.length === 1) {
      this.setCenter(points[0]);
      return;
    }
    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(points[0].lat, points[0].lng),
      new naver.maps.LatLng(points[0].lat, points[0].lng),
    );
    for (const p of points) bounds.extend(new naver.maps.LatLng(p.lat, p.lng));
    this.map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }

  clearMarkers(): void {
    this.markers.forEach((m) => safeCall(() => m.setMap(null)));
    this.markers = [];
  }

  setCurrentLocationMarker(position: LatLng): void {
    if (!this.map) return;
    const naver = window.naver;
    const latLng = new naver.maps.LatLng(position.lat, position.lng);
    if (this.currentLocationMarker) {
      this.currentLocationMarker.setPosition(latLng);
    } else {
      this.currentLocationMarker = new naver.maps.Marker({
        position: latLng,
        map: this.map,
        icon: {
          content: '<div style="width:16px;height:16px;border-radius:50%;background:#4F46E5;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
          anchor: new naver.maps.Point(8, 8),
        },
      });
    }
  }

  animatePlayback(points: LatLng[], options?: PlaybackOptions): PlaybackHandle {
    const naver = window.naver;
    if (this.playbackMarker) safeCall(() => this.playbackMarker.setMap(null));
    if (this.map && points.length > 0) {
      this.playbackMarker = new naver.maps.Marker({
        position: new naver.maps.LatLng(points[0].lat, points[0].lng),
        map: this.map,
      });
    }
    return runPlayback(
      points,
      (p) => this.playbackMarker?.setPosition(new naver.maps.LatLng(p.lat, p.lng)),
      options,
    );
  }

  destroy(): void {
    if (this.polyline) safeCall(() => this.polyline.setMap(null));
    this.clearMarkers();
    if (this.playbackMarker) safeCall(() => this.playbackMarker.setMap(null));
    if (this.currentLocationMarker) safeCall(() => this.currentLocationMarker.setMap(null));
    this.currentLocationMarker = null;
    if (this.map) safeCall(() => this.map.destroy?.());
    this.map = null;
  }
}
