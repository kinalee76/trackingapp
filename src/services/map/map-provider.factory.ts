import type { MapProvider, MapProviderKey } from './map-provider.interface';
import { NaverMapProvider } from './providers/naver-map.provider';
import { KakaoMapProvider } from './providers/kakao-map.provider';
import { GoogleMapProvider } from './providers/google-map.provider';

export function createMapProvider(key: MapProviderKey): MapProvider {
  switch (key) {
    case 'naver':
      return new NaverMapProvider();
    case 'kakao':
      return new KakaoMapProvider();
    case 'google':
      return new GoogleMapProvider();
  }
}
