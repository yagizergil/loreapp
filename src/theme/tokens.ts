/**
 * Lore — Design Token System
 * Single source of truth for all visual decisions.
 */

// ─── COLOR ────────────────────────────────────────────────────────────────────

export const palette = {
  // Neutrals (dark-first; the app lives here)
  ink100: '#0B0D12',     // deepest background
  ink90:  '#12151C',     // main background
  ink80:  '#1A1E28',     // card / sheet background
  ink70:  '#232834',     // elevated surface
  ink60:  '#2F3545',     // border / divider
  ink40:  '#5A6278',     // muted text / icons
  ink20:  '#9AA1B4',     // secondary text
  ink10:  '#C8CEDD',     // tertiary text
  ink00:  '#F0F2F7',     // primary text (near-white, not pure)

  // Accent — Sienna / terracotta warm
  // Evokes maps, clay, warmth, locality.
  accent:     '#D4603A',   // primary CTA, active pins, highlights
  accentSoft: '#E8835F',   // hover / pressed state
  accentDim:  '#3B1F14',   // accent tint background (badges, tags)
  accentMid:  '#8C3B22',   // muted accent (secondary badges)

  // Semantic
  success:    '#4A9E6E',
  warning:    '#C9873A',
  error:      '#C0453A',

  // Pure
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
} as const;

export type PaletteKey = keyof typeof palette;

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────

export const fontFamily = {
  // Display / headings — Fraunces: optical-variable serif, editorial, warm
  // Loaded via @expo-google-fonts/fraunces
  display:  'Fraunces_700Bold',
  displayMedium: 'Fraunces_500Medium',

  // Body — Hanken Grotesk: contemporary grotesque, humanist, not overused
  // Loaded via @expo-google-fonts/hanken-grotesk
  body:     'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
} as const;

export const fontSize = {
  xs:   12,
  sm:   14,
  base: 16,
  md:   18,
  lg:   22,
  xl:   28,
  xxl:  36,
} as const;

export const lineHeight = {
  tight:  1.15,
  normal: 1.45,
  loose:  1.65,
} as const;

// ─── SPACING ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────

export const radius = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  full: 9999,
} as const;

// ─── SHADOWS ──────────────────────────────────────────────────────────────────

export const shadow = {
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
} as const;

// ─── ANIMATION ────────────────────────────────────────────────────────────────

export const duration = {
  fast:   150,
  normal: 280,
  slow:   450,
  xslow:  700,
} as const;

// ─── MAP STYLE ────────────────────────────────────────────────────────────────

// react-native-maps custom style: dark, muted, editorial
// POI labels minimized; roads subtle; water a deep slate-blue
export const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1A1E28' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5A6278' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12151C' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#232834' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#2F3545' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3A4158' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0D1420' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2F3545' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#161C10' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9AA1B4' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5A6278' }],
  },
] as const;

// ─── QUESTION PIN COLORS (per type) ──────────────────────────────────────────

export const pinColor = {
  vote:   palette.accent,      // sienna — "oy ver"
  choice: '#4A7FC0',           // slate-blue — "seç"
  open:   '#4A9E6E',           // sage green — "yaz"
} as const;
