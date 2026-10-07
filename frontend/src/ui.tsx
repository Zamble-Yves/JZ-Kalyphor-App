import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors, radius, spacing } from "./theme";
import { ReactNode } from "react";

export function Button({ title, onPress, variant = "primary", loading, disabled, testID, icon, style }: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean; disabled?: boolean; testID?: string; icon?: ReactNode; style?: any;
}) {
  const bg = variant === "primary" ? colors.brandPrimary : variant === "secondary" ? colors.brandTertiary : variant === "danger" ? colors.error : "transparent";
  const fg = variant === "primary" || variant === "danger" ? "#fff" : variant === "secondary" ? colors.onBrandTertiary : colors.brandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && { borderWidth: 1, borderColor: colors.brandPrimary },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: any; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: "neutral" | "success" | "warning" | "error" | "info" | "brand"; testID?: string }) {
  const map: any = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: "#E6F4EA", fg: colors.success },
    warning: { bg: "#FDF1DC", fg: colors.warning },
    error: { bg: "#FDE7E7", fg: colors.error },
    info: { bg: "#E3EEFB", fg: colors.info },
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
  };
  const c = map[tone];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, testID }: { value: number; testID?: string }) {
  return (
    <View style={styles.progressWrap} testID={testID}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  progressWrap: { height: 10, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
});
