import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location } from '@capacitor-community/background-geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import * as db from '../db/db.service';
import { StayDetector, type StayEvent } from './stay-detector';
import { getStayMinDurationMin, getStayRadiusMeters } from '../settings/settings.service';
import { saveStayPlaceInfo } from '../place-info/place-info.service';
import { formatDateTime } from '../../utils/datetime';
import { haversineMeters } from '../../utils/geo';

// This plugin ships type definitions only (no bundled JS) — the native
// implementation is registered by name, per the plugin's README.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

const SAVE_INTERVAL_MS = 5000;

let watcherId: string | null = null;
let currentRouteId: number | null = null;
let routeStartedAt: number | null = null;
let stayDetector: StayDetector | null = null;
let stayRadiusMeters = 0;
let lastSavedPoint: { lat: number; lng: number } | null = null;
let lastSavedAt: number | null = null;
let totalDistanceMeters = 0;

export async function startTracking(): Promise<number> {
  if (watcherId) throw new Error('Tracking is already running');

  // Android 13+ requires the POST_NOTIFICATIONS runtime permission before a
  // foreground service can show its persistent notification — without it,
  // background tracking silently runs with no visible notification.
  // BackgroundGeolocation's own `requestPermissions` only covers location,
  // so this is requested separately (no-op on platforms that don't need it).
  await LocalNotifications.requestPermissions();

  // Request location permission explicitly and WAIT for the OS grant to
  // fully settle before starting the location-type foreground service.
  // BackgroundGeolocation.addWatcher's own `requestPermissions: true` asks
  // for the permission and attempts to start the foreground service too
  // close together — on a device's very first grant, the service can start
  // before Android has finished propagating the grant, causing a
  // SecurityException that the plugin swallows natively (the JS promise
  // still resolves as if tracking started, leaving the UI showing "추적
  // 중" while no watcher is actually running). Pre-requesting here and
  // passing `requestPermissions: false` below avoids that race.
  const permission = await Geolocation.requestPermissions();
  if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
    throw new Error('위치 권한이 필요합니다.');
  }

  await db.initDb();
  routeStartedAt = Date.now();
  currentRouteId = await db.createRoute(routeStartedAt);
  stayRadiusMeters = await getStayRadiusMeters();
  const minDurationMin = await getStayMinDurationMin();
  stayDetector = new StayDetector({ radiusMeters: stayRadiusMeters, minDurationMs: minDurationMin * 60 * 1000 });
  lastSavedPoint = null;
  lastSavedAt = null;
  totalDistanceMeters = 0;

  // Points are saved directly from this native callback (throttled to one
  // every SAVE_INTERVAL_MS below) rather than from a separate JS
  // setInterval sampling a cached "latest location". A WebView's own JS
  // timers get throttled or paused once the app is backgrounded/hidden —
  // even though the plugin's foreground service keeps native location
  // updates flowing — which meant tracking silently stopped recording
  // points as soon as the user left the app. Native-driven callbacks like
  // this one don't have that problem: they keep firing as long as the
  // foreground service is alive. See
  // docs/reports/13-background-tracking-not-saving.md.
  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'GPS 추적 중',
      backgroundMessage: '이동 경로를 기록하는 중입니다. 중지하려면 앱으로 돌아가세요.',
      requestPermissions: false,
      stale: false,
      distanceFilter: 0,
    },
    (location, error) => {
      if (error) {
        console.error('[geolocation.service] watcher error', error);
        return;
      }
      if (location) void handleLocation(location);
    },
  );

  return currentRouteId;
}

