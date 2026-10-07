import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Linking, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, User } from "@/src/api";
import { Badge } from "@/src/ui";
import { colors, radius, spacing } from "@/src/theme";

export default function Late() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api<User[]>("/admin/late")); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const whatsapp = (s: User) => {
    const phone = (s.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;
    const msg = encodeURIComponent(`Bonjour ${s.name}, nous n'avons pas reçu votre preuve d'avancement cette semaine. Comment avance votre certificat ${s.certificate || ""} ? — JZ KALYPHOR`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.iconBg}><Ionicons name="warning" size={22} color="#fff" /></View>
          <View>
            <Text style={styles.title}>Étudiants en retard</Text>
            <Text style={styles.sub}>Sans preuve depuis plus de 7 jours</Text>
          </View>
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={s => s.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucun étudiant en retard. Bravo !</Text>}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`late-${item.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.subt}>{item.certificate || "—"}</Text>
              </View>
              <Badge label="En retard" tone="error" />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
              <Pressable onPress={() => whatsapp(item)} style={[styles.btn, styles.wa]} testID={`late-wa-${item.id}`}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.waT}>Relancer</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/(admin)/student/${item.id}`)} style={[styles.btn, styles.view]} testID={`late-view-${item.id}`}>
                <Text style={styles.viewT}>Voir la fiche</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, paddingHorizontal: spacing.lg },
  iconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.error },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDE7E7", alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.error, fontWeight: "800" },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 16 },
  subt: { color: colors.muted, fontSize: 13 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  wa: { backgroundColor: "#25D366" },
  waT: { color: "#fff", fontWeight: "700" },
  view: { backgroundColor: colors.brandTertiary },
  viewT: { color: colors.brandPrimary, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.muted, marginTop: 60 },
});
