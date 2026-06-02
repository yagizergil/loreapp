/**
 * SealMark — the reusable wax-seal visual shared by the map pins, the FAB
 * "ask" button, the random button and the premium teaser pin.
 *
 * Pure rendering only (no Marker, no tracksViewChanges). QuestionPin wraps this
 * for the map; the rest of the app uses <SealMark /> directly.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export interface Shade { light: string; mid: string; dark: string; deep: string; emboss: string }

export const TYPE_SHADE: Record<string, Shade> = {
  vote:   { light: '#F4885C', mid: '#DC5E33', dark: '#BE4A23', deep: '#9C3A18', emboss: '#FFC4A6' },
  choice: { light: '#6E9FE6', mid: '#4574BE', dark: '#345D9E', deep: '#284A82', emboss: '#B9D3F6' },
  open:   { light: '#54B97E', mid: '#2F9159', dark: '#247447', deep: '#1A5C37', emboss: '#A9ECC4' },
};
// Kullanıcının kendi sorduğu soruların mührü (sarı).
export const MINE_SHADE: Shade = {
  light: '#F5C842', mid: '#D4A916', dark: '#B08C0C', deep: '#8A6E08', emboss: '#FFF0A0',
};
export const FALLBACK_SHADE = TYPE_SHADE.vote;

// ─── Wax blob path — computed once at module load ─────────────────────────────

function buildSealPath(): string {
  const cx = 50, cy = 50, lobes = 11;
  const rand = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const valleys: [number, number, number][] = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    valleys.push([cx + Math.cos(a) * (33.5 + rand(i) * 2.8), cy + Math.sin(a) * (33.5 + rand(i) * 2.8), a]);
  }
  let d = '';
  for (let i = 0; i < lobes; i++) {
    const [x, y, a] = valleys[i];
    const [nx, ny, naRaw] = valleys[(i + 1) % lobes];
    const na  = naRaw < a ? naRaw + Math.PI * 2 : naRaw;
    const mid = (a + na) / 2;
    const rp  = 40.5 + rand(i + 100) * 2.6;
    if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)} `;
    d += `Q${(cx + Math.cos(mid) * rp).toFixed(1)},${(cy + Math.sin(mid) * rp).toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)} `;
  }
  return d + 'Z';
}

export const SEAL_PATH = buildSealPath();
export const MONO_L    = 'M40,28 L50,28 L50,60 L66,60 L66,70 L40,70 Z';
// "+" mührü — soru sorma butonu için (ortada artı işareti).
export const MONO_PLUS = 'M44,30 L56,30 L56,44 L70,44 L70,56 L56,56 L56,70 L44,70 L44,56 L30,56 L30,44 L44,44 Z';

export type SealGlyph = 'L' | 'plus';

// ─── SVG seal half ────────────────────────────────────────────────────────────

export const SealHalf = React.memo(function SealHalf({ side, w, h, gid, shade, glyph = 'L' }: {
  side: 'left' | 'right'; w: number; h: number; gid: string; shade: Shade; glyph?: SealGlyph;
}) {
  const viewBox = side === 'left' ? '0 0 50 100' : '50 0 50 100';
  const mono = glyph === 'plus' ? MONO_PLUS : MONO_L;
  return (
    <Svg width={w} height={h} viewBox={viewBox}>
      <Defs>
        <RadialGradient id={gid} cx="42" cy="36" r="58" gradientUnits="userSpaceOnUse">
          <Stop offset="0"    stopColor={shade.light} />
          <Stop offset="0.55" stopColor={shade.mid} />
          <Stop offset="0.85" stopColor={shade.dark} />
          <Stop offset="1"    stopColor={shade.deep} />
        </RadialGradient>
      </Defs>
      <Path d={SEAL_PATH} fill={`url(#${gid})`} stroke={shade.deep} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="50" cy="50" r="30" stroke={shade.deep}   strokeWidth="2"   fill="none" opacity={0.35} />
      <Circle cx="50" cy="50" r="30" stroke={shade.emboss} strokeWidth="1.2" fill="none" opacity={0.55} translateY={1.2} />
      <Path d={mono} fill={shade.emboss} opacity={0.7}  translateX={0.6} translateY={1.6} />
      <Path d={mono} fill={shade.deep}   opacity={0.78} />
    </Svg>
  );
});

// ─── Full seal (both halves) ───────────────────────────────────────────────────

let markCounter = 0;

export function SealMark({ size, shade, gid, glyph = 'L' }: { size: number; shade?: Shade; gid?: string; glyph?: SealGlyph }) {
  const s = shade ?? MINE_SHADE;
  const base = gid ?? `sm${++markCounter}`;
  const halfW = size / 2;
  return (
    <View style={styles.row}>
      <SealHalf side="left"  w={halfW} h={size} gid={`${base}L`} shade={s} glyph={glyph} />
      <SealHalf side="right" w={halfW} h={size} gid={`${base}R`} shade={s} glyph={glyph} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
