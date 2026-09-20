import { Preferences } from '@capacitor/preferences';
import type { MapProviderKey } from '../map/map-provider.interface';
import { DEFAULT_MAP_PROVIDER } from '../map/map-config';

const MAP_PROVIDER_KEY = 'settings.mapProvider';
const STAY_RADIUS_METERS_KEY = 'settings.stayRadiusMeters';
const STAY_MIN_DURATION_MIN_KEY = 'settings.stayMinDurationMin';

const VALID_PROVIDERS: MapProviderKey[] = ['naver', 'kakao', 'google'];

export const DEFAULT_STAY_RADIUS_METERS = 3;
export const DEFAULT_STAY_MIN_DURATION_MIN = 5;

export async function getMapProvider(): Promise<MapProviderKey> {
  const { value } = await Preferences.get({ key: MAP_PROVIDER_KEY });
  if (value && VALID_PROVIDERS.includes(value as MapProviderKey)) {
    return value as MapProviderKey;
  }
  return DEFAULT_MAP_PROVIDER;
}

export async function setMapProvider(provider: MapProviderKey): Promise<void> {
  await Preferences.set({ key: MAP_PROVIDER_KEY, value: provider });
}

export async function getStayRadiusMeters(): Promise<number> {
  const { value } = await Preferences.get({ key: STAY_RADIUS_METERS_KEY });
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STAY_RADIUS_METERS;
}

export async function setStayRadiusMeters(meters: number): Promise<void> {
  await Preferences.set({ key: STAY_RADIUS_METERS_KEY, value: String(meters) });
}

export async function getStayMinDurationMin(): Promise<number> {
  const { value } = await Preferences.get({ key: STAY_MIN_DURATION_MIN_KEY });
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STAY_MIN_DURATION_MIN;
}

export async function setStayMinDurationMin(minutes: number): Promise<void> {
  await Preferences.set({ key: STAY_MIN_DURATION_MIN_KEY, value: String(minutes) });
}
