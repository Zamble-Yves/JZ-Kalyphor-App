import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, FlatList, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Badge, ProgressBar } from "@/src/ui";
import { api, User } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const STATUS_FILTERS = [
  { key: "all", label: "Tous" },
  { key: "in_progress", label: "En cours" },
  { key: "late", label: "En retard" },
  { key: "completed", label: "Terminé" },
] as const;

export default function Students() {
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState<User[]>([]);
  const [cohort, setCohort] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs: string[] = [];
      if (cohort !== "all") qs.push(`cohort=${encodeURIComponent(cohort)}`);
      if (status !== "all") qs.push(`status=${encodeURIComponent(status)}`);
      const list = await api<User[]>(`/students${qs.length ? "?" + qs.join("&") : ""}`);
      setStudents(list);
    } catch {}
  }, [cohort, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cohorts = Array.from(new Set(students.map(s => s.cohort).filter(Boolean))) as string[];
  const allCohorts = ["all", ...cohorts.sort()];

  const whatsapp = (s: User) => {
    const phone = (s.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;
    const msg = encodeURIComponent(`Bonjour ${s.name}, nous n'avons pas reçu votre preuve d'avancement cette semaine. Comment avance votre certificat ${s.certificate || ""} ? — JZ KALYPHOR`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Étudiants</Text>
          <Pressable onPress={() => router.push("/(admin)/student/new")} style={styles.addBtn} testID="btn-add-student">
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.caption}>Cohorte</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {allCohorts.map(c => {
            const active = cohort === c;
            return (
              <Pressable key={c} onPress={() => setCohort(c)} style={[styles.chip, active && styles.chipActive]} testID={`cohort-${c}`}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c === "all" ? "Toutes" : c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.caption}>Statut</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {STATUS_FILTERS.map(f => {
            const active = status === f.key;
            return (
              <Pressable key={f.key} onPress={() => setStatus(f.key)} style={[styles.chip, active && styles.chipActive]} testID={`status-${f.key}`}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={students}
        keyExtractor={s => s.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucun étudiant</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(admin)/student/${item.id}`)} style={styles.card} testID={`student-${item.id}`}>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.certificate || "—"} · {item.cohort || "—"}</Text>
              </View>
              <Badge
                label={item.status === "late" ? "En retard" : item.status === "completed" ? "Terminé" : "En cours"}
                tone={item.status === "late" ? "error" : item.status === "completed" ? "success" : "brand"}
              />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={styles.sub}>{item.progress}% complété</Text>
              </View>
              <ProgressBar value={item.progress} />
            </View>
            {item.status === "late" && (
              <Pressable onPress={() => whatsapp(item)} style={styles.waBtn} testID={`whatsapp-${item.id}`}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.waText}>Relancer sur WhatsApp</Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  caption: { color: colors.muted, paddingHorizontal: spacing.lg, fontSize: 12, marginTop: 6 },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontWeight: "800" },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 13 },
  waBtn: { flexDirection: "row", gap: 8, backgroundColor: "#25D366", padding: 10, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  waText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: colors.muted, marginTop: 60 },
});
