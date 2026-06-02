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
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { Question } from '../../lib/supabase';
import { getQuestionBadge } from '../../lib/questionBadge';
import { SealHalf, TYPE_SHADE, MINE_SHADE, FALLBACK_SHADE } from './SealMark';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  question:     Question;
  onPress:      () => void;
  zoom?:        number; // kept for API compat but pin size is now fixed
  extraCount?:  number;
  locked?:      boolean;
  mine?:        boolean; // kullanıcının kendi sorduğu soru → sarı mühür
  viewed?:      boolean;
  coordOffset?: { dLat: number; dLng: number };
  refreshKey?:  number; // increments when modal closes — forces a re-snapshot
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
  const prevStateKey = useRef(`${mine}|${locked}|${viewed}`);
  useEffect(() => {
    const next = `${mine}|${locked}|${viewed}`;
    if (prevStateKey.current === next) return;
    prevStateKey.current = next;
    if (!mounted.current) return;
    setTracks(true);
    const t = setTimeout(() => { if (mounted.current) setTracks(false); }, 220);
    return () => clearTimeout(t);
  }, [mine, locked, viewed]);

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

        {/* Cluster dot indicator */}
        {extraCount > 0 && !locked && (
          <View style={[styles.clusterBadge, { right: halfW - 6 }]}>
            <View style={styles.clusterDot} />
            <View style={styles.clusterDot} />
            <View style={styles.clusterDot} />
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
    position:        'absolute',
    bottom:          2,
    flexDirection:   'row',
    gap:             2,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius:    5,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  clusterDot: {
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: '#fff',
    opacity:         0.9,
  },
});
