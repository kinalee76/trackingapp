import type { MapProviderKey } from './map-provider.interface';

export const MAP_API_KEYS: Record<MapProviderKey, string | undefined> = {
  naver: import.meta.env.VITE_NAVER_MAP_CLIENT_ID,
  kakao: import.meta.env.VITE_KAKAO_MAP_APP_KEY,
  google: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
};

export const DEFAULT_MAP_PROVIDER: MapProviderKey = 'naver';
