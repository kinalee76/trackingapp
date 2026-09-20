import { haversineMeters } from '../../utils/geo';

export interface GeoPoint {
  lat: number;
  lng: number;
  time: number;
}

export type StayEvent =
  | { type: 'stay-started'; centroidLat: number; centroidLng: number; arrivedAt: number }
  | { type: 'stay-updated'; centroidLat: number; centroidLng: number }
  | { type: 'stay-ended'; leftAt: number; durationSec: number };

export interface StayDetectorOptions {
  /** Radius (meters) a point must stay within to belong to the current cluster. */
  radiusMeters?: number;
  /** Minimum time (ms) within the radius before it counts as a "stay". */
  minDurationMs?: number;
  /** Consecutive out-of-radius points required before a stay is considered ended (rejects single-point GPS jitter). */
  jitterStreak?: number;
}

/**
 * Incrementally detects "stays" (>3 min spent within a small radius) from a
 * stream of GPS points. O(1) per point — no point history is buffered
 * except a short jitter-rejection window.
 */
export class StayDetector {
  private readonly radiusMeters: number;
  private readonly minDurationMs: number;
  private readonly jitterStreak: number;

  private clusterLat: number | null = null;
  private clusterLng: number | null = null;
  private clusterCount = 0;
  private clusterStartedAt: number | null = null;
  private clusterLastAt: number | null = null;
  private stayActive = false;
  private pendingOutside: GeoPoint[] = [];

  constructor(options: StayDetectorOptions = {}) {
    this.radiusMeters = options.radiusMeters ?? 75;
    this.minDurationMs = options.minDurationMs ?? 3 * 60 * 1000;
    this.jitterStreak = options.jitterStreak ?? 2;
  }

  addPoint(point: GeoPoint): StayEvent | null {
    if (this.clusterLat === null || this.clusterLng === null || this.clusterStartedAt === null) {
      this.startNewCluster(point);
      return null;
    }

    const distance = haversineMeters({ lat: this.clusterLat, lng: this.clusterLng }, point);

    if (distance <= this.radiusMeters) {
      this.pendingOutside = [];
      this.clusterCount += 1;
      this.clusterLat += (point.lat - this.clusterLat) / this.clusterCount;
      this.clusterLng += (point.lng - this.clusterLng) / this.clusterCount;
      this.clusterLastAt = point.time;

      const duration = this.clusterLastAt - this.clusterStartedAt;
      if (!this.stayActive && duration >= this.minDurationMs) {
        this.stayActive = true;
        return { type: 'stay-started', centroidLat: this.clusterLat, centroidLng: this.clusterLng, arrivedAt: this.clusterStartedAt };
      }
      if (this.stayActive) {
        return { type: 'stay-updated', centroidLat: this.clusterLat, centroidLng: this.clusterLng };
      }
      return null;
    }

    // Point falls outside the cluster radius — don't act until we see
    // enough consecutive out-of-radius points to rule out GPS jitter.
    this.pendingOutside.push(point);
    if (this.pendingOutside.length < this.jitterStreak) {
      return null;
    }

    const event: StayEvent | null =
      this.stayActive && this.clusterStartedAt !== null && this.clusterLastAt !== null
        ? { type: 'stay-ended', leftAt: this.clusterLastAt, durationSec: Math.round((this.clusterLastAt - this.clusterStartedAt) / 1000) }
        : null;

    const [first, ...rest] = this.pendingOutside;
    this.pendingOutside = [];
    this.startNewCluster(first);
    for (const p of rest) this.addPoint(p);

    return event;
  }

  /** Call when tracking stops, to close out a stay still in progress. */
  finalize(): StayEvent | null {
    if (this.stayActive && this.clusterStartedAt !== null && this.clusterLastAt !== null) {
      return { type: 'stay-ended', leftAt: this.clusterLastAt, durationSec: Math.round((this.clusterLastAt - this.clusterStartedAt) / 1000) };
    }
    return null;
  }

  private startNewCluster(point: GeoPoint): void {
    this.clusterLat = point.lat;
    this.clusterLng = point.lng;
    this.clusterCount = 1;
    this.clusterStartedAt = point.time;
    this.clusterLastAt = point.time;
    this.stayActive = false;
    this.pendingOutside = [];
  }
}
