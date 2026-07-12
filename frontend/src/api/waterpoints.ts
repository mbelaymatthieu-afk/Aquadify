import { haversine } from "@/src/lib/geo";

export type WaterPoint = {
  id: string;
  lat: number;
  lon: number;
  type: "fountain" | "water";
  name?: string;
  distance: number;
};

// Public drinking fountains / water points from OpenStreetMap (Overpass API).
export async function fetchWaterPoints(lat: number, lon: number): Promise<WaterPoint[]> {
  const q =
    `[out:json][timeout:20];(` +
    `node["amenity"="drinking_water"](around:2500,${lat},${lon});` +
    `node["amenity"="water_point"](around:2500,${lat},${lon});` +
    `node["drinking_water"="yes"](around:2500,${lat},${lon});` +
    `);out body 60;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error("overpass failed");
  const json = await res.json();
  const pts: WaterPoint[] = (json.elements || [])
    .filter((e: any) => e.lat && e.lon)
    .map((e: any) => ({
      id: String(e.id),
      lat: e.lat,
      lon: e.lon,
      type:
        e.tags?.amenity === "drinking_water" || e.tags?.drinking_water === "yes"
          ? "fountain"
          : "water",
      name: e.tags?.name,
      distance: haversine(lat, lon, e.lat, e.lon),
    }));
  pts.sort((a, b) => a.distance - b.distance);
  return pts.slice(0, 40);
}
