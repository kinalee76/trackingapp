/**
 * Free, no-signup reverse geocoding via OpenStreetMap's public Nominatim
 * server. Gives a road/neighborhood-level "장소" label — not the
 * building/cultural-heritage/bus-stop category lookup originally
 * envisioned, since that requires a server-side-authenticated local search
 * API this project has no backend to call safely. See
 * docs/reports/08-place-info.md for the tradeoff.
 *
 * Nominatim's usage policy caps public-server use at ~1 request/second and
 * offers no SLA — acceptable for this app's light, personal-use call
 * volume (one lookup per photo/stay/manual save), but not for bulk use.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=ko`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return pickLabel(data);
  } catch {
    return null;
  }
}

function pickLabel(data: any): string | null {
  const address = data?.address;
  if (!address) return data?.display_name ?? null;

  const specific =
    address.amenity ?? address.shop ?? address.building ?? address.tourism ?? address.historic ?? address.bus_stop;
  if (specific) return specific;

  const road = address.road;
  const area = address.neighbourhood ?? address.suburb ?? address.quarter ?? address.village;
  if (road && area) return `${area} ${road}`;
  if (road) return road;
  if (area) return area;

  return data?.display_name ?? null;
}
