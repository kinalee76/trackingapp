import { useEffect, useState } from 'react'
import { MapScreen } from './screens/MapScreen'
import { RecordsTab } from './screens/RecordsTab'
import { PlaceInfoTab } from './screens/PlaceInfoTab'
import { SettingsScreen } from './screens/SettingsScreen'
import { ErrorBoundary } from './ErrorBoundary'
import * as db from './services/db/db.service'

type Tab = 'map' | 'records' | 'placeInfo' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'map', label: '지도' },
  { key: 'records', label: '기록' },
  { key: 'placeInfo', label: '장소 정보' },
  { key: 'settings', label: '설정' },
]

function App() {
  const [tab, setTab] = useState<Tab>('map')
  const goToMap = () => setTab('map')

  // Every screen (and the map screen's "위치 저장"/"사진 촬영" actions) reads
  // or writes the DB — initializing it once here, rather than per-screen,
  // means the map screen (the default tab, which has no other reason to
  // await initDb()) doesn't fail on first use.
  useEffect(() => {
    void db.initDb()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ErrorBoundary key={tab}>
          {tab === 'map' && <MapScreen />}
          {tab === 'records' && <RecordsTab onBack={goToMap} />}
          {tab === 'placeInfo' && <PlaceInfoTab onBack={goToMap} />}
          {tab === 'settings' && <SettingsScreen />}
        </ErrorBoundary>
      </div>
      <nav style={{ display: 'flex', borderTop: '1px solid #e5e7eb' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: tab === t.key ? '#eef2ff' : '#fff',
              color: tab === t.key ? '#4F46E5' : '#374151',
              fontWeight: tab === t.key ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
