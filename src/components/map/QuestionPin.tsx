/**
 * QuestionPin — Wax-seal map marker.
 *
 * tracksViewChanges rules (prevents ALL glitches):
 *   • Starts TRUE so the map captures the initial render correctly.
 *   • Set to FALSE after 180ms — pin is frozen as a native snapshot.
 *   • Re-enabled for 220ms ONLY when visual state actually changes
 *     (answered / locked / viewed). Map re-snapshots new appearance, freezes.
 *   • Never re-enabled on zoom changes — eliminates mass-flicker on pinch.
 *
 * NO Reanimated inside Markers. Reanimated runs on the UI thread and bypasses
 * the React reconciler, so the map's snapshot mechanism cannot see those
 * animation frames — it captures opacity=0 and freezes it (the original bug).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { Question } from '../../lib/supabase';
import { getQuestionBadge } from '../../lib/questionBadge';
import { palette, fontFamily } from '../../theme/tokens';
import { SealHalf, TYPE_SHADE, MINE_SHADE, FALLBACK_SHADE } from './SealMark';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  question:     Question;
  onPress:      () => void;
  zoom?:        number; // kept for API compat but pin size is now fixed
  /** When this pin represents a cluster, the total number of questions
   *  grouped into it — shown as a numeric badge, not just a decorative
   *  "there's more" hint, so density is actually legible at a glance. */
  extraCount?:  number;
  locked?:      boolean;
  mine?:        boolean; // kullanıcının kendi sorduğu soru → sarı mühür
  viewed?:      boolean;
  coordOffset?: { dLat: number; dLng: number };
  refreshKey?:  number; // increments when modal closes — forces a re-snapshot
  /** "Wax Seal Reputation" — an extra outer ring in the author's karma-tier
   *  color (see src/lib/karma.ts), only passed for premium authors who've
   *  earned 'trusted' or above. Mirrors the same premium-gated tier badge
   *  already shown on the author's own Profile screen — the ring is the
   *  map's version of that earned status, not a new parallel system. */
  reputationColor?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PIN_SIZE      = 30; // fixed — no zoom dependence, eliminates mass-retrack on pinch
const PIN_SIZE_LG   = 35; // hot / popular / new

export default function QuestionPin({
  question, onPress,
  extraCount = 0,
  locked  = false,
  mine    = false,
  viewed  = false,
  coordOffset,
  refreshKey = 0,
  reputationColor,
}: Props) {
  const mounted = useRef(true);

  // tracksViewChanges — starts true so map gets a correct initial snapshot,
  // then set to false. Only re-enabled on actual visual state changes.
  const [tracks, setTracks] = useState(true);

  // ── Mount: freeze after first snapshot ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { if (mounted.current) setTracks(false); }, 180);
    return () => {
      clearTimeout(t);
      mounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── State changes: re-snapshot for 220ms ──────────────────────────────────
  // reputationColor resolves asynchronously (a batch fetch after the pins
  // already mounted), so it's included here — otherwise the reputation ring
  // would be drawn but never re-snapshotted onto the frozen native marker.
  const prevStateKey = useRef(`${mine}|${locked}|${viewed}|${reputationColor ?? ''}`);
  useEffect(() => {
    const next = `${mine}|${locked}|${viewed}|${reputationColor ?? ''}`;
    if (prevStateKey.current === next) return;
    prevStateKey.current = next;
    if (!mounted.current) return;
    setTracks(true);
    const t = setTimeout(() => { if (mounted.current) setTracks(false); }, 220);
    return () => clearTimeout(t);
  }, [mine, locked, viewed, reputationColor]);

  // ── Modal-close refresh: iOS invalidates the marker layer cache on modal
  //    dismiss. Re-enable tracking for 400ms so the map can re-snapshot.
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKey.current === refreshKey) return;
    prevRefreshKey.current = refreshKey;
    if (!mounted.current) return;
    setTracks(true);
    const t = setTimeout(() => { if (mounted.current) setTracks(false); }, 400);
    return () => clearTimeout(t);
  }, [refreshKey]);

  // ── Press ─────────────────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  }, [onPress]);

  // ── Visual state ──────────────────────────────────────────────────────────
  const badge    = mine ? null : getQuestionBadge(question);
  const isLarge  = badge === 'hot' || badge === 'popular' || badge === 'new';
  const SIZE     = isLarge ? PIN_SIZE_LG : PIN_SIZE;
  const halfW    = SIZE / 2;
  const shade    = mine
    ? MINE_SHADE
    : (TYPE_SHADE[question.type] ?? FALLBACK_SHADE);
  const alpha    = viewed ? 0.55 : locked ? 0.70 : 1.0;
  const crackGap = viewed && !mine ? 3 : 0;
  const wrapSize = SIZE + 18;

  // Deterministic gradient IDs from question UUID — no collisions
  const qHash = question.id.replace(/-/g, '').slice(0, 12);
  const gidL  = `L${qHash}`;
  const gidR  = `R${qHash}`;

  const lat = question.lat + (coordOffset?.dLat ?? 0);
  const lng = question.lng + (coordOffset?.dLng ?? 0);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={handlePress}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.wrap, { width: wrapSize, height: wrapSize }]}>

        {/* Seal */}
        <View style={[styles.sealRow, {
          opacity:       alpha,
          shadowRadius:  SIZE * 0.22,
        }]}>
          <SealHalf side="left"  w={halfW} h={SIZE} gid={gidL} shade={shade} />
          {crackGap > 0 && <View style={{ width: crackGap }} />}
          <SealHalf side="right" w={halfW} h={SIZE} gid={gidR} shade={shade} />
        </View>

        {/* Cluster count badge — the actual number, not a decorative hint */}
        {extraCount > 0 && (
          <View style={[
            styles.clusterBadge,
            { right: halfW - 10, backgroundColor: locked ? palette.ink60 : palette.accent },
          ]}>
            <Text style={styles.clusterBadgeText} numberOfLines={1}>
              {extraCount > 99 ? '99+' : extraCount}
            </Text>
          </View>
        )}

        {/* Locked ring */}
        {locked && (
          <View style={[styles.ring, {
            width:        SIZE + 7,
            height:       SIZE + 7,
            borderRadius: (SIZE + 7) / 2,
            borderColor:  shade.dark + '88',
          }]} />
        )}

        {/* Hot / popular ring */}
        {isLarge && !locked && (
          <View style={[styles.ring, {
            width:        SIZE + 8,
            height:       SIZE + 8,
            borderRadius: (SIZE + 8) / 2,
            borderColor:  shade.mid + '55',
          }]} />
        )}

        {/* Wax Seal Reputation ring — sits outside the other two so a
            locked or hot/popular pin can still show it at the same time. */}
        {reputationColor && (
          <View style={[styles.ring, {
            width:        SIZE + 12,
            height:       SIZE + 12,
            borderRadius: (SIZE + 12) / 2,
            borderWidth:  2,
            borderColor:  reputationColor,
          }]} />
        )}

      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:      'center',
    justifyContent:  'center',
  },
  sealRow: {
    flexDirection:   'row',
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.5,
    elevation:       6,
  },
  ring: {
    position:        'absolute',
    borderWidth:     1.5,
    backgroundColor: 'transparent',
  },
  clusterBadge: {
    position:          'absolute',
    top:               -4,
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
    borderWidth:       1.5,
    borderColor:       '#0B0D12',
  },
  clusterBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize:   10,
    lineHeight: 12,
    color:      '#fff',
  },
});
