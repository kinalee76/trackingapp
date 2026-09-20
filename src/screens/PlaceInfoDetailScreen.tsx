import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import * as db from '../services/db/db.service';
import type { PlaceInfo } from '../services/db/types';
import { formatDateTime } from '../utils/datetime';

interface PlaceInfoDetailScreenProps {
  id: number;
  onBack: () => void;
}

export function PlaceInfoDetailScreen({ id, onBack }: PlaceInfoDetailScreenProps) {
  const [item, setItem] = useState<PlaceInfo | null>(null);

  useEffect(() => {
    db.getPlaceInfo(id).then(setItem);
  }, [id]);

  if (!item) return null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        <button onClick={onBack}>&lt;</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>장소 정보</h2>
      </div>

      <div style={{ padding: 16 }}>
        <section>
          <h3 style={{ marginBottom: 8 }}>사진</h3>
          {item.photoUri ? (
            // Native file:// paths can't be loaded directly in the WebView —
            // Capacitor.convertFileSrc() rewrites them to the
            // capacitor://localhost/_capacitor_file_/... scheme the WebView
            // is configured to actually serve. No-op on web (webPath is
            // already a loadable blob: URL there).
            <img src={Capacitor.convertFileSrc(item.photoUri)} alt="" style={{ width: '100%', maxWidth: 320, borderRadius: 8 }} />
          ) : (
            <p style={{ color: '#6b7280' }}>사진 없음</p>
          )}
        </section>

        <section style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>위치 정보</h3>
          <p>
            {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
          </p>
        </section>

        <section style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>장소</h3>
          <p>{item.placeLabel ?? '알 수 없는 장소'}</p>
        </section>

        <section style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>날짜 / 시간</h3>
          <p>{formatDateTime(item.recordedAt)}</p>
        </section>
      </div>
    </div>
  );
}
