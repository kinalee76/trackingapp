export interface Route {
  id: number;
  startedAt: number;
  endedAt: number | null;
  name: string | null;
  distanceMeters: number | null;
  durationSec: number | null;
}

export interface TrackPoint {
  id: number;
  routeId: number;
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  recordedAt: number;
}

export interface Visit {
  id: number;
  routeId: number | null;
  centroidLat: number;
  centroidLng: number;
  arrivedAt: number;
  leftAt: number | null;
  durationSec: number | null;
}

export interface Photo {
  id: number;
  visitId: number;
  fileUri: string;
  takenAt: number | null;
  createdAt: number;
}

export interface Memo {
  id: number;
  visitId: number;
  text: string;
  updatedAt: number;
}

export type PlaceInfoSource = 'photo' | 'stay' | 'manual';

export interface PlaceInfo {
  id: number;
  routeId: number | null;
  source: PlaceInfoSource;
  lat: number;
  lng: number;
  placeLabel: string | null;
  photoUri: string | null;
  recordedAt: number;
  title: string;
}
