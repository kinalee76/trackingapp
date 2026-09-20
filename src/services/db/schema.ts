export const DB_NAME = 'trackingapp';
export const DB_VERSION = 4;

// IMPORTANT: each array element must be exactly ONE SQL statement.
// @capacitor-community/sqlite's Android upgrade runner passes each element
// straight to Android's SQLiteDatabase.execSQL(), which only ever executes
// the first statement in whatever string it's given and silently drops the
// rest — it does NOT split on ";" itself. Packing multiple CREATE
// TABLE/INDEX statements into one string (as this used to do) meant only
// the very first statement in each schema ever actually ran. See
// docs/reports/09-track-points-migration-bug.md.
export const SCHEMA_V1 = [
  `CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    name TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    speed REAL,
    recorded_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_track_points_route_id ON track_points(route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_track_points_recorded_at ON track_points(recorded_at)`,
  `CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    centroid_lat REAL NOT NULL,
    centroid_lng REAL NOT NULL,
    arrived_at INTEGER NOT NULL,
    left_at INTEGER,
    duration_sec INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_visits_route_id ON visits(route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_visits_arrived_at ON visits(arrived_at)`,
  `CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    file_uri TEXT NOT NULL,
    taken_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_photos_visit_id ON photos(visit_id)`,
  `CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memos_visit_id ON memos(visit_id)`,
];

// v2: "장소 정보" (place info) — a single unified point-in-time record for
// photos taken while tracking, auto-detected stays, and manually saved
// locations. Supersedes the visits/photos/memos flow above (kept in place,
// unused, rather than migrated — no production data to preserve yet).
// `source` holds one of: 'photo' | 'stay' | 'manual'.
export const SCHEMA_V2 = [
  `CREATE TABLE IF NOT EXISTS place_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    place_label TEXT,
    photo_uri TEXT,
    recorded_at INTEGER NOT NULL,
    title TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_place_info_route_id ON place_info(route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_place_info_recorded_at ON place_info(recorded_at)`,
  `CREATE INDEX IF NOT EXISTS idx_place_info_source ON place_info(source)`,
];

// v3: re-runs every CREATE TABLE/INDEX statement from v1+v2. Devices that
// already reached user_version 1 or 2 while the multi-statement bug above
// was live only got their FIRST table (routes, then place_info) created —
// track_points/visits/photos/memos silently never existed. All of these
// statements use IF NOT EXISTS, so re-running the full set is a no-op
// wherever a table already exists and self-heals wherever it doesn't.
// See docs/reports/09-track-points-migration-bug.md.
export const SCHEMA_V3 = [...SCHEMA_V1, ...SCHEMA_V2];

// v4: 경로(route)의 총 이동 거리/시간 저장 — 추적 종료 시 계산해 채워짐
// (docs/reports/12-route-distance-duration.md 참고). 기존 행은 NULL로 남고,
// 화면에서 NULL은 "정보 없음"으로 처리한다.
export const SCHEMA_V4 = [
  `ALTER TABLE routes ADD COLUMN distance_meters REAL`,
  `ALTER TABLE routes ADD COLUMN duration_sec INTEGER`,
];
