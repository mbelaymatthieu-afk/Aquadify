import { haversine } from "@/src/lib/geo";

// A specific OSM-derived category, used for a meaningful label (not just "fountain").
export type WaterKind =
  | "fountain"
  | "drinking_water"
  | "tap"
  | "water_point"
  | "spring"
  | "water";

export type WaterPoint = {
  id: string;
  lat: number;
  lon: number;
  type: "fountain" | "water";
  kind: WaterKind;
  name?: string;
  address?: string;
  distance: number;
};

// Overpass mirrors — tried in order for resilience against rate limits / downtime.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Progressive search radii (meters): never give up after a single attempt.
const RADII = [10000, 25000, 50000];

function buildQuery(lat: number, lon: number, radius: number): string {
  // nwr = node + way + relation. `out center` yields a lat/lon for ways/relations.
  return (
    `[out:json][timeout:25];(` +
    `nwr["amenity"="drinking_water"](around:${radius},${lat},${lon});` +
    `nwr["drinking_water"="yes"](around:${radius},${lat},${lon});` +
    `nwr["amenity"="water_point"](around:${radius},${lat},${lon});` +
    `nwr["man_made"="water_tap"](around:${radius},${lat},${lon});` +
    `nwr["fountain"="drinking"](around:${radius},${lat},${lon});` +
    `nwr["natural"="spring"]["drinking_water"="yes"](around:${radius},${lat},${lon});` +
    `);out center 80;`
  );
}

function buildAddress(tags: any): string | undefined {
  if (!tags) return undefined;
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

// Derive a specific category from the OSM tags so we can show a real name
// (e.g. "Source", "Robinet d'eau") instead of always "Fontaine".
function classify(tags: any): WaterKind {
  if (tags.man_made === "water_tap") return "tap";
  if (tags.natural === "spring") return "spring";
  if (tags.amenity === "water_point") return "water_point";
  if (tags.fountain === "drinking" || tags.amenity === "fountain") return "fountain";
  if (tags.amenity === "drinking_water") return "drinking_water";
  return "water";
}

function mapElements(json: any, lat: number, lon: number): WaterPoint[] {
  return (json.elements || [])
    .map((e: any) => {
      const elat = e.lat ?? e.center?.lat;
      const elon = e.lon ?? e.center?.lon;
      if (elat == null || elon == null) return null;
      const tags = e.tags || {};
      const kind = classify(tags);
      const isFountain = kind === "fountain" || kind === "drinking_water" || kind === "spring";
      return {
        id: `${e.type}/${e.id}`,
        lat: elat,
        lon: elon,
        type: isFountain ? "fountain" : "water",
        kind,
        name: tags.name,
        address: buildAddress(tags),
        distance: haversine(lat, lon, elat, elon),
      } as WaterPoint;
    })
    .filter(Boolean) as WaterPoint[];
}

async function runOverpass(query: string): Promise<any> {
  let lastErr: any = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[waterpoints] POST ${endpoint}`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass mirrors (overpass-api.de) reject requests without a UA (HTTP 406).
          "User-Agent": "Aquadify/1.0 (support@aquadify.com)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      console.log(`[waterpoints] status ${res.status} @ ${endpoint}`);
      if (!res.ok) {
        lastErr = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      console.log(`[waterpoints] raw length ${text.length}`);
      return JSON.parse(text);
    } catch (e: any) {
      console.log(`[waterpoints] endpoint failed: ${e?.message}`);
      lastErr = e;
    }
  }
  throw lastErr || new Error("All Overpass endpoints failed");
}

// Public drinking fountains / water points from OpenStreetMap (Overpass API).
// Expands the radius progressively and tries several mirrors. Throws on a real
// network failure (so the UI shows an error, not a false "nothing found").
export async function fetchWaterPoints(lat: number, lon: number): Promise<WaterPoint[]> {
  console.log(`[waterpoints] GPS lat=${lat} lon=${lon}`);
  let networkError: any = null;

  for (const radius of RADII) {
    const query = buildQuery(lat, lon, radius);
    console.log(`[waterpoints] radius=${radius}m query=${query}`);
    try {
      const json = await runOverpass(query);
      const pts = mapElements(json, lat, lon).sort((a, b) => a.distance - b.distance);
      console.log(`[waterpoints] radius=${radius}m -> ${pts.length} results`);
      if (pts.length > 0) {
        const out = pts.slice(0, 40);
        console.log(`[waterpoints] returning ${out.length} (of ${pts.length})`);
        return out;
      }
    } catch (e: any) {
      networkError = e;
      console.log(`[waterpoints] radius=${radius}m error: ${e?.message}`);
    }
  }

  // If every attempt errored (never got a valid empty response), surface it.
  if (networkError) {
    throw networkError;
  }
  console.log(`[waterpoints] no results after all radii`);
  return [];
}
