import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Linking,
  Alert,
  Platform,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Badge, Button, Card, ProgressBar } from "@/src/ui";
import { api, User, getUser, uploadMessageAttachment, openMessageAttachment, MessageAttachment } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Msg = {
  id: string;
  from_user: string;
  to_user: string;
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
};

export default function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const me = getUser();
  const [student, setStudent] = useState<User | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [newCourse, setNewCourse] = useState<any>({ title: "", link_type: "youtube", url: "", access_email: "", access_password: "" });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState<{ uri: string; filename: string; mimeType: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const s = await api<any>(`/students/${id}`);
      setStudent(s); setNote(s.note || ""); setForm(s);
      setCourses(await api<any[]>(`/students/${id}/courses`));
      setProofs(await api<any[]>(`/students/${id}/proofs`));
      const msgs = await api<Msg[]>(`/messages?with_user=${id}`);
      setMessages(msgs || []);
    } catch {}
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t); }, [id]);

  const whatsapp = () => {
    const phone = (student?.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;
    const msg = encodeURIComponent(`Bonjour ${student?.name}, nous suivons votre progression sur ${student?.certificate || "votre certificat"}. Pouvez-vous nous envoyer votre preuve d'avancement concernant votre parcours ? — JZ KALYPHOR`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
  };

  const saveNote = async () => {
    await api(`/students/${id}/note`, { method: "PUT", body: JSON.stringify({ note }) });
    Platform.OS === "web" ? window.alert("Note enregistrée") : Alert.alert("OK", "Note enregistrée");
  };

  const saveInfos = async () => {
    const { name, phone, certificate, cohort, start_date, deadline } = form;
    await api(`/students/${id}`, { method: "PUT", body: JSON.stringify({ name, phone, certificate, cohort, start_date, deadline }) });
    setEditing(false);
    load();
  };

  const addCourse = async () => {
    if (!newCourse.title || !newCourse.url) return;
    const payload: any = { title: newCourse.title, link_type: newCourse.link_type, url: newCourse.url };
    if (newCourse.access_email) payload.access_email = newCourse.access_email;
    if (newCourse.access_password) payload.access_password = newCourse.access_password;
    await api(`/students/${id}/courses`, { method: "POST", body: JSON.stringify(payload) });
    setNewCourse({ title: "", link_type: "youtube", url: "", access_email: "", access_password: "" });
    load();
  };

  const deleteCourse = async (cid: string) => {
    await api(`/courses/${cid}`, { method: "DELETE" });
    load();
  };

  const deleteStudent = async () => {
    const ok = Platform.OS === "web" ? window.confirm("Supprimer cet étudiant ?") : await new Promise<boolean>(res => Alert.alert("Confirmer", "Supprimer cet étudiant ?", [{ text: "Non", style: "cancel", onPress: () => res(false) }, { text: "Oui", onPress: () => res(true) }]));
    if (!ok) return;
    await api(`/students/${id}`, { method: "DELETE" });
    router.back();
  };

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l’accès aux photos pour joindre une capture ou un document.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSelectedAttachment({
      uri: asset.uri,
      filename: asset.fileName || `piece-jointe-${Date.now()}.png`,
      mimeType: asset.mimeType || "image/png",
    });
  };

  const handleOpenAttachment = async (attachment: MessageAttachment) => {
    try {
      const data = await openMessageAttachment(attachment.id);
      await Linking.openURL(data.url);
    } catch {
      Alert.alert("Ouverture impossible", "Le fichier n’a pas pu être ouvert.");
    }
  };

  const sendMessage = async () => {
    if (!id) return;
    if (!messageText.trim() && !selectedAttachment) return;

    try {
      let attachments: MessageAttachment[] = [];
      if (selectedAttachment) {
        attachments = [await uploadMessageAttachment(selectedAttachment.uri, selectedAttachment.filename, selectedAttachment.mimeType)];
      }

      await api('/messages', {
        method: 'POST',
        body: JSON.stringify({
          to_user_id: id,
          content: messageText.trim(),
          attachments,
        }),
      });

      setMessageText("");
      setSelectedAttachment(null);
      await load();
    } catch (e: any) {
      Alert.alert('Envoi impossible', e?.message || 'Vérifiez votre connexion et réessayez.');
    }
  };

  if (!student) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
        <Pressable onPress={() => router.back()} testID="btn-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{student.name}</Text>
        <Pressable onPress={deleteStudent} testID="btn-delete-student"><Ionicons name="trash" size={22} color={colors.error} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.lg }}>
        {student.status === "late" && (
          <View style={styles.alert} testID="late-alert">
            <Ionicons name="warning" size={20} color={colors.error} />
            <Text style={styles.alertText}>Étudiant en retard — aucune preuve depuis plus de 7 jours.</Text>
          </View>
        )}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{student.name.slice(0,2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{student.name}</Text>
              <Text style={styles.sub}>{student.email}</Text>
              <Text style={styles.sub}>{student.phone || "—"}</Text>
            </View>
            <Badge label={student.status === "late" ? "En retard" : student.status === "completed" ? "Terminé" : "En cours"} tone={student.status === "late" ? "error" : student.status === "completed" ? "success" : "brand"} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.caption}>Avancement {student.progress}%</Text>
            <ProgressBar value={student.progress} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}><Button title="WhatsApp" variant="secondary" icon={<Ionicons name="logo-whatsapp" size={16} color={colors.brandPrimary} />} onPress={whatsapp} testID="btn-wa" /></View>
            <View style={{ flex: 1 }}><Button title={editing ? "Fermer" : "Modifier"} variant="ghost" onPress={() => setEditing(!editing)} testID="btn-edit" /></View>
          </View>
        </Card>

        {editing && (
          <Card>
            <Text style={styles.section}>Informations</Text>
            <Field label="Nom" value={form.name} onChangeText={(t: string) => setForm({ ...form, name: t })} />
            <Field label="Téléphone" value={form.phone} onChangeText={(t: string) => setForm({ ...form, phone: t })} />
            <Field label="Certificat visé" value={form.certificate} onChangeText={(t: string) => setForm({ ...form, certificate: t })} />
            <Field label="Cohorte (YYYY-MM)" value={form.cohort} onChangeText={(t: string) => setForm({ ...form, cohort: t })} />
            <Field label="Date de début (YYYY-MM-DD)" value={form.start_date} onChangeText={(t: string) => setForm({ ...form, start_date: t })} />
            <Field label="Date limite (YYYY-MM-DD)" value={form.deadline} onChangeText={(t: string) => setForm({ ...form, deadline: t })} />
            <View style={{ height: 10 }} />
            <Button title="Enregistrer" onPress={saveInfos} testID="btn-save-infos" />
          </Card>
        )}

        <Card>
          <Text style={styles.section}>Cours assignés ({courses.length})</Text>
          {courses.map(c => (
            <View key={c.id} style={styles.courseRow}>
              <Ionicons name={c.link_type === "youtube" ? "logo-youtube" : c.link_type === "pdf" ? "document-text" : "globe"} size={18} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{c.title}</Text>
                <Text style={styles.sub}>{c.status === "todo" ? "À faire" : c.status === "in_progress" ? "En cours" : "Terminé"}{c.access_email ? "  ·  🔑 identifiants" : ""}</Text>
              </View>
              <Pressable onPress={() => deleteCourse(c.id)} testID={`del-course-${c.id}`}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
            </View>
          ))}
          <View style={{ height: 10 }} />
          <Text style={styles.caption}>Ajouter un cours</Text>
          <Field label="Titre" value={newCourse.title} onChangeText={(t: string) => setNewCourse({ ...newCourse, title: t })} />
          <View style={{ flexDirection: "row", gap: 6, marginVertical: 6 }}>
            {['youtube', 'pdf', 'external'].map(t => (
              <Pressable key={t} onPress={() => setNewCourse({ ...newCourse, link_type: t })} style={[styles.typeChip, newCourse.link_type === t && styles.typeChipActive]} testID={`type-${t}`}>
                <Text style={[styles.typeText, newCourse.link_type === t && styles.typeTextActive]}>{t === 'youtube' ? 'YouTube' : t === 'pdf' ? 'PDF' : 'Plateforme'}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="URL" value={newCourse.url} onChangeText={(t: string) => setNewCourse({ ...newCourse, url: t })} />
          <Text style={styles.caption}>Identifiants plateforme (optionnel — visibles pour l'étudiant)</Text>
          <Field label="Email d'accès" value={newCourse.access_email} onChangeText={(t: string) => setNewCourse({ ...newCourse, access_email: t })} />
          <Field label="Mot de passe d'accès" value={newCourse.access_password} onChangeText={(t: string) => setNewCourse({ ...newCourse, access_password: t })} />
          <Button title="Ajouter le cours" variant="secondary" onPress={addCourse} testID="btn-add-course" />
        </Card>

        <Card>
          <Text style={styles.section}>Historique des preuves ({proofs.length})</Text>
          {proofs.length === 0 ? <Text style={styles.sub}>Aucune preuve</Text> : proofs.map(p => (
            <View key={p.id} style={styles.proofRow}>
              <Ionicons name="image" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
                {p.comment ? <Text style={styles.sub}>{p.comment}</Text> : null}
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.section}>Conversation avec l’étudiant</Text>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatBox}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ gap: spacing.sm }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const mine = item.from_user === me?.id;
                return (
                  <View style={[styles.chatBubble, mine ? styles.chatMine : styles.chatOther]}>
                    {item.content ? <Text style={[styles.chatText, mine ? styles.chatMineText : styles.chatOtherText]}>{item.content}</Text> : null}
                    {item.attachments?.length ? (
                      <View style={styles.chatAttachmentList}>
                        {item.attachments.map((attachment) => (
                          <Pressable key={attachment.id} onPress={() => handleOpenAttachment(attachment)} style={styles.chatAttachmentChip}>
                            <Ionicons name="attach" size={14} color={mine ? '#fff' : colors.brandPrimary} />
                            <Text style={[styles.chatAttachmentText, mine ? styles.chatMineText : styles.chatOtherText]} numberOfLines={1}>{attachment.filename}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <Text style={[styles.chatTime, mine ? styles.chatMineTime : styles.chatOtherTime]}>
                      {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>Aucun message</Text>}
            />

            <View style={styles.chatInputBar}>
              {selectedAttachment ? (
                <View style={styles.attachmentPreview}>
                  <Text style={styles.attachmentPreviewText} numberOfLines={1}>{selectedAttachment.filename}</Text>
                  <Pressable onPress={() => setSelectedAttachment(null)} style={styles.removeAttachment}><Ionicons name="close" size={16} color={colors.brandPrimary} /></Pressable>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <TextInput value={messageText} onChangeText={setMessageText} style={styles.chatInput} placeholder="Répondre au message..." placeholderTextColor={colors.muted} multiline />
                <Pressable onPress={pickAttachment} style={[styles.iconBtn, styles.attachBtn]}><Ionicons name="attach" size={18} color={colors.brandPrimary} /></Pressable>
                <Pressable onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={18} color="#fff" /></Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Card>

        <Card>
          <Text style={styles.section}>Note privée du coach</Text>
          <TextInput value={note} onChangeText={setNote} style={styles.textarea} multiline placeholder="Vos observations privées..." placeholderTextColor={colors.muted} testID="note-input" />
          <View style={{ height: 10 }} />
          <Button title="Enregistrer la note" onPress={saveNote} testID="btn-save-note" />
        </Card>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText }: any) {
  return (
    <View style={{ marginVertical: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{label}</Text>
      <TextInput value={value || ""} onChangeText={onChangeText} style={{ backgroundColor: colors.surfaceTertiary, borderRadius: 10, padding: 10, color: colors.onSurface }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.lg, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.onSurface },
  alert: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#FDE7E7", borderWidth: 1, borderColor: colors.error, padding: 12, borderRadius: radius.md },
  alertText: { color: colors.error, flex: 1, fontWeight: "600" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 18 },
  name: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 13 },
  caption: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  section: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  courseRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  courseTitle: { color: colors.onSurface, fontWeight: "600" },
  proofRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8 },
  textarea: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, minHeight: 80, color: colors.onSurface, textAlignVertical: "top" },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  typeChipActive: { backgroundColor: colors.brandPrimary },
  typeText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  chatBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, padding: spacing.sm },
  chatBubble: { maxWidth: '82%', padding: 10, borderRadius: radius.md },
  chatMine: { backgroundColor: colors.brandPrimary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatOther: { backgroundColor: colors.surfaceTertiary, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatText: { fontSize: 14 },
  chatMineText: { color: '#fff' },
  chatOtherText: { color: colors.onSurface },
  chatTime: { fontSize: 10, marginTop: 6 },
  chatMineTime: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  chatOtherTime: { color: colors.muted },
  chatAttachmentList: { marginTop: 8, gap: 6 },
  chatAttachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.15)' },
  chatAttachmentText: { fontSize: 11, fontWeight: '600' },
  chatInputBar: { marginTop: spacing.sm, gap: 8 },
  chatInput: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10, color: colors.onSurface, maxHeight: 100 },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  attachmentPreviewText: { flex: 1, color: colors.onSurface, fontWeight: '600' },
  removeAttachment: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  attachBtn: { backgroundColor: colors.surfaceTertiary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30 },
});
