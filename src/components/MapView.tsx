import { useEffect, useRef, useState } from 'react';
import type { LatLng, MapProvider, MapProviderKey } from '../services/map/map-provider.interface';
import { MapProviderKeyMissingError } from '../services/map/map-provider.interface';
import { createMapProvider } from '../services/map/map-provider.factory';

interface MapViewProps {
  provider: MapProviderKey;
  center: LatLng;
  zoom?: number;
  onReady?: (map: MapProvider) => void;
}

export function MapView({ provider, center, zoom, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const map = createMapProvider(provider);
    mapRef.current = map;

    (async () => {
      try {
        if (!containerRef.current) return;
        await map.init(containerRef.current, center, zoom);
        if (cancelled) return;
        onReady?.(map);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof MapProviderKeyMissingError) {
          setError(`"${provider}" 지도를 표시하려면 API 키가 필요합니다. .env 파일에 키를 설정해주세요 (.env.example 참고).`);
        } else {
          setError(`지도를 불러오지 못했습니다: ${(e as Error).message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      map.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.92)',
            color: '#b91c1c',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
