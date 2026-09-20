import { useEffect, useState } from 'react';
import * as db from '../services/db/db.service';
import type { PlaceInfo } from '../services/db/types';

interface PlaceInfoListScreenProps {
  onSelect: (id: number) => void;
  onBack: () => void;
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
              style={{ padding: 12, borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
            >
              {item.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
