import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Modal, TextInput, Platform, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Card, ProgressBar, Badge } from "@/src/ui";
import { api, getUser, setCachedUser, uploadProof, User } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

function daysBetween(a: string, b: Date) {
  try { return Math.ceil((new Date(a).getTime() - b.getTime()) / 86400000); } catch { return 0; }
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(getUser());
  const [refreshing, setRefreshing] = useState(false);
  const [proofs, setProofs] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<{ estimated_days: number | null; estimated_date: string | null; avg_minutes_done: number; remaining_courses: number; total_minutes_spent: number } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me); setCachedUser(me);
      const p = await api<any[]>("/me/proofs");
      setProofs(p);
      const est = await api<any>("/me/estimate");
      setEstimate(est);
      if (!me.welcome_seen) setWelcomeOpen(true);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeWelcome = async () => {
    setWelcomeOpen(false);
    try { const u = await api<User>("/auth/me", { method: "PUT", body: JSON.stringify({ welcome_seen: true }) }); setUser(u); setCachedUser(u); } catch {}
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setUploadFile({ uri: a.uri, name: a.fileName || `preuve-${Date.now()}.jpg`, type: a.mimeType || "image/jpeg" });
  };

  const doUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await uploadProof(uploadFile.uri, uploadFile.name, uploadFile.type, comment);
      setUploadOpen(false); setUploadFile(null); setComment("");
      await load();
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e.message) : Alert.alert("Erreur", e.message);
    } finally { setUploading(false); }
  };

  const generatePdf = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bilan ${user?.name}</title>
    <style>body{font-family:Georgia,serif;padding:40px;color:#2D2424}h1{color:#8A1C2B}table{border-collapse:collapse;margin-top:16px}td,th{border:1px solid #E5DBDC;padding:8px}</style></head>
    <body><h1>Bilan de progression</h1>
    <p><b>Étudiant :</b> ${user?.name}<br/><b>Email :</b> ${user?.email}<br/><b>Certificat visé :</b> ${user?.certificate || "-"}<br/>
    <b>Date de début :</b> ${user?.start_date || "-"}<br/><b>Date limite :</b> ${user?.deadline || "-"}<br/>
    <b>Avancement :</b> ${user?.progress}%<br/><b>Statut :</b> ${user?.status}</p>
    <h2>Preuves soumises</h2><table><tr><th>Date</th><th>Commentaire</th></tr>
    ${proofs.map(p => `<tr><td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td><td>${p.comment || ""}</td></tr>`).join("")}
    </table><p style="margin-top:40px;color:#7A696A;font-size:12px">Généré par JZ KALYPHOR · WhatsApp +225 07 00 92 19 22</p>
    <script>window.print()</script></body></html>`;
    if (Platform.OS === "web") {
      const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
    } else {
      const dataUrl = "data:text/html;base64," + (global as any).btoa?.(unescape(encodeURIComponent(html)));
      if (dataUrl) Linking.openURL(dataUrl).catch(() => {});
    }
  };

  if (!user) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  const daysLeft = user.deadline ? daysBetween(user.deadline, new Date()) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View>
          <Text style={styles.hello}>Bonjour,</Text>
          <Text style={styles.name} testID="dashboard-name">{user.name}</Text>
        </View>

        <Card testID="dashboard-progress-card">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.cardLabel}>Certificat visé</Text>
            <Badge label={user.status === "late" ? "En retard" : user.status === "completed" ? "Terminé" : "En cours"} tone={user.status === "late" ? "error" : user.status === "completed" ? "success" : "brand"} />
          </View>
          <Text style={styles.cert}>{user.certificate || "Non défini"}</Text>
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.cardLabel}>Avancement</Text>
              <Text style={styles.pct}>{user.progress}%</Text>
            </View>
            <ProgressBar value={user.progress} testID="dashboard-progress-bar" />
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Début</Text>
              <Text style={styles.metaValue}>{user.start_date || "-"}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Date limite</Text>
              <Text style={styles.metaValue}>{user.deadline || "-"}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Jours restants</Text>
              <Text style={[styles.metaValue, daysLeft !== null && daysLeft < 7 && { color: colors.error }]}>{daysLeft !== null ? daysLeft : "-"}</Text>
            </View>
          </View>
        </Card>

        {estimate && estimate.remaining_courses > 0 && (
          <Card testID="dashboard-estimate-card">
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={styles.estIcon}><Ionicons name="hourglass-outline" size={22} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Estimation de fin</Text>
                <Text style={styles.estValue}>
                  {estimate.estimated_date ? new Date(estimate.estimated_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </Text>
                <Text style={styles.muted}>
                  ~{estimate.estimated_days} jour{(estimate.estimated_days || 0) > 1 ? "s" : ""} · {estimate.remaining_courses} cours restant{estimate.remaining_courses > 1 ? "s" : ""} · {estimate.avg_minutes_done} min / cours en moyenne
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Button title="Déposer ma preuve d'avancement" onPress={() => setUploadOpen(true)} testID="btn-upload-proof" icon={<Ionicons name="cloud-upload" size={18} color="#fff" />} />
        <Button title="Générer mon bilan PDF" onPress={generatePdf} variant="secondary" testID="btn-generate-pdf" icon={<Ionicons name="document-text" size={18} color={colors.brandPrimary} />} />

        <Card>
          <Text style={styles.sectionTitle}>Dernières preuves ({proofs.length})</Text>
          {proofs.length === 0 ? (
            <Text style={styles.muted}>Aucune preuve soumise. Déposez votre première capture !</Text>
          ) : proofs.slice(0, 5).map(p => (
            <View key={p.id} style={styles.proofRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proofDate}>{new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
                {p.comment ? <Text style={styles.muted} numberOfLines={2}>{p.comment}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Welcome modal */}
      <Modal visible={welcomeOpen} transparent animationType="fade" onRequestClose={closeWelcome}>
        <View style={styles.modalBg}>
          <View style={styles.welcomeCard} testID="welcome-modal">
            <View style={styles.welcomeLogo}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 24 }}>JZ</Text></View>
            <Text style={styles.welcomeTitle}>Bienvenue sur JZ KALYPHOR</Text>
            <Text style={styles.welcomeText}>Votre parcours de certification commence ici. Suivez vos cours, déposez vos preuves d'avancement chaque semaine et restez en contact avec votre coach.</Text>
            <Button title="Commencer" onPress={closeWelcome} testID="welcome-close" />
          </View>
        </View>
      </Modal>

      {/* Upload modal */}
      <Modal visible={uploadOpen} transparent animationType="slide" onRequestClose={() => setUploadOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Preuve hebdomadaire</Text>
            <Button title={uploadFile ? "Changer d'image" : "Choisir une capture d'écran"} onPress={pickImage} variant="secondary" testID="btn-pick-image" />
            {uploadFile && <Text style={styles.muted} numberOfLines={1}>{uploadFile.name}</Text>}
            <Text style={styles.label}>Commentaire (optionnel)</Text>
            <TextInput value={comment} onChangeText={setComment} placeholder="Décrivez votre progression..." placeholderTextColor={colors.muted} multiline style={styles.textarea} testID="upload-comment" />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><Button title="Annuler" variant="ghost" onPress={() => { setUploadOpen(false); setUploadFile(null); setComment(""); }} /></View>
              <View style={{ flex: 1 }}><Button title="Envoyer" onPress={doUpload} loading={uploading} disabled={!uploadFile} testID="btn-submit-proof" /></View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hello: { color: colors.muted, fontSize: 16 },
  name: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  cardLabel: { color: colors.muted, fontSize: 13 },
  cert: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 4 },
  pct: { color: colors.brandPrimary, fontWeight: "700" },
  metaRow: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.md },
  metaBlock: { flex: 1 },
  metaLabel: { color: colors.muted, fontSize: 11 },
  metaValue: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 2 },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700", marginBottom: spacing.md },
  muted: { color: colors.muted, fontSize: 13 },
  estIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  estValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: 2 },
  proofRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 10, alignItems: "center" },
  proofDate: { color: colors.onSurface, fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  welcomeCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: "center" },
  welcomeLogo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800", textAlign: "center" },
  welcomeText: { color: colors.muted, textAlign: "center", lineHeight: 20 },
  sheet: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: 4 },
  textarea: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, minHeight: 80, color: colors.onSurface, textAlignVertical: "top" },
});
