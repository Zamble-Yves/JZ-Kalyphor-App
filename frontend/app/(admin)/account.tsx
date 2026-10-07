import { View, Text, ScrollView, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Card } from "@/src/ui";
import { clearSession, getUser } from "@/src/api";
import { colors, spacing } from "@/src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const u = getUser();
  const logout = async () => { await clearSession(); router.replace("/login"); };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.lg, gap: spacing.lg }}
    >
      <Text style={styles.title}>Compte Coach</Text>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(u?.name || "C").slice(0,2).toUpperCase()}</Text></View>
          <View>
            <Text style={styles.name}>{u?.name}</Text>
            <Text style={styles.sub}>{u?.email}</Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text style={styles.section}>Infos pratiques</Text>
        <Text style={styles.muted}>WhatsApp public : +225 07 00 92 19 22</Text>
        <Text style={styles.muted}>Règles : Les étudiants déposent une preuve par semaine. Au-delà de 7 jours sans preuve, ils passent automatiquement « En retard ».</Text>
        <View style={{ height: 12 }} />
        <Button
          title="Ouvrir WhatsApp"
          variant="secondary"
          icon={<Ionicons name="logo-whatsapp" size={18} color={colors.brandPrimary} />}
          onPress={() => Linking.openURL("https://wa.me/2250700921922")}
          testID="btn-wa-admin"
        />
      </Card>
      <Button title="Se déconnecter" variant="ghost" onPress={logout} testID="btn-logout-admin" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  name: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  sub: { color: colors.muted },
  section: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  muted: { color: colors.muted, marginTop: 4, lineHeight: 20 },
});
