import type { LatLng, MapProvider, PlaybackHandle, PlaybackOptions } from '../map-provider.interface';
import { MapProviderKeyMissingError } from '../map-provider.interface';
import { MAP_API_KEYS } from '../map-config';
import { loadScriptOnce } from '../script-loader';
import { runPlayback } from '../playback';
import { pinIconDataUri, PIN_SIZE, PIN_ANCHOR } from '../marker-icon';

declare global {
  interface Window {
    google?: any;
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
    console.warn('[GoogleMapProvider] ignored error from Google Maps SDK during cleanup', err);
  }
}

/**
 * Google Maps JavaScript API, loaded into the WebView.
 *
 * We deliberately do NOT use the native @capacitor-community/google-maps
 * plugin here — as of the beta version evaluated in this project it only
 * exposes markers/polygons, with no polyline API, which is a hard blocker
 * for drawing/animating a GPS route. The JS API supports polylines natively
 * and keeps this adapter consistent with the Naver/Kakao ones.
 * See docs/reports/03-map-providers.md.
 */
export class GoogleMapProvider implements MapProvider {
  private map: any = null;
  private polyline: any = null;
  private markers: any[] = [];
  private playbackMarker: any = null;
  private currentLocationMarker: any = null;

  async init(container: HTMLElement, center: LatLng, zoom = 14): Promise<void> {
    const apiKey = MAP_API_KEYS.google;
    if (!apiKey) throw new MapProviderKeyMissingError('google');

    await loadScriptOnce(`https://maps.googleapis.com/maps/api/js?key=${apiKey}`);
    const google = window.google;
    this.map = new google.maps.Map(container, { center, zoom });
  }

  setCenter(center: LatLng): void {
    this.map?.setCenter(center);
  }

  drawRoute(points: LatLng[]): void {
    if (this.polyline) safeCall(() => this.polyline.setMap(null));
    if (!this.map || points.length === 0) return;
    const google = window.google;
    this.polyline = new google.maps.Polyline({
      map: this.map,
      path: points,
      strokeColor: 'rgb(134, 229, 127)',
      strokeWeight: 4,
    });
  }

  addMarker(position: LatLng, options?: { title?: string; color?: string }): void {
    if (!this.map) return;
    const google = window.google;
    this.markers.push(
      new google.maps.Marker({
        position,
        map: this.map,
        title: options?.title,
        icon: options?.color
          ? {
              url: pinIconDataUri(options.color),
              scaledSize: new google.maps.Size(PIN_SIZE.width, PIN_SIZE.height),
              anchor: new google.maps.Point(PIN_ANCHOR.x, PIN_ANCHOR.y),
            }
          : undefined,
      }),
    );
  }

  clearMarkers(): void {
    this.markers.forEach((m) => safeCall(() => m.setMap(null)));
    this.markers = [];
  }

  fitBounds(points: LatLng[]): void {
    if (!this.map || points.length === 0) return;
    if (points.length === 1) {
      this.setCenter(points[0]);
      return;
    }
    const google = window.google;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend(p);
    this.map.fitBounds(bounds, 40);
  }

  setCurrentLocationMarker(position: LatLng): void {
    if (!this.map) return;
    if (this.currentLocationMarker) {
      this.currentLocationMarker.setPosition(position);
    } else {
      const google = window.google;
      this.currentLocationMarker = new google.maps.Marker({
        position,
        map: this.map,
        title: '현재 위치',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4F46E5',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
    }
  }

  animatePlayback(points: LatLng[], options?: PlaybackOptions): PlaybackHandle {
    const google = window.google;
    if (this.playbackMarker) safeCall(() => this.playbackMarker.setMap(null));
    if (this.map && points.length > 0) {
      this.playbackMarker = new google.maps.Marker({ position: points[0], map: this.map });
    }
    return runPlayback(points, (p) => this.playbackMarker?.setPosition(p), options);
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
