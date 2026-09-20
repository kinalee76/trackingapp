import { useEffect, useState } from 'react';
import type { MapProviderKey } from '../services/map/map-provider.interface';
import {
  DEFAULT_STAY_MIN_DURATION_MIN,
  DEFAULT_STAY_RADIUS_METERS,
  getMapProvider,
  getStayMinDurationMin,
  getStayRadiusMeters,
  setMapProvider,
  setStayMinDurationMin,
  setStayRadiusMeters,
} from '../services/settings/settings.service';

const PROVIDER_LABELS: Record<MapProviderKey, string> = {
  naver: '네이버 지도',
  kakao: '카카오맵',
  google: 'Google Maps',
};

export function SettingsScreen() {
  const [provider, setProvider] = useState<MapProviderKey | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_STAY_RADIUS_METERS);
  const [minDurationMin, setMinDurationMin] = useState(DEFAULT_STAY_MIN_DURATION_MIN);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setProvider(await getMapProvider());
      setRadiusMeters(await getStayRadiusMeters());
      setMinDurationMin(await getStayMinDurationMin());
    })();
  }, []);

  async function handleProviderChange(next: MapProviderKey) {
    setProvider(next);
    await setMapProvider(next);
  }

  async function handleSaveThresholds() {
    await Promise.all([setStayRadiusMeters(radiusMeters), setStayMinDurationMin(minDurationMin)]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!provider) return null;

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2>설정</h2>

      <section>
        <h3>지도 공급자</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {(Object.keys(PROVIDER_LABELS) as MapProviderKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleProviderChange(key)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: provider === key ? '#4F46E5' : '#fff',
                color: provider === key ? '#fff' : '#111827',
                cursor: 'pointer',
              }}
            >
              {PROVIDER_LABELS[key]}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>체류 감지 기준</h3>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          지정한 반경 안에 지정한 시간 이상 머무르면 자동으로 "체류 기록"이 생성됩니다.
        </p>
        <label style={{ display: 'block', marginBottom: 8 }}>
          반경 (미터):{' '}
          <input
            type="number"
            min={10}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          최소 체류 시간 (분):{' '}
          <input
            type="number"
            min={1}
            value={minDurationMin}
            onChange={(e) => setMinDurationMin(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <button onClick={handleSaveThresholds}>{saved ? '저장됨' : '저장'}</button>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>* 다음 추적 시작부터 적용됩니다.</p>
      </section>
    </div>
  );
}
