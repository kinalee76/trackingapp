const EARTH_RADIUS_METERS = 6371000;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** "00.00 Km" — always 2 decimals, integer part padded to at least 2 digits. */
export function formatDistanceKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(2).padStart(5, '0')} Km`;
}
