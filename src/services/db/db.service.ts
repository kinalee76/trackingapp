import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DB_NAME, DB_VERSION, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4 } from './schema';
import type { Memo, PlaceInfo, Photo, Route, TrackPoint, Visit } from './types';
import { haversineMeters } from '../../utils/geo';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;

async function ensureWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;

  const el = document.querySelector('jeep-sqlite');
  if (!el) {
    const newEl = document.createElement('jeep-sqlite');
    // Without autoSave, jeep-sqlite keeps the DB in memory only and every
    // reload starts empty — writes never reach its IndexedDB store.
    newEl.setAttribute('autoSave', 'true');
    document.body.appendChild(newEl);
    await customElements.whenDefined('jeep-sqlite');
  }

  await sqlite.initWebStore();
}

export function initDb(): Promise<SQLiteDBConnection> {
  if (db) return Promise.resolve(db);
  // Concurrent first callers (e.g. React StrictMode's double-invoked
  // effects, or two screens mounting at once) must await the SAME
  // initialization attempt — otherwise each starts its own
  // ensureWebStore()/createConnection() race and one can end up opening a
  // second, empty connection while the other is still restoring the store.
  if (!initPromise) initPromise = doInitDb();
  return initPromise;
}

async function doInitDb(): Promise<SQLiteDBConnection> {
  await ensureWebStore();

  // Each entry's `statements` must be an array of INDIVIDUAL SQL statements
  // — the native Android upgrade runner executes each element as its own
  // execSQL() call and does not split on ";" itself (see schema.ts and
  // docs/reports/09-track-points-migration-bug.md for the bug this caused
  // when a whole multi-statement block was passed as one string).
  await sqlite.addUpgradeStatement(DB_NAME, [
    { toVersion: 1, statements: SCHEMA_V1 },
    { toVersion: 2, statements: SCHEMA_V2 },
    { toVersion: 3, statements: SCHEMA_V3 },
    { toVersion: 4, statements: SCHEMA_V4 },
  ]);

  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

  await db.open();

  if (Capacitor.getPlatform() === 'web') {
    // jeep-sqlite's restore of a previously-saved database from IndexedDB
    // into memory can still be in flight when open() resolves — a query
    // issued immediately after can silently see a blank (version 0)
    // database that gets replaced by the real one moments later. Poll
    // PRAGMA user_version until it reflects our schema (or give up after a
    // bounded wait, which is the correct outcome for a genuinely fresh
    // install with nothing to restore). Native platforms read straight
    // from disk and never hit this race.
    for (let attempt = 0; attempt < 25; attempt++) {
      const result = await db.query('PRAGMA user_version');
      const version = result.values?.[0]?.user_version;
      if (version === DB_VERSION) break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  return db;
}

export async function closeDb(): Promise<void> {
  if (!db) return;
  await sqlite.closeConnection(DB_NAME, false);
  db = null;
  initPromise = null;
}

function requireDb(): SQLiteDBConnection {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

// --- Routes ---

export async function createRoute(startedAt: number, name: string | null = null): Promise<number> {
  const res = await requireDb().run('INSERT INTO routes (started_at, name) VALUES (?, ?)', [startedAt, name]);
  return res.changes?.lastId ?? -1;
}

export async function endRoute(routeId: number, endedAt: number): Promise<void> {
  await requireDb().run('UPDATE routes SET ended_at = ? WHERE id = ?', [endedAt, routeId]);
}

export async function setRouteName(routeId: number, name: string): Promise<void> {
  await requireDb().run('UPDATE routes SET name = ? WHERE id = ?', [name, routeId]);
}

export async function listRoutes(): Promise<Route[]> {
  const res = await requireDb().query('SELECT * FROM routes ORDER BY started_at DESC');
  return (res.values ?? []).map(rowToRoute);
}

export async function getRoute(routeId: number): Promise<Route | null> {
  const res = await requireDb().query('SELECT * FROM routes WHERE id = ?', [routeId]);
  const row = (res.values ?? [])[0];
  return row ? rowToRoute(row) : null;
}

/** Saves the total distance/duration covered by a route, computed once tracking stops. */
export async function updateRouteStats(routeId: number, distanceMeters: number, durationSec: number): Promise<void> {
  await requireDb().run('UPDATE routes SET distance_meters = ?, duration_sec = ? WHERE id = ?', [
    distanceMeters,
    durationSec,
    routeId,
  ]);
}

/** Deletes routes by id. Their track_points cascade-delete; any place_info tied to them keeps its row with route_id set to NULL. */
export async function deleteRoutes(routeIds: number[]): Promise<void> {
  const database = requireDb();
  for (const id of routeIds) {
    await database.run('DELETE FROM routes WHERE id = ?', [id]);
  }
}

export async function getRoutePoints(routeId: number): Promise<TrackPoint[]> {
  const res = await requireDb().query('SELECT * FROM track_points WHERE route_id = ? ORDER BY recorded_at ASC', [
    routeId,
  ]);
  return (res.values ?? []).map(rowToTrackPoint);
}

// --- Track points ---

export async function insertTrackPoint(point: Omit<TrackPoint, 'id'>): Promise<number> {
  const res = await requireDb().run(
    'INSERT INTO track_points (route_id, lat, lng, altitude, accuracy, speed, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [point.routeId, point.lat, point.lng, point.altitude, point.accuracy, point.speed, point.recordedAt],
  );
  return res.changes?.lastId ?? -1;
}

// --- Visits (stays) ---

export async function createVisit(visit: Omit<Visit, 'id'>): Promise<number> {
  const res = await requireDb().run(
    'INSERT INTO visits (route_id, centroid_lat, centroid_lng, arrived_at, left_at, duration_sec) VALUES (?, ?, ?, ?, ?, ?)',
    [visit.routeId, visit.centroidLat, visit.centroidLng, visit.arrivedAt, visit.leftAt, visit.durationSec],
  );
  return res.changes?.lastId ?? -1;
}

export async function closeVisit(visitId: number, leftAt: number, durationSec: number): Promise<void> {
  await requireDb().run('UPDATE visits SET left_at = ?, duration_sec = ? WHERE id = ?', [
    leftAt,
    durationSec,
    visitId,
  ]);
}

export async function listVisits(): Promise<Visit[]> {
  const res = await requireDb().query('SELECT * FROM visits ORDER BY arrived_at DESC');
  return (res.values ?? []).map(rowToVisit);
}

export async function getVisit(visitId: number): Promise<Visit | null> {
  const res = await requireDb().query('SELECT * FROM visits WHERE id = ?', [visitId]);
  const row = (res.values ?? [])[0];
  return row ? rowToVisit(row) : null;
}

// --- Photos ---

export async function addPhoto(photo: Omit<Photo, 'id'>): Promise<number> {
  const res = await requireDb().run('INSERT INTO photos (visit_id, file_uri, taken_at, created_at) VALUES (?, ?, ?, ?)', [
    photo.visitId,
    photo.fileUri,
    photo.takenAt,
    photo.createdAt,
  ]);
  return res.changes?.lastId ?? -1;
}

export async function listPhotosForVisit(visitId: number): Promise<Photo[]> {
  const res = await requireDb().query('SELECT * FROM photos WHERE visit_id = ? ORDER BY taken_at ASC', [visitId]);
  return (res.values ?? []).map(rowToPhoto);
}

// --- Memos ---

export async function upsertMemo(visitId: number, text: string, updatedAt: number): Promise<void> {
  const existing = await requireDb().query('SELECT id FROM memos WHERE visit_id = ?', [visitId]);
  if ((existing.values ?? []).length > 0) {
    await requireDb().run('UPDATE memos SET text = ?, updated_at = ? WHERE visit_id = ?', [
      text,
      updatedAt,
      visitId,
    ]);
  } else {
    await requireDb().run('INSERT INTO memos (visit_id, text, updated_at) VALUES (?, ?, ?)', [
      visitId,
      text,
      updatedAt,
    ]);
  }
}

export async function getMemoForVisit(visitId: number): Promise<Memo | null> {
  const res = await requireDb().query('SELECT * FROM memos WHERE visit_id = ?', [visitId]);
  const row = (res.values ?? [])[0];
  return row ? rowToMemo(row) : null;
}

// --- Place info ---

export async function createPlaceInfo(place: Omit<PlaceInfo, 'id'>): Promise<number> {
  const res = await requireDb().run(
    'INSERT INTO place_info (route_id, source, lat, lng, place_label, photo_uri, recorded_at, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      place.routeId,
      place.source,
      place.lat,
      place.lng,
      place.placeLabel,
      place.photoUri,
      place.recordedAt,
      place.title,
    ],
  );
  return res.changes?.lastId ?? -1;
}

export async function listPlaceInfo(): Promise<PlaceInfo[]> {
  const res = await requireDb().query('SELECT * FROM place_info ORDER BY recorded_at DESC');
  return (res.values ?? []).map(rowToPlaceInfo);
}

export async function getPlaceInfo(id: number): Promise<PlaceInfo | null> {
  const res = await requireDb().query('SELECT * FROM place_info WHERE id = ?', [id]);
  const row = (res.values ?? [])[0];
  return row ? rowToPlaceInfo(row) : null;
}

/** Photos taken while tracking a specific route, for plotting camera markers on its route detail map. */
export async function listRoutePhotos(routeId: number): Promise<PlaceInfo[]> {
  const res = await requireDb().query(
    "SELECT * FROM place_info WHERE route_id = ? AND source = 'photo' ORDER BY recorded_at ASC",
    [routeId],
  );
  return (res.values ?? []).map(rowToPlaceInfo);
}

/** Finds an existing place_info of the given source within `radiusMeters` of (lat, lng), for dedupe checks. */
export async function findNearbyPlaceInfo(
  source: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<PlaceInfo | null> {
  const res = await requireDb().query('SELECT * FROM place_info WHERE source = ?', [source]);
  const rows = (res.values ?? []).map(rowToPlaceInfo);
  for (const row of rows) {
    if (haversineMeters({ lat, lng }, { lat: row.lat, lng: row.lng }) <= radiusMeters) return row;
  }
  return null;
}

// --- row mappers (sql snake_case -> camelCase) ---

function rowToRoute(row: any): Route {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    name: row.name,
    distanceMeters: row.distance_meters,
    durationSec: row.duration_sec,
  };
}

function rowToTrackPoint(row: any): TrackPoint {
  return {
    id: row.id,
    routeId: row.route_id,
    lat: row.lat,
    lng: row.lng,
    altitude: row.altitude,
    accuracy: row.accuracy,
    speed: row.speed,
    recordedAt: row.recorded_at,
  };
}

function rowToVisit(row: any): Visit {
  return {
    id: row.id,
    routeId: row.route_id,
    centroidLat: row.centroid_lat,
    centroidLng: row.centroid_lng,
    arrivedAt: row.arrived_at,
    leftAt: row.left_at,
    durationSec: row.duration_sec,
  };
}

function rowToPhoto(row: any): Photo {
  return { id: row.id, visitId: row.visit_id, fileUri: row.file_uri, takenAt: row.taken_at, createdAt: row.created_at };
}

function rowToMemo(row: any): Memo {
  return { id: row.id, visitId: row.visit_id, text: row.text, updatedAt: row.updated_at };
}

function rowToPlaceInfo(row: any): PlaceInfo {
  return {
    id: row.id,
    routeId: row.route_id,
    source: row.source,
    lat: row.lat,
    lng: row.lng,
    placeLabel: row.place_label,
    photoUri: row.photo_uri,
    recordedAt: row.recorded_at,
    title: row.title,
  };
}
