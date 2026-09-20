import { useEffect, useState } from 'react';
import { Dialog } from '@capacitor/dialog';
import * as db from '../services/db/db.service';
import type { Route } from '../services/db/types';

interface RouteListScreenProps {
  onSelect: (routeId: number) => void;
  onBack: () => void;
}

function formatRouteLabel(route: Route): string {
  return route.name ?? new Date(route.startedAt).toLocaleString();
}

export function RouteListScreen({ onSelect, onBack }: RouteListScreenProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    await db.initDb();
    setRoutes(await db.listRoutes());
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEnterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
  }

  function handleCancelSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const { value: confirmed } = await Dialog.confirm({
      title: '삭제',
      message: '진짜 삭제할꺼야?',
      okButtonTitle: '응',
      cancelButtonTitle: '아니',
    });
    if (!confirmed) return;

    await db.deleteRoutes(Array.from(selectedIds));
    setSelectMode(false);
    setSelectedIds(new Set());
    await reload();
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        {selectMode ? (
          <>
            <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
              삭제
            </button>
            <button onClick={handleCancelSelectMode}>취소</button>
          </>
        ) : (
          <>
            <button onClick={onBack}>&lt;</button>
            <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>기록</h2>
            <button onClick={handleEnterSelectMode} disabled={routes.length === 0}>
              삭제
            </button>
          </>
        )}
      </div>
      <div style={{ padding: 16 }}>
        {routes.length === 0 && <p>저장된 경로가 없습니다.</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {routes.map((route) => (
            <li
              key={route.id}
              onClick={() => (selectMode ? toggleSelected(route.id) : onSelect(route.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
            >
              {selectMode && (
                <input type="checkbox" checked={selectedIds.has(route.id)} onChange={() => toggleSelected(route.id)} onClick={(e) => e.stopPropagation()} />
              )}
              <span>{formatRouteLabel(route)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
