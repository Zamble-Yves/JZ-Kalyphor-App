import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, getUser, uploadMessageAttachment, openMessageAttachment, MessageAttachment } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Msg = {
  id: string;
  from_user: string;
  to_user: string;
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
};

export default function Messages() {
  const insets = useSafeAreaInsets();
  const me = getUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [content, setContent] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("Coach");
  const [selectedAttachment, setSelectedAttachment] = useState<{ uri: string; filename: string; mimeType: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const a = await api<{ id?: string; name?: string }>('/admin/id');
      if (a?.id) { setAdminId(a.id); setAdminName(a.name || 'Coach'); }
      const m = await api<Msg[]>('/messages');
      setMsgs(m);
    } catch {}
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorisez l’accès aux photos pour joindre une capture ou un document.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSelectedAttachment({
      uri: asset.uri,
      filename: asset.fileName || `capture-${Date.now()}.png`,
      mimeType: asset.mimeType || 'image/png',
    });
  };

  const handleOpenAttachment = async (attachment: MessageAttachment) => {
    try {
      const data = await openMessageAttachment(attachment.id);
      await Linking.openURL(data.url);
    } catch {
      Alert.alert('Ouverture impossible', 'Le fichier n’a pas pu être ouvert.');
    }
  };

  const send = async () => {
    if (!adminId) return;
    if (!content.trim() && !selectedAttachment) return;

    const text = content.trim();
    let attachments: MessageAttachment[] = [];

    try {
      if (selectedAttachment) {
        attachments = [await uploadMessageAttachment(selectedAttachment.uri, selectedAttachment.filename, selectedAttachment.mimeType)];
      }
      await api('/messages', {
        method: 'POST',
        body: JSON.stringify({
          to_user_id: adminId,
          content: text,
          attachments,
        }),
      });
      setContent('');
      setSelectedAttachment(null);
      await load();
    } catch (e: any) {
      Alert.alert('Envoi impossible', e?.message || 'Vérifiez votre connexion et réessayez.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Discussion avec {adminName}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.from_user === me?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.other]} testID={`msg-${item.id}`}>
              {item.content ? <Text style={[styles.msgText, mine ? styles.mineText : styles.otherText]}>{item.content}</Text> : null}

              {item.attachments?.length ? (
                <View style={styles.attachGroup}>
                  {item.attachments.map((attachment) => (
                    <Pressable key={attachment.id} onPress={() => handleOpenAttachment(attachment)} style={styles.attachmentChip}>
                      <Ionicons name="attach" size={14} color={mine ? '#fff' : colors.brandPrimary} />
                      <Text style={[styles.attachmentText, mine ? styles.mineText : styles.otherText]} numberOfLines={1}>
                        {attachment.filename}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.msgTime, mine ? styles.mineTime : styles.otherTime]}>
                {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Envoyez votre premier message au coach</Text>}
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        {selectedAttachment ? (
          <View style={styles.attachmentPreview}>
            <Text style={styles.attachmentPreviewText} numberOfLines={1}>{selectedAttachment.filename}</Text>
            <Pressable onPress={() => setSelectedAttachment(null)} style={styles.removeAttachment}>
              <Ionicons name="close" size={16} color={colors.brandPrimary} />
            </Pressable>
          </View>
        ) : null}

        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Votre message..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="msg-input"
          multiline
        />

        <Pressable onPress={pickAttachment} style={[styles.iconBtn, styles.attachBtn]} testID="msg-attach">
          <Ionicons name="attach" size={20} color={colors.brandPrimary} />
        </Pressable>

        <Pressable onPress={send} style={styles.sendBtn} testID="msg-send">
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: 2 },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: radius.md },
  mine: { backgroundColor: colors.brandPrimary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.surfaceTertiary, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15 },
  mineText: { color: colors.onBrandPrimary },
  otherText: { color: colors.onSurface },
  msgTime: { fontSize: 10, marginTop: 6 },
  mineTime: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  otherTime: { color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 60 },
  inputBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: 'flex-end' },
  attachmentPreview: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  attachmentPreviewText: { flex: 1, color: colors.onSurface, fontWeight: '600' },
  removeAttachment: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.onSurface, maxHeight: 100 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  attachBtn: { backgroundColor: colors.surfaceTertiary },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  attachGroup: { marginTop: 8, gap: 6 },
  attachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.15)' },
  attachmentText: { fontSize: 12, fontWeight: '600' },
});
