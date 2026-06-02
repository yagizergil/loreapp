import { useMemo, useRef } from 'react';
import Supercluster from 'supercluster';
import { Question } from '../lib/supabase';
import { getQuestionBadge, badgePriority } from '../lib/questionBadge';

export interface ClusterItem {
  type:          'cluster';
  id:            number;
  lat:           number;
  lng:           number;
  count:         number;
  expansionZoom: number;
  questions:     Question[];
  topQuestion:   Question;
}

export interface PinItem {
  type:     'pin';
  question: Question;
}

export type MapItem = ClusterItem | PinItem;

function regionToZoom(latDelta: number): number {
  return Math.max(0, Math.min(19, Math.floor(Math.log2(360 / latDelta))));
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function useClusteredQuestions(
  questions: Question[],
  region: Region,
): MapItem[] {
  // One supercluster instance per hook instance — no module-level singleton.
  const sc = useRef(new Supercluster<{ questionId: string }>({ radius: 20, maxZoom: 19, minZoom: 0 }));

  // Track the last loaded question set to avoid redundant sc.load() calls.
  const lastQuestionsRef = useRef<Question[]>([]);

  return useMemo(() => {
    if (questions.length === 0) return [];

    // Only reload if the question array reference changed.
    if (lastQuestionsRef.current !== questions) {
      lastQuestionsRef.current = questions;
      sc.current.load(
        questions.map((q) => ({
          type:       'Feature' as const,
          properties: { questionId: q.id },
          geometry:   { type: 'Point' as const, coordinates: [q.lng, q.lat] },
        }))
      );
    }

    const zoom = regionToZoom(region.latitudeDelta);
    if (zoom < 11) return [];

    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude  - region.latitudeDelta  / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude  + region.latitudeDelta  / 2,
    ];

    const clusters = sc.current.getClusters(bbox, zoom);
    const qMap = new Map(questions.map((q) => [q.id, q]));

    return clusters.map((c): MapItem => {
      const props = c.properties as any;

      if (props.cluster) {
        const leaves = sc.current.getLeaves(props.cluster_id, Infinity) as any[];
        const clusterQuestions = leaves
          .map((l: any) => qMap.get(l.properties.questionId))
          .filter((q): q is Question => !!q);

        const sorted = [...clusterQuestions].sort((a, b) => {
          const bp = badgePriority(getQuestionBadge(b)) - badgePriority(getQuestionBadge(a));
          if (bp !== 0) return bp;
          const ac = b.answer_count - a.answer_count;
          if (ac !== 0) return ac;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return {
          type:          'cluster',
          id:            props.cluster_id,
          lat:           c.geometry.coordinates[1],
          lng:           c.geometry.coordinates[0],
          count:         props.point_count,
          expansionZoom: sc.current.getClusterExpansionZoom(props.cluster_id),
          questions:     sorted,
          topQuestion:   sorted[0],
        };
      }

      return {
        type:     'pin',
        question: qMap.get(props.questionId)!,
      };
    });
  }, [questions, region.latitude, region.longitude, region.latitudeDelta]);
}