export async function stopTracking(): Promise<void> {
  if (!watcherId) return;

  await BackgroundGeolocation.removeWatcher({ id: watcherId });
  watcherId = null;

  if (currentRouteId !== null) {
    const endedAt = Date.now();
    const durationSec = Math.round((endedAt - (routeStartedAt ?? endedAt)) / 1000);
    await db.endRoute(currentRouteId, endedAt);
    await db.setRouteName(currentRouteId, formatDateTime(routeStartedAt ?? endedAt));
    await db.updateRouteStats(currentRouteId, totalDistanceMeters, durationSec);
  }

  currentRouteId = null;
  routeStartedAt = null;
  stayDetector = null;
  lastSavedPoint = null;
  lastSavedAt = null;
  totalDistanceMeters = 0;
}

export function isTracking(): boolean {
  return watcherId !== null;
}

export function getCurrentRouteId(): number | null {
  return currentRouteId;
}

export function openLocationSettings(): Promise<void> {
  return BackgroundGeolocation.openSettings();
}

/**
 * Closes out any route left with `ended_at` still NULL — tracking that was
 * interrupted (app killed/crashed/swiped away) before `stopTracking()` could
 * run, so it never got a name, distance, or duration and would otherwise
 * sit "open" forever (unreachable from the UI, since a fresh app launch
 * always starts with `isTracking()` false). Closes each one using its last
 * recorded track_point's timestamp as the end time and re-deriving distance
 * from the actual recorded points, rather than leaving the record broken or
 * guessing based on wall-clock "now".
 *
 * Must only be called once at app startup, before any new tracking session
 * starts — at that point every `ended_at IS NULL` row is unambiguously
 * abandoned, since this module's in-memory state (and therefore
 * `isTracking()`) always starts fresh as "not tracking" on launch.
 * See docs/reports/22-duration-display-and-orphaned-routes.md.
 */
export async function recoverOrphanedRoutes(): Promise<void> {
  const orphaned = await db.listOrphanedRoutes();
  for (const route of orphaned) {
    const points = await db.getRoutePoints(route.id);
    const lastPoint = points[points.length - 1];
    const endedAt = lastPoint?.recordedAt ?? route.startedAt;
    const durationSec = Math.max(0, Math.round((endedAt - route.startedAt) / 1000));

    let distanceMeters = 0;
    for (let i = 1; i < points.length; i++) {
      distanceMeters += haversineMeters(points[i - 1], points[i]);
    }

    await db.endRoute(route.id, endedAt);
    await db.setRouteName(route.id, formatDateTime(route.startedAt));
    await db.updateRouteStats(route.id, distanceMeters, durationSec);
  }
}

async function handleLocation(location: Location): Promise<void> {
  if (currentRouteId === null || !stayDetector) return;

  const recordedAt = location.time ?? Date.now();

  // The native watcher can call back much more often than every 5 seconds
  // (GPS chips commonly report at 1Hz) — throttle here instead of relying
  // on a JS timer (see the comment in startTracking for why).
  if (lastSavedAt !== null && recordedAt - lastSavedAt < SAVE_INTERVAL_MS) return;
  lastSavedAt = recordedAt;

  const point = { lat: location.latitude, lng: location.longitude };

  await db.insertTrackPoint({
    routeId: currentRouteId,
    lat: location.latitude,
    lng: location.longitude,
    altitude: location.altitude,
    accuracy: location.accuracy,
    speed: location.speed,
    recordedAt,
  });

  // Running total of the route's length — summed incrementally per 5-second
  // point rather than re-fetching+re-summing all track_points when tracking
  // stops (see docs/reports/12-route-distance-duration.md).
  if (lastSavedPoint) totalDistanceMeters += haversineMeters(lastSavedPoint, point);
  lastSavedPoint = point;

  const event: StayEvent | null = stayDetector.addPoint({ ...point, time: recordedAt });
  if (event?.type === 'stay-started') {
    await saveStayPlaceInfo(currentRouteId, event.centroidLat, event.centroidLng, event.arrivedAt, stayRadiusMeters);
  }
  // 'stay-updated'/'stay-ended' need no further action — the place_info
  // record (if any) was already saved when the stay started, and it has no
  // duration field to close out.
}
