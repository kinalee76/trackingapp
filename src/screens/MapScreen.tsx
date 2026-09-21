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
      <div style={{ flex: 1 }}>
        <MapView provider={provider} center={DEFAULT_CENTER} zoom={16} onReady={handleMapReady} />
      </div>
    </div>
  );
}
