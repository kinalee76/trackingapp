import { useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Dialog } from '@capacitor/dialog'
import { MapScreen } from './screens/MapScreen'
import { RecordsTab } from './screens/RecordsTab'
import { PlaceInfoTab } from './screens/PlaceInfoTab'
import { SettingsScreen } from './screens/SettingsScreen'
import { ErrorBoundary } from './ErrorBoundary'
import * as db from './services/db/db.service'
import { recoverOrphanedRoutes } from './services/geolocation/geolocation.service'

type Tab = 'map' | 'records' | 'placeInfo' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'map', label: '지도' },
  { key: 'records', label: '기록' },
  { key: 'placeInfo', label: '장소 정보' },
  { key: 'settings', label: '설정' },
]

async function confirmExitApp(): Promise<void> {
  // window.confirm() is a no-op in Capacitor's Android WebView — see the
  // same note elsewhere in this codebase (e.g. MapScreen's "위치 저장").
  const { value: shouldExit } = await Dialog.confirm({
    title: '종료',
    message: '앱을 종료하시겠습니까?',
    okButtonTitle: '확인',
    cancelButtonTitle: '취소',
  })
  if (shouldExit) await CapacitorApp.exitApp()
}

function App() {
  const [tab, setTab] = useState<Tab>('map')
  const goToMap = () => setTab('map')

  // Every screen (and the map screen's "위치 저장"/"사진 촬영" actions) reads
  // or writes the DB — initializing it once here, rather than per-screen,
  // means the map screen (the default tab, which has no other reason to
  // await initDb()) doesn't fail on first use.
  //
  // recoverOrphanedRoutes() runs right after, once per app launch, before
  // the user can press "추적 시작" — see its own doc comment for why that
  // ordering makes it safe to treat every still-open route as abandoned.
  useEffect(() => {
    void (async () => {
      await db.initDb()
      await recoverOrphanedRoutes()
    })()
  }, [])

  // Hardware back button handling. By default Capacitor's own fallback
  // (when nothing listens for 'backButton') just minimizes/closes the app
  // from any screen, which is what the user was seeing. We take over:
  //   - a sub-screen (route/place detail) open inside the current tab →
  //     close that sub-screen (tabRef child registers this via
  //     activeBackHandlerRef, mirroring its own "닫기"/"<" button)
  //   - otherwise, not on the 지도 tab → go to the 지도 tab (mirrors the
  //     list screens' own "<" button)
  //   - on the 지도 tab itself (the app's main/root screen) → ask for
  //     confirmation before actually exiting
  // The listener is registered once; `tabRef` lets its closure always see
  // the current tab without needing to resubscribe on every tab change.
  const tabRef = useRef(tab)
  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  const activeBackHandlerRef = useRef<(() => boolean) | null>(null)

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (activeBackHandlerRef.current?.()) return

      if (tabRef.current === 'map') {
        void confirmExitApp()
      } else {
        setTab('map')
      }
    })
    return () => {
      void listenerPromise.then((listener) => listener.remove())
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ErrorBoundary key={tab}>
          {tab === 'map' && <MapScreen />}
          {tab === 'records' && (
            <RecordsTab onBack={goToMap} onRegisterBack={(h) => (activeBackHandlerRef.current = h)} />
          )}
          {tab === 'placeInfo' && (
            <PlaceInfoTab onBack={goToMap} onRegisterBack={(h) => (activeBackHandlerRef.current = h)} />
          )}
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
