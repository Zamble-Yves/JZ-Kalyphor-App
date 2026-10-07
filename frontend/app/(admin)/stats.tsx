import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Dimensions, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { Card } from "@/src/ui";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

type Cohort = { cohort: string; total: number; late: number; completed: number; avg_progress: number };
type Stats = { totals: { total_students: number; in_progress: number; late: number; completed: number; avg_progress: number }; cohorts: Cohort[] };

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api<Stats>("/admin/stats")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const width = Math.min(Dimensions.get("window").width - 80, 500);

  const barData = (data?.cohorts || []).flatMap(c => ([
    { value: c.total, label: c.cohort.slice(5), spacing: 2, labelWidth: 40, frontColor: colors.brandPrimary },
    { value: c.late, frontColor: colors.error, spacing: 2 },
    { value: c.completed, frontColor: colors.success, spacing: 16 },
  ]));

  const lineData = (data?.cohorts || []).map(c => ({ value: c.avg_progress, label: c.cohort.slice(5), dataPointText: `${c.avg_progress}%` }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: spacing.lg, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
    >
      <Text style={styles.title}>Bilan général</Text>
      <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
        <Metric label="Total étudiants" value={data?.totals.total_students ?? "—"} tone="brand" testID="metric-total" />
        <Metric label="En cours" value={data?.totals.in_progress ?? "—"} tone="info" testID="metric-progress" />
        <Metric label="En retard" value={data?.totals.late ?? "—"} tone="error" testID="metric-late" />
        <Metric label="Terminés" value={data?.totals.completed ?? "—"} tone="success" testID="metric-done" />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Avancement moyen</Text>
        <Text style={styles.big}>{data?.totals.avg_progress ?? 0}%</Text>
        <Text style={styles.muted}>Toutes cohortes confondues</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Évolution par cohorte</Text>
        <Text style={styles.muted}>Nombre d'étudiants · Retards · Terminés</Text>
        <View style={{ marginTop: spacing.md, overflow: "hidden" }}>
          {barData.length ? (
            <BarChart
              data={barData}
              width={width}
              barWidth={14}
              height={180}
              hideRules
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              noOfSections={4}
            />
          ) : <Text style={styles.muted}>Pas assez de données</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" }}>
          <Legend color={colors.brandPrimary} label="Total" />
          <Legend color={colors.error} label="Retards" />
          <Legend color={colors.success} label="Terminés" />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Avancement moyen par cohorte</Text>
        <View style={{ marginTop: spacing.md, overflow: "hidden" }}>
          {lineData.length ? (
            <LineChart
              data={lineData}
              width={width}
              height={180}
              color={colors.brandPrimary}
              thickness={3}
              dataPointsColor={colors.brandPrimary}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              maxValue={100}
              noOfSections={4}
              hideRules
            />
          ) : <Text style={styles.muted}>Pas assez de données</Text>}
        </View>
      </Card>
    </ScrollView>
  );
}

function Metric({ label, value, tone, testID }: { label: string; value: any; tone: "brand" | "info" | "error" | "success"; testID?: string }) {
  const bg = tone === "brand" ? colors.brandTertiary : tone === "info" ? "#E3EEFB" : tone === "error" ? "#FDE7E7" : "#E6F4EA";
  const fg = tone === "brand" ? colors.brandPrimary : tone === "info" ? colors.info : tone === "error" ? colors.error : colors.success;
  return (
    <View testID={testID} style={[styles.metric, { backgroundColor: bg }]}>
      <Text style={[styles.metricValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  big: { color: colors.brandPrimary, fontSize: 36, fontWeight: "800", marginTop: 4 },
  muted: { color: colors.muted, fontSize: 12 },
  metric: { flexBasis: "47%", flexGrow: 1, borderRadius: radius.lg, padding: spacing.lg },
  metricValue: { fontSize: 28, fontWeight: "800" },
  metricLabel: { fontSize: 12, marginTop: 2, fontWeight: "600" },
});
