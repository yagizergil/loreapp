/**
 * Standalone wax seal — same SVG as QuestionPin but without the Marker wrapper.
 * Use anywhere outside of MapView (splash, onboarding, etc.)
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SealType = 'vote' | 'choice' | 'open' | 'answered';

interface Shade { light: string; mid: string; dark: string; deep: string; emboss: string }

// ─── Colour sets ─────────────────────────────────────────────────────────────

const SHADES: Record<SealType, Shade> = {
  vote:     { light: '#F4885C', mid: '#DC5E33', dark: '#BE4A23', deep: '#9C3A18', emboss: '#FFC4A6' },
  choice:   { light: '#6E9FE6', mid: '#4574BE', dark: '#345D9E', deep: '#284A82', emboss: '#B9D3F6' },
  open:     { light: '#54B97E', mid: '#2F9159', dark: '#247447', deep: '#1A5C37', emboss: '#A9ECC4' },
  answered: { light: '#F5C842', mid: '#D4A916', dark: '#B08C0C', deep: '#8A6E08', emboss: '#FFF0A0' },
};

// ─── Wax blob path (same algorithm as QuestionPin) ───────────────────────────

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
    const na = naRaw < a ? naRaw + Math.PI * 2 : naRaw;
    const mid = (a + na) / 2;
    const rp = 40.5 + rand(i + 100) * 2.6;
    if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)} `;
    d += `Q${(cx + Math.cos(mid) * rp).toFixed(1)},${(cy + Math.sin(mid) * rp).toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)} `;
  }
  return d + 'Z';
}

const SEAL_PATH = buildSealPath();
const MONO_L    = 'M40,28 L50,28 L50,60 L66,60 L66,70 L40,70 Z';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  type?:    SealType;
  size:     number;
  /** unique gradient ID suffix — must be unique per page if multiple seals shown */
  gid:      string;
  shadow?:  boolean;
}

export default function WaxSeal({ type = 'vote', size, gid, shadow = true }: Props) {
  const shade = SHADES[type];
  const half  = size / 2;

  return (
    <View
      style={{
        width: size, height: size,
        flexDirection: 'row',
        ...(shadow ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.45,
          shadowRadius: size * 0.18,
          elevation: 6,
        } : {}),
      }}
    >
      {/* LEFT HALF */}
      <Svg width={half} height={size} viewBox="0 0 50 100">
        <Defs>
          <RadialGradient id={`${gid}l`} cx="42" cy="36" r="58" gradientUnits="userSpaceOnUse">
            <Stop offset="0"    stopColor={shade.light} />
            <Stop offset="0.55" stopColor={shade.mid} />
            <Stop offset="0.85" stopColor={shade.dark} />
            <Stop offset="1"    stopColor={shade.deep} />
          </RadialGradient>
        </Defs>
        <Path d={SEAL_PATH} fill={`url(#${gid}l)`} stroke={shade.deep} strokeWidth={1.8} strokeLinejoin="round" />
        <Circle cx="50" cy="50" r="30" stroke={shade.deep}   strokeWidth="2"   fill="none" opacity={0.35} />
        <Circle cx="50" cy="50" r="30" stroke={shade.emboss} strokeWidth="1.2" fill="none" opacity={0.55} translateY={1.2} />
        <Path d={MONO_L} fill={shade.emboss} opacity={0.7}  translateX={0.6} translateY={1.6} />
        <Path d={MONO_L} fill={shade.deep}   opacity={0.78} />
      </Svg>

      {/* RIGHT HALF */}
      <Svg width={half} height={size} viewBox="50 0 50 100">
        <Defs>
          <RadialGradient id={`${gid}r`} cx="42" cy="36" r="58" gradientUnits="userSpaceOnUse">
            <Stop offset="0"    stopColor={shade.light} />
            <Stop offset="0.55" stopColor={shade.mid} />
            <Stop offset="0.85" stopColor={shade.dark} />
            <Stop offset="1"    stopColor={shade.deep} />
          </RadialGradient>
        </Defs>
        <Path d={SEAL_PATH} fill={`url(#${gid}r)`} stroke={shade.deep} strokeWidth={1.8} strokeLinejoin="round" />
        <Circle cx="50" cy="50" r="30" stroke={shade.deep}   strokeWidth="2"   fill="none" opacity={0.35} />
        <Circle cx="50" cy="50" r="30" stroke={shade.emboss} strokeWidth="1.2" fill="none" opacity={0.55} translateY={1.2} />
        <Path d={MONO_L} fill={shade.emboss} opacity={0.7}  translateX={0.6} translateY={1.6} />
        <Path d={MONO_L} fill={shade.deep}   opacity={0.78} />
      </Svg>
    </View>
  );
}
