import { useEffect, useState } from 'react';
import * as db from '../services/db/db.service';
import type { PlaceInfo } from '../services/db/types';

interface PlaceInfoListScreenProps {
  onSelect: (id: number) => void;
  onBack: () => void;
}

/** Matches the purple used for photo markers on the route detail map (see marker-icon.ts) — same meaning, same color, wherever it shows up. */
function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-label="사진">
      <rect x="3" y="7" width="18" height="13" rx="2" fill="#7C3AED" />
      <rect x="8" y="4" width="8" height="4" rx="1" fill="#7C3AED" />
      <circle cx="12" cy="13.5" r="4" fill="white" />
      <circle cx="12" cy="13.5" r="2.3" fill="#7C3AED" />
    </svg>
  );
}

/** Generic location pin — "stay"(자동 체류 감지) and "manual"(수동 위치 저장) entries both just represent a saved location, as opposed to a photo. */
function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-label="위치">
      <path
        d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 11.5 7.3 11.76a1 1 0 0 0 1.4 0C13 21.5 20 15.25 20 10c0-4.42-3.58-8-8-8z"
        fill="#2563EB"
      />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  );
}

export function PlaceInfoListScreen({ onSelect, onBack }: PlaceInfoListScreenProps) {
  const [items, setItems] = useState<PlaceInfo[]>([]);

  useEffect(() => {
    (async () => {
      await db.initDb();
      setItems(await db.listPlaceInfo());
    })();
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        <button onClick={onBack}>&lt;</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>장소 정보</h2>
      </div>
      <div style={{ padding: 16 }}>
        {items.length === 0 && <p>저장된 장소 정보가 없습니다.</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
            >
              {item.source === 'photo' ? <CameraIcon /> : <PinIcon />}
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
