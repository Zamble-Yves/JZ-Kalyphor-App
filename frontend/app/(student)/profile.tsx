import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Linking, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Card, ProgressBar } from "@/src/ui";
import { api, clearSession, getUser, setCachedUser, User } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(getUser());
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [proofs, setProofs] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<User>("/auth/me");
        setUser(me); setName(me.name); setPhone(me.phone || "");
        setCachedUser(me);
        setProofs(await api<any[]>("/me/proofs"));
        setCourses(await api<any[]>("/me/courses"));
      } catch {}
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const u = await api<User>("/auth/me", { method: "PUT", body: JSON.stringify({ name, phone }) });
      setUser(u); setCachedUser(u);
      Platform.OS === "web" ? window.alert("Profil mis à jour") : Alert.alert("Succès", "Profil mis à jour");
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e.message) : Alert.alert("Erreur", e.message);
    } finally { setSaving(false); }
  };

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  const done = courses.filter(c => c.status === "done").length;
  const inprog = courses.filter(c => c.status === "in_progress").length;
  const todo = courses.filter(c => c.status === "todo").length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.lg, gap: spacing.lg }}
    >
      <Text style={styles.title}>Profil</Text>
      <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || "?").slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
        <Text style={styles.label}>Nom complet</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} testID="profile-name" />
        <Text style={styles.label}>Téléphone</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" testID="profile-phone" />
        <View style={{ height: spacing.md }} />
        <Button title="Enregistrer" onPress={save} loading={saving} testID="profile-save" />
      </Card>

      <Card>
        <Text style={styles.section}>Statistiques globales</Text>
        <View style={{ marginVertical: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.muted}>Avancement</Text><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{user?.progress}%</Text>
          </View>
          <ProgressBar value={user?.progress || 0} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Cours terminés" value={done} />
          <Stat label="En cours" value={inprog} />
          <Stat label="À faire" value={todo} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Preuves" value={proofs.length} />
          <Stat label="Statut" value={user?.status === "late" ? "Retard" : user?.status === "completed" ? "Fini" : "En cours"} />
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>Infos pratiques</Text>
        <Text style={styles.muted}>• Déposez une preuve d'avancement chaque semaine (capture d'écran).</Text>
        <Text style={styles.muted}>• Respectez la date limite de votre certificat.</Text>
        <Text style={styles.muted}>• Toute inactivité de plus de 7 jours vous mettra en « En retard ».</Text>
        <View style={{ height: spacing.md }} />
        <Button
          title="Contacter le coach sur WhatsApp"
          variant="secondary"
          onPress={() => Linking.openURL("https://wa.me/2250700921922")}
          icon={<Ionicons name="logo-whatsapp" size={18} color={colors.brandPrimary} />}
          testID="btn-whatsapp"
        />
      </Card>

      <Button title="Se déconnecter" variant="ghost" onPress={logout} testID="btn-logout" />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  avatarRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  name: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  email: { color: colors.muted },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: spacing.sm, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, color: colors.onSurface },
  section: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  muted: { color: colors.muted, marginTop: 4, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, alignItems: "center" },
  statValue: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
