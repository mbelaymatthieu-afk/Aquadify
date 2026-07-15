import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import WaterMap from "@/src/components/WaterMap";
import { useToast } from "@/src/components/Toast";
import { fetchWaterPoints, WaterPoint } from "@/src/api/waterpoints";
import { formatDistance, formatWalkTime } from "@/src/lib/geo";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

type Status = "idle" | "granted" | "denied" | "blocked";

export default function WaterPointsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const premium = !!user?.is_premium;

  const [status, setStatus] = useState<Status>("idle");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [points, setPoints] = useState<WaterPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportFor, setReportFor] = useState<WaterPoint | null>(null);

  const top3 = points.slice(0, 3);

  const loadPoints = useCallback(async () => {
    setLoading(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setCoords({ lat, lon });
      const pts = await fetchWaterPoints(lat, lon);
      setPoints(pts);
    } catch {
      toast.show(t("waterPoints.empty"), "info");
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const requestLocation = useCallback(async () => {
    const cur = await Location.getForegroundPermissionsAsync();
    let res = cur;
    if (!cur.granted && cur.canAskAgain) res = await Location.requestForegroundPermissionsAsync();
    if (res.granted) {
      setStatus("granted");
      loadPoints();
    } else {
      setStatus(res.canAskAgain ? "denied" : "blocked");
    }
  }, [loadPoints]);

  const openDirections = (p: WaterPoint) => {
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${p.lat},${p.lon}`
        : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
    Linking.openURL(url);
  };

  const submitReport = () => {
    setReportFor(null);
    toast.show(t("waterPoints.reported"), "success");
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={[colors.gradTop, colors.gradBottom]} style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable testID="wp-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t("waterPoints.title")}</Text>
            <Text style={styles.headerSub}>{t("waterPoints.subtitle")}</Text>
          </View>
        </View>
      </LinearGradient>

      {!premium ? (
        <View style={styles.gate} testID="wp-locked">
          <View style={styles.gateIcon}>
            <Ionicons name="lock-closed" size={34} color={colors.primary} />
          </View>
          <Text style={styles.gateTitle}>{t("waterPoints.lockedTitle")}</Text>
          <Text style={styles.gateBody}>{t("waterPoints.lockedBody")}</Text>
          <Pressable testID="wp-unlock" onPress={() => router.push("/premium")} style={styles.primaryBtn}>
            <Ionicons name="sparkles" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>{t("waterPoints.unlock")}</Text>
          </Pressable>
        </View>
      ) : status !== "granted" ? (
        <View style={styles.gate} testID="wp-permission-gate">
          <View style={styles.gateIcon}>
            <Ionicons name="location" size={34} color={colors.primary} />
          </View>
          <Text style={styles.gateTitle}>{t("waterPoints.permTitle")}</Text>
          <Text style={styles.gateBody}>{t("waterPoints.permBody")}</Text>
          {status === "blocked" ? (
            <>
              <Text style={styles.deniedText}>{t("waterPoints.denied")}</Text>
              <Pressable testID="wp-open-settings" onPress={() => Linking.openSettings()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{t("waterPoints.openSettings")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable testID="wp-allow" onPress={requestLocation} style={styles.primaryBtn}>
              <Ionicons name="navigate" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>{t("waterPoints.allow")}</Text>
            </Pressable>
          )}
          {status === "denied" && <Text style={styles.deniedText}>{t("waterPoints.denied")}</Text>}
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            {coords && <WaterMap lat={coords.lat} lon={coords.lon} points={top3} onSelect={openDirections} />}
            <Text style={styles.attribution}>{t("waterPoints.attribution")}</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg }}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>{t("waterPoints.loading")}</Text>
              </View>
            ) : top3.length === 0 ? (
              <Text style={styles.muted}>{t("waterPoints.empty")}</Text>
            ) : (
              <>
                <Text style={styles.nearestTitle}>{t("waterPoints.nearest")}</Text>
                {top3.map((p) => (
                  <View key={p.id} style={styles.card} testID={`wp-item-${p.id}`}>
                    <View style={styles.wpIcon}>
                      <MaterialCommunityIcons
                        name={p.type === "fountain" ? "fountain" : "water"}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wpName} numberOfLines={1}>
                        {p.name || t(`waterPoints.${p.type}`)}
                      </Text>
                      <View style={styles.wpMetaRow}>
                        <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.wpDist}>{formatDistance(p.distance)}</Text>
                        <Text style={styles.wpDot}>•</Text>
                        <Ionicons name="walk-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.wpDist}>
                          {formatWalkTime(p.distance)} {t("waterPoints.walk")}
                        </Text>
                      </View>
                    </View>
                    <Pressable testID={`wp-dir-${p.id}`} onPress={() => openDirections(p)} style={styles.iconBtn}>
                      <Ionicons name="navigate" size={18} color={colors.white} />
                    </Pressable>
                    <Pressable testID={`wp-report-${p.id}`} onPress={() => setReportFor(p)} style={styles.reportBtn}>
                      <Ionicons name="flag-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={!!reportFor} transparent animationType="fade" onRequestClose={() => setReportFor(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReportFor(null)}>
          <View style={styles.sheet} testID="wp-report-sheet">
            <Text style={styles.sheetTitle}>{t("waterPoints.reportTitle")}</Text>
            {(["reportAbsent", "reportClosed", "reportBroken"] as const).map((k) => (
              <Pressable key={k} testID={`wp-report-${k}`} onPress={submitReport} style={styles.sheetRow}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.sheetRowText}>{t(`waterPoints.${k}`)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: font.h2, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: font.tiny },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  gateIcon: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  gateTitle: { fontSize: font.h2, fontWeight: "800", color: colors.text, textAlign: "center" },
  gateBody: { fontSize: font.small, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: spacing.md },
  deniedText: { fontSize: font.small, color: colors.danger, textAlign: "center", marginTop: spacing.sm },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 52, paddingHorizontal: spacing.xl, justifyContent: "center", ...shadow.button },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "700" },
  mapWrap: { height: 240, margin: spacing.md, borderRadius: radius.lg, overflow: "hidden", ...shadow.soft },
  attribution: { position: "absolute", bottom: 4, right: 6, fontSize: 9, color: colors.textMuted, backgroundColor: "rgba(255,255,255,0.7)", paddingHorizontal: 4, borderRadius: 4 },
  loadingBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  muted: { color: colors.textMuted, fontSize: font.small, textAlign: "center", paddingVertical: spacing.lg },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  wpIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  wpName: { fontSize: font.body, fontWeight: "700", color: colors.text },
  wpMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  wpDist: { fontSize: font.tiny, color: colors.textMuted },
  wpDot: { fontSize: font.tiny, color: colors.textMuted, marginHorizontal: 2 },
  nearestTitle: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  reportBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  sheetTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowText: { fontSize: font.body, color: colors.text, fontWeight: "600" },
});
