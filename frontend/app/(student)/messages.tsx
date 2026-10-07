import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, getUser } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Msg = { id: string; from_user: string; to_user: string; content: string; created_at: string };

export default function Messages() {
  const insets = useSafeAreaInsets();
  const me = getUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [content, setContent] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("Coach");
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const a = await api<{ id?: string; name?: string }>("/admin/id");
      if (a?.id) { setAdminId(a.id); setAdminName(a.name || "Coach"); }
      const m = await api<Msg[]>("/messages");
      setMsgs(m);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    if (!content.trim() || !adminId) return;
    const text = content.trim();
    setContent("");
    try {
      await api<Msg>("/messages", { method: "POST", body: JSON.stringify({ to_user_id: adminId, content: text }) });
      load();
    } catch {}
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Discussion avec {adminName}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.from_user === me?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.other]} testID={`msg-${item.id}`}>
              <Text style={[styles.msgText, mine ? styles.mineText : styles.otherText]}>{item.content}</Text>
              <Text style={[styles.msgTime, mine ? styles.mineTime : styles.otherTime]}>{new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Envoyez votre premier message au coach</Text>}
      />
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput value={content} onChangeText={setContent} placeholder="Votre message..." placeholderTextColor={colors.muted} style={styles.input} testID="msg-input" multiline />
        <Pressable onPress={send} style={styles.sendBtn} testID="msg-send">
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: 2 },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: radius.md },
  mine: { backgroundColor: colors.brandPrimary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.surfaceTertiary, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15 },
  mineText: { color: colors.onBrandPrimary },
  otherText: { color: colors.onSurface },
  msgTime: { fontSize: 10, marginTop: 4 },
  mineTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  otherTime: { color: colors.muted },
  empty: { textAlign: "center", color: colors.muted, marginTop: 60 },
  inputBar: { flexDirection: "row", padding: spacing.md, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.onSurface, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
