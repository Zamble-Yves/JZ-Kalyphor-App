import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBFB",
  onSurface: "#1A1515",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2D2424",
  surfaceTertiary: "#F4F0F0",
  onSurfaceTertiary: "#4A3C3C",
  surfaceInverse: "#2A1F20",
  onSurfaceInverse: "#FDFBFB",
  muted: "#7A696A",

  brand: "#8A1C2B",
  onBrand: "#FFFFFF",
  brandPrimary: "#8A1C2B",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#A02D3C",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F3E6E8",
  onBrandTertiary: "#8A1C2B",

  success: "#2E7D32",
  onSuccess: "#FFFFFF",
  warning: "#B97700",
  onWarning: "#FFFFFF",
  error: "#C62828",
  onError: "#FFFFFF",
  info: "#1565C0",
  onInfo: "#FFFFFF",

  border: "#E5DBDC",
  borderStrong: "#CBA9AD",
  divider: "#F0E8E9",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export const colors = themes.light;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
