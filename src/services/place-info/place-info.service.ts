import * as db from '../db/db.service';
import type { PlaceInfo } from '../db/types';
import { reverseGeocode } from '../geocoding/nominatim.service';
import { capturePhoto } from '../photo/photo.service';
import { formatDateTimeTitle, formatTime } from '../../utils/datetime';

/**
 * Auto-saves a "장소 정보" for a detected stay (source: 'stay'). Silently
 * skips if a stay-sourced place_info already exists within `dedupeRadiusMeters`
 * — per spec, a location already recorded this way is never saved again.
 */
export async function saveStayPlaceInfo(
  routeId: number | null,
  lat: number,
  lng: number,
  recordedAt: number,
  dedupeRadiusMeters: number,
): Promise<number | null> {
  const existing = await db.findNearbyPlaceInfo('stay', lat, lng, dedupeRadiusMeters);
  if (existing) return null;

  const placeLabel = await reverseGeocode(lat, lng);
  const title = `${formatDateTimeTitle(recordedAt)}_${placeLabel ?? '알 수 없는 장소'}`;
  return db.createPlaceInfo({ routeId, source: 'stay', lat, lng, placeLabel, photoUri: null, recordedAt, title });
}

/** Checks whether a manually-saved location already exists nearby, for the "새로 추가하시겠습니까?" confirmation. */
export function findExistingManualLocation(lat: number, lng: number, radiusMeters: number): Promise<PlaceInfo | null> {
  return db.findNearbyPlaceInfo('manual', lat, lng, radiusMeters);
}

/** Saves a manually-triggered "위치 저장" — always inserts, even if a duplicate exists (caller has already confirmed). */
export async function saveManualLocation(routeId: number | null, lat: number, lng: number): Promise<number> {
  const recordedAt = Date.now();
  const placeLabel = await reverseGeocode(lat, lng);
  const title = `${formatDateTimeTitle(recordedAt)}_${placeLabel ?? '알 수 없는 장소'}`;
  return db.createPlaceInfo({ routeId, source: 'manual', lat, lng, placeLabel, photoUri: null, recordedAt, title });
}

/** Takes a photo and saves it as a "장소 정보" tied to the current location (source: 'photo'). No dedupe — every photo is its own record. */
export async function savePhotoPlaceInfo(routeId: number | null, lat: number, lng: number): Promise<number> {
  const [photoUri, placeLabel] = await Promise.all([capturePhoto(), reverseGeocode(lat, lng)]);
  const recordedAt = Date.now();
  const title = `${formatTime(recordedAt)}_${placeLabel ?? '알 수 없는 장소'}`;
  return db.createPlaceInfo({ routeId, source: 'photo', lat, lng, placeLabel, photoUri, recordedAt, title });
}
