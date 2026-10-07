import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Card, Badge } from "@/src/ui";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

type Course = { id: string; title: string; link_type: "youtube" | "pdf" | "external"; url: string; status: "todo" | "in_progress" | "done" };
const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "todo", label: "À faire" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminé" },
] as const;

export default function Courses() {
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setCourses(await api<Course[]>("/me/courses")); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (c: Course, status: Course["status"]) => {
    setCourses(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
    try { await api(`/courses/${c.id}`, { method: "PUT", body: JSON.stringify({ status }) }); }
    catch { load(); }
  };

  const open = (c: Course) => Linking.openURL(c.url).catch(() => {});

  const filtered = filter === "all" ? courses : courses.filter(c => c.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Mes cours</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} testID={`chip-${f.key}`} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {filtered.length === 0 && <Text style={styles.empty}>Aucun cours dans cette catégorie</Text>}
        {filtered.map(c => (
          <Card key={c.id} testID={`course-${c.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={styles.typeIcon}>
                <Ionicons
                  name={c.link_type === "youtube" ? "logo-youtube" : c.link_type === "pdf" ? "document-text" : "globe"}
                  size={22}
                  color={c.link_type === "youtube" ? "#C62828" : c.link_type === "pdf" ? colors.brandPrimary : colors.info}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{c.title}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4 }}>
                  <Badge label={c.link_type === "youtube" ? "YouTube" : c.link_type === "pdf" ? "PDF" : "Plateforme"} tone="neutral" />
                  <Badge
                    label={c.status === "todo" ? "À faire" : c.status === "in_progress" ? "En cours" : "Terminé"}
                    tone={c.status === "todo" ? "neutral" : c.status === "in_progress" ? "warning" : "success"}
                  />
                </View>
              </View>
              <Pressable onPress={() => open(c)} style={styles.linkBtn} testID={`open-${c.id}`}>
                <Ionicons name="open-outline" size={20} color={colors.brandPrimary} />
              </Pressable>
            </View>
            <View style={styles.statusRow}>
              {(["todo", "in_progress", "done"] as const).map(s => (
                <Pressable key={s} onPress={() => updateStatus(c, s)} testID={`set-${c.id}-${s}`}
                  style={[styles.statusBtn, c.status === s && styles.statusBtnActive]}>
                  <Text style={[styles.statusBtnText, c.status === s && styles.statusBtnTextActive]}>
                    {s === "todo" ? "À faire" : s === "in_progress" ? "En cours" : "Terminé"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  title: { paddingHorizontal: spacing.lg, fontSize: 24, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  typeIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  courseTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  linkBtn: { padding: 8, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  statusRow: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statusBtnActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  statusBtnText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  statusBtnTextActive: { color: colors.brandPrimary },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
});
