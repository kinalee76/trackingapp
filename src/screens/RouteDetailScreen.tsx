import { useEffect, useRef, useState } from 'react';
import { MapView } from '../components/MapView';
import { RoutePlayer, type RoutePlayerState } from '../services/map/route-player';
import type { LatLng, MapProvider, MapProviderKey } from '../services/map/map-provider.interface';
import { getMapProvider } from '../services/settings/settings.service';
import * as db from '../services/db/db.service';
import type { Route, TrackPoint } from '../services/db/types';
import { formatDurationClock } from '../utils/datetime';
import { formatDistanceKm } from '../utils/geo';

const SPEED_OPTIONS = [
  { label: '0.5x', stepMs: 400 },
  { label: '1x', stepMs: 200 },
  { label: '2x', stepMs: 100 },
  { label: '4x', stepMs: 50 },
];

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청 — 경로 로드 전 임시 초기값일 뿐, 로드되면 즉시 실제 위치로 이동함

function toLatLng(point: TrackPoint): LatLng {
  return { lat: point.lat, lng: point.lng };
}

interface RouteDetailScreenProps {
  routeId: number;
  onClose: () => void;
}

export function RouteDetailScreen({ routeId, onClose }: RouteDetailScreenProps) {
  const [provider, setProvider] = useState<MapProviderKey | null>(null);
  const [map, setMap] = useState<MapProvider | null>(null);
  const [points, setPoints] = useState<LatLng[] | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [state, setState] = useState<RoutePlayerState>({ index: 0, total: 0, playing: false });
  const [stepMs, setStepMs] = useState(200);

  const playerRef = useRef<RoutePlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = new RoutePlayer({ stepMs, onStateChange: setState });
  }

  useEffect(() => {
    (async () => {
      setProvider(await getMapProvider());
      const [loaded, routeRow] = await Promise.all([db.getRoutePoints(routeId), db.getRoute(routeId)]);
      const latLngs = loaded.map(toLatLng);
      setPoints(latLngs);
      setRoute(routeRow);
      playerRef.current?.setPoints(latLngs);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Runs whenever the map becomes ready AND/OR the points finish loading,
  // regardless of which happens first — moves the camera to the route's
  // actual location and marks its start/end, instead of leaving the map
  // sitting on its initial placeholder center.
  //
  // fitBounds (not setCenter+fixed zoom) is required here: centering on just
  // the start point at a fixed zoom crops out the rest of any route longer
  // than ~200-300m, which made a real recorded path look like a single
  // stationary point. See docs/reports/10-route-path-not-visible.md.
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    map.fitBounds(points);
    map.clearMarkers();
    map.addMarker(points[0], { title: '출발', color: '#2563EB' });
    if (points.length > 1) map.addMarker(points[points.length - 1], { title: '도착', color: '#DC2626' });
  }, [map, points]);

  function handleMapReady(m: MapProvider) {
    playerRef.current?.setMap(m);
    setMap(m);
  }

  function handleSpeedChange(next: number) {
    setStepMs(next);
    playerRef.current?.setSpeed(next);
  }

  if (!provider) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
        <button onClick={onClose}>닫기</button>
        <h2 style={{ margin: 0, fontSize: 16 }}>이동 경로 보기</h2>

        <button onClick={() => playerRef.current?.play()} disabled={state.playing || state.total === 0}>
          재생
        </button>
        <button onClick={() => playerRef.current?.pause()} disabled={!state.playing}>
          일시정지
        </button>
        <button onClick={() => playerRef.current?.restart()} disabled={state.total === 0}>
          처음부터
        </button>

        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.stepMs}
            onClick={() => handleSpeedChange(opt.stepMs)}
            style={{ fontWeight: stepMs === opt.stepMs ? 'bold' : 'normal' }}
          >
            {opt.label}
          </button>
        ))}

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#374151' }}>
          {state.index} / {state.total}
        </span>
      </div>
      {points?.length === 0 && (
        <p style={{ padding: 8, margin: 0, color: '#b91c1c', fontSize: 13 }}>
          이 경로에는 저장된 위치가 없습니다 (추적을 시작한 직후 바로 중지된 경로일 수 있습니다).
        </p>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView provider={provider} center={DEFAULT_CENTER} zoom={16} onReady={handleMapReady} />
        {route && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(255,255,255,0.92)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              fontSize: 13,
              color: '#111827',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>기록 정보</div>
            <div>이동 거리 : {route.distanceMeters != null ? formatDistanceKm(route.distanceMeters) : '-'}</div>
            <div>이동 시간 : {route.durationSec != null ? formatDurationClock(route.durationSec) : '-'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
