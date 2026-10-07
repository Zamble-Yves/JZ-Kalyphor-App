import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors } from "@/src/theme";

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Étudiants", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="late" options={{ title: "En retard", tabBarIcon: ({ color, size }) => <Ionicons name="warning" size={size} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: "Bilan", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Compte", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="student/[id]" options={{ href: null }} />
      <Tabs.Screen name="student/new" options={{ href: null }} />
    </Tabs>
  );
}
