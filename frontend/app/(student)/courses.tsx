import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Card, Badge } from "@/src/ui";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

type Course = {
  id: string; title: string;
  link_type: "youtube" | "pdf" | "external"; url: string;
  status: "todo" | "in_progress" | "done";
  favorite?: boolean;
  time_spent_minutes?: number;
  access_email?: string;
  access_password?: string;
};

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "todo", label: "À faire" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminé" },
] as const;

function youtubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function Courses() {
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [videoCourse, setVideoCourse] = useState<Course | null>(null);
  const [timeCourse, setTimeCourse] = useState<Course | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showPwFor, setShowPwFor] = useState<string | null>(null);

  const copy = async (text: string, label: string) => {
    try { await Clipboard.setStringAsync(text); } catch {}
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const load = useCallback(async () => {
    try { setCourses(await api<Course[]>("/me/courses")); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCourse = async (id: string, patch: Partial<Course>) => {
    setCourses(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
    try { await api(`/courses/${id}`, { method: "PUT", body: JSON.stringify(patch) }); }
    catch { load(); }
  };

  const openCourse = async (c: Course) => {
    // Auto-mark as "in_progress" if currently "todo"
    if (c.status === "todo") updateCourse(c.id, { status: "in_progress" });
    const vid = c.link_type === "youtube" ? youtubeId(c.url) : null;
    if (c.link_type === "youtube" && vid) {
      setVideoCourse({ ...c, url: `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0` });
    } else {
      Linking.openURL(c.url).catch(() => {});
    }
  };

  const toggleFav = (c: Course) => updateCourse(c.id, { favorite: !c.favorite });

  const logTime = async () => {
    const n = parseInt(timeInput, 10);
    if (!timeCourse || isNaN(n) || n <= 0) return;
    try {
      await api(`/courses/${timeCourse.id}/log-time`, { method: "POST", body: JSON.stringify({ minutes: n }) });
      setTimeCourse(null); setTimeInput("");
      load();
    } catch {}
  };

  const filtered = filter === "all" ? courses : courses.filter(c => c.status === filter);
  const sorted = [...filtered].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const fmtMin = (m?: number) => {
    if (!m) return "";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60); const mn = m % 60;
    return mn ? `${h}h ${mn}m` : `${h}h`;
  };

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
        {sorted.length === 0 && <Text style={styles.empty}>Aucun cours dans cette catégorie</Text>}
        {sorted.map(c => {
          const openLabel = c.link_type === "youtube" ? "Regarder la vidéo" : c.link_type === "pdf" ? "Ouvrir le PDF" : "Ouvrir la plateforme";
          const openIcon = c.link_type === "youtube" ? "play-circle" : c.link_type === "pdf" ? "document-text" : "open-outline";
          return (
            <Card key={c.id} testID={`course-${c.id}`} style={c.favorite ? { borderColor: colors.brandPrimary, borderWidth: 1.5 } : undefined}>
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
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" }}>
                    <Badge label={c.link_type === "youtube" ? "YouTube" : c.link_type === "pdf" ? "PDF" : "Plateforme"} tone="neutral" />
                    <Badge
                      label={c.status === "todo" ? "À faire" : c.status === "in_progress" ? "En cours" : "Terminé"}
                      tone={c.status === "todo" ? "neutral" : c.status === "in_progress" ? "warning" : "success"}
                    />
                    {c.time_spent_minutes ? <Badge label={fmtMin(c.time_spent_minutes)} tone="brand" /> : null}
                  </View>
                </View>
                <Pressable onPress={() => toggleFav(c)} testID={`fav-${c.id}`} style={styles.starBtn}>
                  <Ionicons name={c.favorite ? "star" : "star-outline"} size={22} color={c.favorite ? colors.brandPrimary : colors.muted} />
                </Pressable>
              </View>

              <Pressable onPress={() => openCourse(c)} style={styles.openBtn} testID={`open-${c.id}`}>
                <Ionicons name={openIcon as any} size={18} color="#fff" />
                <Text style={styles.openBtnText}>{openLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>

              {(c.access_email || c.access_password) && (
                <View style={styles.credBox} testID={`creds-${c.id}`}>
                  <View style={styles.credHeader}>
                    <Ionicons name="key" size={16} color={colors.brandPrimary} />
                    <Text style={styles.credTitle}>Identifiants d'accès</Text>
                  </View>
                  {c.access_email ? (
                    <Pressable style={styles.credRow} onPress={() => copy(c.access_email!, `email-${c.id}`)} testID={`copy-email-${c.id}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.credLabel}>Email</Text>
                        <Text style={styles.credValue} selectable>{c.access_email}</Text>
                      </View>
                      <Ionicons name={copied === `email-${c.id}` ? "checkmark" : "copy-outline"} size={18} color={colors.brandPrimary} />
                    </Pressable>
                  ) : null}
                  {c.access_password ? (
                    <View style={styles.credRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.credLabel}>Mot de passe</Text>
                        <Text style={styles.credValue} selectable>{showPwFor === c.id ? c.access_password : "•".repeat(Math.min(c.access_password.length, 10))}</Text>
                      </View>
                      <Pressable onPress={() => setShowPwFor(showPwFor === c.id ? null : c.id)} testID={`toggle-pw-${c.id}`} style={styles.eyeBtn}>
                        <Ionicons name={showPwFor === c.id ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
                      </Pressable>
                      <Pressable onPress={() => copy(c.access_password!, `pw-${c.id}`)} testID={`copy-pw-${c.id}`} style={styles.eyeBtn}>
                        <Ionicons name={copied === `pw-${c.id}` ? "checkmark" : "copy-outline"} size={18} color={colors.brandPrimary} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.actionRow}>
                <Pressable onPress={() => { setTimeCourse(c); setTimeInput(""); }} style={styles.timeBtn} testID={`time-${c.id}`}>
                  <Ionicons name="time-outline" size={16} color={colors.brandPrimary} />
                  <Text style={styles.timeBtnText}>Noter mon temps</Text>
                </Pressable>
              </View>

              <View style={styles.statusRow}>
                {(["todo", "in_progress", "done"] as const).map(s => (
                  <Pressable key={s} onPress={() => updateCourse(c.id, { status: s })} testID={`set-${c.id}-${s}`}
                    style={[styles.statusBtn, c.status === s && styles.statusBtnActive]}>
                    <Text style={[styles.statusBtnText, c.status === s && styles.statusBtnTextActive]}>
                      {s === "todo" ? "À faire" : s === "in_progress" ? "En cours" : "Terminé"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* YouTube Modal */}
      <Modal visible={!!videoCourse} animationType="slide" onRequestClose={() => setVideoCourse(null)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={[styles.videoHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => setVideoCourse(null)} style={styles.closeBtn} testID="video-close">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.videoTitle} numberOfLines={1}>{videoCourse?.title}</Text>
          </View>
          {videoCourse && (
            Platform.OS === "web" ? (
              <iframe
                src={videoCourse.url}
                style={{ flex: 1, border: 0, width: "100%", height: "100%" } as any}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <WebView
                source={{ uri: videoCourse.url }}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                style={{ flex: 1, backgroundColor: "#000" }}
              />
            )
          )}
        </View>
      </Modal>

      {/* Time log sheet */}
      <Modal visible={!!timeCourse} transparent animationType="slide" onRequestClose={() => setTimeCourse(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Temps passé sur ce cours</Text>
            <Text style={styles.sheetSub}>{timeCourse?.title}</Text>
            <Text style={styles.label}>Minutes (ex: 30, 45, 90)</Text>
            <TextInput
              value={timeInput} onChangeText={setTimeInput}
              placeholder="45" placeholderTextColor={colors.muted}
              keyboardType="number-pad" style={styles.input}
              testID="time-input"
            />
            {timeCourse?.time_spent_minutes ? (
              <Text style={styles.sheetSub}>Déjà cumulé : {fmtMin(timeCourse.time_spent_minutes)}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}><Button title="Annuler" variant="ghost" onPress={() => { setTimeCourse(null); setTimeInput(""); }} /></View>
              <View style={{ flex: 1 }}><Button title="Ajouter" onPress={logTime} disabled={!timeInput} testID="time-submit" /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  starBtn: { padding: 6 },
  openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.md },
  openBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  credBox: { marginTop: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  credHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  credTitle: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  credLabel: { color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  credValue: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  eyeBtn: { padding: 4 },
  actionRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
  timeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
  timeBtnText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 13 },
  statusRow: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statusBtnActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  statusBtnText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  statusBtnTextActive: { color: colors.brandPrimary },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
  videoHeader: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#000", paddingHorizontal: spacing.lg, paddingBottom: 10 },
  videoTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sheetSub: { color: colors.muted, fontSize: 13 },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: 6 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 14, color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center" },
});
