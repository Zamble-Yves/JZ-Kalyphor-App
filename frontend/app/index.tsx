import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { loadSession, getUser } from "@/src/api";
import { colors } from "@/src/theme";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"student" | "admin" | null>(null);
  useEffect(() => {
    (async () => {
      await loadSession();
      const u = getUser();
      setRole(u?.role || null);
      setLoading(false);
    })();
  }, []);
  if (loading) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
  if (role === "admin") return <Redirect href="/(admin)" />;
  if (role === "student") return <Redirect href="/(student)" />;
  return <Redirect href="/login" />;
}
