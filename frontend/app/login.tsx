import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/ui";
import { login } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  async function onSubmit() {
    setError(null); setLoading(true);
    try {
      const r = await login(email.trim(), password);
      router.replace(r.user.role === "admin" ? "/(admin)" : "/(student)");
    } catch (e: any) {
      setError(e.message || "Erreur de connexion");
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logo}><Text style={styles.logoText}>JZ</Text></View>
          <Text style={styles.brand}>JZ KALYPHOR</Text>
          <Text style={styles.subtitle}>Suivi des étudiants · Certificats en ligne</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email"
            value={email} onChangeText={setEmail}
            placeholder="votre@email.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={styles.input}
          />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            testID="login-password"
            value={password} onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />
          {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}
          <Button title="Se connecter" onPress={onSubmit} loading={loading} testID="login-submit" />
        </View>

        <Text style={styles.hint}>Besoin d'aide ? Contactez le coach sur WhatsApp +225 07 00 92 19 22</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  logoWrap: { alignItems: "center", gap: spacing.sm },
  logo: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.onBrandPrimary, fontSize: 28, fontWeight: "800", letterSpacing: 1 },
  brand: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 14 },
  form: { gap: spacing.sm },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.onSurface },
  error: { color: colors.error, marginTop: spacing.sm },
  hint: { color: colors.muted, textAlign: "center", fontSize: 12, marginTop: spacing.xl },
});
