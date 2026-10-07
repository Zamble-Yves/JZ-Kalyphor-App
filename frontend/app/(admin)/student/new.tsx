import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/src/ui";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function NewStudent() {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<any>({ email: "", name: "", password: "", phone: "", certificate: "", cohort: "", start_date: "", deadline: "" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!f.email || !f.name || !f.password) {
      Platform.OS === "web" ? window.alert("Email, nom et mot de passe requis") : Alert.alert("Erreur", "Email, nom et mot de passe requis");
      return;
    }
    setLoading(true);
    try {
      const s = await api<any>("/students", { method: "POST", body: JSON.stringify(f) });
      router.replace(`/(admin)/student/${s.id}`);
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e.message) : Alert.alert("Erreur", e.message);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Nouvel étudiant</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: insets.bottom + 32 }}>
        <Field label="Email *" value={f.email} onChangeText={(t: string) => setF({ ...f, email: t })} testID="new-email" keyboardType="email-address" />
        <Field label="Nom complet *" value={f.name} onChangeText={(t: string) => setF({ ...f, name: t })} testID="new-name" />
        <Field label="Mot de passe *" value={f.password} onChangeText={(t: string) => setF({ ...f, password: t })} testID="new-password" secureTextEntry />
        <Field label="Téléphone WhatsApp (ex: +22507...)" value={f.phone} onChangeText={(t: string) => setF({ ...f, phone: t })} testID="new-phone" />
        <Field label="Certificat visé" value={f.certificate} onChangeText={(t: string) => setF({ ...f, certificate: t })} testID="new-cert" />
        <Field label="Cohorte (YYYY-MM)" value={f.cohort} onChangeText={(t: string) => setF({ ...f, cohort: t })} testID="new-cohort" />
        <Field label="Date de début (YYYY-MM-DD)" value={f.start_date} onChangeText={(t: string) => setF({ ...f, start_date: t })} testID="new-start" />
        <Field label="Date limite (YYYY-MM-DD)" value={f.deadline} onChangeText={(t: string) => setF({ ...f, deadline: t })} testID="new-deadline" />
        <View style={{ height: 10 }} />
        <Button title="Créer l'étudiant" onPress={submit} loading={loading} testID="btn-create-student" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} autoCapitalize={props.keyboardType === "email-address" ? "none" : "sentences"} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, color: colors.onSurface, fontSize: 15 },
});
