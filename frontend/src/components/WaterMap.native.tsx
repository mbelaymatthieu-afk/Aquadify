import MapView, { Marker } from "react-native-maps";

import { colors } from "@/src/theme";
import type { WaterPoint } from "@/src/api/waterpoints";

export default function WaterMap({
  lat,
  lon,
  points,
  onSelect,
}: {
  lat: number;
  lon: number;
  points: WaterPoint[];
  onSelect: (p: WaterPoint) => void;
}) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {points.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat, longitude: p.lon }}
          title={p.name || ""}
          pinColor={colors.primary}
          onPress={() => onSelect(p)}
        />
      ))}
    </MapView>
  );
}
