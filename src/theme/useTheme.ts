import { palette, fontFamily, fontSize, spacing, radius, shadow, duration, mapStyle, pinColor } from './tokens';

const theme = {
  colors: palette,
  fonts: fontFamily,
  fontSize,
  spacing,
  radius,
  shadow,
  duration,
  mapStyle,
  pinColor,
} as const;

export type Theme = typeof theme;

export default function useTheme(): Theme {
  return theme;
}
