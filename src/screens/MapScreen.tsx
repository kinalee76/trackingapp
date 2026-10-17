import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Dialog } from '@capacitor/dialog';
import { MapView } from '../components/MapView';
import type { MapProvider, MapProviderKey } from '../services/map/map-provider.interface';
import { getMapProvider, getStayRadiusMeters } from '../services/settings/settings.service';
import * as geolocation from '../services/geolocation/geolocation.service';
import { findExistingManualLocation, saveManualLocation, savePhotoPlaceInfo } from '../services/place-info/place-info.service';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청

export function MapScreen() {
  const [provider, setProvider] = useState<MapProviderKey | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const mapRef = useRef<MapProvider | null>(null);
  const watchIdRef = useRef<string | null>(null);
  const hasCenteredRef = useRef(false);
  const trackingRef = useRef(false);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getMapProvider().then(setProvider);
    setTracking(geolocation.isTracking());
  }, []);

  // The live-location watchPosition callback below is subscribed once on
  // mount (see its own effect's empty deps) and would otherwise close over
  // a stale `tracking` value forever — mirror it into a ref so the callback
  // always sees the current state without needing to resubscribe the GPS
  // watch every time tracking is toggled.
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  // Live "current location" marker — active regardless of tracking state,
  // updated on every location fix while this screen is mounted (renders as
  // the tracking icon — see marker-icon.ts — while `tracking` is on, a plain
  // dot otherwise). Separate from the recording watcher in geolocation.service (which only runs
  // while tracking is on) so the user always sees where they are.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
          if (err || !position) return;
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          currentPositionRef.current = point;
          mapRef.current?.setCurrentLocationMarker(point, { tracking: trackingRef.current });
          if (!hasCenteredRef.current) {
            mapRef.current?.setCenter(point);
            hasCenteredRef.current = true;
          }
        });
        if (cancelled) {
          Geolocation.clearWatch({ id: watchId });
        } else {
          watchIdRef.current = watchId;
        }
      } catch {
        // Permission not granted yet, or unsupported — the map still works, just without the live marker.
      }
    })();
    return () => {
      cancelled = true;
      if (watchIdRef.current) void Geolocation.clearWatch({ id: watchIdRef.current });
    };
  }, []);

  function handleMapReady(map: MapProvider) {
    mapRef.current = map;
  }

  async function handleToggleTracking() {
    setError(null);
    setBusy(true);
    try {
      if (tracking) {
        await geolocation.stopTracking();
      } else {
        await geolocation.startTracking();
      }
      setTracking(geolocation.isTracking());
    } catch (e) {
      setError(`${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLocation() {
    setError(null);
    setSavingLocation(true);
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const dedupeRadius = await getStayRadiusMeters();

      const existing = await findExistingManualLocation(lat, lng, dedupeRadius);
      if (existing) {
        // window.confirm() is a no-op in Capacitor's Android WebView (its
        // WebChromeClient doesn't implement onJsConfirm, so it silently
        // cancels) — @capacitor/dialog shows a real native dialog instead.
        const { value: addAnyway } = await Dialog.confirm({
          title: '이미 저장된 위치',
          message: `이미 저장된 위치입니다 ("${existing.title}"). 새로 추가하시겠습니까?`,
        });
        if (!addAnyway) return;
      }

      await saveManualLocation(geolocation.getCurrentRouteId(), lat, lng);
    } catch (e) {
      setError(`위치 저장 실패: ${(e as Error).message}`);
    } finally {
      setSavingLocation(false);
    }
  }

  /**
   * "현재 위치로 이동" — recenters the map on the live location, whether or
   * not tracking is on (the live marker/watcher above already runs
   * regardless of tracking state, so this is just a manual re-center for
   * when the user has panned the map away from themselves, e.g. to look
   * back along the route while walking).
   */
  async function handleRecenter() {
    setError(null);
    try {
      if (currentPositionRef.current) {
        mapRef.current?.setCenter(currentPositionRef.current);
        return;
      }
      // No live fix cached yet (e.g. permission just granted) — fetch one directly.
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      currentPositionRef.current = point;
      mapRef.current?.setCenter(point);
    } catch (e) {
      setError(`현재 위치를 가져오지 못했습니다: ${(e as Error).message}`);
    }
  }

  async function handleCapturePhoto() {
    setError(null);
    setCapturingPhoto(true);
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      await savePhotoPlaceInfo(geolocation.getCurrentRouteId(), position.coords.latitude, position.coords.longitude);
    } catch (e) {
      setError(`사진 저장 실패: ${(e as Error).message}`);
    } finally {
      setCapturingPhoto(false);
    }
  }

  if (!provider) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        <button onClick={handleToggleTracking} disabled={busy}>
          {tracking ? '추적 중지' : '추적 시작'}
        </button>
        <button onClick={handleSaveLocation} disabled={savingLocation}>
          {savingLocation ? '저장 중...' : '위치 저장'}
        </button>
        <button onClick={handleCapturePhoto} disabled={!tracking || capturingPhoto} title={tracking ? undefined : '추적 중에만 사용할 수 있습니다'}>
          {capturingPhoto ? '촬영 중...' : '사진 촬영'}
        </button>
        <span style={{ fontSize: 13, color: tracking ? '#059669' : '#6b7280' }}>
          {tracking ? '추적 중 — 이동 경로와 체류를 기록하고 있습니다' : '추적이 꺼져 있습니다'}
        </span>
        {error && <span style={{ fontSize: 13, color: '#b91c1c' }}>{error}</span>}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView provider={provider} center={DEFAULT_CENTER} zoom={16} onReady={handleMapReady} />
        <button
          onClick={handleRecenter}
          aria-label="현재 위치로 이동"
          title="현재 위치로 이동"
          style={{
            WebkitAppearance: 'none',
            appearance: 'none',
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 24,
            height: 24,
            padding: 0,
            margin: 0,
            lineHeight: 0,
            boxSizing: 'border-box',
            borderRadius: '50%',
            border: 'none',
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {/* A cute smiling location pin instead of a plain crosshair. */}
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 11.5 7.3 11.76a1 1 0 0 0 1.4 0C13 21.5 20 15.25 20 10c0-4.42-3.58-8-8-8z"
              fill="#2563EB"
            />
            <circle cx="12" cy="10" r="5.2" fill="white" />
            <circle cx="9.8" cy="9" r="1" fill="#2563EB" />
            <circle cx="14.2" cy="9" r="1" fill="#2563EB" />
            <path d="M9.3 11.5 Q12 13.5 14.7 11.5" stroke="#2563EB" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
