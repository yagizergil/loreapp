/**
 * Custom SVG city-map illustration for onboarding.
 * Looks like a stylised top-down urban map — streets, blocks, park, no real data.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, {
  Rect, Path, Circle, Line, G, Defs, LinearGradient, Stop, Polygon,
} from 'react-native-svg';

interface Props { width: number; height: number }

export default function CityMap({ width: W, height: H }: Props) {
  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="park" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A3028" />
            <Stop offset="1" stopColor="#142318" />
          </LinearGradient>
          <LinearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0E1E2E" />
            <Stop offset="1" stopColor="#0A1620" />
          </LinearGradient>
        </Defs>

        {/* ── Base ── */}
        <Rect x={0} y={0} width={W} height={H} fill="#12151C" />

        {/* ── Main road grid ── */}

        {/* Horizontal roads */}
        <Rect x={0}       y={H*0.18} width={W} height={9}     fill="#1E2430" />
        <Rect x={0}       y={H*0.18} width={W} height={2}     fill="#2A3040" />
        <Rect x={0}       y={H*0.42} width={W} height={11}    fill="#1E2430" />
        <Rect x={0}       y={H*0.42} width={W} height={2}     fill="#2A3040" />
        <Rect x={0}       y={H*0.68} width={W} height={8}     fill="#1E2430" />
        <Rect x={0}       y={H*0.68} width={W} height={2}     fill="#2A3040" />

        {/* Vertical roads */}
        <Rect x={W*0.22}  y={0} width={10} height={H}         fill="#1E2430" />
        <Rect x={W*0.22}  y={0} width={2}  height={H}         fill="#2A3040" />
        <Rect x={W*0.50}  y={0} width={12} height={H}         fill="#1E2430" />
        <Rect x={W*0.50}  y={0} width={2}  height={H}         fill="#2A3040" />
        <Rect x={W*0.78}  y={0} width={9}  height={H}         fill="#1E2430" />
        <Rect x={W*0.78}  y={0} width={2}  height={H}         fill="#2A3040" />

        {/* Diagonal avenue */}
        <Path
          d={`M ${W*0.12} 0 L ${W*0.46} ${H}`}
          stroke="#1E2430" strokeWidth={9} />
        <Path
          d={`M ${W*0.12} 0 L ${W*0.46} ${H}`}
          stroke="#2A3040" strokeWidth={2} />

        {/* ── City blocks ── */}

        {/* Top-left cluster */}
        <Rect x={W*0.01} y={H*0.02} width={W*0.18} height={H*0.14} rx={3} fill="#171B24" />
        <Rect x={W*0.01} y={H*0.02} width={W*0.10} height={H*0.06} rx={2} fill="#1A1F2B" />
        <Rect x={W*0.12} y={H*0.08} width={W*0.07} height={H*0.08} rx={2} fill="#1A1F2B" />

        {/* Top-center */}
        <Rect x={W*0.27} y={H*0.02} width={W*0.20} height={H*0.14} rx={3} fill="#171B24" />
        <Rect x={W*0.27} y={H*0.02} width={W*0.09} height={H*0.10} rx={2} fill="#1C2030" />
        <Rect x={W*0.38} y={H*0.04} width={W*0.09} height={H*0.12} rx={2} fill="#191E2A" />

        {/* Top-right */}
        <Rect x={W*0.55} y={H*0.02} width={W*0.21} height={H*0.14} rx={3} fill="#171B24" />
        <Rect x={W*0.55} y={H*0.02} width={W*0.13} height={H*0.08} rx={2} fill="#1A1F2B" />
        <Rect x={W*0.64} y={H*0.06} width={W*0.12} height={H*0.10} rx={2} fill="#1C2030" />

        {/* Park (center-left) */}
        <Rect x={W*0.01} y={H*0.22} width={W*0.18} height={H*0.18} rx={4} fill="url(#park)" />
        <Circle cx={W*0.05} cy={H*0.26} r={6} fill="#1E3A28" />
        <Circle cx={W*0.10} cy={H*0.28} r={9} fill="#1E3A28" />
        <Circle cx={W*0.15} cy={H*0.25} r={6} fill="#1A3022" />
        <Circle cx={W*0.07} cy={H*0.33} r={7} fill="#1A3022" />
        <Circle cx={W*0.14} cy={H*0.34} r={5} fill="#1E3A28" />
        {/* Park path */}
        <Path d={`M ${W*0.02} ${H*0.36} Q ${W*0.10} ${H*0.30} ${W*0.18} ${H*0.36}`}
          stroke="#223828" strokeWidth={2} fill="none" />

        {/* Center blocks */}
        <Rect x={W*0.27} y={H*0.22} width={W*0.20} height={H*0.18} rx={3} fill="#171B24" />
        <Rect x={W*0.27} y={H*0.22} width={W*0.11} height={H*0.10} rx={2} fill="#1C2030" />
        <Rect x={W*0.27} y={H*0.33} width={W*0.20} height={H*0.06} rx={2} fill="#191E2A" />
        <Rect x={W*0.39} y={H*0.22} width={W*0.08} height={H*0.18} rx={2} fill="#1A1F2B" />

        {/* Small water feature (top-right corner) */}
        <Rect x={W*0.82} y={H*0.02} width={W*0.18} height={H*0.14} rx={4} fill="url(#water)" />
        <Path d={`M ${W*0.82} ${H*0.07} Q ${W*0.88} ${H*0.05} ${W*0.94} ${H*0.09} Q ${W*1.0} ${H*0.07} ${W*1.0} ${H*0.10}`}
          stroke="#1A2C3A" strokeWidth={2} fill="none" opacity={0.6} />

        {/* Mid-right blocks */}
        <Rect x={W*0.55} y={H*0.22} width={W*0.21} height={H*0.18} rx={3} fill="#171B24" />
        <Rect x={W*0.55} y={H*0.22} width={W*0.10} height={H*0.11} rx={2} fill="#1C2030" />
        <Rect x={W*0.55} y={H*0.34} width={W*0.21} height={H*0.06} rx={2} fill="#191E2A" />
        <Rect x={W*0.67} y={H*0.22} width={W*0.09} height={H*0.18} rx={2} fill="#1A1F2B" />

        {/* Far-right column */}
        <Rect x={W*0.82} y={H*0.22} width={W*0.18} height={H*0.18} rx={3} fill="#171B24" />
        <Rect x={W*0.82} y={H*0.22} width={W*0.09} height={H*0.18} rx={2} fill="#1A1F2B" />

        {/* Bottom-left */}
        <Rect x={W*0.01} y={H*0.46} width={W*0.18} height={H*0.20} rx={3} fill="#171B24" />
        <Rect x={W*0.01} y={H*0.46} width={W*0.18} height={H*0.09} rx={2} fill="#1A1F2B" />
        <Rect x={W*0.01} y={H*0.56} width={W*0.10} height={H*0.10} rx={2} fill="#1C2030" />
        <Rect x={W*0.12} y={H*0.56} width={W*0.07} height={H*0.10} rx={2} fill="#191E2A" />

        {/* Bottom-center */}
        <Rect x={W*0.27} y={H*0.46} width={W*0.20} height={H*0.20} rx={3} fill="#171B24" />
        <Rect x={W*0.27} y={H*0.46} width={W*0.20} height={H*0.10} rx={2} fill="#1A1F2B" />
        <Rect x={W*0.27} y={H*0.57} width={W*0.09} height={H*0.09} rx={2} fill="#1C2030" />
        <Rect x={W*0.38} y={H*0.57} width={W*0.09} height={H*0.09} rx={2} fill="#191E2A" />

        {/* Bottom-right */}
        <Rect x={W*0.55} y={H*0.46} width={W*0.21} height={H*0.20} rx={3} fill="#171B24" />
        <Rect x={W*0.82} y={H*0.46} width={W*0.18} height={H*0.20} rx={3} fill="#171B24" />

        {/* Bottom strip */}
        <Rect x={W*0.01} y={H*0.72} width={W*0.96} height={H*0.26} rx={3} fill="#171B24" />
        <Rect x={W*0.01} y={H*0.72} width={W*0.44} height={H*0.13} rx={2} fill="#1A1F2B" />
        <Rect x={W*0.01} y={H*0.86} width={W*0.44} height={H*0.12} rx={2} fill="#191E2A" />
        <Rect x={W*0.48} y={H*0.72} width={W*0.49} height={H*0.13} rx={2} fill="#1C2030" />
        <Rect x={W*0.48} y={H*0.86} width={W*0.49} height={H*0.12} rx={2} fill="#1A1F2B" />

        {/* ── Road dashes ── */}
        {[0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72, 0.80, 0.88, 0.96].map((x, i) => (
          <Rect key={i} x={W*x} y={H*0.42+4} width={W*0.04} height={2} fill="#2E3545" opacity={0.6} />
        ))}
        {[0.06, 0.14, 0.22, 0.30, 0.38, 0.52, 0.60, 0.68, 0.84, 0.92].map((y, i) => (
          <Rect key={i} x={W*0.50+5} y={H*y} width={2} height={H*0.04} fill="#2E3545" opacity={0.6} />
        ))}

        {/* ── Intersection circles ── */}
        {[
          [0.22, 0.18], [0.50, 0.18], [0.78, 0.18],
          [0.22, 0.42], [0.50, 0.42], [0.78, 0.42],
          [0.22, 0.68], [0.50, 0.68], [0.78, 0.68],
        ].map(([x, y], i) => (
          <Circle key={i} cx={W*x} cy={H*y} r={4} fill="#232A38" stroke="#2E3848" strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}
